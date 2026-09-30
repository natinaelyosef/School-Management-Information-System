<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class TeacherController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = Teacher::query();

        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('first_name', 'like', "%{$s}%")
                ->orWhere('last_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('employee_no', 'like', "%{$s}%")
                ->orWhere('specialization', 'like', "%{$s}%"));
        }
        if ($request->filled('status')) {
            $q->where('employment_status', $request->string('status'));
        }

        return response()->json(
            $q->orderBy('last_name')->orderBy('first_name')->paginate($request->integer('per_page', 20))
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'employee_no' => 'nullable|string|max:60|unique:teachers,employee_no',
            'email' => 'nullable|email|unique:teachers,email',
            'phone' => 'nullable|string|max:30',
            'qualification' => 'nullable|string|max:255',
            'specialization' => 'nullable|string|max:255',
            'employment_status' => 'nullable|string|max:30',
            'hire_date' => 'nullable|date',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $teacher = Teacher::create($data);
        self::logActivity('teachers.create', $teacher, null, $teacher);

        return response()->json($teacher, 201);
    }

    public function show(Teacher $teacher)
    {
        return response()->json($teacher->load('user'));
    }

    public function update(Request $request, Teacher $teacher)
    {
        $data = $request->validate([
            'first_name' => 'sometimes|required|string|max:100',
            'last_name' => 'sometimes|required|string|max:100',
            'employee_no' => 'nullable|string|max:60|unique:teachers,employee_no,'.$teacher->id,
            'email' => 'nullable|email|unique:teachers,email,'.$teacher->id,
            'phone' => 'nullable|string|max:30',
            'qualification' => 'nullable|string|max:255',
            'specialization' => 'nullable|string|max:255',
            'employment_status' => 'nullable|string|max:30',
            'hire_date' => 'nullable|date',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $old = $teacher->toArray();
        $teacher->update($data);
        self::logActivity('teachers.edit', $teacher, $old, $teacher->fresh());

        return response()->json($teacher->fresh());
    }

    public function destroy(Teacher $teacher)
    {
        $teacher->delete();
        self::logActivity('teachers.delete', $teacher);

        return response()->json(['message' => 'Deleted.']);
    }
}
