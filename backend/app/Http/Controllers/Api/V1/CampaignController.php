<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Grade;
use App\Models\NotificationCampaign;
use App\Models\Section;
use App\Services\CommunicationService;
use App\Services\NotificationService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CampaignController extends Controller
{
    use LogsActivity;

    public function __construct(protected CommunicationService $audiences) {}

    /** Every target that can be messaged, with how many people it reaches. */
    public function audienceOptions(Request $request, NotificationService $notifications)
    {
        return response()->json([
            'options' => $this->audiences->audienceOptions(),
            'channels' => collect($notifications->availableChannels())->mapWithKeys(
                fn (string $name) => [$name => $notifications->isChannelEnabled($name)]
            ),
        ]);
    }

    public function index(Request $request)
    {
        return response()->json(
            NotificationCampaign::query()
                ->with(['grade:id,name', 'section:id,name', 'sender:id,name'])
                ->latest()
                ->paginate($request->integer('per_page', 20))
        );
    }

    /**
     * Send a message to a chosen audience across the channels they receive.
     * The in-app feed is always included; the campaign is also posted to the
     * noticeboard so it is visible on the public site.
     */
    public function store(Request $request, NotificationService $notifications)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:5000',
            'audience' => ['required', Rule::in(CommunicationService::AUDIENCES)],
            'grade_id' => 'nullable|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'role' => 'nullable|string|max:60',
            'channels' => 'nullable|array',
            'channels.*' => ['string', Rule::in(['database', 'sms', 'telegram'])],
        ]);

        // A target that names nothing must not silently go to the whole school.
        if ($data['audience'] === 'grade' && blank($data['grade_id'] ?? null)) {
            return response()->json(['message' => 'Choose which grade to write to.'], 422);
        }
        if ($data['audience'] === 'section' && blank($data['section_id'] ?? null)) {
            return response()->json(['message' => 'Choose which class to write to.'], 422);
        }
        if ($data['audience'] === 'staff' && blank($data['role'] ?? null)) {
            return response()->json(['message' => 'Choose which department to write to.'], 422);
        }

        $recipients = $this->audiences->recipients($data);

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'That audience has nobody to reach yet.'], 422);
        }

        $channels = array_values(array_filter($data['channels'] ?? []));

        $campaign = NotificationCampaign::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'audience' => $data['audience'],
            'label' => $this->labelFor($data, $recipients->count()),
            'grade_id' => $data['grade_id'] ?? null,
            'section_id' => $data['section_id'] ?? null,
            'role' => $data['role'] ?? null,
            'channels' => $channels ?: ['database'],
            'recipients_count' => $recipients->count(),
            'sent_by' => $request->user()->id,
            'sent_at' => now(),
        ]);

        $delivered = 0;
        $failed = 0;

        foreach ($recipients as $recipient) {
            $logs = $notifications->sendMany(
                $recipient,
                'campaign',
                $data['title'],
                $data['body'],
                $channels ?: ['database'],
                $campaign
            );

            foreach ($logs as $log) {
                $log->status === 'sent' ? $delivered++ : $failed++;
            }
        }

        $campaign->update(['delivered_count' => $delivered, 'failed_count' => $failed]);

        // The same words go on the noticeboard.
        Announcement::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'audience' => $data['audience'].(isset($data['role']) ? ':'.$data['role'] : ''),
            'grade_id' => $data['grade_id'] ?? null,
            'created_by' => $request->user()->id,
            'status' => 'published',
            'published_at' => now(),
        ]);

        self::logActivity('campaign.send', $campaign, null, [
            'recipients' => $recipients->count(),
            'delivered' => $delivered,
            'failed' => $failed,
        ]);

        return response()->json($campaign->fresh()->load(['sender', 'grade', 'section']), 201);
    }

    public function show(NotificationCampaign $campaign)
    {
        return response()->json($campaign->load(['sender', 'grade', 'section']));
    }

    public function destroy(NotificationCampaign $campaign)
    {
        $old = $campaign->only(['title', 'recipients_count']);
        // Messages already delivered to families stay delivered.
        $campaign->delete();
        self::logActivity('campaign.delete', $campaign, $old);

        return response()->json(['message' => 'Campaign record removed.']);
    }

    private function labelFor(array $data, int $count): string
    {
        return match ($data['audience']) {
            'all_parents' => 'All parents',
            'grade' => optional(Grade::find($data['grade_id'] ?? null))->name,
            'section' => (function () use ($data) {
                $section = Section::with('grade')->find($data['section_id'] ?? null);

                return $section ? $section->grade?->name.' — '.$section->name : null;
            })(),
            'staff' => str_replace('_', ' ', (string) ($data['role'] ?? 'staff')),
            default => null,
        };
    }
}
