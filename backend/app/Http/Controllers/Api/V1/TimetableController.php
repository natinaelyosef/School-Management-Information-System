<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TimetableSlot;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TimetableController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = TimetableSlot::query()->with(['subject', 'teacher', 'grade', 'section', 'academicYear']);

        if ($request->filled('grade_id')) {
            $q->where('grade_id', $request->integer('grade_id'));
        }
        if ($request->filled('section_id')) {
            $q->where('section_id', $request->integer('section_id'));
        }
        if ($request->filled('teacher_id')) {
            $q->where('teacher_id', $request->integer('teacher_id'));
        }
        if ($request->filled('academic_year_id')) {
            $q->where('academic_year_id', $request->integer('academic_year_id'));
        }

        $slots = $q->orderBy('day')->orderBy('period')->get();

        $grouped = [];
        for ($day = 1; $day <= 6; $day++) {
            $grouped[$day] = [];
        }

        foreach ($slots as $slot) {
            $grouped[$slot->day][] = $slot;
        }

        return response()->json($grouped);
    }

    public function show(TimetableSlot $slot)
    {
        return response()->json($slot->load(['subject', 'teacher', 'grade', 'section', 'academicYear']));
    }

    public function store(Request $request)
    {
        $data = $this->validateSlot($request);

        $conflict = $this->findConflict($data);
        if ($conflict) {
            return response()->json(['message' => $conflict], 422);
        }

        $slot = TimetableSlot::create($data);

        self::logActivity('timetable.create', $slot, null, $slot);

        return response()->json($slot->load(['subject', 'teacher', 'grade', 'section', 'academicYear']), 201);
    }

    public function update(Request $request, TimetableSlot $slot)
    {
        $data = $this->validateSlot($request, true);

        $effective = array_merge($slot->toArray(), $data);
        $conflict = $this->findConflict($effective, $slot->id);
        if ($conflict) {
            return response()->json(['message' => $conflict], 422);
        }

        $old = $slot->toArray();
        $slot->update($data);

        self::logActivity('timetable.update', $slot, $old, $slot->fresh());

        return response()->json($slot->fresh()->load(['subject', 'teacher', 'grade', 'section', 'academicYear']));
    }

    public function destroy(TimetableSlot $slot)
    {
        $slot->delete();
        self::logActivity('timetable.delete', $slot);

        return response()->json(['message' => 'Deleted.']);
    }

    protected function validateSlot(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'academic_year_id' => "{$required}|exists:academic_years,id",
            'grade_id' => "{$required}|exists:grades,id",
            'section_id' => "{$required}|exists:sections,id",
            'subject_id' => "{$required}|exists:subjects,id",
            'teacher_id' => 'nullable|exists:teachers,id',
            'day' => "{$required}|integer|min:1|max:6",
            'period' => "{$required}|integer|min:1|max:20",
            'start_time' => "{$required}|regex:/^\d{1,2}:\d{2}(:\d{2})?$/",
            'end_time' => "{$required}|regex:/^\d{1,2}:\d{2}(:\d{2})?$/",
            'room' => 'nullable|string|max:60',
        ]);

        if (isset($data['start_time'], $data['end_time'])) {
            $start = strtotime($data['start_time']);
            $end = strtotime($data['end_time']);

            if ($start !== false && $end !== false && $end <= $start) {
                abort(422, 'end_time must be after start_time.');
            }
        }

        return $data;
    }

    protected function findConflict(array $data, ?int $exceptId = null): ?string
    {
        return DB::transaction(function () use ($data, $exceptId) {
            if (! empty($data['teacher_id'])) {
                $teacherClash = TimetableSlot::query()
                    ->where('teacher_id', $data['teacher_id'])
                    ->where('day', $data['day'])
                    ->where('period', $data['period'])
                    ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
                    ->exists();

                if ($teacherClash) {
                    return 'Teacher already assigned at this day/period';
                }
            }

            if (isset($data['grade_id'], $data['section_id'], $data['day'], $data['period'])) {
                $classClash = TimetableSlot::query()
                    ->where('grade_id', $data['grade_id'])
                    ->where('section_id', $data['section_id'])
                    ->where('day', $data['day'])
                    ->where('period', $data['period'])
                    ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
                    ->exists();

                if ($classClash) {
                    return 'Grade and section already have a class at this day/period';
                }
            }

            if (! empty($data['room']) && isset($data['day'], $data['period'])) {
                $roomClash = TimetableSlot::query()
                    ->where('room', $data['room'])
                    ->where('day', $data['day'])
                    ->where('period', $data['period'])
                    ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
                    ->exists();

                if ($roomClash) {
                    return 'Room already occupied at this day/period';
                }
            }

            return null;
        });
    }
}
