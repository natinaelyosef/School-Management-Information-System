<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StudentAbsentNotification extends Notification
{
    use Queueable;

    public function __construct(public string $studentName, public string $date) {}

    public function via($notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Absence alert: {$this->studentName}")
            ->line("{$this->studentName} was marked absent on {$this->date}.")
            ->line('Please contact the school if this is unexpected.');
    }

    public function toArray($notifiable): array
    {
        return ['type' => 'absent', 'student' => $this->studentName, 'date' => $this->date];
    }
}
