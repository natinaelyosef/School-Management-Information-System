<?php

use App\Jobs\CheckOverduePayments;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('payments:escalate', function () {
    $summary = app(\App\Services\PaymentEscalationService::class)->run();

    $this->info(sprintf(
        'Scanned %d · reminders %d · tasks %d · statuses %d',
        $summary['scanned'],
        $summary['reminders'],
        $summary['tasks'],
        $summary['statuses']
    ));
})->purpose('Run the overdue payment reminder/escalation ladder once');

// Day 0/1/2 reminders → day 5 contact-parent task → day 7 final warning.
Schedule::job(new CheckOverduePayments)->dailyAt('06:00')->withoutOverlapping();
Schedule::command('payments:escalate')->dailyAt('18:00')->withoutOverlapping();
