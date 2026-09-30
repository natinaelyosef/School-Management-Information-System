<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use App\Services\GradingService;
use App\Services\NotificationService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = Exam::query()->withCount('examSubjects');

        if ($request->filled('academic_year_id')) {
            $q->where('academic_year_id', $request->integer('academic_year_id'));
        }
        if ($request->filled('term_id')) {
            $q->where('term_id', $request->integer('term_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('exam_type')) {
            $q->where('exam_type', $request->string('exam_type'));
        }
        if ($request->filled('type')) {
            $q->where('exam_type', $request->string('type'));
        }
        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq->where('name', 'like', "%{$s}%")->orWhere('description', 'like', "%{$s}%"));
        }

        return response()->json($q->latest('start_date')->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'academic_year_id' => 'required|exists:academic_years,id',
            'term_id' => 'nullable|exists:terms,id',
            'type' => 'nullable|in:quiz,test,midterm,final',
            'exam_type' => 'nullable|in:quiz,test,midterm,final',
            'date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'total_marks' => 'nullable|numeric|min:1',
            'subject' => 'nullable|exists:subjects,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'grade' => 'nullable|exists:grades,id',
            'grade_id' => 'nullable|exists:grades,id',
            'level' => 'nullable|exists:grades,id',
            'level_id' => 'nullable|exists:grades,id',
            'description' => 'nullable|string',
            'subjects' => 'nullable|array',
            'subjects.*.subject_id' => 'required_with:subjects|exists:subjects,id',
            'subjects.*.grade_id' => 'nullable|exists:grades,id',
            'subjects.*.total_marks' => 'nullable|numeric|min:1',
            'subjects.*.exam_date' => 'nullable|date',
        ]);

        $examType = $data['type'] ?? $data['exam_type'] ?? 'midterm';
        $startDate = $data['date'] ?? $data['start_date'] ?? null;
        $subjectId = $data['subject_id'] ?? $data['subject'] ?? null;
        $gradeId = $data['grade_id'] ?? $data['grade'] ?? $data['level_id'] ?? $data['level'] ?? null;
        $totalMarks = $data['total_marks'] ?? 100;

        $exam = DB::transaction(function () use ($data, $examType, $startDate, $subjectId, $gradeId, $totalMarks) {
            $exam = Exam::create([
                'name' => $data['name'],
                'academic_year_id' => $data['academic_year_id'],
                'term_id' => $data['term_id'] ?? null,
                'exam_type' => $examType,
                'start_date' => $startDate,
                'end_date' => $data['end_date'] ?? $startDate,
                'status' => 'scheduled',
                'description' => $data['description'] ?? null,
            ]);

            $rows = [];

            if ($subjectId) {
                $rows[] = [
                    'subject_id' => $subjectId,
                    'grade_id' => $gradeId,
                    'total_marks' => $totalMarks,
                    'exam_date' => $startDate,
                ];
            }

            foreach ($data['subjects'] ?? [] as $row) {
                $rows[] = [
                    'subject_id' => $row['subject_id'],
                    'grade_id' => $row['grade_id'] ?? $gradeId,
                    'total_marks' => $row['total_marks'] ?? $totalMarks,
                    'exam_date' => $row['exam_date'] ?? $startDate,
                ];
            }

            foreach ($rows as $row) {
                $exam->examSubjects()->create($row);
            }

            return $exam;
        });

        self::logActivity('exams.create', $exam, null, $exam);

        $exam->load(['examSubjects.subject']);

        return response()->json($exam->toArray() + ['examSubjects' => $exam->examSubjects], 201);
    }

    public function show(Exam $exam)
    {
        $exam->load(['examSubjects.subject', 'examSubjects.results.student']);

        $payload = $exam->toArray();
        $payload['subjects'] = $exam->examSubjects;
        $payload['results'] = $exam->examSubjects->pluck('results')->flatten(1)->values();

        return response()->json($payload);
    }

    public function results(Exam $exam)
    {
        $results = ExamResult::query()
            ->whereHas('examSubject', fn ($q) => $q->where('exam_id', $exam->id))
            ->with(['student', 'examSubject.subject'])
            ->get();

        return response()->json($results);
    }

    public function storeResults(Request $request, Exam $exam, GradingService $grading)
    {
        $data = $request->validate([
            'results' => 'required|array|min:1',
            'results.*.student_id' => 'required|exists:students,id',
            'results.*.score' => 'required|numeric|min:0',
            'results.*.exam_subject_id' => 'nullable|exists:exam_subjects,id',
            'exam_subject_id' => 'nullable|exists:exam_subjects,id',
            'subject_id' => 'nullable|exists:subjects,id',
        ]);

        $defaultExamSubjectId = $this->resolveExamSubjectId($exam, $data);
        $gradeId = $exam->examSubjects()->value('grade_id');
        $schoolLevelId = $gradeId
            ? (int) Grade::where('id', $gradeId)->value('school_level_id')
            : null;
        $academicYearId = (int) $exam->academic_year_id;

        $saved = DB::transaction(function () use ($data, $exam, $defaultExamSubjectId, $grading, $schoolLevelId, $academicYearId, $request) {
            $saved = [];

            foreach ($data['results'] as $row) {
                $examSubjectId = $row['exam_subject_id'] ?? $defaultExamSubjectId;

                if (! $examSubjectId) {
                    abort(422, 'exam_subject_id or subject_id is required for this exam.');
                }

                if (! $exam->examSubjects()->where('id', $examSubjectId)->exists()) {
                    abort(422, 'Exam subject does not belong to this exam.');
                }

                $grade = $grading->letterFor((float) $row['score'], $schoolLevelId, $academicYearId);

                $saved[] = ExamResult::updateOrCreate(
                    ['exam_subject_id' => $examSubjectId, 'student_id' => $row['student_id']],
                    [
                        'marks_obtained' => $row['score'],
                        'grade_letter' => $grade['letter'],
                        'grade_point' => $grade['point'],
                        'is_absent' => false,
                        'entered_by' => $request->user()->id,
                    ]
                );
            }

            return $saved;
        });

        self::logActivity('exams.results', $exam, null, ['count' => count($saved)]);

        return response()->json(collect($saved), 201);
    }

    protected function resolveExamSubjectId(Exam $exam, array $data): ?int
    {
        if (! empty($data['exam_subject_id'])) {
            return (int) $data['exam_subject_id'];
        }

        if (! empty($data['subject_id'])) {
            $id = $exam->examSubjects()->where('subject_id', $data['subject_id'])->value('id');

            return $id ? (int) $id : null;
        }

        $firstRowSubject = collect($data['results'])->first(fn ($r) => ! empty($r['exam_subject_id']));
        if ($firstRowSubject) {
            return (int) $firstRowSubject['exam_subject_id'];
        }

        $ids = $exam->examSubjects()->pluck('id');

        if ($ids->count() === 1) {
            return (int) $ids->first();
        }

        return null;
    }

    public function publish(Request $request, Exam $exam, NotificationService $notify)
    {
        $exam->update(['status' => 'published']);

        self::logActivity('exams.publish', $exam, null, $exam->fresh());

        $notified = 0;

        try {
            $gradeIds = $exam->examSubjects()->whereNotNull('grade_id')->pluck('grade_id')->unique()->values();

            $students = Student::query()
                ->when($gradeIds->isNotEmpty(), fn ($q) => $q->whereIn('grade_id', $gradeIds))
                ->whereNotNull('user_id')
                ->get(['user_id']);

            foreach ($students as $student) {
                $user = User::find($student->user_id);
                if ($user) {
                    $notify->send(
                        $user,
                        'exam',
                        "Results published: {$exam->name}",
                        "The results for {$exam->name} are now available.",
                        'database',
                        $exam
                    );
                    $notified++;
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }

        $exam = $exam->fresh()->load('examSubjects.subject');
        $exam->notified = $notified;

        return response()->json($exam);
    }
}
