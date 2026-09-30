<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = Subject::query()->with('schoolLevel');

        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('name', 'like', "%{$s}%")
                ->orWhere('code', 'like', "%{$s}%"));
        }
        if ($request->filled('school_level_id')) {
            $q->where('school_level_id', $request->integer('school_level_id'));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($q->orderBy('name')->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:60|unique:subjects,code',
            'school_level_id' => 'nullable|exists:school_levels,id',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $data['is_active'] = $data['is_active'] ?? true;
        $subject = Subject::create($data);

        self::logActivity('subjects.create', $subject, null, $subject);

        return response()->json($subject->load('schoolLevel'), 201);
    }

    public function show(Subject $subject)
    {
        return response()->json($subject->load('schoolLevel'));
    }

    public function update(Request $request, Subject $subject)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:60|unique:subjects,code,'.$subject->id,
            'school_level_id' => 'nullable|exists:school_levels,id',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $old = $subject->toArray();
        $subject->update($data);

        self::logActivity('subjects.edit', $subject, $old, $subject->fresh());

        return response()->json($subject->fresh('schoolLevel'));
    }

    public function destroy(Subject $subject)
    {
        $subject->delete();
        self::logActivity('subjects.delete', $subject);

        return response()->json(['message' => 'Deleted.']);
    }
}
