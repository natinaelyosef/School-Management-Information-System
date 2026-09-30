<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Grade;
use App\Models\Message;
use App\Models\NotificationLog;
use App\Models\ParentModel;
use App\Models\Payment;
use App\Models\SchoolLevel;
use App\Models\SchoolSetting;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function family(): array
    {
        $level = SchoolLevel::create(['name' => 'Middle', 'code' => 'MID', 'order_index' => 1]);
        $grade = Grade::create(['school_level_id' => $level->id, 'name' => 'Grade 8', 'order_index' => 1]);
        $section = Section::create(['grade_id' => $grade->id, 'name' => 'A']);
        $year = AcademicYear::create([
            'name' => '2026/2027', 'code' => '2026', 'is_current' => true,
            'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
        ]);

        $parentUser = User::factory()->create();
        $parentUser->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $parentUser->id,
            'first_name' => 'Abebe',
            'last_name' => 'Kebede',
            'email' => $parentUser->email,
        ]);

        $student = Student::create([
            'admission_no' => 'ST'.uniqid(),
            'first_name' => 'John',
            'last_name' => 'Doe',
            'level_id' => $level->id,
            'grade_id' => $grade->id,
            'section_id' => $section->id,
            'academic_year_id' => $year->id,
        ]);
        $parent->students()->attach($student->id);

        $invoice = StudentInvoice::create([
            'invoice_no' => 'INV-2026-00251',
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'issue_date' => '2026-09-01',
            'due_date' => '2026-10-30',
            'subtotal' => 15000,
            'total' => 15000,
            'amount_paid' => 8000,
            'balance' => 7000,
            'status' => 'partial',
        ]);

        return compact('parentUser', 'parent', 'student', 'invoice', 'year');
    }

    public function test_parent_submits_bank_transfer_proof(): void
    {
        Storage::fake('public');
        $c = $this->family();
        Sanctum::actingAs($c['parentUser']);

        $response = $this->postJson('/api/v1/payment-proofs', [
            'invoice_id' => $c['invoice']->id,
            'amount' => 7000,
            'payment_date' => '2026-09-28',
            'bank' => 'Commercial Bank of Ethiopia',
            'reference' => 'TXN-998877',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 64, 'application/pdf'),
        ])->assertStatus(201);

        $this->assertSame('under_verification', $response->json('status'));
        $this->assertCount(1, $response->json('proofs'));
        $this->assertSame(1, Payment::where('status', 'under_verification')->count());
        $this->assertSame(
            1,
            NotificationLog::where('type', 'payment')
                ->where('title', 'New payment proof awaiting verification')
                ->count()
        );

        Storage::disk('public')->assertExists(Payment::first()->proofs()->first()->file_path);
    }

    public function test_parent_cannot_overpay_or_touch_other_invoice(): void
    {
        Storage::fake('public');
        $c = $this->family();
        Sanctum::actingAs($c['parentUser']);

        $this->postJson('/api/v1/payment-proofs', [
            'invoice_id' => $c['invoice']->id,
            'amount' => 999999,
            'payment_date' => '2026-09-28',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 64, 'application/pdf'),
        ])->assertStatus(422);

        // a stranger's invoice is forbidden
        $otherStudent = Student::create([
            'admission_no' => 'ST'.uniqid(),
            'first_name' => 'Other',
            'last_name' => 'Child',
        ]);
        $foreign = StudentInvoice::create([
            'invoice_no' => 'INV-2026-99999',
            'student_id' => $otherStudent->id,
            'issue_date' => '2026-09-01',
            'total' => 1000, 'subtotal' => 1000, 'balance' => 1000, 'amount_paid' => 0,
            'status' => 'unpaid',
        ]);

        $this->postJson('/api/v1/payment-proofs', [
            'invoice_id' => $foreign->id,
            'amount' => 500,
            'payment_date' => '2026-09-28',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 64, 'application/pdf'),
        ])->assertStatus(403);
    }

    public function test_accountant_verifies_and_parent_is_notified(): void
    {
        Storage::fake('public');
        $c = $this->family();

        Sanctum::actingAs($c['parentUser']);
        $paymentId = $this->postJson('/api/v1/payment-proofs', [
            'invoice_id' => $c['invoice']->id,
            'amount' => 7000,
            'payment_date' => '2026-09-28',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 64, 'application/pdf'),
        ])->assertStatus(201)->json('id');

        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');
        Sanctum::actingAs($accountant);

        $this->getJson('/api/v1/payments/queue')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $paymentId]);

        $this->postJson("/api/v1/payments/{$paymentId}/verify", [
            'action' => 'verified',
            'comment' => 'Matched bank statement.',
        ])->assertStatus(200)
            ->assertJsonFragment(['status' => 'verified']);

        $invoice = $c['invoice']->fresh();
        $this->assertSame(15000.0, (float) $invoice->amount_paid);
        $this->assertSame(0.0, (float) $invoice->balance);
        $this->assertSame('paid', $invoice->status);

        $this->assertSame(
            1,
            NotificationLog::where('user_id', $c['parentUser']->id)
                ->where('title', 'Payment verified')
                ->count()
        );
    }

    public function test_accountant_can_reject_or_request_more_information(): void
    {
        Storage::fake('public');
        $c = $this->family();

        Sanctum::actingAs($c['parentUser']);
        $paymentId = $this->postJson('/api/v1/payment-proofs', [
            'invoice_id' => $c['invoice']->id,
            'amount' => 7000,
            'payment_date' => '2026-09-28',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 64, 'application/pdf'),
        ])->json('id');

        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');
        Sanctum::actingAs($accountant);

        $this->postJson("/api/v1/payments/{$paymentId}/verify", [
            'action' => 'more_information_required',
            'comment' => 'Send a clearer transaction receipt.',
        ])->assertStatus(200)->assertJsonFragment(['status' => 'more_information_required']);

        $this->assertSame(
            1,
            NotificationLog::where('user_id', $c['parentUser']->id)
                ->where('title', 'More information required')
                ->count()
        );

        $this->postJson("/api/v1/payments/{$paymentId}/verify", [
            'action' => 'rejected',
            'comment' => 'Transaction reference could not be verified.',
        ])->assertStatus(200)->assertJsonFragment(['status' => 'rejected']);

        // balance must NOT move when rejected
        $this->assertSame(7000.0, (float) $c['invoice']->fresh()->balance);

        $this->assertSame(
            1,
            NotificationLog::where('user_id', $c['parentUser']->id)
                ->where('title', 'Payment verification failed')
                ->count()
        );
    }

    public function test_parents_only_see_their_own_invoices(): void
    {
        $c = $this->family();
        Sanctum::actingAs($c['parentUser']);

        $this->getJson('/api/v1/invoices')
            ->assertStatus(200)
            ->assertJsonFragment(['invoice_no' => 'INV-2026-00251']);

        // unrelated invoice stays invisible
        $otherStudent = Student::create(['admission_no' => 'STX'.uniqid(), 'first_name' => 'X', 'last_name' => 'Y']);
        StudentInvoice::create([
            'invoice_no' => 'INV-2026-HIDDEN',
            'student_id' => $otherStudent->id,
            'issue_date' => '2026-09-01',
            'total' => 100, 'subtotal' => 100, 'balance' => 100, 'amount_paid' => 0, 'status' => 'unpaid',
        ]);

        $json = $this->getJson('/api/v1/invoices')->json();
        $numbers = array_column($json['data'], 'invoice_no');
        $this->assertNotContains('INV-2026-HIDDEN', $numbers);
    }

    public function test_notifications_endpoint_scopes_to_current_user(): void
    {
        $me = User::factory()->create();
        $me->assignRole('accountant');
        $other = User::factory()->create();

        NotificationLog::create(['user_id' => $me->id, 'title' => 'Mine', 'type' => 'payment', 'status' => 'sent', 'sent_at' => now()]);
        NotificationLog::create(['user_id' => $other->id, 'title' => 'Not mine', 'type' => 'payment', 'status' => 'sent', 'sent_at' => now()]);

        Sanctum::actingAs($me);

        $this->getJson('/api/v1/notifications/unread-count')->assertStatus(200)->assertJson(['count' => 1]);

        $list = $this->getJson('/api/v1/notifications')->assertStatus(200);
        $this->assertSame(['Mine'], array_column($list->json('data'), 'title'));

        $id = $list->json('data.0.id');
        $this->postJson("/api/v1/notifications/{$id}/read")->assertStatus(200);
        $this->getJson('/api/v1/notifications/unread-count')->assertJson(['count' => 0]);

        // cannot read someone else's notification
        $foreign = NotificationLog::create(['user_id' => $other->id, 'title' => 'Foreign', 'type' => 'payment', 'status' => 'sent', 'sent_at' => now()]);
        $this->postJson("/api/v1/notifications/{$foreign->id}/read")->assertStatus(403);
    }

    public function test_compose_message_creates_conversation_and_inbox_flattens(): void
    {
        $sender = User::factory()->create();
        $sender->assignRole('registrar');
        $recipient = User::factory()->create();
        $recipient->assignRole('accountant');

        Sanctum::actingAs($sender);

        $this->postJson('/api/v1/messages', [
            'recipient_id' => $recipient->id,
            'subject' => 'Enrollment complete',
            'body' => 'Student STD-2026-00125 enrolled. Please verify the outstanding fee.',
            'context' => 'fees',
        ])->assertStatus(201)
            ->assertJsonFragment(['subject' => 'Enrollment complete']);

        $this->assertSame(1, Conversation::count());
        $this->assertSame(1, Message::count());

        $sent = $this->getJson('/api/v1/messages/sent')->assertStatus(200);
        $this->assertCount(1, $sent->json('data'));

        // recipient sees it in the inbox
        Sanctum::actingAs($recipient);
        $inbox = $this->getJson('/api/v1/messages/inbox')->assertStatus(200);
        $this->assertCount(1, $inbox->json('data'));
        $this->assertFalse($inbox->json('data.0.is_read'));

        $messageId = $inbox->json('data.0.id');
        $this->postJson("/api/v1/messages/{$messageId}/read")->assertStatus(200);
        $this->assertTrue($this->getJson('/api/v1/messages/inbox')->json('data.0.is_read'));

        $this->postJson("/api/v1/messages/{$messageId}/star")->assertStatus(200);
        $this->assertTrue($this->getJson('/api/v1/messages/inbox')->json('data.0.is_starred'));

        // strangers do not see the conversation
        $outsider = User::factory()->create();
        $outsider->assignRole('librarian');
        Sanctum::actingAs($outsider);
        $this->getJson('/api/v1/messages/inbox')->assertStatus(200)->assertJsonCount(0, 'data');
        $this->assertSame(0, ConversationParticipant::where('user_id', $outsider->id)->count());
    }

    public function test_compose_by_role_reaches_a_user_in_that_role(): void
    {
        $accountant = User::factory()->create();
        $accountant->assignRole('accountant');

        $parent = User::factory()->create();
        $parent->assignRole('parent');

        Sanctum::actingAs($parent);

        $this->postJson('/api/v1/messages', [
            'recipient_role' => 'accountant',
            'subject' => 'Payment question',
            'body' => 'I transferred the money yesterday.',
            'context' => 'fees',
        ])->assertStatus(201);

        $this->assertTrue(Message::first()->conversation->participants()->where('user_id', $accountant->id)->exists());
    }

    public function test_payment_settings_are_readable_but_not_writable_without_permission(): void
    {
        SchoolSetting::create(['key' => 'payment_bank_name', 'value' => 'Commercial Bank of Ethiopia', 'group' => 'payment']);
        SchoolSetting::create(['key' => 'payment_account_number', 'value' => '100012345678', 'group' => 'payment']);
        SchoolSetting::create(['key' => 'payment_reference_hint', 'value' => 'Use student ID / invoice number', 'group' => 'payment']);

        $parent = User::factory()->create();
        $parent->assignRole('parent');
        Sanctum::actingAs($parent);

        $this->getJson('/api/v1/settings/payment')
            ->assertStatus(200)
            ->assertJson([
                'bank_name' => 'Commercial Bank of Ethiopia',
                'account_number' => '100012345678',
                'reference_hint' => 'Use student ID / invoice number',
            ]);

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'payment_bank_name', 'value' => 'Hacked']],
        ])->assertStatus(403);

        // admin can update
        $admin = User::factory()->create();
        $admin->assignRole('super_admin');
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'payment_bank_name', 'value' => 'Awash Bank']],
        ])->assertStatus(200);

        $this->assertSame('Awash Bank', SchoolSetting::where('key', 'payment_bank_name')->value('value'));
    }
}
