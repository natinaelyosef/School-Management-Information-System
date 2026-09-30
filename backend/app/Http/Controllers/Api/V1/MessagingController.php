<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClassSubject;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\ParentModel;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\User;
use App\Services\MessagingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class MessagingController extends Controller
{
    /** Flat inbox view: every message addressed to me across my conversations. */
    /** People this viewer is allowed to start a thread with: my child's teachers, my students' parents. */
    public function contacts(Request $request)
    {
        $user = $request->user();
        $teacherIds = collect();
        $gradeIds = collect();
        $studentIds = collect();

        if ($user->parentProfile) {
            $studentIds = $user->parentProfile->students()->pluck('students.id');
        } elseif ($user->student) {
            $studentIds = collect([(int) $user->student->id]);
        }

        if ($studentIds->isNotEmpty()) {
            $rows = Student::whereIn('id', $studentIds)->get(['grade_id', 'section_id']);
            $gradeIds = $rows->pluck('grade_id')->filter()->unique()->values();
            $sectionIds = $rows->pluck('section_id')->filter()->unique()->values();

            $assignmentTeachers = $gradeIds->isEmpty() ? collect()
                : TeacherAssignment::whereIn('grade_id', $gradeIds)->pluck('teacher_id');
            $assignmentTeachers = $assignmentTeachers->merge(
                $sectionIds->isEmpty() ? collect() : TeacherAssignment::whereIn('section_id', $sectionIds)->pluck('teacher_id')
            );
            $classTeachers = $gradeIds->isEmpty() ? collect()
                : ClassSubject::whereIn('grade_id', $gradeIds)->pluck('teacher_id');

            $teacherIds = $assignmentTeachers->merge($classTeachers)->filter()->unique()->values();
        }

        $parentLinks = collect();
        if ($user->teacher) {
            $assignmentGrades = TeacherAssignment::where('teacher_id', $user->teacher->id)->pluck('grade_id')->filter();
            $classGrades = ClassSubject::where('teacher_id', $user->teacher->id)->pluck('grade_id')->filter();
            $gradeIds = $assignmentGrades->merge($classGrades)->filter()->unique()->values();

            if ($gradeIds->isNotEmpty()) {
                $parentLinks = DB::table('parent_student')
                    ->join('students', 'students.id', '=', 'parent_student.student_id')
                    ->whereNull('students.deleted_at')
                    ->whereIn('students.grade_id', $gradeIds)
                    ->get(['parent_student.parent_id', 'students.first_name', 'students.last_name']);
            }
        }

        $teacherUsers = collect();
        if ($teacherIds->isNotEmpty()) {
            $teacherUserIds = Teacher::whereIn('id', $teacherIds)->whereNotNull('user_id')->pluck('user_id');
            $teacherUsers = User::whereIn('id', $teacherUserIds)->get(['id', 'name', 'email', 'phone']);
        }

        $parents = collect();
        if ($parentLinks->isNotEmpty()) {
            $parentIds = $parentLinks->pluck('parent_id')->unique()->values();
            $parents = ParentModel::whereIn('id', $parentIds)
                ->whereNotNull('user_id')
                ->get()
                ->map(function ($parent) use ($parentLinks) {
                    $children = $parentLinks
                        ->where('parent_id', $parent->id)
                        ->map(fn ($row) => trim($row->first_name.' '.$row->last_name))
                        ->unique()
                        ->values();

                    return [
                        'id' => $parent->user_id,
                        'name' => trim($parent->first_name.' '.$parent->last_name),
                        'children' => $children->all(),
                    ];
                });
        }

        return response()->json([
            'teachers' => $teacherUsers->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => 'teacher',
            ])->values(),
            'parents' => $parents->values(),
        ]);
    }

    public function inbox(Request $request)
    {
        $messages = Message::query()
            ->whereHas('conversation', fn ($q) => $q->whereHas(
                'participants',
                fn ($qq) => $qq->where('user_id', $request->user()->id)
            ))
            ->where('sender_id', '!=', $request->user()->id)
            ->with(['sender', 'reads'])
            ->latest()
            ->paginate($request->integer('per_page', 30));

        $messages->getCollection()->transform(fn ($m) => $this->present($m, $request->user()->id));

        return response()->json($messages);
    }

    /** Flat sent view: messages I authored. */
    public function sent(Request $request)
    {
        $messages = Message::query()
            ->where('sender_id', $request->user()->id)
            ->with('sender')
            ->latest()
            ->paginate($request->integer('per_page', 30));

        $messages->getCollection()->transform(fn ($m) => $this->present($m, $request->user()->id));

        return response()->json($messages);
    }

    /**
     * Departments that can be messaged as a group, with the number of active
     * people in each — a department may hold any number of staff.
     */
    public function departments()
    {
        $counts = DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', (new User())->getMorphClass())
            ->whereNull('users.deleted_at')
            ->where('users.is_active', true)
            ->groupBy('model_has_roles.role_id')
            ->select('model_has_roles.role_id', DB::raw('count(*) as total'))
            ->pluck('total', 'role_id');

        return response()->json(
            Role::orderBy('name')->get(['id', 'name'])
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'members' => (int) ($counts[$role->id] ?? 0),
                ])
                ->values()
        );
    }

    /** Compose a message to one person, a picked group, or a whole department. */
    public function compose(Request $request, MessagingService $service)
    {
        $data = $request->validate([
            'recipient_id' => 'nullable|exists:users,id',
            'recipient_ids' => 'nullable|array|max:200',
            'recipient_ids.*' => 'exists:users,id',
            'recipient_role' => 'nullable|string|max:60',
            'subject' => 'nullable|string|max:255',
            'body' => 'required|string|max:5000',
            'context' => 'nullable|in:fees,grades,attendance,general',
        ]);

        $recipientId = $data['recipient_id'] ?? null;
        $recipientIds = array_values(array_filter($data['recipient_ids'] ?? []));

        // A department broadcast reaches every active member, not just the first.
        if (! empty($data['recipient_role'])) {
            $subject = $data['subject'] ?? null;
            abort_unless($subject, 422, 'A subject is required when messaging a whole department.');

            $result = $service->broadcastToRole(
                $request->user(),
                $data['recipient_role'],
                $subject,
                $data['body']
            );

            abort_if($result['recipients'] === 0, 422, 'That department has nobody else to message.');

            $message = $result['message'];
            if (! empty($data['context'])) {
                $message->update(['context' => $data['context']]);
            }

            return response()->json(
                $this->present($message->load('sender'), $request->user()->id) + [
                    'conversation_id' => $result['conversation']->id,
                    'recipients' => $result['recipients'],
                    'broadcast' => true,
                ],
                201
            );
        }

        // An explicit group of people picked by the sender.
        if (! $recipientId && $recipientIds) {
            $conversation = $service->createConversation(
                $request->user(),
                $recipientIds,
                $data['subject'] ?? null,
                'group'
            );
            $message = $service->sendMessage($conversation, $request->user(), $data['body']);

            if (! empty($data['context'])) {
                $message->update(['context' => $data['context']]);
            }

            return response()->json(
                $this->present($message->load('sender'), $request->user()->id) + [
                    'conversation_id' => $conversation->id,
                    'recipients' => count(array_unique(array_merge($recipientIds, [$request->user()->id]))),
                    'broadcast' => false,
                ],
                201
            );
        }

        abort_unless($recipientId, 422, 'recipient_id, recipient_ids or recipient_role is required.');

        $conversation = Conversation::where('type', 'direct')
            ->whereHas('participants', fn ($q) => $q->where('user_id', $request->user()->id))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $recipientId))
            ->first();

        $conversation ??= $service->createConversation(
            $request->user(),
            [$recipientId],
            $data['subject'] ?? null,
            'direct'
        );

        $message = $service->sendMessage($conversation, $request->user(), $data['body']);

        if (! empty($data['context'])) {
            $message->update(['context' => $data['context']]);
        }

        return response()->json($this->present($message->load('sender'), $request->user()->id), 201);
    }

    public function star(Request $request, Message $message)
    {
        $message->update(['is_starred' => ! $message->is_starred]);

        return response()->json($message);
    }

    protected function present(Message $message, int $viewerId): array
    {
        $read = $message->reads
            ->first(fn ($r) => (int) $r->user_id === $viewerId);

        return [
            'id' => $message->id,
            'sender_id' => $message->sender_id,
            'sender_name' => $message->sender?->name,
            'sender_role' => $message->sender?->getRoleNames()->first(),
            'recipient_role' => $message->conversation?->type,
            'conversation_id' => $message->conversation_id,
            'subject' => $message->conversation?->subject ?: (Str::limit((string) $message->body, 60)),
            'body' => $message->body,
            'is_starred' => (bool) $message->is_starred,
            'is_read' => (bool) $read,
            'context' => $message->context,
            'created_at' => $message->created_at,
        ];
    }

    public function conversations(Request $request)
    {
        $q = Conversation::whereHas('participants', fn ($qq) => $qq->where('user_id', $request->user()->id))
            ->with(['participants', 'messages' => fn ($m) => $m->latest()->limit(1)])
            ->latest('last_message_at');

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function storeConversation(Request $request, MessagingService $service)
    {
        $data = $request->validate([
            'participant_ids' => 'required|array|min:1',
            'participant_ids.*' => 'exists:users,id',
            'subject' => 'nullable|string',
            'type' => 'nullable|string',
        ]);
        $conv = $service->createConversation($request->user(), $data['participant_ids'], $data['subject'] ?? null, $data['type'] ?? 'direct');

        return response()->json($conv->load('participants'), 201);
    }

    public function showConversation(Conversation $conversation)
    {
        abort_unless($conversation->participants()->where('user_id', auth()->id())->exists(), 403);

        return response()->json($conversation->load(['participants', 'messages.sender', 'messages.attachments']));
    }

    public function messages(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->participants()->where('user_id', $request->user()->id)->exists(), 403);

        return response()->json($conversation->messages()->with(['sender', 'attachments'])->latest()->paginate($request->integer('per_page', 30)));
    }

    public function sendMessage(Request $request, Conversation $conversation, MessagingService $service)
    {
        $data = $request->validate([
            'body' => 'nullable|string|max:5000',
            'attachments' => 'nullable|array',
            'file' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,csv,zip|max:10240',
        ]);

        $attachments = $data['attachments'] ?? [];

        // A real upload travels with the message so the row always has a valid message_id.
        if ($request->hasFile('file')) {
            $file = $request->file('file');

            $attachments[] = [
                'file_path' => $file->store('messages/attachments', 'public'),
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ];
        }

        $msg = $service->sendMessage($conversation, $request->user(), $data['body'] ?? null, $attachments);

        return response()->json($msg->load('attachments'), 201);
    }

    /** Streams an attachment back to any participant of its conversation. */
    public function attachmentFile(Request $request, MessageAttachment $attachment)
    {
        $conversation = $attachment->message?->conversation;

        abort_unless($conversation, 404);
        abort_unless(
            $conversation->participants()->where('user_id', $request->user()->id)->exists(),
            403
        );
        abort_unless(Storage::disk('public')->exists($attachment->file_path), 404);

        return Storage::disk('public')->response(
            $attachment->file_path,
            $attachment->original_name ?: 'attachment'
        );
    }

    public function markRead(Request $request, Message $message, MessagingService $service)
    {
        $service->markAsRead($message, $request->user());

        return response()->json(['message' => 'Marked as read.']);
    }
}
