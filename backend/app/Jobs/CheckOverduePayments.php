<?php

namespace App\Jobs;

use App\Services\PaymentEscalationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily overdue-payment sweep. Delegates to PaymentEscalationService so the
 * reminder ladder, parent notifications and follow-up tasks all come from one
 * idempotent place.
 */
class CheckOverduePayments implements ShouldQueue
{
    use Queueable;

    public function handle(PaymentEscalationService $escalation): void
    {
        $escalation->run();
    }
}
