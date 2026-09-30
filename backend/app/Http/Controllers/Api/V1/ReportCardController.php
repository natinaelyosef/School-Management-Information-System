<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\AttendanceRecord;
use App\Models\Enrollment;
use App\Models\ExamResult;
use App\Models\ReportCard;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\Term;
use App\Services\GradingService;
use App\Traits\LogsActivity;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ReportCardController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = ReportCard::with(['student.grade', 'student.section', 'term']);

        $visible = $this->visibleStudentIds($request->user());
        if ($visible !== null) {
            $q->whereIn('student_id', $visible);
        }

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('term_id')) {
            $q->where('term_id', $request->integer('term_id'));
        }
        if ($request->filled('academic_year_id')) {
            $q->where('academic_year_id', $request->integer('academic_year_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    /**
     * Report cards are sensitive. Staff see everything; students and parents only
     * see their own. Returns null for unrestricted access.
     */
    protected function visibleStudentIds($user): ?Collection
    {
        if (! $user) {
            return collect();
        }

        if ($user->can('grades.enter') || $user->can('grades.edit') || $user->can('grades.publish')) {
            return null;
        }

        if ($user->student) {
            return collect([$user->student->id]);
        }

        if ($user->parentProfile) {
            return $user->parentProfile->students()->pluck('students.id');
        }

        return collect();
    }

    protected function authorizeAccess(ReportCard $reportCard, $user): void
    {
        $visible = $this->visibleStudentIds($user);

        if ($visible !== null && ! $visible->contains($reportCard->student_id)) {
            abort(403, 'You may only view report cards for your own children.');
        }
    }

    public function store(Request $request, GradingService $grading)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'term_id' => 'nullable|exists:terms,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'teacher_comment' => 'nullable|string',
            'principal_comment' => 'nullable|string',
        ]);

        $student = Student::with(['grade', 'section'])->findOrFail($data['student_id']);

        $term = ! empty($data['term_id']) ? Term::find($data['term_id']) : Term::where('is_current', true)->first();
        $academicYearId = $data['academic_year_id']
            ?? $term?->academic_year_id
            ?? $student->academic_year_id
            ?? AcademicYear::where('is_current', true)->value('id')
            ?? AcademicYear::orderBy('id', 'desc')->value('id');

        abort_unless($academicYearId, 422, 'academic_year_id is required (no academic year found).');

        $results = ExamResult::query()
            ->where('student_id', $student->id)
            ->whereHas('examSubject', fn ($q) => $q->whereHas('exam', function ($qq) use ($academicYearId, $term) {
                $qq->where('academic_year_id', $academicYearId);
                if ($term) {
                    $qq->where('term_id', $term->id);
                }
            }))
            ->with(['examSubject.subject', 'examSubject.exam'])
            ->get();

        $levelId = $student->level_id;
        $bySubject = [];

        foreach ($results as $result) {
            $subjectId = $result->examSubject->subject_id;
            $key = (string) $subjectId;

            if (! isset($bySubject[$key])) {
                $bySubject[$key] = [
                    'subject_id' => $subjectId,
                    'subject' => $result->examSubject->subject?->name,
                    'code' => $result->examSubject->subject?->code,
                    'obtained' => 0.0,
                    'possible' => 0.0,
                    'count' => 0,
                ];
            }

            $bySubject[$key]['obtained'] += (float) ($result->marks_obtained ?? 0);
            $bySubject[$key]['possible'] += (float) ($result->examSubject->total_marks ?? 0);
            $bySubject[$key]['count']++;
        }

        $subjects = [];
        $totalObtained = 0.0;
        $totalPossible = 0.0;

        foreach ($bySubject as $row) {
            $percent = $row['possible'] > 0 ? round(($row['obtained'] / $row['possible']) * 100, 2) : null;
            $grade = $grading->letterFor($percent, $levelId ? (int) $levelId : null, (int) $academicYearId);

            $subjects[] = [
                'subject_id' => $row['subject_id'],
                'subject' => $row['subject'],
                'code' => $row['code'],
                'obtained' => round($row['obtained'], 2),
                'possible' => round($row['possible'], 2),
                'percentage' => $percent,
                'grade' => $grade['letter'],
                'grade_point' => $grade['point'],
                'exams' => $row['count'],
            ];

            $totalObtained += $row['obtained'];
            $totalPossible += $row['possible'];
        }

        $overallAverage = $totalPossible > 0
            ? round(($totalObtained / $totalPossible) * 100, 2)
            : ($subjects ? round(collect($subjects)->avg('percentage'), 2) : null);

        $overallGrade = $grading->letterFor($overallAverage, $levelId ? (int) $levelId : null, (int) $academicYearId)['letter'] ?: null;

        $attendance = $this->attendanceSummary($student->id, $term, $academicYearId);

        $enrollment = Enrollment::where('student_id', $student->id)
            ->where('academic_year_id', $academicYearId)
            ->first();

        $reportCard = ReportCard::updateOrCreate(
            [
                'student_id' => $student->id,
                'academic_year_id' => $academicYearId,
                'term_id' => $term?->id,
            ],
            [
                'enrollment_id' => $enrollment?->id,
                'overall_average' => $overallAverage,
                'overall_grade' => $overallGrade,
                'attendance_rate' => $attendance['rate'],
                'teacher_comment' => $data['teacher_comment'] ?? null,
                'principal_comment' => $data['principal_comment'] ?? null,
                'status' => 'draft',
                'payload' => [
                    'subjects' => $subjects,
                    'attendance' => $attendance,
                    'exams_count' => $results->count(),
                    'term' => $term?->name,
                    'academic_year_id' => (int) $academicYearId,
                    'grading' => $grading->hasCustomScale($levelId ? (int) $levelId : null, (int) $academicYearId)
                        ? 'grading_scales'
                        : 'default_thresholds',
                    'generated_at' => now()->toDateTimeString(),
                ],
            ]
        );

        $this->applyRank($reportCard, $student, $academicYearId);

        self::logActivity('report_cards.create', $reportCard, null, $reportCard->fresh());

        return response()->json($reportCard->fresh()->load(['student.grade', 'student.section', 'term']), 201);
    }

    public function show(Request $request, ReportCard $reportCard)
    {
        $this->authorizeAccess($reportCard, $request->user());

        return response()->json($reportCard->load(['student.grade', 'student.section', 'term', 'enrollment']));
    }

    public function download(Request $request, ReportCard $reportCard)
    {
        $this->authorizeAccess($reportCard, $request->user());

        $reportCard->load(['student.grade', 'student.section', 'term', 'enrollment.academicYear']);

        $settings = SchoolSetting::whereIn('key', [
            'school_name', 'school_address', 'school_phone',
        ])->pluck('value', 'key');

        $payload = $reportCard->payload ?? [];
        $subjects = collect($payload['subjects'] ?? [])->values()->all();

        $student = $reportCard->student;
        $grade = $student?->grade;
        $section = $student?->section;

        $className = trim(($grade->name ?? '').($section ? '-'.$section->name : ''), '-');

        $academicYear = $reportCard->enrollment->academicYear?->name
            ?? AcademicYear::find($reportCard->academic_year_id)?->name
            ?? '';

        $document = Pdf::loadView('report-cards.pdf', [
            'card' => $reportCard,
            'subjects' => $subjects,
            'schoolName' => $settings['school_name'] ?? config('app.name'),
            'schoolAddress' => $settings['school_address'] ?? '',
            'schoolPhone' => $settings['school_phone'] ?? '',
            'termName' => $reportCard->term?->name
                ?? $payload['term']
                ?? ($academicYear ? $academicYear.' Report' : 'Report Card'),
            'className' => $className ?: '—',
            'academicYear' => $academicYear ?: '—',
            'generatedAt' => now()->format('d M Y, H:i'),
        ]);

        $filename = sprintf(
            'report-card-%s-%s.pdf',
            $student?->admission_no ?: 'student-'.$reportCard->student_id,
            preg_replace('/[^A-Za-z0-9]+/', '-', strtolower($reportCard->term?->name ?? 'report'))
        );

        return $document->download($filename);
    }

    protected function attendanceSummary(int $studentId, ?Term $term, int $academicYearId): array
    {
        $query = AttendanceRecord::query()
            ->where('student_id', $studentId)
            ->whereHas('attendance', function ($q) use ($term, $academicYearId) {
                $q->where(function ($qq) use ($academicYearId) {
                    $qq->where('academic_year_id', $academicYearId)
                        ->orWhereNull('academic_year_id');
                });

                if ($term && $term->start_date && $term->end_date) {
                    $q->whereBetween('date', [$term->start_date, $term->end_date]);
                }
            });

        $statuses = $query->get(['status'])->pluck('status');
        $total = $statuses->count();

        $counts = [];
        foreach ($statuses as $status) {
            $counts[$status] = ($counts[$status] ?? 0) + 1;
        }

        foreach (['present', 'absent', 'late', 'excused'] as $known) {
            $counts[$known] = $counts[$known] ?? 0;
        }

        $attended = ($counts['present'] ?? 0) + ($counts['late'] ?? 0);
        $rate = $total > 0 ? round(($attended / $total) * 100, 2) : null;

        return [
            'total' => $total,
            'by_status' => $counts,
            'attended' => $attended,
            'rate' => $rate,
        ];
    }

    protected function applyRank(ReportCard $reportCard, Student $student, int $academicYearId): void
    {
        if ($reportCard->overall_average === null) {
            return;
        }

        try {
            $peerIds = Student::query()
                ->when($student->grade_id, fn ($q) => $q->where('grade_id', $student->grade_id))
                ->when($student->section_id, fn ($q) => $q->where('section_id', $student->section_id))
                ->pluck('id');

            $peers = ReportCard::query()
                ->where('academic_year_id', $academicYearId)
                ->whereIn('student_id', $peerIds)
                ->whereNotNull('overall_average')
                ->get(['student_id', 'overall_average']);

            $totalStudents = $peers->count();
            $rank = $peers->filter(fn ($p) => (float) $p->overall_average > (float) $reportCard->overall_average)->count() + 1;

            $reportCard->update([
                'rank_in_class' => $totalStudents > 0 ? $rank : null,
                'total_students' => $totalStudents ?: null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
