<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $q = NotificationLog::where('user_id', $request->user()->id);

        if ($request->boolean('unread')) {
            $q->whereNull('read_at');
        }
        if ($request->filled('type')) {
            $q->where('type', $request->string('type'));
        }
        if ($request->filled('channel')) {
            $q->where('channel', $request->string('channel'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    /** Delivery channels this deployment supports, and whether they are usable. */
    public function channels(Request $request, NotificationService $notifications)
    {
        $user = $request->user();

        $channels = collect($notifications->availableChannels())
            ->mapWithKeys(fn (string $name) => [
                $name => [
                    'enabled' => $notifications->isChannelEnabled($name),
                    'opted_in' => (bool) ($user->{"notify_{$name}"} ?? false),
                ],
            ]);

        return response()->json([
            'channels' => $channels,
            'has_phone' => filled($user->phone),
            'has_telegram_chat_id' => filled($user->telegram_chat_id),
        ]);
    }

    /** Let a user store their contact details and channel opt-ins. */
    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'phone' => 'sometimes|nullable|string|max:32',
            'telegram_chat_id' => 'sometimes|nullable|string|max:64',
            'notify_sms' => 'sometimes|boolean',
            'notify_telegram' => 'sometimes|boolean',
        ]);

        $user = $request->user();
        $user->fill($data);
        $user->save();

        return response()->json($user->fresh());
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => NotificationLog::where('user_id', $request->user()->id)
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    public function markRead(Request $request, NotificationLog $notification)
    {
        abort_unless((int) $notification->user_id === (int) $request->user()->id, 403);

        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }

    public function markAllRead(Request $request)
    {
        $updated = NotificationLog::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['updated' => $updated]);
    }
}
