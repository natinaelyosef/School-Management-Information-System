<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_super_admin_manages_departments_end_to_end(): void
    {
        $this->actingAsRole('super_admin');

        $permissions = $this->getJson('/api/v1/permissions')->assertOk()->json();
        $this->assertContains('roles.manage', $permissions);

        $list = $this->getJson('/api/v1/departments')->assertOk()->json();
        $names = array_column($list, 'name');
        $this->assertContains('super_admin', $names);
        $super = collect($list)->firstWhere('name', 'super_admin');
        $this->assertTrue($super['built_in']);
        $this->assertGreaterThan(0, $super['permissions_count']);

        $created = $this->postJson('/api/v1/departments', [
            'name' => 'transport_office',
            'permissions' => ['transport.view', 'transport.manage', 'messaging.send'],
        ])->assertCreated()->json();
        $this->assertSame('transport_office', $created['name']);
        $this->assertCount(3, $created['permissions']);

        $detail = $this->getJson('/api/v1/departments/'.$created['id'])->assertOk()->json();
        $this->assertSame(['messaging.send', 'transport.manage', 'transport.view'], $detail['permissions']);

        $this->patchJson('/api/v1/departments/'.$created['id'], [
            'permissions' => ['transport.view'],
        ])->assertOk()->assertJsonPath('permissions.0', 'transport.view');

        // Assign the department to a new agent, then move them to another one.
        $agent = $this->postJson('/api/v1/users', [
            'name' => 'Fitsum Alemu',
            'email' => 'agent@school.test',
            'password' => 'password123',
            'roles' => ['transport_office'],
        ])->assertCreated()->json();
        $this->assertSame('transport_office', $agent['roles'][0]['name']);

        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => ['teacher']])
            ->assertOk()
            ->assertJsonPath('roles.0.name', 'teacher');

        // Assigned departments cannot be deleted…
        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => ['transport_office']])->assertOk();
        $this->deleteJson('/api/v1/departments/'.$created['id'])->assertStatus(422);

        // …until the last agent leaves it.
        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => ['teacher']])->assertOk();
        $this->deleteJson('/api/v1/departments/'.$created['id'])->assertOk();
        $this->assertDatabaseMissing('roles', ['name' => 'transport_office']);
    }

    public function test_sub_admin_creates_departments_assigns_roles_and_manages_agents(): void
    {
        $this->actingAsRole('school_admin');

        $created = $this->postJson('/api/v1/departments', [
            'name' => 'admissions_club',
            'permissions' => ['applications.view', 'applications.review'],
        ])->assertCreated()->json();

        $agent = $this->postJson('/api/v1/users', [
            'name' => 'Sara Tesfaye',
            'email' => 'subagent@school.test',
            'password' => 'password123',
            'roles' => ['admissions_club'],
        ])->assertCreated()->json();

        $this->assertSame('admissions_club', $agent['roles'][0]['name']);

        // Sub admin removes and re-assigns departments at will.
        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => []])->assertOk();
        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => ['admissions_club']])
            ->assertOk()
            ->assertJsonPath('roles.0.name', 'admissions_club');

        // Assigned departments cannot be deleted, but free ones can.
        $this->deleteJson('/api/v1/departments/'.$created['id'])->assertStatus(422);
        $this->patchJson('/api/v1/users/'.$agent['id'], ['roles' => ['teacher']])->assertOk();
        $this->deleteJson('/api/v1/departments/'.$created['id'])->assertOk();

        // The sub admin cannot read the audit log.
        $this->actingAsRole('school_admin');
        $this->getJson('/api/v1/audit')->assertForbidden();
    }

    public function test_only_super_and_sub_admin_can_manage_departments(): void
    {
        $payload = ['name' => 'sneaky_office', 'permissions' => ['messages.view']];

        foreach (['principal', 'registrar', 'teacher', 'registration_office'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/departments', $payload)->assertForbidden();
            $this->getJson('/api/v1/departments')->assertForbidden();
            $this->getJson('/api/v1/permissions')->assertForbidden();
        }

        $this->actingAsRole('super_admin');
        $this->getJson('/api/v1/departments')->assertOk();
    }

    public function test_builtin_departments_cannot_be_deleted_or_renamed(): void
    {
        $this->actingAsRole('super_admin');
        $registrar = Role::where('name', 'registrar')->firstOrFail();

        $this->deleteJson('/api/v1/departments/'.$registrar->id)->assertStatus(422);
        $this->patchJson('/api/v1/departments/'.$registrar->id, ['name' => 'front_office'])
            ->assertStatus(422);
        $this->assertDatabaseHas('roles', ['name' => 'registrar']);

        // Their permissions may still be adjusted.
        $this->patchJson('/api/v1/departments/'.$registrar->id, [
            'permissions' => ['students.view', 'parents.view'],
        ])->assertOk();
        $this->assertSame(
            ['parents.view', 'students.view'],
            $registrar->fresh()->permissions()->orderBy('name')->pluck('name')->all()
        );
    }

    public function test_department_names_and_permissions_are_validated(): void
    {
        $this->actingAsRole('super_admin');

        $this->postJson('/api/v1/departments', ['name' => 'Bad Name', 'permissions' => []])
            ->assertStatus(422);
        $this->postJson('/api/v1/departments', ['name' => 'super_admin', 'permissions' => []])
            ->assertStatus(422);
        $this->postJson('/api/v1/departments', ['name' => 'ok_office', 'permissions' => ['not.a.permission']])
            ->assertStatus(422);
    }

    public function test_super_and_sub_admin_hold_the_department_permission(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super_admin');
        $sub = User::factory()->create();
        $sub->assignRole('school_admin');

        $this->assertTrue($super->can('roles.manage'));
        $this->assertTrue($sub->can('roles.manage'));

        $principal = User::factory()->create();
        $principal->assignRole('principal');
        $this->assertFalse($principal->can('roles.manage'));
    }
}
