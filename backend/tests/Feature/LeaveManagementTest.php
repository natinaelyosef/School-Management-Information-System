<?php

namespace Tests\Feature;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\SchoolSetting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaveManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_the_seeded_leave_types_are_offered(): void
    {
        $this->actingAsRole('teacher');

        $types = $this->getJson('/api/v1/leave-types')->assertStatus(200)->json();

        $byName = collect($types)->keyBy('name');
        $this->assertSame('Annual leave', $byName['annual']['label']);
        $this->assertSame(30, $byName['annual']['quota_days']);
        $this->assertFalse($byName['unpaid']['is_paid']);
        $this->assertTrue($byName['sick']['requires_document']);
    }

    public function test_a_teacher_requests_leave_and_weekends_are_not_counted(): void
    {
        $teacher = $this->actingAsRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        // Friday 2nd to Monday 5th skips the weekend, so two days are booked.
        $response = $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-02', // Friday
            'end_date' => '2026-10-05',   // Monday
            'reason' => 'Family event out of town.',
        ])->assertStatus(201);

        $this->assertSame(2, $response->json('days'));
        $this->assertSame('pending', $response->json('status'));
        $this->assertSame($teacher->id, $response->json('user_id'));
    }

    public function test_a_registered_public_holiday_is_skipped(): void
    {
        SchoolSetting::create([
            'key' => 'school_holidays', 'group' => 'general', 'type' => 'json',
            'value' => json_encode(['2026-10-06']),
        ]);

        $this->actingAsRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        // Tuesday 6th is a public holiday, so only Monday and Wednesday count.
        $response = $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-05',
            'end_date' => '2026-10-07',
        ])->assertStatus(201);

        $this->assertSame(2, $response->json('days'));
    }

    public function test_a_principal_approves_leave_and_the_staff_member_is_told(): void
    {
        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        $leave = LeaveRequest::create([
            'user_id' => $teacher->id, 'leave_type_id' => $annual->id,
            'start_date' => '2026-11-02', 'end_date' => '2026-11-03', 'days' => 2, 'status' => 'pending',
        ]);

        $this->actingAsRole('principal');

        $this->postJson("/api/v1/leave-requests/{$leave->id}/decide", [
            'status' => 'approved', 'decision_note' => 'Cover arranged.',
        ])->assertOk()->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('notification_logs', [
            'user_id' => $teacher->id, 'type' => 'leave', 'status' => 'sent',
        ]);
        $this->assertNotNull($leave->fresh()->decided_at);

        // A decided request is final.
        $this->postJson("/api/v1/leave-requests/{$leave->id}/decide", ['status' => 'rejected'])
            ->assertStatus(422);
    }

    public function test_staff_only_see_their_own_requests_while_a_principal_sees_the_queue(): void
    {
        $mine = User::factory()->create();
        $mine->assignRole('teacher');
        $theirs = User::factory()->create();
        $theirs->assignRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        foreach ([$mine, $theirs] as $person) {
            LeaveRequest::create([
                'user_id' => $person->id, 'leave_type_id' => $annual->id,
                'start_date' => '2026-12-01', 'end_date' => '2026-12-01', 'days' => 1, 'status' => 'pending',
            ]);
        }

        Sanctum::actingAs($mine);
        $own = $this->getJson('/api/v1/leave-requests')->assertStatus(200)->json();
        $this->assertCount(1, $own['data']);
        $this->assertSame($mine->id, $own['data'][0]['user_id']);

        $this->actingAsRole('principal');
        $queue = $this->getJson('/api/v1/leave-requests?status=pending')->assertStatus(200)->json();
        $this->assertCount(2, $queue['data']);
    }

    public function test_overlapping_requests_are_refused_until_the_first_is_decided(): void
    {
        $this->actingAsRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-12', 'end_date' => '2026-10-16',
        ])->assertStatus(201);

        // The same days cannot be booked twice.
        $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-15', 'end_date' => '2026-10-19',
        ])->assertStatus(422);

        // A teacher cannot decide their own request, so a principal declines it...
        $first = LeaveRequest::first();
        $this->postJson("/api/v1/leave-requests/{$first->id}/decide", ['status' => 'rejected'])
            ->assertForbidden();

        $this->actingAsRole('principal');
        $this->postJson("/api/v1/leave-requests/{$first->id}/decide", ['status' => 'rejected'])
            ->assertOk();

        // ...which frees the dates up for a fresh request.
        $this->actingAsRole('teacher');
        $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-15', 'end_date' => '2026-10-19',
        ])->assertStatus(201);
    }

    public function test_a_weekend_only_range_is_rejected(): void
    {
        $this->actingAsRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-10', // Saturday
            'end_date' => '2026-10-11',   // Sunday
        ])->assertStatus(422);
    }

    public function test_staff_can_withdraw_their_own_request_but_nobody_elses(): void
    {
        $teacher = $this->actingAsRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();

        $leave = LeaveRequest::create([
            'user_id' => $teacher->id, 'leave_type_id' => $annual->id,
            'start_date' => '2026-09-20', 'end_date' => '2026-09-21', 'days' => 2, 'status' => 'pending',
        ]);

        $other = User::factory()->create();
        $other->assignRole('teacher');
        Sanctum::actingAs($other);
        $this->postJson("/api/v1/leave-requests/{$leave->id}/cancel")->assertForbidden();

        Sanctum::actingAs($teacher);
        $this->postJson("/api/v1/leave-requests/{$leave->id}/cancel")
            ->assertOk()->assertJsonPath('status', 'cancelled');
        $this->postJson("/api/v1/leave-requests/{$leave->id}/cancel")->assertStatus(422);
    }

    public function test_only_leave_managers_may_approve_or_remove_requests(): void
    {
        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');
        $annual = LeaveType::where('name', 'annual')->first();
        $leave = LeaveRequest::create([
            'user_id' => $teacher->id, 'leave_type_id' => $annual->id,
            'start_date' => '2026-08-03', 'end_date' => '2026-08-04', 'days' => 2, 'status' => 'pending',
        ]);

        // A teacher may ask for leave but not decide anybody else's.
        $this->actingAsRole('teacher');
        $this->postJson('/api/v1/leave-requests', [
            'leave_type_id' => $annual->id, 'start_date' => '2027-01-04', 'end_date' => '2027-01-05',
        ])->assertStatus(201);
        $this->postJson("/api/v1/leave-requests/{$leave->id}/decide", ['status' => 'approved'])->assertForbidden();
        $this->deleteJson("/api/v1/leave-requests/{$leave->id}")->assertForbidden();

        $this->actingAsRole('principal');
        $this->deleteJson("/api/v1/leave-requests/{$leave->id}")->assertOk();
    }

    public function test_a_principal_can_add_a_new_leave_type(): void
    {
        $this->actingAsRole('principal');

        $this->postJson('/api/v1/leave-types', [
            'name' => 'exam_support', 'label' => 'Exam support leave', 'quota_days' => 3,
        ])->assertStatus(201);

        $this->getJson('/api/v1/leave-types')->assertOk()
            ->assertJsonFragment(['name' => 'exam_support', 'label' => 'Exam support leave']);

        $this->postJson('/api/v1/leave-types', [
            'name' => 'Bad Name', 'label' => 'Nope',
        ])->assertStatus(422)->assertJsonValidationErrors(['name']);
    }
}
