<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ParentModel;
use App\Models\Student;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class ParentController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = ParentModel::with('students:id,first_name,last_name,admission_no,grade_id')->orderBy('last_name');

        if ($request->filled('search')) {
            $s = $request->string('search');
            $q->where(fn ($qq) => $qq
                ->where('first_name', 'like', "%{$s}%")
                ->orWhere('last_name', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%"));
        }

        if ($request->filled('student_id')) {
            $q->whereHas('students', fn ($qq) => $qq->where('students.id', $request->integer('student_id')));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function show(ParentModel $parent)
    {
        return response()->json($parent->load(['user:id,name,email', 'students']));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:190',
            'address' => 'nullable|string|max:500',
            'occupation' => 'nullable|string|max:120',
            'relationship' => 'nullable|string|max:40',
            'user_id' => 'nullable|exists:users,id',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'integer|exists:students,id',
        ]);

        $parent = ParentModel::create($data);
        if (! empty($data['student_ids'])) {
            $parent->students()->sync($data['student_ids']);
        }
        self::logActivity('parents.create', $parent, null, $parent);

        return response()->json($parent->load('students:id,first_name,last_name,admission_no'), 201);
    }

    public function update(Request $request, ParentModel $parent)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:190',
            'address' => 'nullable|string|max:500',
            'occupation' => 'nullable|string|max:120',
            'relationship' => 'nullable|string|max:40',
            'user_id' => 'nullable|exists:users,id',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'integer|exists:students,id',
        ]);

        $old = $parent->toArray();
        $parent->fill($data);
        $parent->save();
        if (array_key_exists('student_ids', $data)) {
            $parent->students()->sync($data['student_ids'] ?? []);
        }
        self::logActivity('parents.edit', $parent, $old, $parent->fresh());

        return response()->json($parent->load('students:id,first_name,last_name,admission_no'));
    }

    public function destroy(ParentModel $parent)
    {
        $parent->students()->detach();
        $parent->delete();
        self::logActivity('parents.delete', $parent);

        return response()->json(['message' => 'Deleted.']);
    }
}
