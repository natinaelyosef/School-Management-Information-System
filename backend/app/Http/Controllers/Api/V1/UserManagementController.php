<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserManagementController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = User::with('roles');
        if ($request->filled('role')) {
            $q->role($request->string('role'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('search')) {
            $s = $request->string('search');
            $q->where(fn ($qq) => $qq->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%"));
        }

        return response()->json($q->paginate($request->integer('per_page', 15)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string|max:30',
            'roles' => 'nullable|array',
            'roles.*' => 'string|exists:roles,name',
        ]);
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'status' => 'active',
            'is_active' => true,
        ]);
        if (! empty($data['roles'])) {
            $user->syncRoles($data['roles']);
        }
        self::logActivity('users.create', $user, null, $user);

        return response()->json($user->load('roles'), 201);
    }

    public function roles()
    {
        return response()->json(
            Role::withCount('permissions')
                ->orderBy('name')
                ->get(['id', 'name'])
        );
    }

    public function bulkStore(Request $request)
    {
        $data = $request->validate([
            'users' => 'required|array|min:1|max:200',
            'users.*.name' => 'required|string|max:255',
            'users.*.email' => 'required|email|unique:users,email',
            'users.*.password' => 'required|string|min:8',
            'users.*.phone' => 'nullable|string|max:30',
            'users.*.roles' => 'nullable|array',
            'users.*.roles.*' => 'string|exists:roles,name',
        ]);

        $created = DB::transaction(function () use ($data) {
            $users = [];
            foreach ($data['users'] as $entry) {
                $user = User::create([
                    'name' => $entry['name'],
                    'email' => $entry['email'],
                    'password' => Hash::make($entry['password']),
                    'phone' => $entry['phone'] ?? null,
                    'status' => 'active',
                    'is_active' => true,
                ]);
                if (! empty($entry['roles'])) {
                    $user->syncRoles($entry['roles']);
                }
                $users[] = $user->load('roles');
            }

            return $users;
        });

        self::logActivity('users.bulk_create', null, null, ['count' => count($created)]);

        return response()->json($created, 201);
    }

    public function show(User $user)
    {
        return response()->json($user->load(['roles', 'permissions']));
    }

    public function update(Request $request, User $user)
    {
        $old = $user->toArray();
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$user->id,
            'phone' => 'sometimes|nullable|string|max:30',
            'status' => 'sometimes|in:active,suspended',
            'is_active' => 'sometimes|boolean',
            'roles' => 'nullable|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        // Demoting the last active super admin, or deactivating them, would leave
        // the school with nobody able to manage accounts.
        $stripsAdmin = isset($data['roles']) && ! in_array('super_admin', $data['roles'], true);
        $deactivates = (array_key_exists('is_active', $data) && ! $data['is_active'])
            || (array_key_exists('status', $data) && $data['status'] !== 'active');

        if ($stripsAdmin || $deactivates) {
            $this->assertNotLastAdmin($user);
        }

        if (array_key_exists('is_active', $data)) {
            $data['status'] = $data['is_active'] ? 'active' : 'suspended';
        }

        $user->update(collect($data)->except('roles')->toArray());
        if (isset($data['roles'])) {
            $user->syncRoles($data['roles']);
        }
        self::logActivity('users.edit', $user, $old, $user->fresh());

        return response()->json($user->fresh()->load('roles'));
    }

    public function destroy(User $user)
    {
        $this->assertNotLastAdmin($user);
        $user->delete();
        self::logActivity('users.delete', $user);

        return response()->json(['message' => 'User deactivated (soft deleted).']);
    }

    public function activate(User $user)
    {
        $user->update(['is_active' => true, 'status' => 'active']);
        self::logActivity('users.activate', $user);

        return response()->json($user);
    }

    public function suspend(User $user)
    {
        $this->assertNotLastAdmin($user);
        $user->update(['is_active' => false, 'status' => 'suspended']);
        self::logActivity('users.suspend', $user);

        return response()->json($user);
    }

    public function resetPassword(Request $request, User $user)
    {
        $data = $request->validate(['password' => 'required|string|min:8']);
        $user->update(['password' => Hash::make($data['password'])]);
        self::logActivity('users.reset_password', $user);

        return response()->json(['message' => 'Password reset.']);
    }

    private function assertNotLastAdmin(User $user): void
    {
        if (! $user->hasRole('super_admin')) {
            return;
        }

        $otherAdmins = User::where('id', '!=', $user->id)
            ->where('is_active', true)
            ->role('super_admin')
            ->count();

        if ($otherAdmins === 0) {
            abort(422, 'This is the last active super admin. Promote another account first.');
        }
    }
}
