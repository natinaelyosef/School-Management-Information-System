<?php

namespace App\Contracts;

use App\Models\User;

interface NotificationChannel
{
    /**
     * Stable channel name, matching the `channel` column on notification_logs
     * (e.g. 'database', 'telegram', 'sms').
     */
    public function name(): string;

    /**
     * Whether this channel is switched on and has usable credentials.
     */
    public function isEnabled(): bool;

    /**
     * Attempt delivery. Implementations must not throw — a provider failure is
     * a result, not an exception, so notification dispatch never breaks a
     * request. Return true only when the provider accepted the message.
     */
    public function send(User $user, string $title, ?string $body = null): bool;

    /**
     * Why the channel could not deliver, for the log's status field.
     */
    public function lastFailure(): ?string;
}
