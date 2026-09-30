<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\NotificationLog;
use App\Models\ParentModel;
use App\Models\PaymentReminder;
use App\Models\PaymentTask;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\User;
use App\Services\PaymentEscalationService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentEscalationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function overdueInvoice(int $daysOverdue): array
    {
        $level = SchoolLevel::firstOrCreate(
            ['code' => 'PRI'],
            ['name' => 'Primary', 'order_index' => 1]
        );
        $grade = Grade::firstOrCreate(
            ['school_level_id' => $level->id, 'name' => 'Grade 2'],
            ['order_index' => 1]
        );
        $section = Section::firstOrCreate(
            ['grade_id' => $grade->id, 'name' => 'A']
        );
        $year = AcademicYear::firstOrCreate(
            ['code' => '2026'],
            [
                'name' => '2026/2027', 'is_current' => true,
                'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
            ]
        );

        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $parentUser->id,
            'first_name' => 'Sara',
            'last_name' => 'Tola',
            'email' => $parentUser->email,
        ]);

        $student = Student::create([
            'admission_no' => 'ST'.uniqid(),
            'first_name' => 'Noah',
            'last_name' => 'Tola',
            'level_id' => $level->id,
            'grade_id' => $grade->id,
            'section_id' => $section->id,
            'academic_year_id' => $year->id,
        ]);
        $parent->students()->attach($student->id);

        $invoice = StudentInvoice::create([
            'invoice_no' => 'INV-'.uniqid(),
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'issue_date' => now()->subDays($daysOverdue + 30)->toDateString(),
            'due_date' => now()->subDays($daysOverdue)->toDateString(),
            'subtotal' => 5000,
            'total' => 5000,
            'amount_paid' => 0,
            'balance' => 5000,
            'status' => 'unpaid',
        ]);

        return compact('parentUser', 'parent', 'student', 'invoice');
    }

    protected function runLadder(): array
    {
        return app(PaymentEscalationService::class)->run();
    }

    public function test_first_overdue_day_records_a_reminder_and_marks_the_invoice_overdue(): void
    {
        ['parentUser' => $parentUser, 'invoice' => $invoice] = $this->overdueInvoice(1);

        $summary = $this->runLadder();

        $this->assertSame(1, $summary['reminders']);
        $this->assertSame(1, $summary['statuses']);

        $invoice->refresh();
        $this->assertSame('overdue', $invoice->status);

        $reminder = PaymentReminder::where('student_invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame('overdue_reminder', $reminder->stage);
        $this->assertSame(1, (int) $reminder->days_overdue);

        $this->assertDatabaseHas('notification_logs', [
            'user_id' => $parentUser->id,
            'type' => 'payment',
        ]);
    }

    public function test_re_running_the_ladder_never_duplicates_a_stage(): void
    {
        $this->overdueInvoice(1);

        $this->runLadder();
        $second = $this->runLadder();

        $this->assertSame(0, $second['reminders']);
        $this->assertSame(1, PaymentReminder::count());
        $this->assertSame(1, NotificationLog::count());
    }

    public function test_day_five_creates_a_contact_parent_task_and_notifies_the_office(): void
    {
        $this->overdueInvoice(5);

        $summary = $this->runLadder();

        $this->assertGreaterThanOrEqual(1, $summary['tasks']);
        $this->assertSame(1, PaymentTask::where('type', 'contact_parent')->where('status', 'open')->count());

        $reminder = PaymentReminder::firstOrFail();
        $this->assertSame('contact_parent', $reminder->stage);

        // finance office staff were told about it
        $this->assertGreaterThan(0, NotificationLog::where('title', 'Overdue payment follow-up')->count());

        // running again must not spawn a second open task
        $this->runLadder();
        $this->assertSame(1, PaymentTask::count());
    }

    public function test_day_seven_is_the_final_warning_and_never_blocks_the_child(): void
    {
        ['student' => $student, 'invoice' => $invoice] = $this->overdueInvoice(7);

        $this->runLadder();

        $this->assertSame('final_warning', PaymentReminder::firstOrFail()->stage);
        $this->assertSame(1, PaymentTask::where('type', 'final_warning')->where('status', 'open')->count());

        // the ladder only ever records warnings: the child stays enrolled and active
        $this->assertSame('active', $student->fresh()->status);
        $this->assertSame(1, Student::count());
        $this->assertTrue(Student::where('id', $invoice->student_id)->exists());
    }

    public function test_settled_invoices_are_skipped_entirely(): void
    {
        ['invoice' => $invoice] = $this->overdueInvoice(10);
        $invoice->update(['status' => 'paid', 'balance' => 0]);

        $summary = $this->runLadder();

        $this->assertSame(0, $summary['reminders']);
        $this->assertSame(0, PaymentReminder::count());
        $this->assertSame(0, PaymentTask::count());
    }

    public function test_dashboard_summarises_due_and_overdue_invoices(): void
    {
        $this->overdueInvoice(1);
        $this->overdueInvoice(4);
        $this->overdueInvoice(9);
        $this->overdueInvoice(0);

        $dashboard = app(PaymentEscalationService::class)->dashboard();

        $this->assertSame(1, $dashboard['due_today']);
        $this->assertSame(1, $dashboard['overdue_1_2']);
        $this->assertSame(1, $dashboard['overdue_3_5']);
        $this->assertSame(1, $dashboard['overdue_6_plus']);
        $this->assertArrayHasKey('stages_fired', $dashboard);
    }

    public function test_accountant_can_work_the_contact_parent_task_queue(): void
    {
        $this->overdueInvoice(5);
        $this->runLadder();

        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');

        $this->actingAs($accountant, 'sanctum')
            ->getJson('/api/v1/payment-tasks')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $task = PaymentTask::firstOrFail();

        $this->actingAs($accountant, 'sanctum')
            ->postJson("/api/v1/payment-tasks/{$task->id}/complete", [
                'outcome' => 'will_pay',
                'notes' => 'Parent promised to pay on Friday.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('outcome', 'will_pay');

        $this->actingAs($accountant, 'sanctum')
            ->getJson('/api/v1/finance/escalation')
            ->assertOk()
            ->assertJsonStructure(['due_today', 'overdue_1_2', 'contact_parent_tasks']);
    }

    public function test_task_endpoints_are_denied_without_permission(): void
    {
        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');

        $this->actingAs($parentUser, 'sanctum')
            ->getJson('/api/v1/payment-tasks')
            ->assertForbidden();
    }
}
