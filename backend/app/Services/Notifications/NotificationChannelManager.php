<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use Illuminate\Contracts\Container\Container;

class NotificationChannelManager
{
    /** @var array<string, class-string<NotificationChannel>> */
    protected array $drivers = [
        'database' => DatabaseChannel::class,
        'telegram' => TelegramChannel::class,
        'sms' => SmsChannel::class,
    ];

    public function __construct(protected Container $container) {}

    public function register(string $name, string $driver): void
    {
        $this->drivers[$name] = $driver;
    }

    public function has(string $name): bool
    {
        return isset($this->drivers[$name]);
    }

    /** @return array<int, string> */
    public function available(): array
    {
        return array_keys($this->drivers);
    }

    public function driver(string $name): NotificationChannel
    {
        $driver = $this->drivers[$name] ?? $this->drivers['database'];

        return $this->container->make($driver);
    }

    public function default(): string
    {
        return (string) config('notifications.default', 'database');
    }

    /**
     * Resolve a channel, falling back to the in-app feed when the requested one
     * is unknown. A user asking for 'sms' should never end up with nothing.
     */
    public function resolve(?string $name): NotificationChannel
    {
        $name = $name ?: $this->default();

        if (! $this->has($name)) {
            $name = 'database';
        }

        return $this->driver($name);
    }
}
