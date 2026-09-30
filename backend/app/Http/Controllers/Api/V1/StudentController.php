<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceRecord;
use App\Models\Enrollment;
use App\Models\ExamResult;
use App\Models\ReportCard;
use App\Models\Student;
use App\Models\StudentEvent;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class StudentController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = Student::with(['grade', 'section']);

        // Parents and students only ever see their own records.
        $viewer = $request->user();
        $isFamily = (bool) $viewer->student || (bool) $viewer->parentProfile;
        if ($isFamily && ! $viewer->can('students.create') && ! $viewer->can('students.edit')) {
            $visible = collect();
            if ($viewer->student) {
                $visible = collect([$viewer->student->id]);
            } elseif ($viewer->parentProfile) {
                $visible = $viewer->parentProfile->students()->pluck('students.id');
            }
            if ($visible->isEmpty()) {
                return response()->json($this->emptyPaginator($request));
            }
            $q->whereIn('id', $visible);
        }

        if ($request->filled('grade_id')) {
            $q->where('grade_id', $request->integer('grade_id'));
        }
        if ($request->filled('section_id')) {
            $q->where('section_id', $request->integer('section_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('search')) {
            $s = $request->string('search');
            $q->where(fn ($qq) => $qq->where('first_name', 'like', "%{$s}%")->orWhere('last_name', 'like', "%{$s}%")->orWhere('admission_no', 'like', "%{$s}%"));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'admission_no' => 'nullable|string|unique:students,admission_no',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'gender' => 'nullable|string',
            'dob' => 'nullable|date',
            'level_id' => 'nullable|exists:school_levels,id',
            'grade_id' => 'nullable|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $data['admission_no'] = ($request->filled('admission_no'))
            ? $request->string('admission_no')->toString()
            : $this->nextAdmissionNo();

        $student = Student::create($data);
        self::logActivity('students.create', $student, null, $student);

        return response()->json($student, 201);
    }

    private function nextAdmissionNo(): string
    {
        return \App\Support\AdmissionNumber::next();
    }

    public function show(Student $student)
    {
        return response()->json($student->load(['grade', 'section', 'user']));
    }

    public function update(Request $request, Student $student)
    {
        $old = $student->toArray();
        $student->update($request->all());
        self::logActivity('students.edit', $student, $old, $student->fresh());

        return response()->json($student);
    }

    public function destroy(Student $student)
    {
        $student->delete();
        self::logActivity('students.delete', $student);

        return response()->json(['message' => 'Deleted.']);
    }

    public function promote(Request $request, Student $student)
    {
        $data = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'grade_id' => 'nullable|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'level_id' => 'nullable|exists:school_levels,id',
            'status' => 'nullable|string',
        ]);
        $enrollment = Enrollment::updateOrCreate(
            ['student_id' => $student->id, 'academic_year_id' => $data['academic_year_id']],
            [
                'grade_id' => $data['grade_id'] ?? $student->grade_id,
                'section_id' => $data['section_id'] ?? $student->section_id,
                'level_id' => $data['level_id'] ?? $student->level_id,
                'status' => $data['status'] ?? 'promoted',
                'promoted_at' => now(),
            ]
        );
        $student->update([
            'grade_id' => $enrollment->grade_id,
            'section_id' => $enrollment->section_id,
            'level_id' => $enrollment->level_id,
            'academic_year_id' => $enrollment->academic_year_id,
        ]);
        self::logActivity('students.promote', $student, null, $enrollment);

        StudentEvent::create([
            'student_id' => $student->id,
            'type' => 'promotion',
            'title' => 'Promoted',
            'detail' => trim(
                ($enrollment->grade?->name ? 'Grade '.$enrollment->grade?->name : '').
                ($enrollment->section?->name ? ' - Section '.$enrollment->section?->name : '').
                ($enrollment->academicYear?->name ? ' ('.$enrollment->academicYear?->name.')' : ''),
                ' -'
            ),
            'event_date' => now()->toDateString(),
            'academic_year_id' => $enrollment->academic_year_id,
            'to_grade_id' => $enrollment->grade_id,
            'to_section_id' => $enrollment->section_id,
            'performed_by' => $request->user()->id,
        ]);

        return response()->json($enrollment, 201);
    }

    /**
     * Move a student between grades/sections/levels inside the current year,
     * or out of the school entirely. History is appended, never overwritten.
     */
    public function transfer(Request $request, Student $student)
    {
        $data = $request->validate([
            'to_grade_id' => 'nullable|exists:grades,id',
            'to_section_id' => 'nullable|exists:sections,id',
            'to_level_id' => 'nullable|exists:school_levels,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'type' => 'required|in:internal,transfer_in,transfer_out',
            'reason' => 'nullable|string|max:500',
            'effective_date' => 'required|date',
            'destination_school' => 'nullable|string|max:200',
        ]);

        $from = [
            'grade_id' => $student->grade_id,
            'section_id' => $student->section_id,
            'level_id' => $student->level_id,
        ];

        $yearId = $data['academic_year_id'] ?? $student->academic_year_id
            ?? AcademicYear::where('is_current', true)->value('id');

        DB::transaction(function () use ($request, $student, $data, $from, $yearId) {
            if ($data['type'] === 'transfer_out') {
                $student->update(['status' => 'transferred']);
            } else {
                $student->update([
                    'grade_id' => $data['to_grade_id'] ?? $student->grade_id,
                    'section_id' => $data['to_section_id'] ?? $student->section_id,
                    'level_id' => $data['to_level_id'] ?? $student->level_id,
                ]);

                if ($yearId) {
                    Enrollment::updateOrCreate(
                        ['student_id' => $student->id, 'academic_year_id' => $yearId],
                        [
                            'grade_id' => $student->grade_id,
                            'section_id' => $student->section_id,
                            'level_id' => $student->level_id,
                            'status' => 'transferred',
                        ]
                    );
                }
            }

            $toGrade = $data['to_grade_id'] ?? null;
            $toSection = $data['to_section_id'] ?? null;

            StudentEvent::create([
                'student_id' => $student->id,
                'type' => $data['type'],
                'title' => match ($data['type']) {
                    'transfer_out' => 'Transferred out',
                    'transfer_in' => 'Transferred in',
                    default => 'Class transfer',
                },
                'detail' => trim(
                    ($data['reason'] ?? '')
                    .(($data['destination_school'] ?? null) ? ' → '.$data['destination_school'] : ''),
                    ' '
                ) ?: null,
                'event_date' => $data['effective_date'],
                'academic_year_id' => $yearId,
                'from_grade_id' => $from['grade_id'],
                'to_grade_id' => $toGrade,
                'from_section_id' => $from['section_id'],
                'to_section_id' => $toSection,
                'status_to' => $data['type'] === 'transfer_out' ? 'transferred' : null,
                'performed_by' => $request->user()->id,
            ]);
        });

        self::logActivity('students.transfer', $student, $from, $student->fresh());

        return response()->json($student->fresh(['grade', 'section']));
    }

    /** Withdraw, graduate, reinstate or suspend a student — recorded as a lifecycle event. */
    public function changeStatus(Request $request, Student $student)
    {
        $data = $request->validate([
            'status' => 'required|in:active,suspended,withdrawn,graduated,inactive',
            'reason' => 'nullable|string|max:500',
            'effective_date' => 'required|date',
            'academic_year_id' => 'nullable|exists:academic_years,id',
        ]);

        $previous = $student->status;
        $student->update(['status' => $data['status']]);

        StudentEvent::create([
            'student_id' => $student->id,
            'type' => $data['status'],
            'title' => ucfirst($data['status']),
            'detail' => trim(
                ($previous !== $data['status'] ? "Previously {$previous}. " : '').($data['reason'] ?? ''),
                ' '
            ) ?: null,
            'event_date' => $data['effective_date'],
            'academic_year_id' => $data['academic_year_id'] ?? $student->academic_year_id,
            'status_to' => $data['status'],
            'performed_by' => $request->user()->id,
        ]);

        self::logActivity('students.status', $student, ['status' => $previous], $student->fresh());

        return response()->json($student->fresh());
    }

    public function timeline(Student $student)
    {
        $events = [];

        $applications = Application::where('first_name', $student->first_name)
            ->where('last_name', $student->last_name)
            ->get();

        foreach ($applications as $application) {
            if ($application->submitted_at) {
                $events[] = [
                    'date' => $this->dateOnly($application->submitted_at),
                    'type' => 'application_submitted',
                    'title' => 'Application submitted',
                    'detail' => 'Application '.$application->application_no,
                ];
            }

            if ($application->decided_at
                && in_array($application->status, ['accepted', 'approved', 'enrolled'], true)) {
                $events[] = [
                    'date' => $this->dateOnly($application->decided_at),
                    'type' => 'application_approved',
                    'title' => 'Application approved',
                    'detail' => 'Application '.$application->application_no.' '.$application->status,
                ];
            }
        }

        $enrollments = Enrollment::where('student_id', $student->id)
            ->with(['grade', 'section', 'academicYear'])
            ->get();

        foreach ($enrollments as $enrollment) {
            $gradeName = $enrollment->grade?->name;
            $sectionName = $enrollment->section?->name;
            $yearName = $enrollment->academicYear?->name;
            $where = trim(
                ($gradeName ? "Grade {$gradeName}" : '').
                ($sectionName ? " - Section {$sectionName}" : '').
                ($yearName ? " ({$yearName})" : ''),
                ' -'
            );

            $events[] = [
                'date' => $this->dateOnly($enrollment->enrollment_date ?: $enrollment->created_at),
                'type' => 'enrollment',
                'title' => $enrollment->status === 'promoted' ? 'Assigned grade/section' : 'Enrolled',
                'detail' => $where !== '' ? $where : 'Enrollment recorded',
            ];

            if ($enrollment->promoted_at || $enrollment->status === 'promoted') {
                $events[] = [
                    'date' => $this->dateOnly($enrollment->promoted_at ?: $enrollment->created_at),
                    'type' => 'promotion',
                    'title' => 'Promoted',
                    'detail' => $where !== '' ? $where : 'Promotion recorded',
                ];
            }
        }

        $firstAttendance = AttendanceRecord::where('student_id', $student->id)
            ->with('attendance')
            ->orderBy('created_at')
            ->first();

        if ($firstAttendance) {
            $events[] = [
                'date' => $this->dateOnly($firstAttendance->attendance?->date ?: $firstAttendance->created_at),
                'type' => 'attendance',
                'title' => 'First attendance',
                'detail' => 'Marked '.$firstAttendance->status,
            ];
        }

        $submissions = AssignmentSubmission::where('student_id', $student->id)
            ->with('assignment')
            ->get();

        foreach ($submissions as $submission) {
            $events[] = [
                'date' => $this->dateOnly($submission->submitted_at ?: $submission->created_at),
                'type' => 'submission',
                'title' => $submission->assignment?->title ?: 'Assignment submission',
                'detail' => $submission->marks !== null
                    ? 'Graded '.$submission->marks
                    : 'Submitted',
            ];
        }

        $examResults = ExamResult::where('student_id', $student->id)
            ->with(['examSubject.subject', 'examSubject.exam'])
            ->get();

        foreach ($examResults as $result) {
            $exam = $result->examSubject?->exam;
            $subject = $result->examSubject?->subject;
            $events[] = [
                'date' => $this->dateOnly($exam?->start_date ?: $result->examSubject?->exam_date ?: $result->created_at),
                'type' => 'exam_result',
                'title' => trim(($exam?->name ?: 'Exam').($subject ? ' - '.$subject->name : '')),
                'detail' => 'Score '.$result->marks_obtained
                    .($result->examSubject?->total_marks ? '/'.$result->examSubject->total_marks : '')
                    .($result->grade_letter ? ' ('.$result->grade_letter.')' : ''),
            ];
        }

        $reportCards = ReportCard::where('student_id', $student->id)->get();

        foreach ($reportCards as $reportCard) {
            $events[] = [
                'date' => $this->dateOnly($reportCard->published_at ?: $reportCard->created_at),
                'type' => 'report_card',
                'title' => 'Report card',
                'detail' => trim(
                    'Average '.($reportCard->overall_average ?? 'n/a')
                    .($reportCard->overall_grade ? ' ('.$reportCard->overall_grade.')' : ''),
                    ' '
                ),
            ];
        }

        // Transfers, withdrawals, graduations and any other recorded lifecycle events.
        foreach (StudentEvent::where('student_id', $student->id)->get() as $event) {
            $events[] = [
                'date' => $this->dateOnly($event->event_date),
                'type' => $event->type,
                'title' => $event->title,
                'detail' => trim(
                    ($event->detail ?? '').
                    ($event->toGrade && $event->fromGrade && $event->toGrade->id !== $event->fromGrade->id
                        ? ' Grade '.$event->fromGrade->name.' → '.$event->toGrade->name
                        : ''),
                    ' '
                ) ?: '—',
            ];
        }

        usort($events, fn ($a, $b) => strcmp($b['date'], $a['date']));

        $basic = $student->only([
            'id', 'admission_no', 'first_name', 'last_name', 'gender', 'dob', 'status',
        ]);
        $basic['grade'] = $student->grade?->name;
        $basic['section'] = $student->section?->name;

        return response()->json([
            'student' => $basic,
            'events' => $events,
        ]);
    }

    protected function dateOnly($value): string
    {
        if (! $value) {
            return '';
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable $e) {
            return '';
        }
    }
}
