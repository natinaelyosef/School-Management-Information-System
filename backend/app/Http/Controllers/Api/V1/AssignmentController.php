<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Student;
use App\Models\User;
use App\Services\NotificationService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssignmentController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $q = Assignment::with(['subject', 'grade', 'section', 'teacher'])
            ->withCount(['submissions', 'submissions as graded_submissions_count' => fn ($qq) => $qq->where('status', 'graded')]);

        if ($request->filled('grade_id')) {
            $q->where('grade_id', $request->integer('grade_id'));
        }
        if ($request->filled('section_id')) {
            $q->where('section_id', $request->integer('section_id'));
        }
        if ($request->filled('subject_id')) {
            $q->where('subject_id', $request->integer('subject_id'));
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
        if ($request->filled('teacher_id')) {
            $q->where('teacher_id', $request->integer('teacher_id'));
        }

        // Students only see published work for their own class.
        $viewer = $request->user();
        if ($viewer->student) {
            $q->where('status', 'published');
            $student = $viewer->student;
            $q->where(function ($qq) use ($student) {
                $qq->where(function ($qqq) use ($student) {
                    $qqq->whereNull('grade_id')->whereNull('section_id');
                })->orWhere(function ($qqq) use ($student) {
                    $qqq->when($student->grade_id, fn ($x) => $x->where('grade_id', $student->grade_id))
                        ->when($student->section_id, fn ($x) => $x->where('section_id', $student->section_id));
                });
            });
        }

        return response()->json($q->latest('due_date')->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request, NotificationService $notify)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'grade_id' => 'nullable|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'class_subject_id' => 'nullable|exists:class_subjects,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'term_id' => 'nullable|exists:terms,id',
            'teacher_id' => 'nullable|exists:teachers,id',
            'due_date' => 'nullable|date',
            'total_marks' => 'nullable|numeric|min:1|max:1000',
            'status' => 'nullable|in:draft,published',
        ]);

        $teacherId = $data['teacher_id'] ?? $request->user()->teacher?->id;

        $assignment = Assignment::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'grade_id' => $data['grade_id'] ?? null,
            'section_id' => $data['section_id'] ?? null,
            'subject_id' => $data['subject_id'] ?? null,
            'class_subject_id' => $data['class_subject_id'] ?? null,
            'academic_year_id' => $data['academic_year_id'] ?? null,
            'term_id' => $data['term_id'] ?? null,
            'teacher_id' => $teacherId,
            'due_date' => $data['due_date'] ?? null,
            'total_marks' => $data['total_marks'] ?? 100,
            'status' => $data['status'] ?? 'published',
        ]);

        self::logActivity('assignments.create', $assignment, null, $assignment);

        if ($assignment->status === 'published') {
            $this->notifyStudents($assignment, $notify);
        }

        return response()->json($assignment->load(['subject', 'grade', 'section', 'teacher']), 201);
    }

    protected function notifyStudents(Assignment $assignment, NotificationService $notify): void
    {
        try {
            $students = Student::query()
                ->when($assignment->grade_id, fn ($q) => $q->where('grade_id', $assignment->grade_id))
                ->when($assignment->section_id, fn ($q) => $q->where('section_id', $assignment->section_id))
                ->whereNotNull('user_id')
                ->get(['user_id']);

            foreach ($students as $student) {
                $user = User::find($student->user_id);
                if ($user) {
                    $notify->sendAssignmentNotification($user, $assignment->title, $assignment);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function show(Assignment $assignment)
    {
        return response()->json($assignment->load([
            'subject', 'grade', 'section', 'teacher',
            'submissions.student',
        ]));
    }

    public function submissions(Assignment $assignment)
    {
        return response()->json(
            $assignment->submissions()->with('student')->latest('submitted_at')->paginate(50)
        );
    }

    public function submit(Request $request, Assignment $assignment)
    {
        $student = $request->user()->student;

        if (! $student) {
            abort(403, 'No student profile linked to this account.');
        }

        $data = $request->validate([
            'answer' => 'nullable|string',
            'content' => 'nullable|string',
            'file' => 'nullable|file|max:10240',
            'file_path' => 'nullable|string|max:1000',
        ]);

        $content = $data['answer'] ?? $data['content'] ?? null;
        $filePath = $data['file_path'] ?? null;

        if ($request->hasFile('file')) {
            $filePath = $request->file('file')->store('assignments/submissions', 'public');
        }

        if (blank($content) && blank($filePath)) {
            throw ValidationException::withMessages([
                'answer' => ['Provide an answer text or a file.'],
            ]);
        }

        $submission = AssignmentSubmission::updateOrCreate(
            ['assignment_id' => $assignment->id, 'student_id' => $student->id],
            [
                'content' => $content,
                'file_path' => $filePath,
                'submitted_at' => now(),
                'status' => 'submitted',
            ]
        );

        self::logActivity('assignments.submit', $submission, null, $submission);

        return response()->json($submission->load('student'), 201);
    }

    public function grade(Request $request, Assignment $assignment, AssignmentSubmission $submission)
    {
        abort_unless($submission->assignment_id === $assignment->id, 404);

        $totalMarks = (float) ($assignment->total_marks ?? 100);

        $data = $request->validate([
            'score' => "required|numeric|min:0|max:{$totalMarks}",
            'feedback' => 'nullable|string',
        ]);

        $submission->update([
            'marks' => $data['score'],
            'feedback' => $data['feedback'] ?? $submission->feedback,
            'status' => 'graded',
        ]);

        self::logActivity('assignments.grade', $submission, null, $submission->fresh());

        $this->notifyGraded($assignment, $submission);

        return response()->json($submission->fresh('student'));
    }

    protected function notifyGraded(Assignment $assignment, AssignmentSubmission $submission): void
    {
        try {
            $student = $submission->student()->with('user')->first();
            if ($student?->user) {
                app(NotificationService::class)->send(
                    $student->user,
                    'assignment',
                    "Assignment graded: {$assignment->title}",
                    "Your submission scored {$submission->marks}.",
                    'database',
                    $submission
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
