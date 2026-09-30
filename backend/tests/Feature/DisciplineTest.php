<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\DisciplineRecord;
use App\Models\Grade;
use App\Models\NotificationLog;
use App\Models\ParentModel;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DisciplineTest extends TestCase
{
    use RefreshDatabase;

    protected SchoolLevel $level;
    protected Grade $grade;
    protected Section $section;
    protected AcademicYear $year;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        // A student cannot exist without its grade, section and year.
        $this->level = SchoolLevel::create(['name' => 'Primary', 'code' => 'PRI', 'order_index' => 1]);
        $this->grade = Grade::create(['school_level_id' => $this->level->id, 'name' => 'Grade 1']);
        $this->section = Section::create(['grade_id' => $this->grade->id, 'name' => 'A']);
        $this->year = AcademicYear::create([
            'name' => '2026/2027', 'code' => '2026', 'is_current' => true,
            'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
        ]);
    }

    protected function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function makeStudent(string $first = 'Kid', string $last = 'Doe'): Student
    {
        return Student::create([
            'admission_no' => 'ST'.uniqid(),
            'first_name' => $first,
            'last_name' => $last,
            'level_id' => $this->level->id,
            'grade_id' => $this->grade->id,
            'section_id' => $this->section->id,
            'academic_year_id' => $this->year->id,
        ]);
    }

    public function test_a_teacher_records_a_merit_and_it_scores_positive(): void
    {
        $teacher = $this->actingAsRole('teacher');
        $student = $this->makeStudent();

        $response = $this->postJson('/api/v1/discipline', [
            'student_id' => $student->id,
            'type' => 'merit',
            'category' => 'participation',
            'title' => 'Excellent contribution in class',
        ])->assertStatus(201);

        $this->assertSame(1, $response->json('points'));
        $this->assertSame('open', $response->json('status'));
        $this->assertSame($teacher->id, $response->json('recorded_by'));
        $this->assertDatabaseHas('discipline_records', [
            'student_id' => $student->id,
            'type' => 'merit',
            'points' => 1,
        ]);
    }

    public function test_a_demerit_scores_against_the_severity_and_informs_the_family(): void
    {
        $teacher = $this->actingAsRole('teacher');
        $student = $this->makeStudent();

        $parentUser = User::factory()->create();
        $parent = ParentModel::create([
            'user_id' => $parentUser->id, 'first_name' => 'Abebe', 'last_name' => 'Kebede',
            'email' => $parentUser->email,
        ]);
        $parent->students()->attach($student->id);

        $response = $this->postJson('/api/v1/discipline', [
            'student_id' => $student->id,
            'type' => 'demerit',
            'category' => 'conduct',
            'severity' => 3,
            'title' => 'Disruption during the exam',
            'description' => 'Talked throughout the paper.',
        ])->assertStatus(201);

        $this->assertSame(-3, $response->json('points'));
        $this->assertSame(3, $response->json('severity'));

        $this->assertDatabaseHas('notification_logs', [
            'user_id' => $parentUser->id,
            'type' => 'discipline',
            'status' => 'sent',
        ]);
    }

    public function test_the_summary_weighs_merits_against_demerits(): void
    {
        $this->actingAsRole('principal');

        $student = $this->makeStudent();

        foreach (range(1, 3) as $ignored) {
            DisciplineRecord::create([
                'student_id' => $student->id, 'recorded_by' => null, 'type' => 'merit',
                'category' => 'participation', 'title' => 'Merit', 'points' => 1,
                'occurred_on' => now(), 'status' => 'resolved',
            ]);
        }
        DisciplineRecord::create([
            'student_id' => $student->id, 'recorded_by' => null, 'type' => 'demerit',
            'category' => 'punctuality', 'title' => 'Late twice', 'points' => -2,
            'occurred_on' => now(), 'status' => 'open',
        ]);

        $summary = $this->getJson('/api/v1/discipline/summary')->assertStatus(200)->json();

        $row = collect($summary)->firstWhere('student_id', $student->id);
        $this->assertNotNull($row);
        $this->assertSame(3, $row['merit_points']);
        $this->assertSame(2, $row['demerit_points']);
        $this->assertSame(1, $row['balance']);
        $this->assertSame(1, $row['open']);
    }

    public function test_a_record_is_closed_off_with_a_resolution(): void
    {
        $this->actingAsRole('principal');

        $record = DisciplineRecord::create([
            'student_id' => $this->makeStudent()->id,
            'recorded_by' => null, 'type' => 'incident', 'category' => 'property',
            'title' => 'Damaged a window', 'points' => 0,
            'occurred_on' => now(), 'status' => 'open',
        ]);

        $this->postJson("/api/v1/discipline/{$record->id}/resolve", [
            'status' => 'resolved',
            'resolution' => 'Family compensated the school.',
        ])->assertOk()
            ->assertJsonPath('status', 'resolved')
            ->assertJsonPath('resolution', 'Family compensated the school.');

        $this->assertNotNull($record->fresh()->resolved_at);
    }

    public function test_a_parent_sees_their_own_children_only(): void
    {
        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $parentUser->id, 'first_name' => 'Abebe', 'last_name' => 'Kebede',
            'email' => $parentUser->email,
        ]);
        $mine = $this->makeStudent();
        $someoneElses = $this->makeStudent();
        $parent->students()->attach($mine->id);

        DisciplineRecord::create([
            'student_id' => $mine->id, 'recorded_by' => null, 'type' => 'merit',
            'category' => 'conduct', 'title' => 'Helped in class', 'points' => 1,
            'occurred_on' => now(), 'status' => 'open',
        ]);
        DisciplineRecord::create([
            'student_id' => $someoneElses->id, 'recorded_by' => null, 'type' => 'demerit',
            'category' => 'conduct', 'title' => 'Not my child', 'points' => -1,
            'occurred_on' => now(), 'status' => 'open',
        ]);

        Sanctum::actingAs($parentUser);

        $visible = $this->getJson('/api/v1/discipline')->assertStatus(200)->json();
        $this->assertCount(1, $visible['data']);
        $this->assertSame($mine->id, $visible['data'][0]['student_id']);

        // Asking for another child must not widen the result.
        $forced = $this->getJson('/api/v1/discipline?student_id='.$someoneElses->id)->json();
        $this->assertCount(0, $forced['data']);

        // The summary must be narrowed the same way.
        $summary = $this->getJson('/api/v1/discipline/summary')->assertStatus(200)->json();
        $this->assertCount(1, $summary);
        $this->assertSame($mine->id, $summary[0]['student_id']);
    }


    public function test_only_staff_with_the_permission_can_record_or_manage(): void
    {
        $student = $this->makeStudent();
        $payload = [
            'student_id' => $student->id, 'type' => 'merit',
            'title' => 'Nice work', 'occurred_on' => now()->toDateString(),
        ];

        $this->actingAsRole('parent');
        $this->postJson('/api/v1/discipline', $payload)->assertForbidden();
        $this->getJson('/api/v1/discipline')->assertOk();

        // A teacher may record but not rewrite or delete somebody else's log.
        $this->actingAsRole('teacher');
        $record = $this->postJson('/api/v1/discipline', $payload)->assertStatus(201)->json();
        $this->patchJson("/api/v1/discipline/{$record['id']}", ['title' => 'Rewritten'])->assertForbidden();
        $this->deleteJson("/api/v1/discipline/{$record['id']}")->assertForbidden();
        $this->postJson("/api/v1/discipline/{$record['id']}/resolve", ['status' => 'resolved'])->assertForbidden();

        $this->actingAsRole('principal');
        $this->patchJson("/api/v1/discipline/{$record['id']}", ['title' => 'Rewritten'])->assertOk();
        $this->deleteJson("/api/v1/discipline/{$record['id']}")->assertOk();
        $this->assertDatabaseCount('discipline_records', 0);
    }

    public function test_the_log_is_validated_and_filterable(): void
    {
        $this->actingAsRole('principal');

        $this->postJson('/api/v1/discipline', [
            'student_id' => $this->makeStudent()->id,
            'type' => 'detention', 'title' => '', 'occurred_on' => 'not-a-date',
        ])->assertStatus(422)->assertJsonValidationErrors(['type', 'title', 'occurred_on']);

        $this->postJson('/api/v1/discipline', [
            'student_id' => $this->makeStudent()->id,
            'type' => 'demerit', 'category' => 'nonsense', 'title' => 'x', 'occurred_on' => now()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors(['category']);

        $student = $this->makeStudent();
        DisciplineRecord::create([
            'student_id' => $student->id, 'recorded_by' => null, 'type' => 'demerit',
            'category' => 'uniform', 'title' => 'Out of uniform', 'points' => -1,
            'occurred_on' => now(), 'status' => 'open',
        ]);

        $this->getJson('/api/v1/discipline?type=merit')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/discipline?type=demerit&status=open')
            ->assertOk()->assertJsonCount(1, 'data');
    }
}
