<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Notifications\NotificationChannelManager;
use App\Services\Notifications\SmsChannel;
use App\Services\Notifications\TelegramChannel;
use App\Services\NotificationService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationChannelsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        config([
            'notifications.default' => 'database',
            'notifications.channels.telegram.enabled' => false,
            'notifications.channels.telegram.bot_token' => null,
            'notifications.channels.sms.enabled' => false,
            'notifications.channels.sms.endpoint' => null,
        ]);
    }

    protected function user(array $attrs = []): User
    {
        $user = User::factory()->create($attrs);
        $user->assignRole('parent');

        return $user;
    }

    public function test_database_channel_always_logs_and_succeeds(): void
    {
        $user = $this->user();
        $log = app(NotificationService::class)->send($user, 'general', 'Hello', 'World');

        $this->assertSame('database', $log->channel);
        $this->assertSame('sent', $log->status);
        $this->assertNotNull($log->sent_at);
        $this->assertDatabaseHas('notification_logs', ['id' => $log->id, 'user_id' => $user->id]);
    }

    public function test_disabled_channel_is_recorded_as_failed_not_silently_dropped(): void
    {
        $user = $this->user();
        $log = app(NotificationService::class)->send($user, 'general', 'Hi', null, 'telegram');

        $this->assertSame('telegram', $log->channel);
        $this->assertSame('failed', $log->status);
        $this->assertNull($log->sent_at);
    }

    public function test_unknown_channel_falls_back_to_database(): void
    {
        $user = $this->user();
        $log = app(NotificationService::class)->send($user, 'general', 'Hi', null, 'carrier-pigeon');

        $this->assertSame('database', $log->channel);
        $this->assertSame('sent', $log->status);
    }

    public function test_telegram_delivers_when_configured(): void
    {
        config([
            'notifications.channels.telegram.enabled' => true,
            'notifications.channels.telegram.bot_token' => 'test-token',
            'notifications.channels.telegram.api_base' => 'https://api.telegram.org',
        ]);

        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
        ]);

        $user = $this->user(['telegram_chat_id' => '998877']);
        $log = app(NotificationService::class)->send($user, 'payment', 'Payment verified', 'Thanks', 'telegram');

        $this->assertSame('telegram', $log->channel);
        $this->assertSame('sent', $log->status);

        Http::assertSent(fn ($request) => str_contains($request->url(), 'bottest-token/sendMessage')
            && $request['chat_id'] === '998877'
            && str_contains($request['text'], 'Payment verified'));
    }

    public function test_telegram_api_rejection_is_reported_as_failed(): void
    {
        config([
            'notifications.channels.telegram.enabled' => true,
            'notifications.channels.telegram.bot_token' => 'test-token',
        ]);

        Http::fake([
            '*' => Http::response(['ok' => false, 'description' => 'chat not found'], 400),
        ]);

        $user = $this->user(['telegram_chat_id' => '998877']);
        $log = app(NotificationService::class)->send($user, 'payment', 'Hi', null, 'telegram');

        $this->assertSame('failed', $log->status);
        $this->assertNull($log->sent_at);
    }

    public function test_telegram_without_chat_id_does_not_call_the_api(): void
    {
        config([
            'notifications.channels.telegram.enabled' => true,
            'notifications.channels.telegram.bot_token' => 'test-token',
        ]);

        Http::fake();

        $user = $this->user();
        $log = app(NotificationService::class)->send($user, 'payment', 'Hi', null, 'telegram');

        $this->assertSame('failed', $log->status);
        Http::assertNothingSent();
    }

    public function test_sms_delivers_through_the_configured_gateway(): void
    {
        config([
            'notifications.channels.sms.enabled' => true,
            'notifications.channels.sms.endpoint' => 'https://sms.example.com/send',
            'notifications.channels.sms.api_key' => 'secret',
            'notifications.channels.sms.payload' => [
                'to' => '{{phone}}',
                'text' => '{{message}}',
            ],
        ]);

        Http::fake(['sms.example.com/*' => Http::response(['status' => 'ok'])]);

        $user = $this->user(['phone' => '+251911000001']);
        $log = app(NotificationService::class)->send($user, 'payment', 'Payment reminder', 'Due Friday', 'sms');

        $this->assertSame('sms', $log->channel);
        $this->assertSame('sent', $log->status);

        Http::assertSent(fn ($request) => $request->url() === 'https://sms.example.com/send'
            && $request['to'] === '+251911000001'
            && str_contains($request['text'], 'Payment reminder'));
    }

    public function test_sms_without_phone_is_not_sent(): void
    {
        config([
            'notifications.channels.sms.enabled' => true,
            'notifications.channels.sms.endpoint' => 'https://sms.example.com/send',
        ]);

        Http::fake();

        $user = $this->user();
        $log = app(NotificationService::class)->send($user, 'payment', 'Hi', null, 'sms');

        $this->assertSame('failed', $log->status);
        Http::assertNothingSent();
    }

    public function test_fanout_always_includes_the_in_app_feed(): void
    {
        config([
            'notifications.channels.sms.enabled' => true,
            'notifications.channels.sms.endpoint' => 'https://sms.example.com/send',
        ]);
        Http::fake(['sms.example.com/*' => Http::response(['ok' => true])]);

        $user = $this->user(['phone' => '+251911000001', 'notify_sms' => true]);

        $preferred = app(NotificationService::class)->preferredChannelsFor($user);
        $this->assertSame(['sms'], $preferred);

        $logs = app(NotificationService::class)->sendMany($user, 'payment', 'Reminder', 'Body', $preferred);

        $this->assertCount(2, $logs);
        $this->assertSame(['database', 'sms'], array_map(fn ($l) => $l->channel, $logs));
        $this->assertSame(['sent', 'sent'], array_map(fn ($l) => $l->status, $logs));
    }

    public function test_user_who_did_not_opt_in_gets_no_external_channel(): void
    {
        config([
            'notifications.channels.sms.enabled' => true,
            'notifications.channels.sms.endpoint' => 'https://sms.example.com/send',
        ]);

        $user = $this->user(['phone' => '+251911000001', 'notify_sms' => false]);

        $this->assertSame([], app(NotificationService::class)->preferredChannelsFor($user));
    }

    public function test_channel_manager_falls_back_for_unknown_channels(): void
    {
        $manager = app(NotificationChannelManager::class);

        $this->assertInstanceOf(TelegramChannel::class, $manager->resolve('telegram'));
        $this->assertInstanceOf(SmsChannel::class, $manager->resolve('sms'));
        $this->assertSame('database', $manager->resolve('nope')->name());
        $this->assertTrue($manager->has('database'));
    }

    public function test_endpoints_expose_channels_and_accept_preferences(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/notifications/channels')
            ->assertStatus(200)
            ->assertJsonStructure(['channels' => ['database', 'telegram', 'sms'], 'has_phone', 'has_telegram_chat_id'])
            ->assertJsonPath('channels.database.enabled', true)
            ->assertJsonPath('channels.telegram.enabled', false);

        $this->putJson('/api/v1/notifications/preferences', [
            'phone' => '+251911999888',
            'telegram_chat_id' => '555111',
            'notify_telegram' => true,
        ])->assertStatus(200)
            ->assertJsonPath('telegram_chat_id', '555111')
            ->assertJsonPath('notify_telegram', true);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'phone' => '+251911999888',
            'telegram_chat_id' => '555111',
        ]);
    }

    public function test_notification_feed_can_be_filtered_by_channel(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        app(NotificationService::class)->send($user, 'general', 'In app');
        config(['notifications.channels.sms.enabled' => true, 'notifications.channels.sms.endpoint' => 'https://sms.example.com/send']);
        app(NotificationService::class)->send($user, 'general', 'Texted', null, 'sms');

        $this->getJson('/api/v1/notifications?channel=sms')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Texted');
    }
}
