<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageRead;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MessagingService
{
    public function createConversation(User $creator, array $participantIds, ?string $subject = null, string $type = 'direct', $classSubjectId = null): Conversation
    {
        return DB::transaction(function () use ($creator, $participantIds, $subject, $type, $classSubjectId) {
            $conversation = Conversation::create([
                'subject' => $subject,
                'type' => $type,
                'class_subject_id' => $classSubjectId,
                'created_by' => $creator->id,
                'last_message_at' => now(),
            ]);
            $ids = array_unique(array_merge([$creator->id], $participantIds));
            foreach ($ids as $uid) {
                ConversationParticipant::firstOrCreate(
                    ['conversation_id' => $conversation->id, 'user_id' => $uid],
                    ['joined_at' => now(), 'role' => $uid === $creator->id ? 'admin' : 'member']
                );
            }

            return $conversation;
        });
    }

    /**
     * Every active member of a department, minus the sender. A department can
     * hold many people, so a role thread addresses the whole team at once.
     *
     * @return array<int, int>
     */
    public function roleMemberIds(User $sender, string $role): array
    {
        return User::role($role)
            ->where('id', '!=', $sender->id)
            ->where('is_active', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Post to an entire department. The thread is the department's notice board:
     * it tracks membership over time, so a colleague who joins the department
     * later receives the next broadcast (and can read the earlier notices),
     * while someone who leaves it stops receiving them.
     *
     * @return array{conversation: Conversation, message: Message, recipients: int}
     */
    public function broadcastToRole(User $sender, string $role, string $subject, ?string $body, array $attachments = []): array
    {
        $memberIds = $this->roleMemberIds($sender, $role);

        $conversation = Conversation::where('type', 'role:'.$role)
            ->where('created_by', $sender->id)
            ->orderByDesc('id')
            ->first();

        if ($conversation) {
            $currentIds = $conversation->participants()
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            foreach (array_diff($memberIds, $currentIds) as $newId) {
                $conversation->participants()->create([
                    'user_id' => $newId,
                    'joined_at' => now(),
                    'role' => 'member',
                ]);
            }

            $conversation->participants()
                ->whereNotIn('user_id', array_merge($memberIds, [$sender->id]))
                ->delete();

            $conversation->update(['subject' => $subject]);
        } else {
            $conversation = $this->createConversation($sender, $memberIds, $subject, 'role:'.$role);
        }

        $message = $this->sendMessage($conversation, $sender, $body, $attachments);

        return [
            'conversation' => $conversation,
            'message' => $message,
            'recipients' => count($memberIds),
        ];
    }

    public function sendMessage(Conversation $conversation, User $sender, ?string $body, array $attachments = []): Message
    {
        abort_unless($conversation->participants()->where('user_id', $sender->id)->exists(), 403, 'Not a participant');
        $message = DB::transaction(function () use ($conversation, $sender, $body, $attachments) {
            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'body' => $body,
            ]);
            foreach ($attachments as $att) {
                $msg->attachments()->create($att);
            }
            $conversation->update(['last_message_at' => now()]);

            return $msg;
        });

        return $message;
    }

    public function markAsRead(Message $message, User $user): void
    {
        MessageRead::updateOrCreate(
            ['message_id' => $message->id, 'user_id' => $user->id],
            ['read_at' => now()]
        );
        ConversationParticipant::where('conversation_id', $message->conversation_id)
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);
    }
}
