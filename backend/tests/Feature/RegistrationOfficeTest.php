<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\ParentModel;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\Term;
use App\Models\User;
use App\Models\FeeStructure;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrationOfficeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function office(): User
    {
        $user = User::factory()->create();
        $user->assignRole('registration_office');
        Sanctum::actingAs($user);

        return $user;
    }

    protected function school(): array
    {
        $level = SchoolLevel::create(['name' => 'Primary', 'code' => 'PRI', 'order_index' => 1]);
        $grade = Grade::create(['school_level_id' => $level->id, 'name' => 'Grade 1', 'order_index' => 1]);
        $section = Section::create(['grade_id' => $grade->id, 'name' => 'A']);
        $year = AcademicYear::create([
            'name' => '2026/2027', 'code' => '2026', 'is_current' => true,
            'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
        ]);
        $term = Term::create([
            'academic_year_id' => $year->id, 'name' => 'Term 1', 'is_current' => true,
            'start_date' => '2026-09-01', 'end_date' => '2026-12-15',
        ]);
        $fee = FeeStructure::create([
            'academic_year_id' => $year->id,
            'grade_id' => $grade->id,
            'name' => 'Grade 1 tuition',
            'amount' => 15000,
            'frequency' => 'per term',
            'category' => 'tuition',
            'is_active' => true,
        ]);

        return compact('level', 'grade', 'section', 'year', 'term', 'fee');
    }

    public function test_registration_office_role_holds_the_admissions_permissions(): void
    {
        $user = User::factory()->create();
        $user->assignRole('registration_office');

        foreach (['applications.view', 'applications.review', 'applications.decide',
            'students.create', 'parents.create', 'invoices.create', 'payments.receive'] as $permission) {
            $this->assertTrue($user->can($permission), "missing {$permission}");
        }
        $this->assertFalse($user->can('users.delete'));
        $this->assertFalse($user->can('settings.edit'));

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/applications')->assertOk();
        $this->getJson('/api/v1/parents')->assertOk();
        $this->getJson('/api/v1/students')->assertOk();
    }

    public function test_other_roles_cannot_decide_applications(): void
    {
        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');

        $application = \App\Models\Application::create([
            'application_no' => 'APP-2026-00001',
            'first_name' => 'Test',
            'last_name' => 'Child',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $this->actingAs($accountant, 'sanctum')
            ->postJson("/api/v1/applications/{$application->id}/decide", ['status' => 'accepted'])
            ->assertForbidden();
    }

    public function test_full_registration_workflow_from_application_to_enrollment(): void
    {
        ['grade' => $grade, 'section' => $section, 'year' => $year, 'fee' => $fee] = $this->school();
        $office = $this->office();

        $application = $this->postJson('/api/v1/applications', [
            'first_name' => 'Selam',
            'last_name' => 'Tesfaye',
            'gender' => 'female',
            'dob' => '2019-04-12',
            'applying_grade_id' => $grade->id,
            'academic_year_id' => $year->id,
            'parent_name' => 'Marta Tesfaye',
            'parent_phone' => '+251911223344',
            'parent_email' => 'marta.tesfaye@example.com',
            'address' => 'Bole, Addis Ababa',
        ])->assertCreated();

        $id = $application->json('id');

        $offer = $this->getJson("/api/v1/applications/{$id}/offer")->assertOk();
        $this->assertSame(15000.0, (float) $offer->json('fee.amount'));
        $this->assertCount(5, $offer->json('documents'));
        $this->assertStringContainsString('ACCEPTED', $offer->json('message'));
        $this->assertStringContainsString('cash', $offer->json('message'));

        $this->postJson("/api/v1/applications/{$id}/decide", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('status', 'suspended');

        $this->postJson("/api/v1/applications/{$id}/notify")
            ->assertUnprocessable();

        $this->postJson("/api/v1/applications/{$id}/decide", ['status' => 'accepted', 'notes' => 'Parent called back'])
            ->assertOk()
            ->assertJsonPath('status', 'accepted');

        $notify = $this->postJson("/api/v1/applications/{$id}/notify")->assertOk();
        $this->assertNotNull($notify->json('recipient.id'));
        $this->assertNotNull($notify->json('parent_account.password'));
        $this->assertArrayHasKey('database', $notify->json('channels'));
        $this->assertNotNull($notify->json('application.notified_at'));

        $parentEmail = $notify->json('parent_account.email');
        $parentPassword = $notify->json('parent_account.password');

        $contact = $this->postJson("/api/v1/applications/{$id}/contact", [
            'method' => 'phone',
            'note' => 'Called parent, confirmed documents and CBE transfer.',
        ])->assertOk();
        $this->assertNotNull($contact->json('contacted_at'));

        $enroll = $this->postJson("/api/v1/applications/{$id}/enroll", [
            'grade_id' => $grade->id,
            'section_id' => $section->id,
        ])->assertCreated();

        $studentId = $enroll->json('student.id');
        $this->assertMatchesRegularExpression('/^STD-\d{4}-\d{5}$/', $enroll->json('student.admission_no'));
        $this->assertSame('enrolled', $enroll->json('application.status'));
        $this->assertSame(15000.0, (float) $enroll->json('invoice.total'));
        $this->assertSame($parentEmail, $enroll->json('parent_account.email') ?? $parentEmail);

        $this->assertDatabaseHas('enrollments', [
            'student_id' => $studentId,
            'grade_id' => $grade->id,
            'status' => 'enrolled',
        ]);
        $this->assertDatabaseHas('parent_student', ['student_id' => $studentId]);

        $this->postJson("/api/v1/applications/{$id}/enroll", ['grade_id' => $grade->id])
            ->assertUnprocessable();

        Sanctum::actingAs(User::where('email', $parentEmail)->firstOrFail());
        $this->getJson('/api/v1/me/children')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/v1/invoices')->assertOk();
    }

    public function test_parent_account_password_can_be_chosen_by_the_office(): void
    {
        ['grade' => $grade] = $this->school();
        $this->office();

        $application = $this->postJson('/api/v1/applications', [
            'first_name' => 'Dawit',
            'last_name' => 'Alemu',
            'applying_grade_id' => $grade->id,
            'parent_name' => 'Sara Alemu',
            'parent_phone' => '+251922334455',
        ])->assertCreated();

        $id = $application->json('id');
        $this->postJson("/api/v1/applications/{$id}/decide", ['status' => 'accepted'])->assertOk();

        $enroll = $this->postJson("/api/v1/applications/{$id}/enroll", [
            'grade_id' => $grade->id,
            'parent_password' => 'office-chosen-pass',
        ])->assertCreated();

        $email = $enroll->json('parent_account.email');
        $this->assertNotNull($email);

        $parentUser = User::where('email', $email)->firstOrFail();
        $this->assertTrue($parentUser->hasRole('parent'));
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('office-chosen-pass', $parentUser->password));
        $this->assertTrue((bool) $parentUser->notify_telegram);
    }

    public function test_parent_and_teacher_see_each_other_as_messaging_contacts(): void
    {
        ['grade' => $grade, 'section' => $section, 'year' => $year] = $this->school();

        $teacherUser = User::factory()->create();
        $teacherUser->assignRole('teacher');
        $teacher = Teacher::create([
            'user_id' => $teacherUser->id,
            'first_name' => 'Daniel',
            'last_name' => 'Tesfaye',
            'employee_no' => 'T-'.uniqid(),
        ]);
        TeacherAssignment::create([
            'teacher_id' => $teacher->id,
            'academic_year_id' => $year->id,
            'grade_id' => $grade->id,
            'section_id' => $section->id,
            'role' => 'class_teacher',
        ]);

        $student = Student::create([
            'admission_no' => 'STD-2026-00009',
            'first_name' => 'Liya',
            'last_name' => 'Girma',
            'grade_id' => $grade->id,
            'section_id' => $section->id,
            'academic_year_id' => $year->id,
            'level_id' => $grade->school_level_id,
        ]);

        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $parentUser->id,
            'first_name' => 'Marta',
            'last_name' => 'Girma',
            'phone' => '+251911000222',
        ]);
        $parent->students()->attach($student->id);

        Sanctum::actingAs($parentUser);
        $contacts = $this->getJson('/api/v1/messages/contacts')->assertOk();
        $this->assertSame($teacherUser->id, $contacts->json('teachers.0.id'));

        Sanctum::actingAs($teacherUser);
        $contacts = $this->getJson('/api/v1/messages/contacts')->assertOk();
        $this->assertSame($parentUser->id, $contacts->json('parents.0.id'));
        $this->assertContains('Liya Girma', $contacts->json('parents.0.children'));

        Sanctum::actingAs($parentUser);
        $sent = $this->postJson('/api/v1/messages', [
            'recipient_id' => $teacherUser->id,
            'subject' => 'Question about homework',
            'body' => 'Hello teacher, Liya needs the assignment list.',
        ])->assertCreated();

        Sanctum::actingAs($teacherUser);
        $this->getJson('/api/v1/messages/inbox')
            ->assertOk()
            ->assertJsonFragment(['id' => $sent->json('id')]);
    }
}
