<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DisciplineRecord;
use App\Models\ParentModel;
use App\Models\Student;
use App\Services\NotificationService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class DisciplineController extends Controller
{
    use LogsActivity;

    public const CATEGORIES = [
        'conduct', 'punctuality', 'uniform', 'homework', 'participation',
        'respect', 'attendance', 'property', 'bullying', 'other',
    ];

    /**
     * The behaviour log. Staff see every student; a parent only ever sees the
     * records of their own children.
     */
    public function index(Request $request)
    {
        $q = DisciplineRecord::query()->with(['student:id,first_name,last_name,admission_no', 'recorder:id,name']);

        $this->scopeToViewer($q, $request);

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('type')) {
            $q->where('type', $request->string('type'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('category')) {
            $q->where('category', $request->string('category'));
        }
        if ($request->filled('term_id')) {
            $q->where('term_id', $request->integer('term_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('occurred_on', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('occurred_on', '<=', $request->date('to'));
        }

        return response()->json(
            $q->orderByDesc('occurred_on')->orderByDesc('id')
                ->paginate($request->integer('per_page', 20))
        );
    }

    /** Merit/demerit balance per student — the number a staff room or report card needs. */
    public function summary(Request $request)
    {
        $q = DisciplineRecord::query();

        // A parent only ever sees their own children, here as everywhere else.
        if ($request->user()->parentProfile) {
            $q->whereIn('student_id', $request->user()->parentProfile->students()->pluck('students.id'));
        }

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('grade_id')) {
            $q->whereHas('student', fn ($s) => $s->where('grade_id', $request->integer('grade_id')));
        }
        if ($request->filled('term_id')) {
            $q->where('term_id', $request->integer('term_id'));
        }

        $rows = $q->selectRaw('student_id, type, status, points, count(*) as total')
            ->groupBy('student_id', 'type', 'status', 'points')
            ->get();

        $byStudent = $rows->groupBy('student_id')->map(function (Collection $group) {
            $merit = 0;
            $demerit = 0;
            $counts = ['merit' => 0, 'demerit' => 0, 'incident' => 0, 'note' => 0];

            foreach ($group as $row) {
                $counts[$row->type] = ($counts[$row->type] ?? 0) + (int) $row->total;
                if ($row->type === 'merit') {
                    $merit += (int) $row->points * (int) $row->total;
                }
                if ($row->type === 'demerit') {
                    $demerit += abs((int) $row->points) * (int) $row->total;
                }
            }

            return [
                'merit_points' => $merit,
                'demerit_points' => $demerit,
                'balance' => $merit - $demerit,
                'merits' => $counts['merit'],
                'demerits' => $counts['demerit'],
                'incidents' => $counts['incident'],
                'open' => (int) $group->where('status', 'open')->sum('total'),
            ];
        });

        $students = Student::whereIn('id', $byStudent->keys())
            ->get(['id', 'first_name', 'last_name', 'admission_no'])
            ->keyBy('id');

        return response()->json(
            $byStudent->map(fn ($summary, $studentId) => [
                'student_id' => (int) $studentId,
                'student_name' => optional($students->get($studentId))->first_name.' '.optional($students->get($studentId))->last_name,
                'admission_no' => optional($students->get($studentId))->admission_no,
            ] + (array) $summary
            )->sortByDesc('balance')->values()
        );
    }

    public function store(Request $request, NotificationService $notifications)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'term_id' => 'nullable|exists:terms,id',
            'type' => 'required|in:merit,demerit,incident,note',
            'category' => ['nullable', Rule::in(self::CATEGORIES)],
            'severity' => 'nullable|integer|between:1,5',
            'points' => 'nullable|integer|between:-100,100',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'occurred_on' => 'nullable|date',
        ]);

        $record = DisciplineRecord::create([
            'student_id' => $data['student_id'],
            'term_id' => $data['term_id'] ?? null,
            'recorded_by' => $request->user()->id,
            'type' => $data['type'],
            'category' => $data['category'] ?? 'conduct',
            'severity' => $data['severity'] ?? null,
            'points' => $data['points'] ?? $this->derivePoints($data['type'], $data['severity'] ?? 1),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'occurred_on' => $data['occurred_on'] ?? now()->toDateString(),
            'status' => 'open',
        ]);

        self::logActivity('discipline.record', $record, null, $record);

        // A demerit or a serious incident is news for the family.
        if (in_array($record->type, ['demerit', 'incident'], true)) {
            $this->notifyGuardians($notifications, $record);
        }

        return response()->json($record->load(['student', 'recorder']), 201);
    }

    public function update(Request $request, DisciplineRecord $record)
    {
        $old = $record->only(['type', 'category', 'severity', 'points', 'title', 'description', 'status']);

        $data = $request->validate([
            'type' => 'sometimes|in:merit,demerit,incident,note',
            'category' => ['sometimes', Rule::in(self::CATEGORIES)],
            'severity' => 'nullable|integer|between:1,5',
            'points' => 'nullable|integer|between:-100,100',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:2000',
            'status' => 'sometimes|in:open,resolved,appealed',
            'term_id' => 'nullable|exists:terms,id',
        ]);

        $record->fill($data);
        // Keep the score consistent when the type changes but no points were given.
        if (! array_key_exists('points', $data) && array_key_exists('type', $data)) {
            $record->points = $this->derivePoints($record->type, $record->severity ?? 1);
        }
        $record->save();

        self::logActivity('discipline.edit', $record, $old, $record->fresh());

        return response()->json($record->fresh()->load(['student', 'recorder']));
    }

    /** Close a record off, or mark that the family has appealed it. */
    public function resolve(Request $request, DisciplineRecord $record, NotificationService $notifications)
    {
        $data = $request->validate([
            'status' => 'required|in:resolved,appealed',
            'resolution' => 'nullable|string|max:2000',
        ]);

        $record->update([
            'status' => $data['status'],
            'resolution' => $data['resolution'] ?? null,
            'resolved_at' => now(),
            'resolved_by' => $request->user()->id,
        ]);

        self::logActivity('discipline.resolve', $record, ['status' => 'open'], $record->fresh());

        $this->notifyGuardians($notifications, $record->fresh());

        return response()->json($record->fresh()->load(['student', 'resolver']));
    }

    public function destroy(DisciplineRecord $record)
    {
        $old = $record->only(['student_id', 'type', 'title']);
        $record->delete();
        self::logActivity('discipline.delete', $record, $old);

        return response()->json(['message' => 'Record removed.']);
    }

    /** Merits score positively, demerits against the severity of the incident. */
    private function derivePoints(string $type, int $severity): int
    {
        return match ($type) {
            'merit' => 1,
            'demerit' => -$severity,
            default => 0,
        };
    }

    /**
     * Restrict the log to the children of a parent account. Staff pass through
     * untouched, and a parent cannot ask for somebody else's child.
     */
    private function scopeToViewer($query, Request $request): void
    {
        $user = $request->user();

        if (! $user->parentProfile) {
            return;
        }

        $childIds = $user->parentProfile->students()->pluck('students.id');

        $requested = $request->integer('student_id');
        if ($requested && $childIds->contains($requested)) {
            $query->where('student_id', $requested);

            return;
        }

        $query->whereIn('student_id', $childIds);
    }

    private function notifyGuardians(NotificationService $notifications, DisciplineRecord $record): void
    {
        $student = $record->student;
        abort_unless($student, 404);

        $guardians = ParentModel::whereIn('id', $student->parents()->pluck('parents.id'))
            ->whereNotNull('user_id')
            ->get();

        $title = $record->type === 'merit'
            ? "Merit recorded for {$student->first_name} {$student->last_name}"
            : "Behaviour notice for {$student->first_name} {$student->last_name}";

        $body = $record->type === 'merit'
            ? "{$record->title} ({$record->category})."
            : "{$record->title} ({$record->category}). Please contact the school to discuss this.";

        foreach ($guardians as $guardian) {
            $notifications->send(
                $guardian->user,
                'discipline',
                $title,
                $record->status === 'resolved' ? $body.' This has since been resolved.' : $body,
                'database',
                $record
            );
        }
    }
}
