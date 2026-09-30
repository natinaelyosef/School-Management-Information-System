<?php

return [

    /*
    |---------------------------------------------------------------------------
    | Delivery channels
    |---------------------------------------------------------------------------
    | 'database' is always available (it is the in-app notification feed).
    | External channels are opt-in and require credentials below. When a channel
    | is enabled but not configured, sends are recorded as 'skipped' rather
    | than failing the request.
    */

    'default' => env('NOTIFY_DEFAULT_CHANNEL', 'database'),

    'channels' => [

        'telegram' => [
            'enabled' => (bool) env('TELEGRAM_ENABLED', false),
            'bot_token' => env('TELEGRAM_BOT_TOKEN'),
            'api_base' => env('TELEGRAM_API_BASE', 'https://api.telegram.org'),
            'timeout' => (int) env('TELEGRAM_TIMEOUT', 10),
            // Fall back to the phone number formatted as a chat id when the
            // user has no explicit telegram_chat_id.
            'chat_id_source' => env('TELEGRAM_CHAT_ID_SOURCE', 'user_setting'),
        ],

        'sms' => [
            'enabled' => (bool) env('SMS_ENABLED', false),
            // Generic HTTP gateway. Point this at your provider's send endpoint
            // and adapt the payload template if your provider differs.
            'endpoint' => env('SMS_ENDPOINT'),
            'api_key' => env('SMS_API_KEY'),
            'sender_id' => env('SMS_SENDER_ID'),
            'method' => env('SMS_METHOD', 'POST'),
            'timeout' => (int) env('SMS_TIMEOUT', 10),
            'payload' => [
                'to' => '{{phone}}',
                'message' => '{{message}}',
            ],
        ],

        'email' => [
            'enabled' => (bool) env('EMAIL_CHANNEL_ENABLED', false),
        ],

    ],

    /*
    | Never let a failing external provider break the request that triggered
    | the notification. Failures are recorded on the notification log.
    */
    'fail_silently' => (bool) env('NOTIFY_FAIL_SILENTLY', true),

];
