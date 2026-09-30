<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ParentModel;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        if (! $user->is_active || $user->status === 'suspended') {
            return response()->json(['message' => 'Account is suspended.'], 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    public function register(Request $request)
    {
        // Public parent self-registration (admission inquiry)
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:30',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'status' => 'active',
            'is_active' => true,
        ]);
        $user->assignRole('parent');

        ParentModel::create([
            'user_id' => $user->id,
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'],
        ]);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json(['user' => $this->userPayload($user), 'token' => $token], 201);
    }

    public function me(Request $request)
    {
        $user = $this->userPayload($request->user());
        $user->load(['student', 'parentProfile', 'teacher']);

        return response()->json($user);
    }

    private function userPayload(User $user): User
    {
        $user->load('roles');
        $user->setRelation('permissions', $user->getAllPermissions());

        return $user;
    }

    /**
     * The parent portal's child switcher: every child linked to this account,
     * each with the enrollment the frontend needs to label them.
     */
    public function children(Request $request)
    {
        $user = $request->user();
        $parent = $user->parentProfile;

        if (! $parent) {
            if ($user->student) {
                return response()->json(collect([$user->student->load(['grade', 'section', 'academicYear'])]));
            }

            return response()->json(collect([]));
        }

        $children = $parent->students()
            ->with(['grade', 'section', 'academicYear'])
            ->get()
            ->map(fn ($student) => $student->only([
                'id', 'admission_no', 'first_name', 'last_name', 'gender', 'dob', 'status', 'photo',
            ]) + [
                'grade' => $student->grade?->only(['id', 'name']),
                'section' => $student->section?->only(['id', 'name']),
                'academic_year' => $student->academicYear?->only(['id', 'name']),
                'full_name' => trim($student->first_name.' '.$student->last_name),
            ]);

        return response()->json($children);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
