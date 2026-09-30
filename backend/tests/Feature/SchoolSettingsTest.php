<?php

namespace Tests\Feature;

use App\Models\SchoolSetting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SchoolSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_a_renamed_school_reaches_the_public_site(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/v1/settings', [
            'settings' => [
                ['key' => 'school_name', 'value' => 'Future Academy'],
                ['key' => 'school_phone', 'value' => '+251 912345678'],
                ['key' => 'school_email', 'value' => 'info@future.edu.et'],
                ['key' => 'school_address', 'value' => 'Bole Road, Addis Ababa'],
            ],
        ])->assertOk();

        // The public site must serve the new name, not a hardcoded default.
        $site = $this->getJson('/api/v1/public/site')->assertOk()->json();
        $this->assertSame('Future Academy', $site['name']);
        $this->assertSame('+251 912345678', $site['phone']);
        $this->assertSame('info@future.edu.et', $site['email']);
        $this->assertSame('Bole Road, Addis Ababa', $site['address']);
    }

    public function test_the_motto_established_year_and_public_figures_are_saved_and_served(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/v1/settings', [
            'settings' => [
                ['key' => 'school_name', 'value' => 'Future Academy'],
                ['key' => 'school_motto', 'value' => 'Knowledge and Character'],
                ['key' => 'school_established', 'value' => '1998'],
                ['key' => 'stat_students', 'value' => '2,900+'],
                ['key' => 'stat_teachers', 'value' => '140+'],
                ['key' => 'stat_levels', 'value' => '4'],
                ['key' => 'stat_years', 'value' => '27+'],
            ],
        ])->assertOk();

        $site = $this->getJson('/api/v1/public/site')->assertOk()->json();

        $this->assertSame('Knowledge and Character', $site['motto']);
        $this->assertSame('1998', $site['established']);
        $this->assertSame('2,900+', $site['stats']['students']);
        $this->assertSame('140+', $site['stats']['teachers']);
        $this->assertSame('4', $site['stats']['levels']);
        $this->assertSame('27+', $site['stats']['years']);

        // And they are readable again from the settings screen.
        $rows = collect($this->getJson('/api/v1/settings')->assertOk()->json())->keyBy('key');
        $this->assertSame('2,900+', $rows['stat_students']['value']);
        $this->assertSame('Knowledge and Character', $rows['school_motto']['value']);
    }

    public function test_the_public_site_falls_back_when_nothing_has_been_saved(): void
    {
        $site = $this->getJson('/api/v1/public/site')->assertOk()->json();

        $this->assertSame('Bright Future Academy', $site['name']);
        $this->assertSame('2,500+', $site['stats']['students']);
    }

    public function test_payment_settings_are_saved_once_and_served_to_the_fees_page(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'payment_bank_name', 'value' => 'Dashen Bank']],
        ])->assertOk();

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'payment_bank_name', 'value' => 'Awash Bank']],
        ])->assertOk();

        $payment = $this->getJson('/api/v1/settings/payment')->assertOk()->json();
        $this->assertSame('Awash Bank', $payment['bank_name']);
        $this->assertSame(1, SchoolSetting::where('key', 'payment_bank_name')->count());
    }

    public function test_secrets_are_hidden_from_roles_without_settings_edit(): void
    {
        SchoolSetting::create(['key' => 'telegram_bot_token', 'value' => 'secret-token', 'group' => 'channels']);
        $this->actingAsAdmin();

        $adminView = collect($this->getJson('/api/v1/settings')->assertOk()->json());
        $this->assertSame('secret-token', $adminView->firstWhere('key', 'telegram_bot_token')['value']);

        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');
        Sanctum::actingAs($teacher);

        $teacherView = $this->getJson('/api/v1/settings')->assertOk()->json();
        $this->assertNull(collect($teacherView)->firstWhere('key', 'telegram_bot_token'));
    }

    public function test_ordinary_roles_cannot_write_settings(): void
    {
        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');
        Sanctum::actingAs($teacher);

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'school_name', 'value' => 'Hijacked Academy']],
        ])->assertForbidden();

        $this->assertSame(
            'Bright Future Academy',
            $this->getJson('/api/v1/public/site')->json('name'),
        );
    }
}
