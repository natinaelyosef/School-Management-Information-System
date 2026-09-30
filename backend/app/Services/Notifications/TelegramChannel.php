<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramChannel implements NotificationChannel
{
    protected ?string $failure = null;

    public function name(): string
    {
        return 'telegram';
    }

    public function isEnabled(): bool
    {
        return (bool) config('notifications.channels.telegram.enabled')
            && filled(config('notifications.channels.telegram.bot_token'));
    }

    public function send(User $user, string $title, ?string $body = null): bool
    {
        $this->failure = null;

        $chatId = $this->resolveChatId($user);
        if (! $chatId) {
            $this->failure = 'no_chat_id';

            return false;
        }

        $token = (string) config('notifications.channels.telegram.bot_token');
        $base = rtrim((string) config('notifications.channels.telegram.api_base'), '/');

        try {
            $response = Http::timeout((int) config('notifications.channels.telegram.timeout', 10))
                ->post("{$base}/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $body ? "*{$title}*\n{$body}" : "*{$title}*",
                    'parse_mode' => 'Markdown',
                ]);
        } catch (\Throwable $e) {
            $this->failure = 'request_failed: '.$e->getMessage();
            Log::warning('Telegram delivery failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }

        if ($response->successful() && $response->json('ok') === true) {
            return true;
        }

        $this->failure = 'api_error: '.(string) ($response->json('description') ?? $response->status());
        Log::warning('Telegram API rejected the message', [
            'user_id' => $user->id,
            'status' => $response->status(),
            'description' => $response->json('description'),
        ]);

        return false;
    }

    public function lastFailure(): ?string
    {
        return $this->failure;
    }

    /**
     * Prefer an explicit chat id; otherwise fall back to the phone number when
     * the deployment is configured to treat phones as Telegram handles.
     */
    protected function resolveChatId(User $user): ?string
    {
        if (filled($user->telegram_chat_id)) {
            return (string) $user->telegram_chat_id;
        }

        if (config('notifications.channels.telegram.chat_id_source') === 'phone' && filled($user->phone)) {
            return (string) $user->phone;
        }

        return null;
    }
}
