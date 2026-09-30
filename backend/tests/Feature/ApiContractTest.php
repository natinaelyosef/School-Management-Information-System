<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\AttendanceRecord;
use App\Models\Book;
use App\Models\Borrowing;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\HealthRecord;
use App\Models\SchoolLevel;
use App\Models\SchoolSetting;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TransportRoute;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiContractTest extends TestCase
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

    protected function academicSetup(): array
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

        return compact('level', 'grade', 'section', 'year', 'term');
    }

    protected function makeStudentUser(array $context): User
    {
        $user = User::factory()->create();
        $user->assignRole('student');

        Student::create([
            'user_id' => $user->id,
            'admission_no' => 'ST'.uniqid(),
            'first_name' => 'Abebe',
            'last_name' => 'Kebede',
            'level_id' => $context['level']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'academic_year_id' => $context['year']->id,
        ]);

        return $user;
    }

    public function test_stats_returns_role_keys_and_tasks(): void
    {
        $this->actingAsRole('super_admin');

        $response = $this->getJson('/api/v1/stats')->assertStatus(200);

        $response->assertJsonStructure([
            'students', 'teachers', 'parents', 'classes', 'attendance_today',
            'outstanding_fees', 'applications_pending', 'unread_messages',
            'role', 'my_tasks',
        ]);

        foreach ($response->json('my_tasks') as $task) {
            $this->assertArrayHasKey('label', $task);
            $this->assertArrayHasKey('count', $task);
            $this->assertContains($task['tone'], ['red', 'orange', 'blue', 'green']);
        }
    }

    public function test_stats_student_shape(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);

        Sanctum::actingAs($studentUser);

        $this->getJson('/api/v1/stats')
            ->assertStatus(200)
            ->assertJsonStructure(['assignments_due', 'unread_messages', 'role', 'my_tasks']);
    }

    public function test_subjects_crud_and_permissions(): void
    {
        $this->actingAsRole('super_admin');

        $created = $this->postJson('/api/v1/subjects', [
            'name' => 'Mathematics',
            'code' => 'MATH-01',
            'description' => 'Numbers',
        ])->assertStatus(201);

        $id = $created->json('id');

        $this->getJson('/api/v1/subjects')->assertStatus(200)->assertJsonFragment(['code' => 'MATH-01']);
        $this->getJson("/api/v1/subjects/{$id}")->assertStatus(200);
        $this->putJson("/api/v1/subjects/{$id}", ['name' => 'Advanced Mathematics'])->assertStatus(200);
        $this->deleteJson("/api/v1/subjects/{$id}")->assertStatus(200);

        $studentUser = $this->makeStudentUser($this->academicSetup());
        Sanctum::actingAs($studentUser);
        $this->postJson('/api/v1/subjects', ['name' => 'Nope', 'code' => 'NOPE'])->assertStatus(403);
    }

    public function test_assignments_flow(): void
    {
        $context = $this->academicSetup();
        $subject = Subject::create(['name' => 'English', 'code' => 'ENG']);

        $this->actingAsRole('teacher');

        $assignment = $this->postJson('/api/v1/assignments', [
            'title' => 'Essay',
            'description' => 'Write about your town',
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'subject_id' => $subject->id,
            'academic_year_id' => $context['year']->id,
            'term_id' => $context['term']->id,
            'due_date' => now()->addDays(7)->toDateString(),
            'total_marks' => 50,
        ])->assertStatus(201);

        $assignmentId = $assignment->json('id');

        $this->getJson('/api/v1/assignments?grade_id='.$context['grade']->id)
            ->assertStatus(200)
            ->assertJsonFragment(['title' => 'Essay']);
        $this->getJson("/api/v1/assignments/{$assignmentId}")->assertStatus(200);

        $studentUser = $this->makeStudentUser($context);
        Sanctum::actingAs($studentUser);

        $submission = $this->postJson("/api/v1/assignments/{$assignmentId}/submissions", [
            'answer' => 'My answer text',
        ])->assertStatus(201);

        $this->assertSame('submitted', $submission->json('status'));

        $teacherUser = User::factory()->create();
        $teacherUser->assignRole('teacher');
        Sanctum::actingAs($teacherUser);

        $this->postJson("/api/v1/assignments/{$assignmentId}/submissions/{$submission->json('id')}/grade", [
            'score' => 45,
            'feedback' => 'Well done',
        ])->assertStatus(200)
            ->assertJsonFragment(['status' => 'graded', 'feedback' => 'Well done']);

        $this->assertSame(1, Assignment::find($assignmentId)->submissions()->where('status', 'graded')->count());
    }

    public function test_exams_flow(): void
    {
        $context = $this->academicSetup();
        $subject = Subject::create(['name' => 'Science', 'code' => 'SCI']);
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $exam = $this->postJson('/api/v1/exams', [
            'name' => 'Midterm 1',
            'academic_year_id' => $context['year']->id,
            'term_id' => $context['term']->id,
            'level' => $context['grade']->id,
            'subject' => $subject->id,
            'date' => '2026-10-01',
            'total_marks' => 100,
            'type' => 'midterm',
        ])->assertStatus(201);

        $examId = $exam->json('id');
        $this->assertNotEmpty($exam->json('examSubjects'));

        $show = $this->getJson("/api/v1/exams/{$examId}")->assertStatus(200);
        $this->assertArrayHasKey('subjects', $show->json());
        $this->assertArrayHasKey('results', $show->json());

        $this->postJson("/api/v1/exams/{$examId}/results", [
            'results' => [
                ['student_id' => $student->id, 'score' => 88],
            ],
        ])->assertStatus(201);

        $results = $this->getJson("/api/v1/exams/{$examId}/results")->assertStatus(200);
        $this->assertCount(1, $results->json());
        $this->assertEquals(88, $results->json('0.marks_obtained'));

        $published = $this->postJson("/api/v1/exams/{$examId}/publish")->assertStatus(200);
        $this->assertSame('published', $published->json('status'));
    }

    public function test_report_card_generation(): void
    {
        $context = $this->academicSetup();
        $subject = Subject::create(['name' => 'Mathematics', 'code' => 'MATH']);
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $exam = $this->postJson('/api/v1/exams', [
            'name' => 'Final',
            'academic_year_id' => $context['year']->id,
            'term_id' => $context['term']->id,
            'subject' => $subject->id,
            'grade' => $context['grade']->id,
            'date' => '2026-11-01',
            'total_marks' => 100,
            'type' => 'final',
        ])->assertStatus(201);

        $this->postJson('/api/v1/exams/'.$exam->json('id').'/results', [
            'results' => [['student_id' => $student->id, 'score' => 95]],
        ])->assertStatus(201);

        $attendance = Attendance::create([
            'academic_year_id' => $context['year']->id,
            'term_id' => $context['term']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'date' => '2026-09-10',
        ]);
        AttendanceRecord::create([
            'attendance_id' => $attendance->id,
            'student_id' => $student->id,
            'status' => 'present',
        ]);

        $created = $this->postJson('/api/v1/report-cards', [
            'student_id' => $student->id,
            'term_id' => $context['term']->id,
            'academic_year_id' => $context['year']->id,
            'teacher_comment' => 'Steady progress this term.',
        ])->assertStatus(201);

        $this->assertEquals(95.0, (float) $created->json('overall_average'));
        $this->assertSame('A+', $created->json('overall_grade'));
        $this->assertNotEmpty($created->json('payload.subjects'));
        $this->assertNotNull($created->json('attendance_rate'));

        // Contract the report-card view depends on: subject lines carry their own
        // percentage and letter grade so the UI does not have to re-derive them.
        $line = $created->json('payload.subjects.0');
        $this->assertArrayHasKey('subject', $line);
        $this->assertArrayHasKey('percentage', $line);
        $this->assertArrayHasKey('grade', $line);
        $this->assertSame('Steady progress this term.', $created->json('teacher_comment'));
        $this->assertNotNull($created->json('student.grade.name'));

        $this->getJson('/api/v1/report-cards?student_id='.$student->id)
            ->assertStatus(200)
            ->assertJsonPath('data.0.payload.subjects.0.grade', $line['grade']);

        $this->getJson('/api/v1/report-cards/'.$created->json('id'))
            ->assertStatus(200)
            ->assertJsonFragment(['overall_grade' => 'A+']);
    }

    public function test_report_card_pdf_download(): void
    {
        $context = $this->academicSetup();
        $subject = Subject::create(['name' => 'Mathematics', 'code' => 'MATH']);
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $exam = $this->postJson('/api/v1/exams', [
            'name' => 'Final',
            'academic_year_id' => $context['year']->id,
            'term_id' => $context['term']->id,
            'subject' => $subject->id,
            'grade' => $context['grade']->id,
            'date' => '2026-11-01',
            'total_marks' => 100,
            'type' => 'final',
        ])->assertStatus(201);

        $this->postJson('/api/v1/exams/'.$exam->json('id').'/results', [
            'results' => [['student_id' => $student->id, 'score' => 91]],
        ])->assertStatus(201);

        $card = $this->postJson('/api/v1/report-cards', [
            'student_id' => $student->id,
            'term_id' => $context['term']->id,
            'academic_year_id' => $context['year']->id,
            'teacher_comment' => 'Excellent work.',
        ])->assertStatus(201);

        $response = $this->get("/api/v1/report-cards/{$card->json('id')}/pdf");
        $response->assertStatus(200);
        $this->assertSame(
            'application/pdf',
            $response->headers->get('Content-Type')
        );
        $this->assertStringContainsString('report-card-', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertGreaterThan(1000, strlen($response->getContent()));

        // A different student may not pull someone else's report card PDF.
        Sanctum::actingAs($this->makeStudentUser($context));
        $this->get("/api/v1/report-cards/{$card->json('id')}/pdf")->assertStatus(403);
        $this->getJson("/api/v1/report-cards/{$card->json('id')}")->assertStatus(403);
        $this->getJson('/api/v1/report-cards')->assertStatus(200)
            ->assertJsonMissing(['student_id' => $student->id]);

        // ...but the student named on the card can read their own.
        Sanctum::actingAs($studentUser);
        $this->get("/api/v1/report-cards/{$card->json('id')}/pdf")->assertStatus(200);
    }

    public function test_preschool_assessments_with_configurable_ratings(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $this->postJson('/api/v1/preschool-assessments', [
            'student_id' => $student->id,
            'term_id' => $context['term']->id,
            'skill' => 'Fine motor skills',
            'rating' => 'excellent',
            'notes' => 'Cuts along a line',
        ])->assertStatus(201)
            ->assertJsonFragment(['skill' => 'Fine motor skills']);

        SchoolSetting::create([
            'key' => 'preschool_rating_scale',
            'value' => '["mastering","emerging"]',
            'type' => 'json',
            'group' => 'academics',
        ]);

        $this->postJson('/api/v1/preschool-assessments', [
            'student_id' => $student->id,
            'term_id' => $context['term']->id,
            'skill' => 'Counting',
            'rating' => 'mastering',
        ])->assertStatus(201);

        $this->postJson('/api/v1/preschool-assessments', [
            'student_id' => $student->id,
            'term_id' => $context['term']->id,
            'skill' => 'Counting',
            'rating' => 'excellent',
        ])->assertStatus(422);

        $this->getJson('/api/v1/preschool-assessments?student_id='.$student->id)
            ->assertStatus(200);
    }

    public function test_timetable_grouping_and_conflicts(): void
    {
        $context = $this->academicSetup();
        $otherSection = Section::create(['grade_id' => $context['grade']->id, 'name' => 'B']);
        $subject = Subject::create(['name' => 'Art', 'code' => 'ART']);
        $subject2 = Subject::create(['name' => 'Music', 'code' => 'MUS']);
        $teacher = Teacher::create(['first_name' => 'Tina', 'last_name' => 'Tesfaye']);

        $this->actingAsRole('super_admin');

        $slot = $this->postJson('/api/v1/timetable', [
            'academic_year_id' => $context['year']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
            'day' => 1,
            'period' => 1,
            'start_time' => '08:00',
            'end_time' => '08:45',
            'room' => 'R1',
        ])->assertStatus(201);

        $grouped = $this->getJson('/api/v1/timetable?grade_id='.$context['grade']->id)
            ->assertStatus(200);

        foreach ([1, 2, 3, 4, 5, 6] as $day) {
            $this->assertArrayHasKey((string) $day, $grouped->json());
        }
        $this->assertCount(1, $grouped->json('1'));

        // same teacher, same day/period in another class
        $this->postJson('/api/v1/timetable', [
            'academic_year_id' => $context['year']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $otherSection->id,
            'subject_id' => $subject2->id,
            'teacher_id' => $teacher->id,
            'day' => 1,
            'period' => 1,
            'start_time' => '08:00',
            'end_time' => '08:45',
        ])->assertStatus(422)
            ->assertJson(['message' => 'Teacher already assigned at this day/period']);

        // same grade/section/period
        $this->postJson('/api/v1/timetable', [
            'academic_year_id' => $context['year']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'subject_id' => $subject2->id,
            'day' => 1,
            'period' => 1,
            'start_time' => '08:00',
            'end_time' => '08:45',
        ])->assertStatus(422);

        // same room at the same day/period (different class)
        $this->postJson('/api/v1/timetable', [
            'academic_year_id' => $context['year']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $otherSection->id,
            'subject_id' => $subject2->id,
            'day' => 1,
            'period' => 1,
            'start_time' => '08:00',
            'end_time' => '08:45',
            'room' => 'R1',
        ])->assertStatus(422);

        $this->putJson('/api/v1/timetable/'.$slot->json('id'), ['period' => 3])->assertStatus(200);
        $this->deleteJson('/api/v1/timetable/'.$slot->json('id'))->assertStatus(200);
        $this->assertSame(0, TimetableSlot::count());
    }

    public function test_library_borrow_and_return_with_fine(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $book = $this->postJson('/api/v1/library/books', [
            'title' => 'Things Fall Apart',
            'author' => 'Chinua Achebe',
            'isbn' => '978-0-435-90526-1',
            'total_copies' => 2,
        ])->assertStatus(201);

        $bookId = $book->json('id');
        $this->assertSame(2, $book->json('copies_count'));

        $search = $this->getJson('/api/v1/library/books?q=Achebe')->assertStatus(200);
        $this->assertCount(1, $search->json('data'));

        $borrowing = $this->postJson("/api/v1/library/books/{$bookId}/borrow", [
            'student_id' => $student->id,
        ])->assertStatus(201);

        $this->assertSame('issued', $borrowing->json('status'));
        $this->assertNotNull($borrowing->json('due_at'));

        $this->getJson('/api/v1/library/borrowings?student_id='.$student->id)
            ->assertStatus(200)
            ->assertJsonFragment(['status' => 'issued']);

        Borrowing::where('id', $borrowing->json('id'))
            ->update(['due_at' => now()->subDays(3)]);

        $returned = $this->postJson('/api/v1/library/borrowings/'.$borrowing->json('id').'/return')
            ->assertStatus(200);

        $this->assertSame('returned', $returned->json('status'));
        $this->assertEquals(6.0, (float) $returned->json('fine.amount'));
        $this->assertSame(2, (int) Book::find($bookId)->fresh()->available_copies);
    }

    public function test_health_endpoints(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $this->postJson('/api/v1/health/visits', [
            'student_id' => $student->id,
            'symptoms' => 'Headache and fever',
            'treatment' => 'Rest and fluids',
            'medication' => 'Paracetamol 500mg',
            'follow_up' => now()->addDays(3)->toDateString(),
        ])->assertStatus(201)
            ->assertJsonFragment(['symptoms' => 'Headache and fever']);

        $this->getJson('/api/v1/health/visits?student_id='.$student->id)->assertStatus(200);

        $this->postJson('/api/v1/health/records', [
            'student_id' => $student->id,
            'allergies' => 'Peanuts',
            'blood_group' => 'O+',
            'medical_notes' => 'Asthma inhaler as needed',
        ])->assertStatus(201)
            ->assertJsonFragment(['medical_notes' => 'Asthma inhaler as needed']);

        $this->getJson('/api/v1/health/records?student_id='.$student->id)
            ->assertStatus(200)
            ->assertJsonFragment(['allergies' => 'Peanuts']);

        $this->assertSame(1, HealthRecord::where('student_id', $student->id)->count());

        $nurse = User::factory()->create();
        $nurse->assignRole('nurse');
        Sanctum::actingAs($nurse);

        $this->postJson('/api/v1/health/visits', [
            'student_id' => $student->id,
            'symptoms' => 'Sore throat',
        ])->assertStatus(201);
    }

    public function test_transport_endpoints(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        $route = $this->postJson('/api/v1/transport/routes', [
            'name' => 'Route A',
            'code' => 'RA',
            'driver_name' => 'Dawit',
            'vehicle' => ['plate_no' => 'AA-1234', 'model' => 'Toyota', 'capacity' => 30],
        ])->assertStatus(201);

        $routeId = $route->json('id');

        $this->postJson("/api/v1/transport/routes/{$routeId}/stops", [
            'name' => 'Main Gate',
            'arrival_time' => '07:15',
            'order_index' => 1,
        ])->assertStatus(201);

        $this->getJson("/api/v1/transport/routes/{$routeId}")
            ->assertStatus(200)
            ->assertJsonFragment(['name' => 'Main Gate']);

        $this->getJson('/api/v1/transport/routes')->assertStatus(200);

        $this->postJson('/api/v1/transport/assignments', [
            'route_id' => $routeId,
            'student_id' => $student->id,
        ])->assertStatus(201);

        $this->getJson('/api/v1/transport/assignments?route_id='.$routeId)
            ->assertStatus(200)
            ->assertJsonFragment(['status' => 'active']);

        $this->assertSame(1, TransportRoute::count());
    }

    public function test_reports_summary_and_csv_export(): void
    {
        $this->actingAsRole('super_admin');

        foreach (['attendance', 'finance', 'enrollment', 'academics'] as $report) {
            $this->getJson("/api/v1/reports/summary?report={$report}")->assertStatus(200);
        }

        $this->getJson('/api/v1/reports/summary?report=bogus')->assertStatus(422);

        foreach (['attendance', 'finance', 'enrollment', 'academics'] as $report) {
            $response = $this->get("/api/v1/reports/export.csv?report={$report}");
            $response->assertStatus(200);
            $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
            $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
            $this->assertNotEmpty($response->streamedContent());
        }
    }

    public function test_reports_xlsx_export(): void
    {
        // Real rows: an export with no data would never exercise cell writing.
        $context = $this->academicSetup();
        $this->makeStudentUser($context);

        $this->actingAsRole('super_admin');

        foreach (['attendance', 'finance', 'enrollment', 'academics'] as $report) {
            $response = $this->get("/api/v1/reports/export.xlsx?report={$report}");
            $response->assertStatus(200);

            $this->assertStringContainsString(
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                (string) $response->headers->get('Content-Type')
            );
            $this->assertStringContainsString("report-{$report}-", (string) $response->headers->get('Content-Disposition'));
            $this->assertStringContainsString('.xlsx', (string) $response->headers->get('Content-Disposition'));

            $body = (string) $response->getContent();
            // xlsx is a zip archive: "PK\x03\x04"
            $this->assertSame('PK', substr($body, 0, 2));
            $this->assertGreaterThan(500, strlen($body));
            $this->assertNotNull($this->sheetXml($body), 'xlsx must contain xl/worksheets/sheet1.xml');
        }

        // The workbook must actually carry the report's rows (enrollment is a
        // per-grade count), proving cells are written and not just a header.
        $xlsx = (string) $this->get('/api/v1/reports/export.xlsx?report=enrollment')->getContent();
        $text = $this->workbookText($xlsx);
        $this->assertStringContainsString('Grade 1', $text);
        $this->assertStringContainsString('Primary', $text);

        $this->get('/api/v1/reports/export.xlsx?report=bogus')->assertStatus(422);

        // Export is permission-gated.
        Sanctum::actingAs(User::factory()->create());
        $this->get('/api/v1/reports/export.xlsx?report=finance')->assertStatus(403);
    }

    /** Concatenated sheet + shared-string XML from a generated xlsx buffer. */
    protected function workbookText(string $binary): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'smis_test_');
        file_put_contents($tmp, $binary);

        $zip = new \ZipArchive;
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);

            return '';
        }

        $text = '';
        foreach (['xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml'] as $entry) {
            $text .= (string) $zip->getFromName($entry);
        }

        $zip->close();
        @unlink($tmp);

        return $text;
    }

    /** Reads xl/worksheets/sheet1.xml out of a generated xlsx buffer. */
    protected function sheetXml(string $binary): ?string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'smis_test_');
        file_put_contents($tmp, $binary);

        $zip = new \ZipArchive;
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);

            return null;
        }

        $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        @unlink($tmp);

        return $xml === false ? null : $xml;
    }

    public function test_student_timeline(): void
    {
        $context = $this->academicSetup();
        $studentUser = $this->makeStudentUser($context);
        $student = Student::where('user_id', $studentUser->id)->first();

        $this->actingAsRole('super_admin');

        Enrollment::create([
            'student_id' => $student->id,
            'academic_year_id' => $context['year']->id,
            'level_id' => $context['level']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'enrollment_date' => '2026-09-01',
            'status' => 'enrolled',
        ]);

        $attendance = Attendance::create([
            'academic_year_id' => $context['year']->id,
            'grade_id' => $context['grade']->id,
            'section_id' => $context['section']->id,
            'date' => '2026-09-02',
        ]);
        AttendanceRecord::create([
            'attendance_id' => $attendance->id,
            'student_id' => $student->id,
            'status' => 'present',
        ]);

        $response = $this->getJson('/api/v1/students/'.$student->id.'/timeline')
            ->assertStatus(200);

        $response->assertJsonStructure(['student' => ['id', 'admission_no', 'first_name'], 'events']);
        $this->assertNotEmpty($response->json('events'));

        $dates = array_column($response->json('events'), 'date');
        $sorted = $dates;
        rsort($sorted);
        $this->assertSame($sorted, $dates);

        $types = array_column($response->json('events'), 'type');
        $this->assertContains('enrollment', $types);
        $this->assertContains('attendance', $types);
    }
}
