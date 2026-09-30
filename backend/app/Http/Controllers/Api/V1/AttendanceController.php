<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $q = Attendance::withCount('records');
        if ($request->filled('grade_id')) {
            $q->where('grade_id', $request->integer('grade_id'));
        }
        if ($request->filled('section_id')) {
            $q->where('section_id', $request->integer('section_id'));
        }
        if ($request->filled('date')) {
            $q->whereDate('date', $request->date('date'));
        }

        return response()->json($q->latest('date')->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request, NotificationService $notify)
    {
        $data = $request->validate([
            'grade_id' => 'nullable|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'term_id' => 'nullable|exists:terms,id',
            'date' => 'required|date',
            'session' => 'nullable|string',
            'records' => 'required|array|min:1',
            'records.*.student_id' => 'required|exists:students,id',
            'records.*.status' => 'required|in:present,absent,late,excused',
            'records.*.remark' => 'nullable|string',
        ]);

        $attendance = DB::transaction(function () use ($data, $request) {
            $att = Attendance::create([
                'grade_id' => $data['grade_id'] ?? null,
                'section_id' => $data['section_id'] ?? null,
                'subject_id' => $data['subject_id'] ?? null,
                'academic_year_id' => $data['academic_year_id'] ?? null,
                'term_id' => $data['term_id'] ?? null,
                'date' => $data['date'],
                'session' => $data['session'] ?? 'daily',
                'taken_by' => $request->user()->id,
            ]);
            foreach ($data['records'] as $r) {
                $att->records()->updateOrCreate(
                    ['student_id' => $r['student_id']],
                    ['status' => $r['status'], 'remark' => $r['remark'] ?? null]
                );
            }

            return $att;
        });

        $this->notifyAbsentees($attendance, $notify);

        return response()->json($attendance->load('records'), 201);
    }

    /**
     * Attendance → parent notification: every guardian of a child marked absent
     * gets an in-app (and, if opted in, SMS/Telegram) alert. Failures are
     * reported, never thrown, so a notification outage cannot block marking.
     */
    protected function notifyAbsentees(Attendance $attendance, NotificationService $notify): void
    {
        try {
            $absent = $attendance->records()
                ->whereIn('status', ['absent', 'late'])
                ->with('student.parents.user')
                ->get();

            foreach ($absent as $record) {
                $student = $record->student;
                if (! $student) {
                    continue;
                }

                $label = $record->status === 'absent' ? 'absent' : 'late';

                foreach ($student->parents as $parent) {
                    if (! $parent->user) {
                        continue;
                    }

                    $channels = $notify->preferredChannelsFor($parent->user);
                    $channels[] = 'database';

                    $notify->sendMany(
                        $parent->user,
                        'attendance',
                        ucfirst($label).": {$student->full_name}",
                        "{$student->full_name} was marked {$label} on ".\Carbon\Carbon::parse($attendance->date)->format('d M Y').'.',
                        $channels,
                        $attendance
                    );
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function show(Attendance $attendance)
    {
        return response()->json($attendance->load('records.student'));
    }

    public function update(Request $request, Attendance $attendance)
    {
        $attendance->update($request->only(['notes', 'subject_id']));
        if ($request->has('records')) {
            foreach ($request->input('records') as $r) {
                $attendance->records()->updateOrCreate(
                    ['student_id' => $r['student_id']],
                    ['status' => $r['status'], 'remark' => $r['remark'] ?? null]
                );
            }
        }

        return response()->json($attendance->load('records'));
    }

    public function destroy(Attendance $attendance)
    {
        $attendance->records()->delete();
        $attendance->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
