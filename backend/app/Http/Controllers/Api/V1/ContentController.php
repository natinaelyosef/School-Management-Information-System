<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContactInquiry;
use App\Models\Event;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

/** Admin-managed public content: events calendar and contact inquiries. */
class ContentController extends Controller
{
    use LogsActivity;

    public function events(Request $request)
    {
        $q = Event::query()->orderByDesc('starts_at');

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('title', 'like', "%{$s}%")
                ->orWhere('location', 'like', "%{$s}%"));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function storeEvent(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:200',
            'audience' => 'nullable|string|max:60',
            'starts_at' => 'required|date',
            'ends_at' => 'nullable|date|after:starts_at',
            'status' => 'nullable|in:draft,published',
        ]);

        $event = Event::create($data + [
            'created_by' => $request->user()->id,
            'published_at' => ($data['status'] ?? 'draft') === 'published' ? now() : null,
        ]);

        self::logActivity('events.create', $event, null, $event);

        return response()->json($event, 201);
    }

    public function updateEvent(Request $request, Event $event)
    {
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:200',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:200',
            'audience' => 'nullable|string|max:60',
            'starts_at' => 'sometimes|required|date',
            'ends_at' => 'nullable|date',
            'status' => 'nullable|in:draft,published',
        ]);

        $old = $event->toArray();
        if (($data['status'] ?? null) === 'published' && ! $event->published_at) {
            $data['published_at'] = now();
        }
        $event->update($data);

        self::logActivity('events.edit', $event, $old, $event->fresh());

        return response()->json($event->fresh());
    }

    public function destroyEvent(Event $event)
    {
        $event->delete();
        self::logActivity('events.delete', $event);

        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Contact inquiries -------------------------------------------------

    public function inquiries(Request $request)
    {
        $q = ContactInquiry::query()->with('handler')->latest();

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function updateInquiry(Request $request, ContactInquiry $inquiry)
    {
        $data = $request->validate([
            'status' => 'sometimes|required|in:new,contacted,follow_up,resolved,closed',
            'staff_notes' => 'nullable|string|max:2000',
        ]);

        $old = $inquiry->toArray();
        $inquiry->update($data + [
            'handled_by' => $request->user()->id,
            'responded_at' => $inquiry->responded_at ?? now(),
        ]);

        self::logActivity('inquiries.update', $inquiry, $old, $inquiry->fresh());

        return response()->json($inquiry->fresh('handler'));
    }
}
