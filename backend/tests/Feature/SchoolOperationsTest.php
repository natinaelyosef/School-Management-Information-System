<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ContactInquiry;
use App\Models\Event;
use App\Models\Grade;
use App\Models\MessageAttachment;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentEvent;
use App\Models\Teacher;
use App\Models\User;
use App\Services\MessagingService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SchoolOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function hierarchy(): array
    {
        $level = SchoolLevel::firstOrCreate(
            ['code' => 'SEC'],
            ['name' => 'Secondary', 'order_index' => 2]
        );
        $grade = Grade::firstOrCreate(
            ['school_level_id' => $level->id, 'name' => 'Grade 7'],
            ['order_index' => 7]
        );
        $section = Section::firstOrCreate(['grade_id' => $grade->id, 'name' => 'B']);
        $year = AcademicYear::firstOrCreate(
            ['code' => '2026'],
            [
                'name' => '2026/2027', 'is_current' => true,
                'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
            ]
        );

        $student = Student::create([
            'admission_no' => 'ST'.uniqid(),
            'first_name' => 'Kalkidan',
            'last_name' => 'Mulu',
            'level_id' => $level->id,
            'grade_id' => $grade->id,
            'section_id' => $section->id,
            'academic_year_id' => $year->id,
        ]);

        return compact('level', 'grade', 'section', 'year', 'student');
    }

    // ---- Teachers ----------------------------------------------------------

    public function test_admin_can_manage_teachers(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/teachers', [
            'first_name' => 'Meron',
            'last_name' => 'Assefa',
            'employee_no' => 'T-1042',
            'specialization' => 'Mathematics',
        ])
            ->assertCreated()
            ->assertJsonPath('first_name', 'Meron');

        $teacher = Teacher::where('employee_no', 'T-1042')->firstOrFail();

        $this->getJson('/api/v1/teachers')->assertOk()->assertJsonPath('total', 1);

        $this->putJson("/api/v1/teachers/{$teacher->id}", ['qualification' => 'MSc Mathematics'])
            ->assertOk()
            ->assertJsonPath('qualification', 'MSc Mathematics');

        $this->getJson('/api/v1/teachers?q=Assefa')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->deleteJson("/api/v1/teachers/{$teacher->id}")->assertOk();
        $this->assertSoftDeleted($teacher);
    }

    public function test_roles_without_teacher_permission_cannot_manage_teachers(): void
    {
        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');

        $this->actingAs($accountant, 'sanctum')
            ->getJson('/api/v1/teachers')
            ->assertForbidden();

        $this->actingAs($accountant, 'sanctum')
            ->postJson('/api/v1/teachers', ['first_name' => 'X', 'last_name' => 'Y'])
            ->assertForbidden();
    }

    // ---- Audit trail -------------------------------------------------------

    public function test_staff_actions_are_audited_and_readable(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/teachers', ['first_name' => 'Audit', 'last_name' => 'Trail'])
            ->assertCreated();

        $response = $this->getJson('/api/v1/audit')->assertOk();
        $response->assertJsonFragment(['action' => 'teachers.create']);
        $this->assertGreaterThanOrEqual(1, $response->json('total'));

        $this->getJson('/api/v1/audit/actions')->assertOk()->assertJsonFragment(['teachers.create']);
        $this->getJson('/api/v1/audit/users')->assertOk()->assertJsonFragment(['id' => $admin->id]);
    }

    public function test_audit_trail_is_not_open_to_school_admin(): void
    {
        $schoolAdmin = User::factory()->create();
        $schoolAdmin->assignRole('school_admin');

        $this->actingAs($schoolAdmin, 'sanctum')
            ->getJson('/api/v1/audit')
            ->assertForbidden();
    }

    // ---- Student lifecycle -------------------------------------------------

    public function test_internal_transfer_moves_the_class_and_records_history(): void
    {
        ['grade' => $from, 'section' => $fromSection, 'student' => $student] = $this->hierarchy();
        $toSection = Section::create(['grade_id' => $from->id, 'name' => 'C']);

        $admin = User::factory()->create();
        $admin->assignRole('registrar');
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/students/{$student->id}/transfer", [
            'type' => 'internal',
            'to_section_id' => $toSection->id,
            'effective_date' => now()->toDateString(),
            'reason' => 'Balancing class sizes',
        ])
            ->assertOk()
            ->assertJsonPath('section_id', $toSection->id);

        $event = StudentEvent::where('student_id', $student->id)->where('type', 'internal')->firstOrFail();
        $this->assertSame($fromSection->id, $event->from_section_id);
        $this->assertSame($toSection->id, $event->to_section_id);
        $this->assertSame($admin->id, $event->performed_by);
    }

    public function test_transfer_out_marks_the_student_transferred(): void
    {
        ['student' => $student] = $this->hierarchy();

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $this->postJson("/api/v1/students/{$student->id}/transfer", [
            'type' => 'transfer_out',
            'effective_date' => now()->toDateString(),
            'destination_school' => 'Nearby Academy',
        ])->assertOk();

        $this->assertSame('transferred', $student->fresh()->status);
        $this->assertDatabaseHas('student_events', [
            'student_id' => $student->id,
            'type' => 'transfer_out',
            'status_to' => 'transferred',
        ]);
    }

    public function test_status_change_is_recorded_as_a_lifecycle_event(): void
    {
        ['student' => $student] = $this->hierarchy();

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $this->postJson("/api/v1/students/{$student->id}/status", [
            'status' => 'suspended',
            'reason' => 'Repeated misconduct',
            'effective_date' => now()->toDateString(),
        ])
            ->assertOk()
            ->assertJsonPath('status', 'suspended');

        $event = StudentEvent::where('student_id', $student->id)->where('type', 'suspended')->firstOrFail();
        $this->assertSame('suspended', $event->status_to);
        $this->assertStringContainsString('Repeated misconduct', (string) $event->detail);

        // the timeline exposes the recorded history
        $this->getJson("/api/v1/students/{$student->id}/timeline")
            ->assertOk()
            ->assertJsonPath('student.status', 'suspended');
    }

    public function test_registrar_can_enroll_a_student_and_gets_an_auto_admission_number(): void
    {
        ['grade' => $grade, 'section' => $section] = $this->hierarchy();

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $response = $this->postJson('/api/v1/students', [
            'first_name' => 'Liya',
            'last_name' => 'Girma',
            'gender' => 'female',
            'dob' => '2015-03-04',
            'grade_id' => $grade->id,
            'section_id' => $section->id,
        ])
            ->assertCreated()
            ->assertJsonPath('first_name', 'Liya');

        $this->assertMatchesRegularExpression('/^STD-\d{4}-\d{5}$/', $response->json('admission_no'));

        $this->postJson('/api/v1/students', [
            'first_name' => 'Duplicate',
            'last_name' => 'Number',
            'admission_no' => $response->json('admission_no'),
        ])->assertUnprocessable();
    }

    public function test_roles_without_students_permission_cannot_enroll(): void
    {
        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');

        $this->actingAs($accountant, 'sanctum')
            ->postJson('/api/v1/students', ['first_name' => 'Nope', 'last_name' => 'Allowed'])
            ->assertForbidden();
    }

    public function test_login_and_me_expose_permission_names_for_client_side_gating(): void
    {
        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $registrar->email,
            'password' => 'password',
        ])->assertOk();

        $permissions = array_column($login->json('user.permissions'), 'name');
        $this->assertContains('students.promote', $permissions);
        $this->assertContains('students.edit', $permissions);
        $this->assertNotContains('students.delete', $permissions);

        Sanctum::actingAs($registrar);
        $me = $this->getJson('/api/v1/me')->assertOk();
        $this->assertContains('students.promote', array_column($me->json('permissions'), 'name'));
    }

    public function test_registrar_can_promote_a_student_to_another_grade(): void
    {
        ['level' => $level, 'grade' => $grade, 'section' => $section, 'year' => $year, 'student' => $student] = $this->hierarchy();
        $nextGrade = Grade::create(['school_level_id' => $level->id, 'name' => 'Grade 8', 'order_index' => 8]);

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $this->postJson("/api/v1/students/{$student->id}/promote", [
            'academic_year_id' => $year->id,
            'grade_id' => $nextGrade->id,
            'section_id' => $section->id,
        ])
            ->assertCreated()
            ->assertJsonPath('grade_id', $nextGrade->id);

        $this->assertSame($nextGrade->id, $student->fresh()->grade_id);
        $this->assertDatabaseHas('enrollments', [
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'grade_id' => $nextGrade->id,
            'status' => 'promoted',
        ]);
        $this->assertDatabaseHas('student_events', [
            'student_id' => $student->id,
            'type' => 'promotion',
            'performed_by' => $registrar->id,
        ]);

        $this->getJson("/api/v1/students/{$student->id}/timeline")
            ->assertOk()
            ->assertJsonFragment(['type' => 'promotion']);
    }

    // ---- Parent/guardian directory ------------------------------------------

    public function test_registrar_can_manage_guardians_and_link_children(): void
    {
        ['student' => $student] = $this->hierarchy();

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $parent = $this->postJson('/api/v1/parents', [
            'first_name' => 'Marta',
            'last_name' => 'Haile',
            'phone' => '+251911000111',
            'relationship' => 'mother',
            'student_ids' => [$student->id],
        ])
            ->assertCreated()
            ->assertJsonPath('first_name', 'Marta');

        $parentId = $parent->json('id');

        $this->getJson('/api/v1/parents?search=Haile')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/v1/parents/{$parentId}")
            ->assertOk()
            ->assertJsonFragment(['admission_no' => $student->admission_no]);

        $this->patchJson("/api/v1/parents/{$parentId}", [
            'first_name' => 'Marta',
            'last_name' => 'Tadesse',
            'relationship' => 'guardian',
            'student_ids' => [],
        ])
            ->assertOk()
            ->assertJsonPath('last_name', 'Tadesse');

        $this->getJson("/api/v1/parents/{$parentId}")->assertOk()->assertJsonCount(0, 'students');

        $this->deleteJson("/api/v1/parents/{$parentId}")->assertForbidden();

        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/parents/{$parentId}")->assertOk();
        $this->assertSoftDeleted('parents', ['id' => $parentId]);
    }

    public function test_parent_endpoints_respect_role_permissions(): void
    {
        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');

        $this->actingAs($teacher, 'sanctum')->getJson('/api/v1/parents')->assertForbidden();
        $this->actingAs($teacher, 'sanctum')
            ->postJson('/api/v1/parents', ['first_name' => 'A', 'last_name' => 'B'])
            ->assertForbidden();

        $principal = User::factory()->create();
        $principal->assignRole('principal');

        $this->actingAs($principal, 'sanctum')->getJson('/api/v1/parents')->assertOk();
        $this->actingAs($principal, 'sanctum')
            ->postJson('/api/v1/parents', ['first_name' => 'A', 'last_name' => 'B'])
            ->assertForbidden();
    }

    // ---- Parent portal -----------------------------------------------------

    public function test_parent_child_switcher_returns_linked_children(): void
    {
        $this->hierarchy();

        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');
        $parent = \App\Models\ParentModel::create([
            'user_id' => $parentUser->id,
            'first_name' => 'Hanna',
            'last_name' => 'Mulu',
            'email' => $parentUser->email,
        ]);
        $parent->students()->attach(Student::firstOrFail()->id);

        $otherUser = User::factory()->create();
        $otherUser->assignRole('parent');

        $this->actingAs($parentUser, 'sanctum')
            ->getJson('/api/v1/me/children')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.full_name', 'Kalkidan Mulu')
            ->assertJsonPath('0.grade.name', 'Grade 7');

        $this->actingAs($otherUser, 'sanctum')
            ->getJson('/api/v1/me/children')
            ->assertOk()
            ->assertJsonCount(0);
    }

    // ---- Public content ----------------------------------------------------

    public function test_events_can_be_draft_then_published(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/events', [
            'title' => 'Parents meeting',
            'starts_at' => now()->addWeek()->toDateTimeString(),
            'location' => 'Main hall',
            'status' => 'draft',
        ])->assertCreated()->assertJsonPath('status', 'draft');

        $event = Event::where('title', 'Parents meeting')->firstOrFail();
        $this->assertNull($event->published_at);

        // hidden from the public site while a draft
        $this->getJson('/api/v1/public/events')->assertOk()->assertJsonCount(0, 'data');

        $this->putJson("/api/v1/events/{$event->id}", ['status' => 'published'])
            ->assertOk()
            ->assertJsonPath('status', 'published');

        $this->assertNotNull($event->fresh()->published_at);
        $this->getJson('/api/v1/public/events')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/v1/events/{$event->id}")->assertOk();
        $this->assertSoftDeleted($event);
    }

    public function test_inquiries_can_be_worked_by_the_registrar(): void
    {
        $inquiry = ContactInquiry::create([
            'reference' => 'INQ-2026-ABCDEF',
            'name' => 'Peter',
            'email' => 'peter@example.com',
            'message' => 'Do you offer scholarships?',
            'status' => 'new',
        ]);

        $registrar = User::factory()->create();
        $registrar->assignRole('registrar');
        Sanctum::actingAs($registrar);

        $this->getJson('/api/v1/inquiries')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->putJson("/api/v1/inquiries/{$inquiry->id}", [
            'status' => 'contacted',
            'staff_notes' => 'Called back with scholarship info.',
        ])
            ->assertOk()
            ->assertJsonPath('status', 'contacted')
            ->assertJsonPath('handler.id', $registrar->id);

        $this->getJson('/api/v1/inquiries?status=contacted')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/inquiries?status=new')->assertJsonCount(0, 'data');
    }

    // ---- Reports -----------------------------------------------------------

    public function test_enrollment_report_exports_as_pdf(): void
    {
        $this->hierarchy();

        $admin = User::factory()->create();
        $admin->assignRole('super_admin');

        $response = $this->actingAs($admin, 'sanctum')
            ->get('/api/v1/reports/export.pdf?report=enrollment');

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
        $this->assertNotSame('', $response->getContent());
    }

    public function test_report_rejects_unknown_report_type(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/reports/export.pdf?report=nope')
            ->assertStatus(422);
    }

    // ---- Messaging attachments ---------------------------------------------

    public function test_participants_can_upload_and_download_attachments(): void
    {
        Storage::fake('public');

        $sender = User::factory()->create();
        $sender->assignRole('teacher');
        $recipient = User::factory()->create();
        $recipient->assignRole('parent');

        $conversation = app(MessagingService::class)
            ->createConversation($sender, [$recipient->id], 'Homework help');

        $this->actingAs($sender, 'sanctum')
            ->post("/api/v1/conversations/{$conversation->id}/messages", [
                'body' => 'See the attached worksheet.',
                'file' => UploadedFile::fake()->create('worksheet.pdf', 20, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonCount(1, 'attachments');

        $attachment = MessageAttachment::firstOrFail();
        $this->assertSame('worksheet.pdf', $attachment->original_name);
        Storage::disk('public')->assertExists($attachment->file_path);

        $this->actingAs($recipient, 'sanctum')
            ->get("/api/v1/messages/attachments/{$attachment->id}/file")
            ->assertOk();

        $outsider = User::factory()->create();
        $outsider->assignRole('student');
        $this->actingAs($outsider, 'sanctum')
            ->get("/api/v1/messages/attachments/{$attachment->id}/file")
            ->assertForbidden();
    }
}
