<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Announcement;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Attendance;
use App\Models\AttendanceRecord;
use App\Models\Book;
use App\Models\Borrowing;
use App\Models\ClassSubject;
use App\Models\Enrollment;
use App\Models\Event;
use App\Models\Exam;
use App\Models\HealthRecord;
use App\Models\HealthVisit;
use App\Models\LibraryFine;
use App\Models\Message;
use App\Models\ParentModel;
use App\Models\Payment;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    protected const ROLE_PRIORITY = [
        'super_admin', 'school_admin', 'principal', 'academic_coordinator',
        'registrar', 'registration_office', 'teacher', 'accountant', 'librarian', 'nurse', 'parent', 'student',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->resolveRole($user);

        [$stats, $tasks] = match ($role) {
            'super_admin', 'school_admin', 'principal', 'academic_coordinator' => $this->adminStats($user),
            'teacher' => $this->teacherStats($user),
            'accountant' => $this->accountantStats($user),
            'registrar', 'registration_office' => $this->registrarStats($user),
            'librarian' => $this->librarianStats($user),
            'nurse' => $this->nurseStats($user),
            'parent' => $this->parentStats($user),
            'student' => $this->studentStats($user),
            default => $this->genericStats($user),
        };

        $stats['role'] = $role;
        $stats['my_tasks'] = $tasks;

        return response()->json($stats);
    }

    protected function resolveRole(User $user): string
    {
        $roles = $user->getRoleNames()->map(fn ($r) => (string) $r)->all();

        foreach (self::ROLE_PRIORITY as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        if ($user->student) {
            return 'student';
        }
        if ($user->parentProfile) {
            return 'parent';
        }
        if ($user->teacher) {
            return 'teacher';
        }

        return $roles[0] ?? 'staff';
    }

    protected function unreadMessages(User $user): int
    {
        try {
            return (int) Message::query()
                ->whereHas('conversation', fn ($q) => $q->whereHas(
                    'participants',
                    fn ($qq) => $qq->where('user_id', $user->id)
                ))
                ->where('sender_id', '!=', $user->id)
                ->whereDoesntHave('reads', fn ($q) => $q->where('user_id', $user->id))
                ->count();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    protected function attendanceTakenTodayCount(): int
    {
        return (int) Attendance::whereDate('date', today())->count();
    }

    protected function classesWithoutAttendanceToday(?int $teacherId = null): int
    {
        try {
            $pairs = $this->teacherClassPairs($teacherId);
            $pending = 0;

            foreach ($pairs as $pair) {
                $exists = Attendance::whereDate('date', today())
                    ->where('grade_id', $pair['grade_id'])
                    ->where('section_id', $pair['section_id'])
                    ->exists();

                if (! $exists) {
                    $pending++;
                }
            }

            return $pending;
        } catch (\Throwable $e) {
            return 0;
        }
    }

    protected function teacherClassPairs(?int $teacherId): array
    {
        if (! $teacherId) {
            return [];
        }

        $pairs = [];

        $classSubjects = ClassSubject::where('teacher_id', $teacherId)
            ->get(['grade_id', 'section_id']);
        foreach ($classSubjects as $cs) {
            $pairs[$cs->grade_id.':'.$cs->section_id] = [
                'grade_id' => $cs->grade_id,
                'section_id' => $cs->section_id,
            ];
        }

        $slots = TimetableSlot::where('teacher_id', $teacherId)
            ->get(['grade_id', 'section_id']);
        foreach ($slots as $slot) {
            $pairs[$slot->grade_id.':'.$slot->section_id] = [
                'grade_id' => $slot->grade_id,
                'section_id' => $slot->section_id,
            ];
        }

        $assignments = TeacherAssignment::where('teacher_id', $teacherId)
            ->get(['grade_id', 'section_id']);
        foreach ($assignments as $ta) {
            $key = $ta->grade_id.':'.$ta->section_id;
            if (! isset($pairs[$key])) {
                $pairs[$key] = ['grade_id' => $ta->grade_id, 'section_id' => $ta->section_id];
            }
        }

        return array_values($pairs);
    }

    protected function myClassesCount(?int $teacherId): int
    {
        return count($this->teacherClassPairs($teacherId));
    }

    /** Today's attendance percentage across every class the teacher owns. */
    protected function attendanceRateForTeacher(?int $teacherId): ?float
    {
        $pairs = $this->teacherClassPairs($teacherId);
        if ($pairs === []) {
            return null;
        }

        $total = 0;
        $attended = 0;

        foreach ($pairs as $pair) {
            $q = AttendanceRecord::query()->whereHas(
                'attendance',
                fn ($qq) => $qq->whereDate('date', today())
                    ->where('grade_id', $pair['grade_id'])
                    ->where('section_id', $pair['section_id'])
            );

            $total += (clone $q)->count();
            $attended += (clone $q)->whereIn('status', ['present', 'late'])->count();
        }

        return $total === 0 ? null : round(($attended / $total) * 100, 1);
    }

    protected function teacherStudentCount(?int $teacherId): int
    {
        $pairs = $this->teacherClassPairs($teacherId);
        if ($pairs === []) {
            return 0;
        }

        return (int) Student::whereNull('deleted_at')
            ->where('status', 'active')
            ->where(function ($q) use ($pairs) {
                foreach ($pairs as $pair) {
                    $q->orWhere(
                        fn ($w) => $w->where('grade_id', $pair['grade_id'])
                            ->where('section_id', $pair['section_id'])
                    );
                }
            })
            ->count();
    }

    protected function myTeacherId(User $user): ?int
    {
        return $user->teacher?->id;
    }

    /** Present + late percentage for a set of students over the last $days days. */
    protected function attendanceRateForStudents($studentIds, int $days = 60): ?float
    {
        $ids = collect($studentIds)->filter()->values();
        if ($ids->isEmpty()) {
            return null;
        }

        try {
            $q = AttendanceRecord::whereIn('student_id', $ids)
                ->whereHas('attendance', fn ($qq) => $qq->whereDate('date', '>=', now()->subDays($days)->toDateString()));

            $total = (clone $q)->count();
            if ($total === 0) {
                return null;
            }

            $attended = (clone $q)->whereIn('status', ['present', 'late'])->count();

            return round(($attended / $total) * 100, 1);
        } catch (\Throwable $e) {
            return null;
        }
    }

    protected function feeStatusFor($studentIds): ?string
    {
        $ids = collect($studentIds)->filter()->values();
        if ($ids->isEmpty()) {
            return null;
        }

        $q = StudentInvoice::whereIn('student_id', $ids);
        $total = (clone $q)->sum('total');
        if ($total <= 0) {
            return null;
        }

        $balance = (float) StudentInvoice::whereIn('student_id', $ids)->sum('balance');
        if ($balance <= 0) {
            return 'Paid';
        }

        $overdue = $this->overdueInvoicesCount($ids);

        return $overdue > 0 ? 'Overdue' : 'Partial';
    }

    protected function outstandingFeesFor($studentIds): float
    {
        $ids = collect($studentIds)->filter()->values();

        if ($ids->isEmpty()) {
            return 0.0;
        }

        return (float) StudentInvoice::whereIn('student_id', $ids)
            ->where('balance', '>', 0)
            ->sum('balance');
    }

    protected function unpaidInvoicesCount($studentIds = null): int
    {
        $q = StudentInvoice::where('balance', '>', 0);
        if ($studentIds !== null) {
            $ids = collect($studentIds)->filter()->values();
            if ($ids->isEmpty()) {
                return 0;
            }
            $q->whereIn('student_id', $ids);
        }

        return (int) $q->count();
    }

    protected function overdueInvoicesCount($studentIds = null): int
    {
        $q = StudentInvoice::whereNotNull('due_date')
            ->whereDate('due_date', '<', today())
            ->where('balance', '>', 0);

        if ($studentIds !== null) {
            $ids = collect($studentIds)->filter()->values();
            if ($ids->isEmpty()) {
                return 0;
            }
            $q->whereIn('student_id', $ids);
        }

        return (int) $q->count();
    }

    protected function pendingApplications(): int
    {
        return (int) Application::whereNull('decided_at')->count();
    }

    protected function pendingVerifications(): int
    {
        return (int) Payment::where('status', 'pending')->count();
    }

    /** Present + late as a percentage of today's marked attendance records. */
    protected function attendanceRateToday(?int $gradeId = null, ?int $sectionId = null): ?float
    {
        try {
            $q = AttendanceRecord::query()->whereHas(
                'attendance',
                fn ($qq) => $qq->whereDate('date', today())
                    ->when($gradeId, fn ($x) => $x->where('grade_id', $gradeId))
                    ->when($sectionId, fn ($x) => $x->where('section_id', $sectionId))
            );

            $total = (clone $q)->count();
            if ($total === 0) {
                return null;
            }

            $attended = (clone $q)->whereIn('status', ['present', 'late'])->count();

            return round(($attended / $total) * 100, 1);
        } catch (\Throwable $e) {
            return null;
        }
    }

    protected function examPercentSql(string $alias = 'pct'): string
    {
        return 'avg(exam_results.marks_obtained * 100.0 / exam_subjects.total_marks) as '.$alias;
    }

    /** School-wide average score across every entered exam result. */
    protected function averageExamPercent(?int $studentId = null): ?float
    {
        try {
            $row = DB::table('exam_results')
                ->join('exam_subjects', 'exam_subjects.id', '=', 'exam_results.exam_subject_id')
                ->whereNull('exam_results.deleted_at')
                ->whereNull('exam_results.is_absent')
                ->whereNotNull('exam_results.marks_obtained')
                ->whereNotNull('exam_subjects.total_marks')
                ->where('exam_subjects.total_marks', '>', 0)
                ->when($studentId, fn ($q) => $q->where('exam_results.student_id', $studentId))
                ->selectRaw($this->examPercentSql())
                ->first();

            $pct = $row->pct ?? null;

            return $pct === null ? null : round((float) $pct, 1);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Percentage of results scoring at least half of the available marks. */
    protected function examPassRate(): ?float
    {
        try {
            $row = DB::table('exam_results')
                ->join('exam_subjects', 'exam_subjects.id', '=', 'exam_results.exam_subject_id')
                ->whereNull('exam_results.deleted_at')
                ->whereNull('exam_results.is_absent')
                ->whereNotNull('exam_results.marks_obtained')
                ->where('exam_subjects.total_marks', '>', 0)
                ->selectRaw(
                    'sum(case when exam_results.marks_obtained * 100.0 / exam_subjects.total_marks >= 50 then 1 else 0 end) * 100.0 / count(*) as rate'
                )
                ->first();

            $rate = $row->rate ?? null;

            return $rate === null ? null : round((float) $rate, 1);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Published announcements + upcoming events, for the principal's live panels. */
    protected function contentCounts(): array
    {
        return [
            'announcements' => (int) Announcement::where('status', 'published')
                ->whereNull('deleted_at')
                ->count(),
            'upcoming_events' => (int) Event::where('status', 'published')
                ->where('starts_at', '>=', now())
                ->count(),
        ];
    }

    protected function upcomingEvents(int $limit = 5): array
    {
        return Event::where('status', 'published')
            ->orderBy('starts_at')
            ->limit($limit)
            ->get(['id', 'title', 'location', 'starts_at', 'audience'])
            ->map(fn (Event $event) => [
                'id' => $event->id,
                'title' => $event->title,
                'location' => $event->location,
                'when' => \Carbon\Carbon::parse($event->starts_at)->format('D d M, H:i'),
                'audience' => $event->audience,
            ])
            ->all();
    }

    protected function recentAnnouncements(int $limit = 5): array
    {
        return Announcement::where('status', 'published')
            ->whereNull('deleted_at')
            ->latest('published_at')
            ->limit($limit)
            ->get(['id', 'title', 'audience', 'published_at', 'is_pinned'])
            ->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'audience' => $announcement->audience,
                'pinned' => (bool) $announcement->is_pinned,
                'when' => $announcement->published_at
                    ? \Carbon\Carbon::parse($announcement->published_at)->format('d M Y')
                    : null,
            ])
            ->all();
    }

    protected function adminStats(User $user): array
    {
        $content = $this->contentCounts();

        $stats = [
            'students' => (int) Student::count(),
            'teachers' => (int) Teacher::count(),
            'parents' => (int) ParentModel::count(),
            'classes' => (int) Section::count(),
            'sections' => (int) Section::count(),
            'attendance_today' => (int) AttendanceRecord::whereHas(
                'attendance',
                fn ($q) => $q->whereDate('date', today())
            )->count(),
            'attendance_rate' => $this->attendanceRateToday(),
            'avg_score' => $this->averageExamPercent(),
            'pass_rate' => $this->examPassRate(),
            'exams_scheduled' => (int) Exam::whereNotIn('status', ['published', 'archived'])->count(),
            'announcements' => $content['announcements'],
            'upcoming_events' => $content['upcoming_events'],
            'outstanding_fees' => $this->outstandingFeesFor(Student::pluck('id')),
            'fee_collected' => (float) Payment::sum('amount'),
            'fee_expected' => (float) StudentInvoice::sum('total'),
            'applications_pending' => $this->pendingApplications(),
            'unread_messages' => $this->unreadMessages($user),
        ];

        $tasks = [
            ['label' => 'Pending applications', 'count' => $stats['applications_pending'], 'tone' => 'orange'],
            ['label' => 'Unpaid invoices', 'count' => $this->unpaidInvoicesCount(), 'tone' => 'red'],
            ['label' => 'Payments awaiting verification', 'count' => $this->pendingVerifications(), 'tone' => 'orange'],
            ['label' => 'Classes without attendance today', 'count' => $this->classesWithoutAttendanceToday(), 'tone' => 'blue'],
            ['label' => 'Unread messages', 'count' => $stats['unread_messages'], 'tone' => 'blue'],
        ];

        $stats['upcoming'] = $this->upcomingEvents();
        $stats['news'] = $this->recentAnnouncements();

        return [$stats, $tasks];
    }

    protected function teacherStats(User $user): array
    {
        $teacherId = $this->myTeacherId($user);

        $assignmentsToGrade = $teacherId
            ? (int) AssignmentSubmission::whereHas(
                'assignment',
                fn ($q) => $q->where('teacher_id', $teacherId)
            )->where('status', '!=', 'graded')->count()
            : 0;

        $myClasses = $this->myClassesCount($teacherId);
        $attendancePending = $this->classesWithoutAttendanceToday($teacherId);
        $unread = $this->unreadMessages($user);

        $stats = [
            'my_classes' => $myClasses,
            'attendance_pending' => $attendancePending,
            'attendance_rate' => $this->attendanceRateForTeacher($teacherId),
            'my_students' => $this->teacherStudentCount($teacherId),
            'assignments' => $teacherId
                ? (int) Assignment::whereNull('deleted_at')->where('teacher_id', $teacherId)->count()
                : 0,
            'assignments_to_grade' => $assignmentsToGrade,
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Classes without attendance today', 'count' => $attendancePending, 'tone' => 'blue'],
            ['label' => 'Submissions to grade', 'count' => $assignmentsToGrade, 'tone' => 'orange'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function accountantStats(User $user): array
    {
        $pendingVerifications = $this->pendingVerifications();
        $overdue = $this->overdueInvoicesCount();
        $paidToday = (float) Payment::whereDate('payment_date', today())->sum('amount');
        $unread = $this->unreadMessages($user);

        $stats = [
            'pending_verifications' => $pendingVerifications,
            'pending_proofs' => $pendingVerifications,
            'overdue_invoices' => $overdue,
            'unpaid_invoices' => $this->unpaidInvoicesCount(),
            'paid_today' => $paidToday,
            'collected' => $paidToday,
            'fee_collected' => (float) Payment::sum('amount'),
            'fee_expected' => (float) StudentInvoice::sum('total'),
            'outstanding_fees' => $this->outstandingFeesFor(Student::pluck('id')),
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Overdue invoices', 'count' => $overdue, 'tone' => 'red'],
            ['label' => 'Payments awaiting verification', 'count' => $pendingVerifications, 'tone' => 'orange'],
            ['label' => 'Unpaid invoices', 'count' => $this->unpaidInvoicesCount(), 'tone' => 'blue'],
            ['label' => 'Paid today', 'count' => $paidToday, 'tone' => 'green'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function registrarStats(User $user): array
    {
        $pending = $this->pendingApplications();

        $transferIds = Student::where('status', 'transferred')->pluck('id')
            ->merge(Enrollment::where('status', 'transferred')->pluck('student_id'))
            ->unique()
            ->values();
        $transfers = $transferIds->count();

        $unread = $this->unreadMessages($user);

        $stats = [
            'pending_applications' => $pending,
            'applications_pending' => $pending,
            'students' => (int) Student::whereNull('deleted_at')->where('status', 'active')->count(),
            'new_enrollments' => (int) Enrollment::where('created_at', '>=', now()->subDays(30))->count(),
            'transfers' => $transfers,
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Pending applications', 'count' => $pending, 'tone' => 'orange'],
            ['label' => 'Transfers processed', 'count' => $transfers, 'tone' => 'blue'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function librarianStats(User $user): array
    {
        $issued = (int) Borrowing::where('status', 'issued')->count();
        $overdue = (int) Borrowing::where('status', 'issued')
            ->whereNotNull('due_at')
            ->where('due_at', '<', now())
            ->count();
        $unpaidFines = (float) LibraryFine::where('status', 'unpaid')->sum('amount');
        $unread = $this->unreadMessages($user);

        $stats = [
            'books' => (int) Book::count(),
            'issued' => $issued,
            'overdue' => $overdue,
            'fines_unpaid' => $unpaidFines,
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Overdue books', 'count' => $overdue, 'tone' => 'red'],
            ['label' => 'Books issued', 'count' => $issued, 'tone' => 'blue'],
            ['label' => 'Unpaid fines', 'count' => $unpaidFines, 'tone' => 'orange'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function nurseStats(User $user): array
    {
        $visitsToday = (int) HealthVisit::whereDate('visit_date', today())->count();
        $followUps = (int) HealthVisit::whereNotNull('follow_up_date')
            ->whereDate('follow_up_date', today())
            ->count();
        $unread = $this->unreadMessages($user);

        $stats = [
            'visits_today' => $visitsToday,
            'follow_ups_today' => $followUps,
            'health_records' => (int) HealthRecord::count(),
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Follow-ups today', 'count' => $followUps, 'tone' => 'orange'],
            ['label' => 'Visits today', 'count' => $visitsToday, 'tone' => 'blue'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function parentStats(User $user): array
    {
        $parent = $user->parentProfile;
        $children = $parent ? $parent->students()->get() : collect();
        $childIds = $children->pluck('id');

        $outstanding = $this->outstandingFeesFor($childIds);
        $unread = $this->unreadMessages($user);

        $assignmentsDue = (int) Assignment::whereNull('deleted_at')
            ->where('status', 'published')
            ->when($childIds->isNotEmpty(), function ($q) use ($children) {
                $q->where(function ($qq) use ($children) {
                    foreach ($children as $student) {
                        $qq->orWhere(fn ($w) => $w->where('grade_id', $student->grade_id)
                            ->where(fn ($s) => $s->whereNull('section_id')->orWhere('section_id', $student->section_id)));
                    }
                });
            }, fn ($q) => $q->whereRaw('1 = 0'))
            ->count();

        $stats = [
            'children' => $children->count(),
            'outstanding_fees' => $outstanding,
            'fee_balance' => $outstanding,
            'attendance' => $this->attendanceRateForStudents($childIds, 60),
            'assignments' => $assignmentsDue,
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Unpaid invoices', 'count' => $this->unpaidInvoicesCount($childIds), 'tone' => 'red'],
            ['label' => 'Overdue invoices', 'count' => $this->overdueInvoicesCount($childIds), 'tone' => 'orange'],
            ['label' => 'Assignments due', 'count' => $assignmentsDue, 'tone' => 'blue'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function studentStats(User $user): array
    {
        $student = $user->student;
        $unread = $this->unreadMessages($user);

        $due = 0;
        $overdue = 0;

        if ($student) {
            $query = Assignment::whereNull('deleted_at')
                ->where('status', 'published')
                ->whereDoesntHave(
                    'submissions',
                    fn ($q) => $q->where('student_id', $student->id)
                )
                ->where(fn ($q) => $q
                    ->where('grade_id', $student->grade_id)
                    ->orWhere('section_id', $student->section_id));

            $due = (int) (clone $query)->count();
            $overdue = (int) (clone $query)->whereNotNull('due_date')
                ->whereDate('due_date', '<', today())
                ->count();
        }

        $stats = [
            'assignments' => $due,
            'assignments_due' => $due,
            'my_average' => $student ? $this->averageExamPercent($student->id) : null,
            'attendance' => $student ? $this->attendanceRateForStudents([$student->id], 60) : null,
            'fee_status' => $student ? $this->feeStatusFor([$student->id]) : null,
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Overdue assignments', 'count' => $overdue, 'tone' => 'red'],
            ['label' => 'Assignments due', 'count' => $due, 'tone' => 'orange'],
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }

    protected function genericStats(User $user): array
    {
        $unread = $this->unreadMessages($user);

        $stats = [
            'unread_messages' => $unread,
        ];

        $tasks = [
            ['label' => 'Unread messages', 'count' => $unread, 'tone' => 'blue'],
        ];

        return [$stats, $tasks];
    }
}
