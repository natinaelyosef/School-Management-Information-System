<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Payment reminder / escalation ladder
    |--------------------------------------------------------------------------
    |
    | Day 0 is the invoice due date. Each stage fires at most once per invoice,
    | recorded on payment_reminders with (invoice, stage, days_overdue).
    |
    | Nothing here ever blocks a child from attending school: the final stage
    | only creates a task for an administrator to review under school policy.
    |
    */

    'reminder_days' => array_values(array_filter(
        array_map('intval', explode(',', (string) env('PAYMENT_REMINDER_DAYS', '0,1,2'))),
        fn ($d) => $d >= 0
    )),

    'contact_parent_days' => (int) env('PAYMENT_CONTACT_PARENT_DAYS', 5),

    'final_warning_days' => (int) env('PAYMENT_FINAL_WARNING_DAYS', 7),

    /** Statuses the ladder skips entirely. */
    'settled_statuses' => ['paid', 'cancelled', 'waived', 'written_off'],

    /** Roles notified when a case escalates to an administrator. */
    'escalation_roles' => ['accountant', 'school_admin', 'super_admin'],
];
