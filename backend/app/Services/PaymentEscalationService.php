<?php

namespace App\Services;

use App\Models\PaymentReminder;
use App\Models\PaymentTask;
use App\Models\StudentInvoice;
use App\Models\User;

/**
 * The overdue-payment ladder:
 *
 *   Day 0  due today          → reminder
 *   Day 1-2 overdue           → stronger reminders
 *   Day 5  CONTACT_PARENT     → task for the finance office + parent message
 *   Day 7  FINAL_WARNING      → configurable warning, then admin review
 *
 * Every stage is idempotent: it is recorded once per invoice, so a re-run
 * never spams the parent. The child is never automatically blocked — the
 * final stage only ever produces a task for a human to decide.
 */
class PaymentEscalationService
{
    public function __construct(protected NotificationService $notify) {}

    /**
     * @return array{scanned:int, reminders:int, tasks:int, statuses:int}
     */
    public function run(): array
    {
        $summary = ['scanned' => 0, 'reminders' => 0, 'tasks' => 0, 'statuses' => 0];

        $invoices = StudentInvoice::query()
            ->with(['student.parents.user'])
            ->whereNotNull('due_date')
            ->where('balance', '>', 0)
            ->whereNotIn('status', config('payment.settled_statuses', ['paid', 'cancelled']))
            ->get();

        $today = now()->toDateString();

        foreach ($invoices as $invoice) {
            $summary['scanned']++;

            $due = (string) $invoice->due_date;
            $daysOverdue = $this->daysBetween($due, now()->toDateString());

            if ($invoice->due_date !== $today && $invoice->status !== 'overdue') {
                if ($daysOverdue > 0) {
                    $invoice->update(['status' => 'overdue']);
                    $summary['statuses']++;
                }
            }

            $stage = $this->stageFor($daysOverdue, $due === $today);
            if ($stage === null) {
                continue;
            }

            if ($this->alreadyAt($invoice, $stage, $daysOverdue)) {
                // A task may still be missing if the run was interrupted.
                if ($stage === 'contact_parent') {
                    $summary['tasks'] += $this->ensureTask($invoice) ? 1 : 0;
                }
                continue;
            }

            $summary['reminders'] += $this->record($invoice, $stage, $daysOverdue) ? 1 : 0;
            $this->notifyParents($invoice, $stage, $daysOverdue);

            if ($stage === 'contact_parent') {
                $summary['tasks'] += $this->ensureTask($invoice) ? 1 : 0;
                $this->notifyStaff($invoice, $stage, $daysOverdue);
            }

            if ($stage === 'final_warning') {
                $summary['tasks'] += $this->ensureTask($invoice, 'final_warning') ? 1 : 0;
                $this->notifyStaff($invoice, $stage, $daysOverdue);
            }
        }

        return $summary;
    }

    /** Whole days from the due date up to (but not including) $from, never negative. */
    protected function daysBetween(string $dueDate, string $fromDate): int
    {
        $due = strtotime($dueDate.' 00:00:00');
        $from = strtotime($fromDate.' 00:00:00');

        if ($due === false || $from === false) {
            return 0;
        }

        return max(0, (int) floor(($from - $due) / 86400));
    }

    protected function stageFor(int $daysOverdue, bool $dueToday): ?string
    {
        $contactAt = (int) config('payment.contact_parent_days', 5);
        $finalAt = (int) config('payment.final_warning_days', 7);

        if ($dueToday || $daysOverdue === 0) {
            return in_array(0, config('payment.reminder_days', [0, 1, 2]), true) ? 'due_today' : null;
        }

        if ($daysOverdue >= $finalAt) {
            return 'final_warning';
        }

        if ($daysOverdue >= $contactAt) {
            return 'contact_parent';
        }

        if (in_array($daysOverdue, config('payment.reminder_days', [0, 1, 2]), true)) {
            return 'overdue_reminder';
        }

        return $daysOverdue >= 3 ? 'warning' : null;
    }

    protected function alreadyAt(StudentInvoice $invoice, string $stage, int $days): bool
    {
        return PaymentReminder::where('student_invoice_id', $invoice->id)
            ->where('stage', $stage)
            ->where('days_overdue', $days)
            ->exists();
    }

