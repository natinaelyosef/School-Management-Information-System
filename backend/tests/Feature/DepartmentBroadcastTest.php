<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepartmentBroadcastTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_a_broadcast_reaches_every_member_of_a_department(): void
    {
        $sender = User::factory()->create();
        $sender->assignRole('registrar');
        Sanctum::actingAs($sender);

        // A department holds many people — all of them must get the message.
        $teachers = User::factory()->count(4)->create();
        foreach ($teachers as $teacher) {
            $teacher->assignRole('teacher');
        }
        $inactive = User::factory()->create(['is_active' => false, 'status' => 'suspended']);
        $inactive->assignRole('teacher');

        $response = $this->postJson('/api/v1/messages', [
            'recipient_role' => 'teacher',
            'subject' => 'Staff briefing on Friday',
            'body' => 'Assembly at 8:00am sharp.',
        ])->assertStatus(201);

        // Four active teachers, the sender excluded, the suspended one skipped.
        $this->assertSame(4, $response->json('recipients'));
        $this->assertTrue($response->json('broadcast'));

        $conversationId = $response->json('conversation_id');
        $conversation = Conversation::find($conversationId);
        $this->assertSame('role:teacher', $conversation->type);

        $participantIds = $conversation->participants()->pluck('user_id')->all();
        foreach ($teachers as $teacher) {
            $this->assertContains($teacher->id, $participantIds);
        }
        $this->assertNotContains($inactive->id, $participantIds);
        $this->assertContains($sender->id, $participantIds);

        foreach ($teachers as $teacher) {
            $this->assertDatabaseHas('messages', [
                'conversation_id' => $conversationId,
                'sender_id' => $sender->id,
            ]);
        }
    }

    public function test_repeat_broadcastes_reuse_the_department_thread_and_track_membership(): void
    {
        $sender = User::factory()->create();
        $sender->assignRole('principal');
        Sanctum::actingAs($sender);

        $first = User::factory()->create();
        $first->assignRole('nurse');
        $second = User::factory()->create();
        $second->assignRole('nurse');

        $one = $this->postJson('/api/v1/messages', [
            'recipient_role' => 'nurse', 'subject' => 'Notice 1', 'body' => 'First notice.',
        ])->assertStatus(201);
        $this->assertSame(2, $one->json('recipients'));

        // A third nurse joins the department after the first broadcast.
        $third = User::factory()->create();
        $third->assignRole('nurse');

        $two = $this->postJson('/api/v1/messages', [
            'recipient_role' => 'nurse', 'subject' => 'Notice 2', 'body' => 'Second notice.',
        ])->assertStatus(201);

        $this->assertSame(
            $one->json('conversation_id'),
            $two->json('conversation_id'),
            'a department keeps one thread'
        );
        $this->assertSame(3, $two->json('recipients'), 'the new joiner is picked up');

        $conversation = Conversation::find($two->json('conversation_id'));
        // Sender + the three nurses.
        $this->assertSame(4, $conversation->participants()->count());
        $this->assertSame('Notice 2', $conversation->subject);

        // A department thread is a shared notice board, so a colleague who joins
        // later sees the earlier notices as well as the new one.
        $this->assertSame(2, $this->actingAs($first)->getJson('/api/v1/messages/inbox')->json('total'));
        $this->assertSame(2, $this->actingAs($third)->getJson('/api/v1/messages/inbox')->json('total'));
    }

    public function test_a_lone_department_membership_is_rejected_rather_than_silently_dropped(): void
    {
        $sender = User::factory()->create();
        $sender->assignRole('librarian');
        Sanctum::actingAs($sender);

        $this->postJson('/api/v1/messages', [
            'recipient_role' => 'librarian', 'subject' => 'Echo', 'body' => 'Nobody else here.',
        ])->assertStatus(422);

        // A department broadcast must carry a subject so the thread stays readable.
        $colleague = User::factory()->create();
        $colleague->assignRole('librarian');

        $this->postJson('/api/v1/messages', [
            'recipient_role' => 'librarian', 'body' => 'No subject given.',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'A subject is required when messaging a whole department.');
    }

    public function test_the_department_directory_counts_active_members(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        Sanctum::actingAs($user);

        User::factory()->count(3)->create()->each(fn ($u) => $u->assignRole('teacher'));

        $departments = $this->getJson('/api/v1/messages/departments')->assertStatus(200)->json();

        $byName = collect($departments)->keyBy('name');
        $this->assertSame(3, $byName['teacher']['members']);
        // The seeder ships one super admin, this test acts as a second.
        $this->assertSame(2, $byName['super_admin']['members']);
        $this->assertSame(0, $byName['nurse']['members']);
    }

    public function test_a_picked_group_reaches_exactly_those_people(): void
    {
        $sender = User::factory()->create();
        $sender->assignRole('principal');
        Sanctum::actingAs($sender);

        $one = User::factory()->create();
        $two = User::factory()->create();
        $leftOut = User::factory()->create();
        foreach ([$one, $two, $leftOut] as $u) {
            $u->assignRole('teacher');
        }

        $response = $this->postJson('/api/v1/messages', [
            'recipient_ids' => [$one->id, $two->id],
            'subject' => 'Duty rota',
            'body' => 'You are on duty this week.',
        ])->assertStatus(201);

        $conversation = Conversation::find($response->json('conversation_id'));
        $this->assertSame('group', $conversation->type);
        $this->assertEqualsCanonicalizing(
            [$sender->id, $one->id, $two->id],
            $conversation->participants()->pluck('user_id')->all()
        );
    }
}
