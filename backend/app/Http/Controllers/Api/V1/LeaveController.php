<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SchoolSetting;
use App\Services\NotificationService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class LeaveController extends Controller
{
    use LogsActivity;

    public function types()
    {
        return response()->json(
            LeaveType::where('is_active', true)->orderBy('label')->get([
                'id', 'name', 'label', 'quota_days', 'is_paid', 'requires_document',
            ])
        );
    }

    public function storeType(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40', 'regex:/^[a-z0-9_]+$/', Rule::unique('leave_types', 'name')],
            'label' => 'required|string|max:80',
            'quota_days' => 'nullable|integer|between:0,365',
            'is_paid' => 'sometimes|boolean',
            'requires_document' => 'sometimes|boolean',
        ]);

        $type = LeaveType::create([
            'name' => $data['name'],
            'label' => $data['label'],
            'quota_days' => $data['quota_days'] ?? 0,
            'is_paid' => $data['is_paid'] ?? true,
            'requires_document' => $data['requires_document'] ?? false,
        ]);

        self::logActivity('leave.type_create', $type, null, $type);

        return response()->json($type, 201);
    }

    /**
     * The leave register. A person always sees their own requests; anyone who
     * can approve leave also sees the whole staff queue.
     */
    public function index(Request $request)
    {
        $q = LeaveRequest::query()->with(['user:id,name,email', 'leaveType:id,label,is_paid', 'decider:id,name']);

        if (! $request->user()->can('leave.approve')) {
            $q->where('user_id', $request->user()->id);
        } elseif ($request->filled('user_id')) {
            $q->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('leave_type_id')) {
            $q->where('leave_type_id', $request->integer('leave_type_id'));
        }
        if ($request->filled('mine')) {
            $q->where('user_id', $request->user()->id);
        }

        return response()->json(
            $q->orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
                ->orderByDesc('start_date')
                ->paginate($request->integer('per_page', 20))
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'leave_type_id' => 'required|exists:leave_types,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:2000',
        ]);

        $type = LeaveType::findOrFail($data['leave_type_id']);
        abort_if(! $type->is_active, 422, 'That leave type is no longer offered.');

        $days = $this->workingDays(
            Carbon::parse($data['start_date']),
            Carbon::parse($data['end_date'])
        );
        abort_if($days < 1, 422, 'The selected range contains no working days.');

        // Nobody may book two overlapping requests, whatever the outcome of the first.
        $clash = LeaveRequest::where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();
        abort_if($clash, 422, 'You already have a leave request covering those dates.');

        $request_ = LeaveRequest::create([
            'user_id' => $request->user()->id,
            'leave_type_id' => $type->id,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'days' => $days,
            'reason' => $data['reason'] ?? null,
            'status' => 'pending',
        ]);

        self::logActivity('leave.request', $request_, null, $request_);

        return response()->json($request_->load(['leaveType']), 201);
    }

    /** Approve or decline a pending request. */
    public function decide(Request $request, LeaveRequest $leaveRequest, NotificationService $notifications)
    {
        abort_if($leaveRequest->isPending() === false, 422, 'That request has already been decided.');

        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'decision_note' => 'nullable|string|max:2000',
        ]);

        $leaveRequest->update([
            'status' => $data['status'],
            'decision_note' => $data['decision_note'] ?? null,
            'decided_by' => $request->user()->id,
            'decided_at' => now(),
        ]);

        self::logActivity('leave.decide', $leaveRequest, ['status' => 'pending'], $leaveRequest->fresh());

        $applicant = $leaveRequest->user;
        if ($applicant) {
            $approved = $data['status'] === 'approved';
            $notifications->send(
                $applicant,
                'leave',
                $approved ? 'Leave approved' : 'Leave declined',
                sprintf(
                    'Your %s leave of %d day(s) from %s was %s.',
                    strtolower((string) $leaveRequest->leaveType?->label),
                    $leaveRequest->days,
                    $leaveRequest->start_date->toFormattedDateString(),
                    $approved ? 'approved' : 'declined'
                ),
                'database',
                $leaveRequest
            );
        }

        return response()->json($leaveRequest->fresh()->load(['user', 'leaveType', 'decider']));
    }

    /** Withdraw a request of your own before anybody decides it. */
    public function cancel(Request $request, LeaveRequest $leaveRequest)
    {
        abort_if($leaveRequest->user_id !== $request->user()->id, 403);
        abort_if($leaveRequest->isPending() === false, 422, 'Only a pending request can be withdrawn.');

        $leaveRequest->update([
            'status' => 'cancelled',
            'decided_by' => $request->user()->id,
            'decided_at' => now(),
        ]);

        self::logActivity('leave.cancel', $leaveRequest, ['status' => 'pending'], $leaveRequest->fresh());

        return response()->json($leaveRequest->fresh()->load(['leaveType']));
    }

    public function destroy(LeaveRequest $leaveRequest)
    {
        $old = $leaveRequest->only(['user_id', 'status']);
        $leaveRequest->delete();
        self::logActivity('leave.delete', $leaveRequest, $old);

        return response()->json(['message' => 'Leave request removed.']);
    }

    /**
     * Days actually off work: weekends are not counted against the allowance,
     * and a public holiday is skipped when one has been registered.
     */
    private function workingDays(Carbon $start, Carbon $end): int
    {
        $holidays = $this->holidays($start, $end);
        $days = 0;
        $cursor = $start->copy();

        while ($cursor->lessThanOrEqualTo($end)) {
            if (! $cursor->isWeekend() && ! in_array($cursor->toDateString(), $holidays, true)) {
                $days++;
            }
            $cursor->addDay();
        }

        return $days;
    }

    /** @return array<int, string> */
    private function holidays(Carbon $start, Carbon $end): array
    {
        // Public holidays are a single settings entry holding a JSON list of dates.
        $raw = SchoolSetting::where('key', 'school_holidays')->value('value');
        if (blank($raw)) {
            return [];
        }

        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($decoded)) {
            return [];
        }

        return collect($decoded)
            ->map(fn ($row) => is_array($row) ? ($row['date'] ?? null) : $row)
            ->filter()
            ->filter(fn ($date) => $date >= $start->toDateString() && $date <= $end->toDateString())
            ->values()
            ->all();
    }
}
