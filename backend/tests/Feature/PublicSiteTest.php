<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Application;
use App\Models\ContactInquiry;
use App\Models\Event;
use App\Models\SchoolSetting;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_site_returns_school_identity(): void
    {
        SchoolSetting::create(['key' => 'school_name', 'value' => 'Sunrise Academy']);

        $this->getJson('/api/v1/public/site')
            ->assertOk()
            ->assertJsonPath('name', 'Sunrise Academy');
    }

    public function test_only_published_announcements_show_as_news(): void
    {
        Announcement::create([
            'title' => 'Open day', 'body' => 'Come visit us.',
            'status' => 'published', 'published_at' => now(),
        ]);
        Announcement::create([
            'title' => 'Draft notice', 'body' => 'Not ready yet.',
            'status' => 'draft', 'published_at' => null,
        ]);

        $this->getJson('/api/v1/public/news')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Open day');
    }

    public function test_only_upcoming_published_events_are_listed(): void
    {
        Event::create([
            'title' => 'Science fair', 'starts_at' => now()->addDays(3),
            'status' => 'published', 'published_at' => now(),
        ]);
        Event::create([
            'title' => 'Hidden draft', 'starts_at' => now()->addDays(3),
            'status' => 'draft',
        ]);

        $this->getJson('/api/v1/public/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Science fair');
    }

    public function test_public_staff_directory_hides_inactive_teachers(): void
    {
        Teacher::create(['first_name' => 'Ada', 'last_name' => 'Tesfaye', 'employment_status' => 'active']);
        Teacher::create(['first_name' => 'Ben', 'last_name' => 'Abebe', 'employment_status' => 'left']);

        $this->getJson('/api/v1/public/teachers')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.last_name', 'Tesfaye');
    }

    public function test_contact_form_creates_a_trackable_enquiry(): void
    {
        $this->postJson('/api/v1/public/contact', [
            'name' => 'Hanna Girma',
            'email' => 'hanna@example.com',
            'type' => 'admission',
            'message' => 'Please call me about Grade 4 admissions.',
        ])
            ->assertCreated()
            ->assertJsonStructure(['reference', 'message']);

        $this->assertDatabaseHas('contact_inquiries', [
            'name' => 'Hanna Girma',
            'status' => 'new',
        ]);

        $this->postJson('/api/v1/public/contact', ['name' => 'No message'])
            ->assertStatus(422);
    }

    public function test_anonymous_application_can_be_submitted_and_tracked(): void
    {
        $response = $this->postJson('/api/v1/public/applications', [
            'first_name' => 'Lily',
            'last_name' => 'Haile',
            'gender' => 'female',
            'parent_name' => 'Marta Haile',
            'parent_phone' => '+251911000222',
            'parent_email' => 'marta@example.com',
            'address' => 'Bole, Addis Ababa',
            'previous_school' => 'Little Stars',
            'note' => 'Available for an interview any weekday.',
        ]);

        $response->assertCreated()->assertJsonStructure(['application_no', 'status']);
        $this->assertSame('pending', $response->json('status'));

        $application = Application::where('first_name', 'Lily')->firstOrFail();
        $this->assertStringContainsString('previous school: Little Stars', (string) $application->notes);

        $this->postJson('/api/v1/public/applications/track', [
            'code' => $application->application_no,
            'email' => 'marta@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('student', 'Lily Haile')
            ->assertJsonPath('status', 'pending');

        $this->postJson('/api/v1/public/applications/track', [
            'code' => $application->application_no,
            'email' => 'wrong@example.com',
        ])->assertNotFound();
    }

    public function test_contact_inquiries_are_stored_once_per_submission(): void
    {
        $before = ContactInquiry::count();

        $this->postJson('/api/v1/public/contact', [
            'name' => 'Sam',
            'email' => 'sam@example.com',
            'message' => 'Question about bus routes.',
        ])->assertCreated();

        $this->assertSame($before + 1, ContactInquiry::count());
    }
}
