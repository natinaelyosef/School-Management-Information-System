<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\Grade;
use App\Models\NotificationLog;
use App\Models\ParentModel;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CampaignTest extends TestCase
{
    use RefreshDatabase;

    protected SchoolLevel $level;
    protected Grade $grade;
    protected Section $sectionA;
    protected Section $sectionB;
    protected AcademicYear $year;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->level = SchoolLevel::create(['name' => 'Primary', 'code' => 'PRI', 'order_index' => 1]);
        $this->grade = Grade::create(['school_level_id' => $this->level->id, 'name' => 'Grade 5']);
        $this->sectionA = Section::create(['grade_id' => $this->grade->id, 'name' => 'A']);
        $this->sectionB = Section::create(['grade_id' => $this->grade->id, 'name' => 'B']);
        $this->year = AcademicYear::create([
            'name' => '2026/2027', 'code' => '2026', 'is_current' => true,
            'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
        ]);
    }

    protected function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function makeStudent(Section $section, string $first = 'Kid'): Student
    {
        return Student::create([
            'admission_no' => 'ST'.uniqid(), 'first_name' => $first, 'last_name' => 'Doe',
            'level_id' => $this->level->id, 'grade_id' => $this->grade->id,
            'section_id' => $section->id, 'academic_year_id' => $this->year->id,
        ]);
    }

    protected function makeParentWithChild(Section $section, ?string $first = null): ParentModel
    {
        $user = User::factory()->create();
        $user->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $user->id, 'first_name' => $first ?? 'Parent',
            'last_name' => 'X', 'email' => $user->email,
        ]);
        $parent->students()->attach($this->makeStudent($section, $first ?? 'Kid')->id);

        return $parent;
    }

    public function test_audience_options_count_the_people_each_target_reaches(): void
    {
        $this->makeParentWithChild($this->sectionA);
        $this->makeParentWithChild($this->sectionB);

        $this->actingAsRole('principal');
        $options = $this->getJson('/api/v1/campaigns/audiences')->assertStatus(200)->json('options');

        $byKey = collect($options)->keyBy(fn ($o) => $o['value'].':'.($o['section_id'] ?? $o['grade_id'] ?? $o['role'] ?? 'all'));

        $this->assertSame(2, $byKey['all_parents:all']['count']);
        $this->assertSame(2, $byKey['grade:'.$this->grade->id]['count']);
        $this->assertSame(1, $byKey['section:'.$this->sectionA->id]['count']);
        $this->assertSame(1, $byKey['section:'.$this->sectionB->id]['count']);
    }

    public function test_a_campaign_reaches_every_parent_of_one_class_only(): void
    {
        $inClassA = $this->makeParentWithChild($this->sectionA, 'Alpha');
        $inClassB = $this->makeParentWithChild($this->sectionB, 'Bravo');

        $this->actingAsRole('registrar');

        $response = $this->postJson('/api/v1/campaigns', [
            'title' => 'Parents meeting',
            'body' => 'This Thursday at 4pm in the hall.',
            'audience' => 'section',
            'section_id' => $this->sectionA->id,
        ])->assertStatus(201);

        $this->assertSame(1, $response->json('recipients_count'));
        $this->assertSame('Grade 5 — A', $response->json('label'));

        $this->assertDatabaseHas('notification_logs', [
            'user_id' => $inClassA->user_id, 'type' => 'campaign', 'title' => 'Parents meeting', 'status' => 'sent',
        ]);
        $this->assertDatabaseMissing('notification_logs', [
            'user_id' => $inClassB->user_id, 'type' => 'campaign',
        ]);
    }

    public function test_a_parent_with_two_children_in_one_class_is_counted_once(): void
    {
        $user = User::factory()->create();
        $user->assignRole('parent');
        $parent = ParentModel::create([
            'user_id' => $user->id, 'first_name' => 'Siblings', 'last_name' => 'X', 'email' => $user->email,
        ]);
        $parent->students()->attach($this->makeStudent($this->sectionA, 'One')->id);
        $parent->students()->attach($this->makeStudent($this->sectionA, 'Two')->id);

        $this->actingAsRole('registrar');
        $this->postJson('/api/v1/campaigns', [
            'title' => 'Notice', 'body' => 'One message only.',
            'audience' => 'section', 'section_id' => $this->sectionA->id,
        ])->assertStatus(201)->assertJsonPath('recipients_count', 1);

        $this->assertSame(1, NotificationLog::where('type', 'campaign')->count());
    }

    public function test_a_campaign_to_a_department_reaches_all_of_its_staff(): void
    {
        User::factory()->count(3)->create()->each(fn ($u) => $u->assignRole('teacher'));

        $this->actingAsRole('principal');
        $this->postJson('/api/v1/campaigns', [
            'title' => 'Staff meeting', 'body' => 'Monday 7:45am.',
            'audience' => 'staff', 'role' => 'teacher',
        ])->assertStatus(201)
            ->assertJsonPath('recipients_count', 3)
            ->assertJsonPath('label', 'teacher');
    }

    public function test_the_campaign_is_also_published_to_the_noticeboard(): void
    {
        $this->makeParentWithChild($this->sectionA);
        $this->actingAsRole('principal');

        $this->postJson('/api/v1/campaigns', [
            'title' => 'School closes early', 'body' => 'Home by 1pm.',
            'audience' => 'all_parents',
        ])->assertStatus(201);

        $this->assertDatabaseHas('announcements', [
            'title' => 'School closes early', 'status' => 'published', 'audience' => 'all_parents',
        ]);
    }

    public function test_a_target_without_the_required_choice_is_refused(): void
    {
        $this->makeParentWithChild($this->sectionA);
        $this->actingAsRole('principal');

        // A grade message with no grade must not fall back to the whole school.
        $this->postJson('/api/v1/campaigns', [
            'title' => 'Oops', 'body' => 'No grade given.', 'audience' => 'grade',
        ])->assertStatus(422);

        $this->postJson('/api/v1/campaigns', [
            'title' => 'Oops', 'body' => 'No class given.', 'audience' => 'section',
        ])->assertStatus(422);

        $this->postJson('/api/v1/campaigns', [
            'title' => 'Oops', 'body' => 'No department given.', 'audience' => 'staff',
        ])->assertStatus(422);

        $this->assertSame(0, NotificationLog::where('type', 'campaign')->count());
    }

    public function test_an_audience_with_nobody_in_it_is_refused(): void
    {
        $this->actingAsRole('principal');

        $this->postJson('/api/v1/campaigns', [
            'title' => 'Nobody home', 'body' => 'No students yet.',
            'audience' => 'section', 'section_id' => $this->sectionB->id,
        ])->assertStatus(422);
    }

    public function test_only_office_roles_may_write_campaigns(): void
    {
        $this->makeParentWithChild($this->sectionA);
        $payload = ['title' => 'x', 'body' => 'y', 'audience' => 'all_parents'];

        $this->actingAsRole('teacher');
        $this->postJson('/api/v1/campaigns', $payload)->assertForbidden();
        $this->getJson('/api/v1/campaigns')->assertForbidden();

        $this->actingAsRole('parent');
        $this->postJson('/api/v1/campaigns', $payload)->assertForbidden();

        $this->actingAsRole('registration_office');
        $this->postJson('/api/v1/campaigns', $payload)->assertStatus(201);
        $this->getJson('/api/v1/campaigns')->assertOk();
    }

    public function test_the_campaign_register_lists_what_was_sent(): void
    {
        $this->makeParentWithChild($this->sectionA);
        $this->actingAsRole('principal');

        $this->postJson('/api/v1/campaigns', [
            'title' => 'Fee reminder', 'body' => 'Second term fees are due.',
            'audience' => 'all_parents',
        ])->assertStatus(201);

        $list = $this->getJson('/api/v1/campaigns')->assertStatus(200)->json();
        $this->assertCount(1, $list['data']);
        $this->assertSame('Fee reminder', $list['data'][0]['title']);
        $this->assertSame(1, $list['data'][0]['recipients_count']);
        $this->assertSame('All parents', $list['data'][0]['label']);

        $campaignId = $list['data'][0]['id'];
        $this->deleteJson("/api/v1/campaigns/{$campaignId}")->assertOk();

        // The noticeboard copy and delivered messages survive the record removal.
        $this->assertDatabaseMissing('notification_campaigns', ['id' => $campaignId]);
        $this->assertDatabaseHas('announcements', ['title' => 'Fee reminder']);
        $this->assertSame(1, NotificationLog::where('type', 'campaign')->count());
    }

    public function test_announcements_written_by_hand_are_never_sent_to_anybody(): void
    {
        // The gap that motivated campaigns: an announcement on its own reaches nobody.
        $this->actingAsRole('principal');
        $this->postJson('/api/v1/announcements', [
            'title' => 'Silent notice', 'body' => 'Nobody is told.',
        ])->assertStatus(201);

        $this->assertDatabaseMissing('notification_logs', ['type' => 'campaign']);
        $this->assertSame(0, NotificationLog::where('title', 'Silent notice')->count());
        $this->assertSame(0, Announcement::where('title', 'Silent notice')
            ->whereNotNull('published_at')->where('status', 'published')->count());
    }
}
