<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
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

    protected function makeAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');

        return $user;
    }

    protected function deactivateSeededAdmin(): void
    {
        User::where('email', 'admin@school.local')
            ->update(['is_active' => false, 'status' => 'suspended']);
    }

    public function test_super_admin_can_create_many_users_of_different_roles_in_one_call(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/users/bulk', [
            'users' => [
                ['name' => 'Hana Tesfaye', 'email' => 'hana@school.local', 'password' => 'password123', 'phone' => '0911000001', 'roles' => ['teacher']],
                ['name' => 'Beko Ali', 'email' => 'beko@school.local', 'password' => 'password123', 'roles' => ['parent']],
                ['name' => 'Sara Getu', 'email' => 'sara@school.local', 'password' => 'password123', 'roles' => ['student']],
            ],
        ])->assertStatus(201)->assertJsonCount(3);

        $this->assertSame(3, User::whereIn('email', ['hana@school.local', 'beko@school.local', 'sara@school.local'])->count());
        $this->assertSame(
            ['hana@school.local', 'beko@school.local', 'sara@school.local'],
            $response->json('*.email')
        );

        $this->assertTrue(User::where('email', 'hana@school.local')->first()->getRoleNames()->contains('teacher'));
        $this->assertTrue(User::where('email', 'beko@school.local')->first()->getRoleNames()->contains('parent'));
        $this->assertTrue(User::where('email', 'sara@school.local')->first()->getRoleNames()->contains('student'));

        $teacher = User::where('email', 'hana@school.local')->first();
        $this->assertSame('active', $teacher->status);
        $this->assertTrue((bool) $teacher->is_active);
        $this->assertSame('0911000001', $teacher->phone);

        $this->assertSame(
            1,
            AuditLog::where('action', 'users.bulk_create')->where('new_values', 'like', '%count%3%')->count()
        );
    }

    public function test_bulk_create_is_all_or_nothing_on_validation_failure(): void
    {
        $this->actingAsAdmin();

        $before = User::count();

        $this->postJson('/api/v1/users/bulk', [
            'users' => [
                ['name' => 'Good One', 'email' => 'good@school.local', 'password' => 'password123', 'roles' => ['teacher']],
                ['name' => 'Duplicate', 'email' => 'admin@school.local', 'password' => 'password123', 'roles' => ['parent']],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors(['users.1.email']);

        $this->assertSame($before, User::count());
        $this->assertSame(0, User::where('email', 'good@school.local')->count());
    }

    public function test_bulk_create_rejects_an_oversized_batch(): void
    {
        $this->actingAsAdmin();

        $before = User::count();

        $users = [];
        for ($i = 0; $i < 201; $i++) {
            $users[] = [
                'name' => "Bulk User {$i}",
                'email' => "bulk{$i}@school.local",
                'password' => 'password123',
                'roles' => ['teacher'],
            ];
        }

        $this->postJson('/api/v1/users/bulk', ['users' => $users])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['users']);

        $this->assertSame($before, User::count());
    }

    public function test_roles_endpoint_lists_every_role(): void
    {
        $this->actingAsAdmin();

        $response = $this->getJson('/api/v1/roles')->assertStatus(200);

        $roles = $response->json();
        $this->assertIsArray($roles);

        $names = array_column($roles, 'name');
        $this->assertContains('super_admin', $names);
        $this->assertContains('teacher', $names);

        foreach (['super_admin', 'school_admin', 'principal', 'academic_coordinator', 'registrar', 'registration_office', 'teacher', 'accountant', 'librarian', 'nurse', 'parent', 'student'] as $role) {
            $this->assertContains($role, $names);
        }

        $this->assertCount(12, $names);
        $sorted = $names;
        sort($sorted);
        $this->assertSame($sorted, $names);

        foreach ($roles as $role) {
            $this->assertArrayHasKey('id', $role);
            $this->assertArrayHasKey('name', $role);
            $this->assertIsInt($role['permissions_count']);
        }

        $superAdmin = collect($roles)->firstWhere('name', 'super_admin');
        $parent = collect($roles)->firstWhere('name', 'parent');
        $this->assertGreaterThan($parent['permissions_count'], $superAdmin['permissions_count']);

        Sanctum::actingAs(User::factory()->create(['name' => 'No Role', 'email' => 'norole@school.local']));
        $this->getJson('/api/v1/roles')->assertStatus(403);
    }

    public function test_cannot_suspend_the_last_active_super_admin(): void
    {
        $this->deactivateSeededAdmin();

        $admin = $this->actingAsAdmin();

        $this->postJson("/api/v1/users/{$admin->id}/suspend")
            ->assertStatus(422)
            ->assertJson(['message' => 'This is the last active super admin. Promote another account first.']);

        $this->assertTrue((bool) $admin->fresh()->is_active);

        $this->deleteJson("/api/v1/users/{$admin->id}")->assertStatus(422);
        $this->assertNotNull(User::find($admin->id));

        $this->putJson("/api/v1/users/{$admin->id}", ['roles' => ['teacher']])
            ->assertStatus(422);
        $this->assertTrue($admin->fresh()->hasRole('super_admin'));
    }

    public function test_can_suspend_a_super_admin_when_another_one_exists(): void
    {
        $this->deactivateSeededAdmin();

        $first = $this->makeAdmin();
        $second = $this->makeAdmin();

        Sanctum::actingAs($first);

        $this->postJson("/api/v1/users/{$second->id}/suspend")->assertStatus(200);

        $second->refresh();
        $this->assertFalse((bool) $second->is_active);
        $this->assertSame('suspended', $second->status);
    }

    public function test_non_admin_cannot_create_users(): void
    {
        $parent = User::factory()->create();
        $parent->assignRole('parent');
        Sanctum::actingAs($parent);

        $this->postJson('/api/v1/users', [
            'name' => 'Sneaky',
            'email' => 'sneaky@school.local',
            'password' => 'password123',
        ])->assertStatus(403);

        $this->assertSame(0, User::where('email', 'sneaky@school.local')->count());

        $this->postJson('/api/v1/users/bulk', [
            'users' => [
                ['name' => 'Sneaky', 'email' => 'sneaky@school.local', 'password' => 'password123'],
            ],
        ])->assertStatus(403);

        $roleless = User::factory()->create();
        Sanctum::actingAs($roleless);

        $this->postJson('/api/v1/users', [
            'name' => 'Sneaky',
            'email' => 'sneaky@school.local',
            'password' => 'password123',
        ])->assertStatus(403);
    }

    public function test_list_users_filtered_by_role_and_search(): void
    {
        $this->actingAsAdmin();

        $teacher = User::factory()->create(['name' => 'Hana Tesfaye', 'email' => 'hana@school.local']);
        $teacher->assignRole('teacher');

        $otherTeacher = User::factory()->create(['name' => 'Mikael Bekele', 'email' => 'mikael@school.local']);
        $otherTeacher->assignRole('teacher');

        $student = User::factory()->create(['name' => 'Sara Getu', 'email' => 'sara@school.local']);
        $student->assignRole('student');

        $byRole = $this->getJson('/api/v1/users?role=teacher')->assertStatus(200);
        $ids = array_column($byRole->json('data'), 'id');
        $this->assertContains($teacher->id, $ids);
        $this->assertContains($otherTeacher->id, $ids);
        $this->assertNotContains($student->id, $ids);

        foreach ($byRole->json('data') as $row) {
            $this->assertSame('teacher', $row['role']);
        }

        $bySearch = $this->getJson('/api/v1/users?role=teacher&search=Hana')->assertStatus(200);
        $searchIds = array_column($bySearch->json('data'), 'id');
        $this->assertSame([$teacher->id], $searchIds);

        $this->getJson('/api/v1/users?role=student')->assertStatus(200)->assertJsonFragment(['id' => $student->id]);
    }

    public function test_update_can_toggle_active_state(): void
    {
        $admin = $this->actingAsAdmin();

        $teacher = User::factory()->create(['name' => 'Toggle Me']);
        $teacher->assignRole('teacher');

        $this->patchJson("/api/v1/users/{$teacher->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonFragment(['is_active' => false, 'status' => 'suspended']);

        $this->patchJson("/api/v1/users/{$teacher->id}", ['is_active' => true])
            ->assertStatus(200)
            ->assertJsonFragment(['is_active' => true, 'status' => 'active']);

        $this->assertTrue((bool) $teacher->fresh()->is_active);
        $this->assertSame('active', $teacher->fresh()->status);

        // Deactivating the last active super admin through PATCH must be blocked too.
        $this->deactivateSeededAdmin();
        $this->patchJson("/api/v1/users/{$admin->id}", ['is_active' => false])->assertStatus(422);

        $this->patchJson("/api/v1/users/{$teacher->id}", ['status' => 'suspended'])->assertStatus(200);
    }

    public function test_update_rejects_invalid_status(): void
    {
        $this->actingAsAdmin();
        $teacher = User::factory()->create();
        $teacher->assignRole('teacher');

        $this->patchJson("/api/v1/users/{$teacher->id}", ['status' => 'banished'])->assertStatus(422);
    }

    public function test_user_list_paginates_beyond_the_first_page(): void
    {
        $this->actingAsAdmin();

        foreach (range(1, 25) as $i) {
            User::factory()->create(['name' => "Paged {$i}"]);
        }

        $page1 = $this->getJson('/api/v1/users?per_page=10&page=1')->assertStatus(200);
        $this->assertCount(10, $page1->json('data'));
        $this->assertSame(1, $page1->json('current_page'));
        $this->assertGreaterThan(10, $page1->json('total'));

        $page2 = $this->getJson('/api/v1/users?per_page=10&page=2')->assertStatus(200);
        $this->assertCount(10, $page2->json('data'));

        $this->assertSame(
            [],
            array_intersect(array_column($page1->json('data'), 'id'), array_column($page2->json('data'), 'id')),
            'pages must not overlap'
        );

        $this->getJson('/api/v1/users?per_page=10&page=9999')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');
    }

    public function test_many_accounts_can_be_created_for_each_school_role(): void
    {
        $this->actingAsAdmin();

        $roles = ['super_admin', 'principal', 'teacher', 'parent', 'librarian', 'nurse', 'student'];
        $before = [];

        foreach ($roles as $role) {
            $before[$role] = User::role($role)->count();

            $batch = [];
            foreach (range(1, 3) as $n) {
                $batch[] = [
                    'name' => ucfirst(str_replace('_', ' ', $role))." {$n}",
                    'email' => "{$role}-{$n}@school.et",
                    'password' => 'password123',
                    'roles' => [$role],
                ];
            }

            $this->postJson('/api/v1/users/bulk', ['users' => $batch])->assertStatus(201);
        }

        foreach ($roles as $role) {
            $this->assertSame(
                $before[$role] + 3,
                User::role($role)->count(),
                "expected 3 extra {$role} accounts"
            );
        }
    }

    protected function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_sub_admin_can_create_privileged_accounts_and_manage_any_agents_roles(): void
    {
        $this->actingAsRole('school_admin');

        // A sub admin can mint super admin and sub admin accounts, one by one or in bulk.
        $super = $this->postJson('/api/v1/users', [
            'name' => 'Extra Super', 'email' => 'extra-super@school.local',
            'password' => 'password123', 'roles' => ['super_admin'],
        ])->assertStatus(201)->json();
        $this->assertTrue(User::find($super['id'])->hasRole('super_admin'));

        $sub = $this->postJson('/api/v1/users', [
            'name' => 'Extra Sub', 'email' => 'extra-sub@school.local',
            'password' => 'password123', 'roles' => ['school_admin'],
        ])->assertStatus(201)->json();
        $this->assertTrue(User::find($sub['id'])->hasRole('school_admin'));

        $this->postJson('/api/v1/users/bulk', ['users' => [[
            'name' => 'Bulk Super', 'email' => 'bulk-super@school.local',
            'password' => 'password123', 'roles' => ['super_admin'],
        ]]])->assertStatus(201);

        // A sub admin can pin any combination of roles — privileged included — on any agent.
        $agent = $this->postJson('/api/v1/users', [
            'name' => 'Flex Agent', 'email' => 'flex-agent@school.local',
            'password' => 'password123', 'roles' => ['teacher'],
        ])->assertStatus(201)->json();

        $this->patchJson("/api/v1/users/{$agent['id']}", ['roles' => ['super_admin', 'school_admin', 'teacher']])
            ->assertOk();
        $this->assertEqualsCanonicalizing(
            ['super_admin', 'school_admin', 'teacher'],
            User::find($agent['id'])->getRoleNames()->all()
        );

        // ... and strip every role back off again.
        $this->patchJson("/api/v1/users/{$agent['id']}", ['roles' => []])->assertOk();
        $this->assertCount(0, User::find($agent['id'])->getRoleNames());

        $this->patchJson("/api/v1/users/{$agent['id']}", ['roles' => ['librarian']])->assertOk();
        $this->assertTrue(User::find($agent['id'])->hasRole('librarian'));

        // The only rail: the last active super admin cannot be demoted or removed.
        foreach (User::role('super_admin')->where('id', '!=', $super['id'])->pluck('id') as $extraId) {
            $this->deleteJson("/api/v1/users/{$extraId}")->assertOk();
        }
        $this->patchJson("/api/v1/users/{$super['id']}", ['roles' => ['teacher']])->assertStatus(422);
        $this->patchJson("/api/v1/users/{$agent['id']}", ['roles' => ['super_admin']])->assertOk();
        $this->patchJson("/api/v1/users/{$super['id']}", ['roles' => ['teacher']])
            ->assertOk()
            ->assertJsonPath('roles.0.name', 'teacher');

        // Roles without account permissions still cannot touch accounts at all.
        $this->actingAsRole('teacher');
        $this->postJson('/api/v1/users', [
            'name' => 'Nope', 'email' => 'nope@school.local',
            'password' => 'password123', 'roles' => ['parent'],
        ])->assertForbidden();
        $this->patchJson("/api/v1/users/{$agent['id']}", ['roles' => ['parent']])->assertForbidden();
    }
}
