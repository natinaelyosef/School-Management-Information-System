<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsChannel implements NotificationChannel
{
    protected ?string $failure = null;

    public function name(): string
    {
        return 'sms';
    }

    public function isEnabled(): bool
    {
        return (bool) config('notifications.channels.sms.enabled')
            && filled(config('notifications.channels.sms.endpoint'));
    }

    public function send(User $user, string $title, ?string $body = null): bool
    {
        $this->failure = null;

        if (blank($user->phone)) {
            $this->failure = 'no_phone';

            return false;
        }

        $message = $this->render($title, $body);
        $config = config('notifications.channels.sms');

        $payload = [];
        foreach ($config['payload'] ?? [] as $key => $template) {
            $payload[$key] = $this->interpolate((string) $template, $user, $message);
        }

        try {
            $request = Http::timeout((int) ($config['timeout'] ?? 10))
                ->withHeaders(array_filter([
                    'Authorization' => filled($config['api_key'] ?? null) ? 'Bearer '.$config['api_key'] : null,
                ]));

            $response = strtoupper((string) ($config['method'] ?? 'POST')) === 'GET'
                ? $request->get((string) $config['endpoint'], $payload)
                : $request->post((string) $config['endpoint'], $payload);
        } catch (\Throwable $e) {
            $this->failure = 'request_failed: '.$e->getMessage();
            Log::warning('SMS delivery failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }

        if ($response->successful()) {
            return true;
        }

        $this->failure = 'api_error: HTTP '.$response->status();
        Log::warning('SMS gateway rejected the message', [
            'user_id' => $user->id,
            'status' => $response->status(),
        ]);

        return false;
    }

    public function lastFailure(): ?string
    {
        return $this->failure;
    }

    protected function render(string $title, ?string $body): string
    {
        $text = trim($title.($body ? "\n".$body : ''));

        return mb_substr($text, 0, 320);
    }

    protected function interpolate(string $template, User $user, string $message): string
    {
        return strtr($template, [
            '{{phone}}' => (string) $user->phone,
            '{{message}}' => $message,
            '{{name}}' => (string) $user->name,
        ]);
    }
}
