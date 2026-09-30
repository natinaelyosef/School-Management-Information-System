<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentReminderNotification extends Notification
{
    use Queueable;

    public function __construct(public string $invoiceNo, public $balance) {}

    public function via($notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Payment reminder: {$this->invoiceNo}")
            ->line("Invoice {$this->invoiceNo} has an outstanding balance of {$this->balance}.")
            ->line('Please complete payment at your earliest convenience.');
    }

    public function toArray($notifiable): array
    {
        return ['type' => 'payment', 'invoice' => $this->invoiceNo, 'balance' => $this->balance];
    }
}
