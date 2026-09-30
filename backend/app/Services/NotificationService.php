<?php

namespace App\Services;

use App\Models\NotificationLog;
use App\Models\User;
use App\Services\Notifications\NotificationChannelManager;

class NotificationService
{
    public function __construct(protected NotificationChannelManager $channels) {}

    /**
     * Record and deliver a notification on a single channel.
     *
     * The NotificationLog is always written so the in-app feed stays complete
     * even when an external provider is down; `status` reflects the outcome.
     */
    public function send(?User $user, string $type, string $title, ?string $body = null, string $channel = 'database', $related = null): NotificationLog
    {
        $resolved = $this->channels->resolve($channel);
        $delivered = null;
        $failure = null;

        if ($user) {
            if (! $resolved->isEnabled()) {
                $delivered = false;
                $failure = 'channel_disabled';
            } else {
                try {
                    $delivered = $resolved->send($user, $title, $body);
                    $failure = $delivered ? null : ($resolved->lastFailure() ?? 'delivery_failed');
                } catch (\Throwable $e) {
                    // A provider must never break the calling request.
                    report($e);
                    $delivered = false;
                    $failure = 'exception: '.$e->getMessage();
                }
            }
        } else {
            $failure = 'no_recipient';
        }

        return NotificationLog::create([
            'user_id' => $user?->id,
            'channel' => $resolved->name(),
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'notifiable_type' => $related ? get_class($related) : null,
            'notifiable_id' => $related?->getKey(),
            'sent_at' => $delivered === true ? now() : null,
            'status' => match (true) {
                $delivered === true => 'sent',
                $delivered === false => 'failed',
                default => 'queued',
            },
        ]);
    }

    /**
     * Deliver the same notification across several channels, always including
     * the in-app feed. Returns one log row per channel.
     *
     * @param  array<int, string>  $channelNames
     * @return array<int, NotificationLog>
     */
    public function sendMany(?User $user, string $type, string $title, ?string $body = null, array $channelNames = ['database'], $related = null): array
    {
        $logs = [];

        foreach (array_unique(array_merge(['database'], $channelNames)) as $name) {
            $logs[] = $this->send($user, $type, $title, $body, $name, $related);
        }

        return $logs;
    }

    /** @return array<int, string> */
    public function availableChannels(): array
    {
        return $this->channels->available();
    }

    /**
     * External channels a given user has opted into (and that are configured).
     * The in-app feed is always added by sendMany().
     *
     * @return array<int, string>
     */
    public function preferredChannelsFor(?User $user): array
    {
        if (! $user) {
            return [];
        }

        $preferred = [];

        if ($user->notify_sms && $this->isChannelEnabled('sms')) {
            $preferred[] = 'sms';
        }
        if ($user->notify_telegram && $this->isChannelEnabled('telegram')) {
            $preferred[] = 'telegram';
        }

        return $preferred;
    }

    public function isChannelEnabled(string $name): bool
    {
        return $this->channels->resolve($name)->isEnabled();
    }

    public function sendAbsentNotification(User $parentUser, string $studentName, string $date, $attendance = null): NotificationLog
    {
        return $this->send($parentUser, 'absent',
            "Absence alert: {$studentName}",
            "{$studentName} was marked absent on {$date}.", 'database', $attendance);
    }

    public function sendPaymentReminder(User $user, string $invoiceNo, $invoice = null): NotificationLog
    {
        return $this->send($user, 'payment',
            "Payment reminder: {$invoiceNo}",
            "Invoice {$invoiceNo} is due. Please complete payment.", 'database', $invoice);
    }

    public function sendAssignmentNotification(User $user, string $assignmentTitle, $assignment = null): NotificationLog
    {
        return $this->send($user, 'assignment',
            "New assignment: {$assignmentTitle}",
            "A new assignment '{$assignmentTitle}' has been posted.", 'database', $assignment);
    }
}
