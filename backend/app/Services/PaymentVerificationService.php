<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\StudentInvoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PaymentVerificationService
{
    public function __construct(
        protected NotificationService $notifications,
        protected MessagingService $messaging,
    ) {}

    public function verify(Payment $payment, User $verifier, string $action, ?string $comment = null, string $channel = 'database'): Payment
    {
        abort_unless(
            in_array($action, ['verified', 'rejected', 'more_information_required'], true),
            422,
            'Invalid action'
        );

        $payment = DB::transaction(function () use ($payment, $verifier, $action, $comment) {
            $payment->update(['status' => $action]);
            $payment->verifications()->create([
                'verified_by' => $verifier->id,
                'action' => $action,
                'comment' => $comment,
                'verified_at' => now(),
            ]);

            $invoice = $payment->student_invoice_id
                ? StudentInvoice::lockForUpdate()->find($payment->student_invoice_id)
                : null;

            if ($action === 'verified' && $invoice) {
                $invoice->amount_paid = (float) $invoice->amount_paid + (float) $payment->amount;
                $invoice->balance = max(0, (float) $invoice->total - (float) $invoice->amount_paid);
                $invoice->status = $invoice->balance <= 0 ? 'paid' : 'partial';
                $invoice->save();
            }

            return $payment->fresh(['verifications', 'invoice', 'student', 'proofs']);
        });

        $this->notifyParent($payment, $verifier, $action, $comment, $channel);

        return $payment;
    }

    protected function notifyParent(Payment $payment, User $verifier, string $action, ?string $comment, string $channel): void
    {
        try {
            $parents = $payment->student?->parents()->with('user')->get() ?? collect();
            if ($parents->isEmpty()) {
                return;
            }

            $invoiceNo = $payment->invoice?->invoice_no ?? 'your invoice';
            $amount = number_format((float) $payment->amount, 2);

            [$title, $body] = match ($action) {
                'verified' => [
                    'Payment verified',
                    "Your payment of {$amount} for invoice {$invoiceNo} has been received and verified. A receipt is now available.",
                ],
                'rejected' => [
                    'Payment verification failed',
                    trim("Payment {$amount} for invoice {$invoiceNo} could not be verified.".($comment ? " Reason: {$comment}" : '')),
                ],
                default => [
                    'More information required',
                    trim("We need more information about your payment of {$amount} for invoice {$invoiceNo}.".($comment ? " {$comment}" : '')),
                ],
            };

            foreach ($parents as $parent) {
                if (! $parent->user) {
                    continue;
                }

                // Always hit the in-app feed, plus whatever external channels
                // this parent has opted into.
                $targets = $this->notifications->preferredChannelsFor($parent->user);

                if ($channel === 'message') {
                    $targets[] = 'database';
                    $conversation = $this->messaging->createConversation(
                        $verifier,
                        [$parent->user->id],
                        $title,
                        'direct'
                    );
                    $this->messaging->sendMessage($conversation, $verifier, $body);
                } else {
                    $targets[] = $channel;
                }

                $this->notifications->sendMany($parent->user, 'payment', $title, $body, $targets, $payment);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