    protected function record(StudentInvoice $invoice, string $stage, int $days): bool
    {
        try {
            PaymentReminder::create([
                'student_invoice_id' => $invoice->id,
                'student_id' => $invoice->student_id,
                'stage' => $stage,
                'days_overdue' => $days,
                'channel' => 'database',
                'message' => $this->message($invoice, $stage, $days),
                'status' => 'queued',
            ]);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    protected function message(StudentInvoice $invoice, string $stage, int $days): string
    {
        $balance = number_format((float) $invoice->balance, 2);

        return match ($stage) {
            'due_today' => "Payment reminder: invoice {$invoice->invoice_no} of {$balance} ETB is due today.",
            'overdue_reminder' => "Invoice {$invoice->invoice_no} is overdue by {$days} day(s). Outstanding: {$balance} ETB.",
            'warning' => "Important: your school fee payment for invoice {$invoice->invoice_no} is still outstanding ({$days} days overdue, {$balance} ETB). Please contact the finance office.",
            'contact_parent' => "Payment overdue by {$days} days ({$balance} ETB). The finance office will contact you about invoice {$invoice->invoice_no}.",
            'final_warning' => "Final payment notice: invoice {$invoice->invoice_no} remains unsettled ({$balance} ETB, {$days} days overdue). Please contact the school finance office immediately.",
            default => "Invoice {$invoice->invoice_no} balance {$balance} ETB.",
        };
    }

    protected function notifyParents(StudentInvoice $invoice, string $stage, int $days): void
    {
        try {
            $message = $this->message($invoice, $stage, $days);
            $title = match ($stage) {
                'due_today' => "Payment due: {$invoice->invoice_no}",
                'final_warning' => "Final payment notice: {$invoice->invoice_no}",
                default => "Payment reminder: {$invoice->invoice_no}",
            };

            foreach ($invoice->student->parents ?? collect() as $parent) {
                if (! $parent->user) {
                    continue;
                }

                $channels = $this->notify->preferredChannelsFor($parent->user);
                $channels[] = 'database';

                $logs = $this->notify->sendMany($parent->user, 'payment', $title, $message, $channels, $invoice);

                PaymentReminder::where('student_invoice_id', $invoice->id)
                    ->where('stage', $stage)
                    ->where('days_overdue', $days)
                    ->update([
                        'channel' => collect($logs)->pluck('channel')->first() ?? 'database',
                        'status' => collect($logs)->contains(fn ($l) => $l->status === 'sent') ? 'sent' : 'queued',
                        'sent_at' => now(),
                    ]);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    protected function notifyStaff(StudentInvoice $invoice, string $stage, int $days): void
    {
        try {
            $message = "Invoice {$invoice->invoice_no} ({$invoice->student?->full_name}) is {$days} days overdue with {$invoice->balance} ETB outstanding. Stage: {$stage}.";

            foreach (config('payment.escalation_roles', []) as $role) {
                foreach (User::role($role)->get() as $staff) {
                    $this->notify->send($staff, 'payment', 'Overdue payment follow-up', $message, 'database', $invoice);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    protected function ensureTask(StudentInvoice $invoice, string $type = 'contact_parent'): bool
    {
        try {
            $exists = PaymentTask::where('student_invoice_id', $invoice->id)
                ->where('type', $type)
                ->where('status', 'open')
                ->exists();

            if ($exists) {
                return false;
            }

            $days = $this->daysBetween((string) $invoice->due_date, now()->toDateString());

            PaymentTask::create([
                'student_invoice_id' => $invoice->id,
                'student_id' => $invoice->student_id,
                'type' => $type,
                'priority' => $type === 'final_warning' ? 'high' : 'normal',
                'title' => $type === 'final_warning'
                    ? "Final warning review — {$invoice->invoice_no}"
                    : "Contact parent — {$invoice->invoice_no}",
                'notes' => "Outstanding {$invoice->balance} ETB, {$days} days overdue.",
                'due_date' => now()->addDay()->toDateString(),
            ]);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    /** Stage counts for the accountant escalation dashboard. */
    public function dashboard(): array
    {
        $byStage = PaymentReminder::query()
            ->selectRaw('stage, count(distinct student_invoice_id) as invoices, count(*) as sent')
            ->groupBy('stage')
            ->pluck('invoices', 'stage');

        $today = now()->toDateString();

        $dueToday = StudentInvoice::where('due_date', $today)
            ->where('balance', '>', 0)
            ->whereNotIn('status', config('payment.settled_statuses', ['paid', 'cancelled']))
            ->count();

        $overdue = StudentInvoice::whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->where('balance', '>', 0)
            ->whereNotIn('status', config('payment.settled_statuses', ['paid', 'cancelled']))
            ->get(['id', 'due_date'])
            ->groupBy(function ($inv) use ($today) {
                $days = $this->daysBetween((string) $inv->due_date, $today);

                return match (true) {
                    $days <= 2 => 'overdue_1_2',
                    $days <= 5 => 'overdue_3_5',
                    default => 'overdue_6_plus',
                };
            })
            ->map(fn ($g) => $g->count());

        return [
            'due_today' => $dueToday,
            'overdue_1_2' => (int) ($overdue['overdue_1_2'] ?? 0),
            'overdue_3_5' => (int) ($overdue['overdue_3_5'] ?? 0),
            'overdue_6_plus' => (int) ($overdue['overdue_6_plus'] ?? 0),
            'contact_parent_tasks' => PaymentTask::where('type', 'contact_parent')->where('status', 'open')->count(),
            'final_warning_tasks' => PaymentTask::where('type', 'final_warning')->where('status', 'open')->count(),
            'stages_fired' => $byStage->toArray(),
        ];
    }
}
