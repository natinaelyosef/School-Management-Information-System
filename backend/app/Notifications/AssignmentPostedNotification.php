<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AssignmentPostedNotification extends Notification
{
    use Queueable;

    public function __construct(public string $title, public $dueDate = null) {}

    public function via($notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("New assignment: {$this->title}")
            ->line("A new assignment '{$this->title}' has been posted.")
            ->line($this->dueDate ? "Due date: {$this->dueDate}" : 'Check the portal for details.');
    }

    public function toArray($notifiable): array
    {
        return ['type' => 'assignment', 'title' => $this->title, 'due_date' => $this->dueDate];
    }
}
