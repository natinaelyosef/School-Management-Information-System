<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleManagementController extends Controller
{
    use LogsActivity;

    /** Roles that ship with the school system: rename/delete would break every guard. */
    protected const BUILT_IN = [
        'super_admin', 'school_admin', 'principal', 'academic_coordinator', 'registrar',
        'registration_office', 'teacher', 'accountant', 'librarian', 'nurse', 'parent', 'student',
    ];

    public function index()
    {
        $counts = $this->assignedCounts();
        $roles = Role::withCount('permissions')->orderBy('name')->get(['id', 'name']);

        return response()->json(
            $roles->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions_count' => (int) $role->permissions_count,
                'users_count' => (int) ($counts[$role->id] ?? 0),
                'built_in' => in_array($role->name, self::BUILT_IN, true),
            ])
        );
    }

    public function permissions()
    {
        return response()->json(
            Permission::orderBy('name')->pluck('name')->values()
        );
    }

    public function show(Role $role)
    {
        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'built_in' => in_array($role->name, self::BUILT_IN, true),
            'users_count' => $this->assignedCount($role->id),
            'permissions' => $role->permissions()->orderBy('name')->pluck('name')->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateRole($request);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);
        self::logActivity('roles.create', $role, null, $role);

        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'built_in' => false,
            'users_count' => 0,
            'permissions' => $role->permissions()->orderBy('name')->pluck('name')->values(),
        ], 201);
    }

    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:60', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions' => 'sometimes|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $old = $role->only(['name']) + ['permissions' => $role->permissions()->pluck('name')];

        if (isset($data['name']) && $data['name'] !== $role->name) {
            if (in_array($role->name, self::BUILT_IN, true)) {
                abort(422, 'Built-in departments cannot be renamed.');
            }
            $role->update(['name' => $data['name']]);
        }

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions'] ?? []);
        }

        self::logActivity('roles.edit', $role, $old, $role->fresh());

        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'built_in' => in_array($role->name, self::BUILT_IN, true),
            'users_count' => $this->assignedCount($role->id),
            'permissions' => $role->permissions()->orderBy('name')->pluck('name')->values(),
        ]);
    }

    public function destroy(Role $role)
    {
        if (in_array($role->name, self::BUILT_IN, true)) {
            abort(422, 'Built-in departments cannot be deleted.');
        }

        $assigned = $this->assignedCount($role->id);
        if ($assigned > 0) {
            abort(422, "This department is assigned to {$assigned} account".($assigned === 1 ? '' : 's').'. Remove it from them first.');
        }

        $old = $role->only(['name']);
        $role->delete();
        self::logActivity('roles.delete', $role, $old);

        return response()->json(['message' => 'Department deleted.']);
    }

    private function validateRole(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('roles', 'name')],
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);
    }

    /** Active accounts per role, counted straight from the pivot table. */
    private function assignedCounts(): array
    {
        return DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', (new User())->getMorphClass())
            ->whereNull('users.deleted_at')
            ->groupBy('model_has_roles.role_id')
            ->select('model_has_roles.role_id', DB::raw('count(*) as total'))
            ->pluck('total', 'role_id')
            ->all();
    }

    private function assignedCount(int $roleId): int
    {
        return (int) DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', (new User())->getMorphClass())
            ->where('model_has_roles.role_id', $roleId)
            ->whereNull('users.deleted_at')
            ->count();
    }
}
