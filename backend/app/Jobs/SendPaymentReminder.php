<?php

namespace App\Jobs;

use App\Models\PaymentReminder;
use App\Models\StudentInvoice;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendPaymentReminder implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $invoiceId) {}

    public function handle(NotificationService $service): void
    {
        $invoice = StudentInvoice::with('student.parents.user')->find($this->invoiceId);
        if (! $invoice) {
            return;
        }

        $message = "Reminder: invoice {$invoice->invoice_no} balance {$invoice->balance} due {$invoice->due_date}";
        $parents = $invoice->student?->parents ?? collect();

        if ($parents->isEmpty()) {
            // No parent on file: record the attempt so staff can follow up,
            // but do not claim it was sent.
            PaymentReminder::create([
                'student_invoice_id' => $invoice->id,
                'student_id' => $invoice->student_id,
                'channel' => 'database',
                'message' => $message,
                'status' => 'failed',
                'sent_at' => null,
                'sent_by' => auth()->id(),
            ]);

            return;
        }

        $title = "Payment reminder: {$invoice->invoice_no}";

        foreach ($parents as $parent) {
            if (! $parent->user) {
                continue;
            }

            $channels = $service->preferredChannelsFor($parent->user);
            $channels[] = 'database';

            $logs = $service->sendMany($parent->user, 'payment', $title, $message, $channels, $invoice);

            PaymentReminder::create([
                'student_invoice_id' => $invoice->id,
                'student_id' => $invoice->student_id,
                'channel' => $logs[0]->channel ?? 'database',
                'message' => $message,
                'status' => collect($logs)->contains(fn ($l) => $l->status === 'sent') ? 'sent' : 'failed',
                'sent_at' => now(),
                'sent_by' => auth()->id(),
            ]);
        }
    }
}
