<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Models\User;

/**
 * The in-app feed. Always available: it is the durable record that powers the
 * notification bell, and other channels are layered on top of it.
 */
class DatabaseChannel implements NotificationChannel
{
    public function name(): string
    {
        return 'database';
    }

    public function isEnabled(): bool
    {
        return true;
    }

    public function send(User $user, string $title, ?string $body = null): bool
    {
        return true;
    }

    public function lastFailure(): ?string
    {
        return null;
    }
}
