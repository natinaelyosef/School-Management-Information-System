<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SchoolSetting;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    use LogsActivity;

    /** Settings that must never be readable/writable by non-super-admins. */
    protected const PROTECTED = ['smtp_password', 'api_secret', 'telegram_bot_token'];

    public function index(Request $request)
    {
        $q = SchoolSetting::query()->orderBy('group')->orderBy('key');

        if ($request->filled('group')) {
            $q->where('group', $request->string('group'));
        }

        $settings = $q->get()
            ->filter(fn ($s) => $request->user()->can('settings.edit')
                || ! in_array($s->key, self::PROTECTED, true))
            ->values();

        return response()->json($settings);
    }

    public function update(Request $request)
    {
        $payload = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string|max:100',
            'settings.*.value' => 'nullable|string',
        ]);

        $saved = [];

        foreach ($payload['settings'] as $row) {
            if (in_array($row['key'], self::PROTECTED, true) && blank($row['value'] ?? null)) {
                continue;
            }

            $setting = SchoolSetting::firstOrNew(['key' => $row['key']]);
            $setting->value = $row['value'] ?? null;
            $setting->type = $setting->type ?: 'string';
            $setting->group = $setting->group ?: ($request->input('group') ?: 'general');
            $setting->save();

            $saved[] = $setting;
        }

        self::logActivity('settings.update', null, null, ['count' => count($saved)]);

        return response()->json($saved);
    }

    public function paymentSettings(): JsonResponse
    {
        $keys = [
            'payment_bank_name',
            'payment_account_name',
            'payment_account_number',
            'payment_reference_hint',
            'payment_instructions',
            'school_name',
            'school_phone',
            'school_email',
            'school_address',
        ];

        $settings = SchoolSetting::whereIn('key', $keys)->pluck('value', 'key');

        return response()->json([
            'bank_name' => $settings['payment_bank_name'] ?? null,
            'account_name' => $settings['payment_account_name'] ?? null,
            'account_number' => $settings['payment_account_number'] ?? null,
            'reference_hint' => $settings['payment_reference_hint'] ?? null,
            'instructions' => $settings['payment_instructions'] ?? null,
            'school_name' => $settings['school_name'] ?? null,
            'school_phone' => $settings['school_phone'] ?? null,
            'school_email' => $settings['school_email'] ?? null,
            'school_address' => $settings['school_address'] ?? null,
        ]);
    }
}
