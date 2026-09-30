<?php

use App\Http\Controllers\Api\V1\AnnouncementController;
use App\Http\Controllers\Api\V1\ApplicationController;
use App\Http\Controllers\Api\V1\AssignmentController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CampaignController;
use App\Http\Controllers\Api\V1\ContentController;
use App\Http\Controllers\Api\V1\DisciplineController;
use App\Http\Controllers\Api\V1\ExamController;
use App\Http\Controllers\Api\V1\FinanceController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\LeaveController;
use App\Http\Controllers\Api\V1\LibraryController;
use App\Http\Controllers\Api\V1\MessagingController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ParentController;
use App\Http\Controllers\Api\V1\PreschoolAssessmentController;
use App\Http\Controllers\Api\V1\PublicController;
use App\Http\Controllers\Api\V1\ReportCardController;
use App\Http\Controllers\Api\V1\ReportsController;
use App\Http\Controllers\Api\V1\RoleManagementController;
use App\Http\Controllers\Api\V1\SchoolStructureController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\StatsController;
use App\Http\Controllers\Api\V1\StudentController;
use App\Http\Controllers\Api\V1\SubjectController;
use App\Http\Controllers\Api\V1\TeacherController;
use App\Http\Controllers\Api\V1\TimetableController;
use App\Http\Controllers\Api\V1\TransportController;
use App\Http\Controllers\Api\V1\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok']));

// ---- Anonymous public website -----------------------------------------------
Route::prefix('v1/public')->group(function () {
    Route::get('/site', [PublicController::class, 'site']);
    Route::get('/news', [PublicController::class, 'news']);
    Route::get('/events', [PublicController::class, 'events']);
    Route::get('/teachers', [PublicController::class, 'teachers']);
    Route::post('/contact', [PublicController::class, 'contact'])->middleware('throttle:10,1');
    Route::post('/applications', [PublicController::class, 'apply'])->middleware('throttle:5,1');
    Route::post('/applications/track', [PublicController::class, 'track'])->middleware('throttle:20,1');
});

Route::prefix('v1')->group(function () {
    // Public auth
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/me/children', [AuthController::class, 'children']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::middleware(['audit.log'])->group(function () {
            // Users (permission examples)
            Route::middleware(['permission:users.view'])->group(function () {
                Route::get('/users', [UserManagementController::class, 'index']);
                Route::get('/users/{user}', [UserManagementController::class, 'show']);
            });
            Route::post('/users', [UserManagementController::class, 'store'])->middleware('permission:users.create');
            Route::post('/users/bulk', [UserManagementController::class, 'bulkStore'])->middleware('permission:users.create');
            Route::match(['put', 'patch'], '/users/{user}', [UserManagementController::class, 'update'])->middleware('permission:users.edit');
            Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])->middleware('permission:users.delete');
            Route::post('/users/{user}/activate', [UserManagementController::class, 'activate'])->middleware('permission:users.activate');
            Route::post('/users/{user}/suspend', [UserManagementController::class, 'suspend'])->middleware('permission:users.activate');
            Route::post('/users/{user}/reset-password', [UserManagementController::class, 'resetPassword'])->middleware('permission:users.reset_password');

            // Roles (for role pickers)
            Route::get('/roles', [UserManagementController::class, 'roles'])->middleware('permission:users.view');

            // Departments (roles) management — super admin & sub admin
            Route::get('/permissions', [RoleManagementController::class, 'permissions'])->middleware('permission:roles.manage');
            Route::get('/departments', [RoleManagementController::class, 'index'])->middleware('permission:roles.manage');
            Route::post('/departments', [RoleManagementController::class, 'store'])->middleware('permission:roles.manage');
            Route::get('/departments/{role}', [RoleManagementController::class, 'show'])->middleware('permission:roles.manage');
            Route::match(['put', 'patch'], '/departments/{role}', [RoleManagementController::class, 'update'])->middleware('permission:roles.manage');
            Route::delete('/departments/{role}', [RoleManagementController::class, 'destroy'])->middleware('permission:roles.manage');

            // School structure: levels / grades / sections / years / terms
            Route::get('/structure/{resource}', [SchoolStructureController::class, 'index']);
            Route::post('/structure/{resource}', [SchoolStructureController::class, 'store']);
            Route::get('/structure/{resource}/{id}', [SchoolStructureController::class, 'show']);
            Route::match(['put', 'patch'], '/structure/{resource}/{id}', [SchoolStructureController::class, 'update']);
            Route::delete('/structure/{resource}/{id}', [SchoolStructureController::class, 'destroy']);

            // Students
            Route::get('/students', [StudentController::class, 'index'])->middleware('permission:students.view');
            Route::post('/students', [StudentController::class, 'store'])->middleware('permission:students.create');
            Route::get('/students/{student}', [StudentController::class, 'show'])->middleware('permission:students.view');
            Route::match(['put', 'patch'], '/students/{student}', [StudentController::class, 'update'])->middleware('permission:students.edit');
            Route::delete('/students/{student}', [StudentController::class, 'destroy'])->middleware('permission:students.delete');
            Route::post('/students/{student}/promote', [StudentController::class, 'promote'])->middleware('permission:students.promote');
            Route::post('/students/{student}/transfer', [StudentController::class, 'transfer'])->middleware('permission:students.edit');
            Route::post('/students/{student}/status', [StudentController::class, 'changeStatus'])->middleware('permission:students.edit');

            // Parents / guardians
            Route::get('/parents', [ParentController::class, 'index'])->middleware('permission:parents.view');
            Route::get('/parents/{parent}', [ParentController::class, 'show'])->middleware('permission:parents.view');
            Route::post('/parents', [ParentController::class, 'store'])->middleware('permission:parents.create');
            Route::match(['put', 'patch'], '/parents/{parent}', [ParentController::class, 'update'])->middleware('permission:parents.edit');
            Route::delete('/parents/{parent}', [ParentController::class, 'destroy'])->middleware('permission:parents.delete');

            // Teachers
            Route::get('/teachers', [TeacherController::class, 'index'])->middleware('permission:teachers.view');
            Route::post('/teachers', [TeacherController::class, 'store'])->middleware('permission:teachers.create');
            Route::get('/teachers/{teacher}', [TeacherController::class, 'show'])->middleware('permission:teachers.view');
            Route::match(['put', 'patch'], '/teachers/{teacher}', [TeacherController::class, 'update'])->middleware('permission:teachers.edit');
            Route::delete('/teachers/{teacher}', [TeacherController::class, 'destroy'])->middleware('permission:teachers.delete');

            // Campaigns: write to a class, a grade, every parent, or a department
            Route::get('/campaigns', [CampaignController::class, 'index'])->middleware('permission:campaigns.view');
            Route::get('/campaigns/audiences', [CampaignController::class, 'audienceOptions'])->middleware('permission:campaigns.view');
            Route::post('/campaigns', [CampaignController::class, 'store'])->middleware('permission:campaigns.send');
            Route::get('/campaigns/{campaign}', [CampaignController::class, 'show'])->middleware('permission:campaigns.view');
            Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy'])->middleware('permission:campaigns.view');

            // Staff leave: request, register and approvals
            Route::get('/leave-types', [LeaveController::class, 'types']);
            Route::post('/leave-types', [LeaveController::class, 'storeType'])->middleware('permission:leave.manage');
            Route::get('/leave-requests', [LeaveController::class, 'index'])->middleware('permission:leave.view');
            Route::post('/leave-requests', [LeaveController::class, 'store'])->middleware('permission:leave.request');
            Route::post('/leave-requests/{leaveRequest}/decide', [LeaveController::class, 'decide'])->middleware('permission:leave.approve');
            Route::post('/leave-requests/{leaveRequest}/cancel', [LeaveController::class, 'cancel'])->middleware('permission:leave.request');
            Route::delete('/leave-requests/{leaveRequest}', [LeaveController::class, 'destroy'])->middleware('permission:leave.manage');

            // Behaviour: merit, demerit and incident log
            Route::get('/discipline', [DisciplineController::class, 'index'])->middleware('permission:discipline.view');
            Route::get('/discipline/summary', [DisciplineController::class, 'summary'])->middleware('permission:discipline.view');
            Route::post('/discipline', [DisciplineController::class, 'store'])->middleware('permission:discipline.record');
            Route::match(['put', 'patch'], '/discipline/{record}', [DisciplineController::class, 'update'])->middleware('permission:discipline.manage');
            Route::post('/discipline/{record}/resolve', [DisciplineController::class, 'resolve'])->middleware('permission:discipline.manage');
            Route::delete('/discipline/{record}', [DisciplineController::class, 'destroy'])->middleware('permission:discipline.manage');

            // Attendance
            Route::get('/attendances', [AttendanceController::class, 'index'])->middleware('permission:attendance.view');
            Route::post('/attendances', [AttendanceController::class, 'store'])->middleware('permission:attendance.mark');
            Route::get('/attendances/{attendance}', [AttendanceController::class, 'show'])->middleware('permission:attendance.view');
            Route::match(['put', 'patch'], '/attendances/{attendance}', [AttendanceController::class, 'update'])->middleware('permission:attendance.edit');
            Route::delete('/attendances/{attendance}', [AttendanceController::class, 'destroy'])->middleware('permission:attendance.edit');

            // Finance
            Route::get('/invoices', [FinanceController::class, 'invoices'])->middleware('permission:invoices.view');
            Route::post('/invoices', [FinanceController::class, 'storeInvoice'])->middleware('permission:invoices.create');
            Route::get('/invoices/{invoice}', [FinanceController::class, 'showInvoice'])->middleware('permission:invoices.view');
            Route::match(['put', 'patch'], '/invoices/{invoice}', [FinanceController::class, 'updateInvoice'])->middleware('permission:invoices.edit');
            Route::get('/payments', [FinanceController::class, 'payments'])->middleware('permission:payments.view');
            Route::post('/payments', [FinanceController::class, 'storePayment'])->middleware('permission:payments.receive');
            Route::get('/payments/queue', [FinanceController::class, 'verificationQueue'])->middleware('permission:payments.verify');
            Route::get('/payments/{payment}', [FinanceController::class, 'showPayment'])->middleware('permission:payments.view');
            Route::post('/payments/{payment}/proofs', [FinanceController::class, 'uploadProof'])->middleware('permission:payments.receive');
            Route::post('/payments/{payment}/verify', [FinanceController::class, 'verify'])->middleware('permission:payments.verify');
            Route::get('/payments/{payment}/receipt', [FinanceController::class, 'receipt']);
            // Parent bank-transfer proof (allowed for anyone holding an invoice)
            Route::post('/payment-proofs', [FinanceController::class, 'submitProof']);
            Route::get('/payment-proofs/{proof}/file', [FinanceController::class, 'proofImage']);

            // Fee structures
            Route::get('/fee-structures', [FinanceController::class, 'feeStructures'])->middleware('permission:fees.view');
            Route::post('/fee-structures', [FinanceController::class, 'storeFeeStructure'])->middleware('permission:fees.create');
            Route::delete('/fee-structures/{feeStructure}', [FinanceController::class, 'destroyFeeStructure'])->middleware('permission:fees.delete');

            // Overdue escalation: dashboard counts + contact-parent follow-up tasks
            Route::get('/finance/escalation', [FinanceController::class, 'escalation'])->middleware('permission:payments.view');
            Route::get('/payment-tasks', [FinanceController::class, 'tasks'])->middleware('permission:tasks.view');
            Route::post('/payment-tasks/{task}/complete', [FinanceController::class, 'completeTask'])->middleware('permission:tasks.manage');
            Route::post('/payment-tasks/{task}/reopen', [FinanceController::class, 'reopenTask'])->middleware('permission:tasks.manage');
            Route::post('/payments/run-escalation', function () {
                $summary = app(\App\Services\PaymentEscalationService::class)->run();

                return response()->json($summary);
            })->middleware('permission:payments.verify');

            // Messaging
            Route::get('/conversations', [MessagingController::class, 'conversations']);
            Route::post('/conversations', [MessagingController::class, 'storeConversation'])->middleware('permission:messaging.send');
            Route::get('/conversations/{conversation}', [MessagingController::class, 'showConversation']);
            Route::get('/conversations/{conversation}/messages', [MessagingController::class, 'messages']);
            Route::post('/conversations/{conversation}/messages', [MessagingController::class, 'sendMessage'])->middleware('permission:messaging.send');
            Route::post('/messages/{message}/read', [MessagingController::class, 'markRead']);
            Route::get('/messages/contacts', [MessagingController::class, 'contacts']);
            Route::get('/messages/departments', [MessagingController::class, 'departments'])->middleware('permission:messaging.send');
            Route::get('/messages/inbox', [MessagingController::class, 'inbox']);
            Route::get('/messages/sent', [MessagingController::class, 'sent']);
            Route::post('/messages', [MessagingController::class, 'compose'])->middleware('permission:messaging.send');
            Route::post('/messages/{message}/star', [MessagingController::class, 'star']);
            Route::get('/messages/attachments/{attachment}/file', [MessagingController::class, 'attachmentFile']);

            // Notifications (in-app bell)
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::get('/notifications/channels', [NotificationController::class, 'channels']);
            Route::put('/notifications/preferences', [NotificationController::class, 'updatePreferences']);
            Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
            Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

            // School settings (payment instructions, profile)
            Route::get('/settings', [SettingController::class, 'index']);
            Route::get('/settings/payment', [SettingController::class, 'paymentSettings']);
            Route::match(['put', 'patch'], '/settings', [SettingController::class, 'update'])->middleware('permission:settings.edit');

            // Announcements
            Route::get('/announcements', [AnnouncementController::class, 'index']);
            Route::post('/announcements', [AnnouncementController::class, 'store'])->middleware('permission:announcements.create');
            Route::get('/announcements/{announcement}', [AnnouncementController::class, 'show']);
            Route::match(['put', 'patch'], '/announcements/{announcement}', [AnnouncementController::class, 'update'])->middleware('permission:announcements.create');
            Route::delete('/announcements/{announcement}', [AnnouncementController::class, 'destroy'])->middleware('permission:announcements.create');
            Route::post('/announcements/{announcement}/publish', [AnnouncementController::class, 'publish'])->middleware('permission:announcements.publish');

            // Admissions / applications
            Route::get('/applications', [ApplicationController::class, 'index'])->middleware('permission:applications.view');
            Route::post('/applications', [ApplicationController::class, 'store']);
            Route::get('/applications/{application}', [ApplicationController::class, 'show'])->middleware('permission:applications.view');
            Route::match(['put', 'patch'], '/applications/{application}', [ApplicationController::class, 'update'])->middleware('permission:applications.review');
            Route::delete('/applications/{application}', [ApplicationController::class, 'destroy'])->middleware('permission:applications.review');
            Route::post('/applications/{application}/documents', [ApplicationController::class, 'uploadDocument']);
            Route::post('/applications/{application}/decide', [ApplicationController::class, 'decide'])->middleware('permission:applications.decide');
            Route::get('/applications/{application}/offer', [ApplicationController::class, 'offer'])->middleware('permission:applications.view');
            Route::post('/applications/{application}/contact', [ApplicationController::class, 'contact'])->middleware('permission:applications.review');
            Route::post('/applications/{application}/notify', [ApplicationController::class, 'notifyAccepted'])->middleware('permission:applications.decide');
            Route::post('/applications/{application}/enroll', [ApplicationController::class, 'enroll'])->middleware('permission:applications.decide');

            // Role-based example route
            Route::get('/admin-only', fn () => response()->json(['ok' => true]))->middleware('role:super_admin|school_admin');

            // Dashboard stats (role based)
            Route::get('/stats', [StatsController::class, 'index']);

            // Student timeline
            Route::get('/students/{student}/timeline', [StudentController::class, 'timeline'])->middleware('permission:students.view');

            // Subjects
            Route::get('/subjects', [SubjectController::class, 'index'])->middleware('permission:subjects.view');
            Route::post('/subjects', [SubjectController::class, 'store'])->middleware('permission:subjects.create');
            Route::get('/subjects/{subject}', [SubjectController::class, 'show'])->middleware('permission:subjects.view');
            Route::match(['put', 'patch'], '/subjects/{subject}', [SubjectController::class, 'update'])->middleware('permission:subjects.edit');
            Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy'])->middleware('permission:subjects.edit');

            // Assignments
            Route::get('/assignments', [AssignmentController::class, 'index'])->middleware('permission:assignments.view');
            Route::post('/assignments', [AssignmentController::class, 'store'])->middleware('permission:assignments.create');
            Route::get('/assignments/{assignment}', [AssignmentController::class, 'show'])->middleware('permission:assignments.view');
            Route::get('/assignments/{assignment}/submissions', [AssignmentController::class, 'submissions'])->middleware('permission:assignments.view');
            Route::post('/assignments/{assignment}/submissions', [AssignmentController::class, 'submit'])->middleware('permission:assignments.submit');
            Route::post('/assignments/{assignment}/submissions/{submission}/grade', [AssignmentController::class, 'grade'])->middleware('permission:assignments.grade');

            // Exams & results
            Route::get('/exams', [ExamController::class, 'index'])->middleware('permission:exams.view');
            Route::post('/exams', [ExamController::class, 'store'])->middleware('permission:exams.create');
            Route::get('/exams/{exam}', [ExamController::class, 'show'])->middleware('permission:exams.view');
            Route::get('/exams/{exam}/results', [ExamController::class, 'results'])->middleware('permission:grades.view');
            Route::post('/exams/{exam}/results', [ExamController::class, 'storeResults'])->middleware('permission:grades.create');
            Route::post('/exams/{exam}/publish', [ExamController::class, 'publish'])->middleware('permission:grades.publish');

            // Report cards
            Route::get('/report-cards', [ReportCardController::class, 'index'])->middleware('permission:grades.view');
            Route::post('/report-cards', [ReportCardController::class, 'store'])->middleware('permission:grades.enter');
            Route::get('/report-cards/{reportCard}', [ReportCardController::class, 'show'])->middleware('permission:grades.view');
            Route::get('/report-cards/{reportCard}/pdf', [ReportCardController::class, 'download'])->middleware('permission:grades.view');

            // Preschool assessments
            Route::get('/preschool-assessments', [PreschoolAssessmentController::class, 'index'])->middleware('permission:grades.view');
            Route::post('/preschool-assessments', [PreschoolAssessmentController::class, 'store'])->middleware('permission:grades.enter');
            Route::get('/preschool-assessments/{preschoolAssessment}', [PreschoolAssessmentController::class, 'show'])->middleware('permission:grades.view');

            // Timetable
            Route::get('/timetable', [TimetableController::class, 'index']);
            Route::get('/timetable/{slot}', [TimetableController::class, 'show']);
            Route::post('/timetable', [TimetableController::class, 'store'])->middleware('permission:timetable.manage');
            Route::match(['put', 'patch'], '/timetable/{slot}', [TimetableController::class, 'update'])->middleware('permission:timetable.manage');
            Route::delete('/timetable/{slot}', [TimetableController::class, 'destroy'])->middleware('permission:timetable.manage');

            // Library
            Route::get('/library/books', [LibraryController::class, 'books'])->middleware('permission:library.view');
            Route::post('/library/books', [LibraryController::class, 'storeBooks'])->middleware('permission:library.manage');
            Route::get('/library/books/{book}', [LibraryController::class, 'showBook'])->middleware('permission:library.view');
            Route::post('/library/books/{book}/copies', [LibraryController::class, 'addCopy'])->middleware('permission:library.manage');
            Route::post('/library/books/{book}/borrow', [LibraryController::class, 'borrow'])->middleware('permission:library.manage|library.borrow');
            Route::get('/library/borrowings', [LibraryController::class, 'borrowings'])->middleware('permission:library.view');
            Route::get('/library/borrowings/{borrowing}', [LibraryController::class, 'showBorrowing'])->middleware('permission:library.view');
            Route::post('/library/borrowings/{borrowing}/return', [LibraryController::class, 'returnBorrowing'])->middleware('permission:library.manage');
            Route::get('/library/fines', [LibraryController::class, 'fines'])->middleware('permission:library.view');

            // Health
            Route::get('/health/visits', [HealthController::class, 'visits'])->middleware('permission:health.view');
            Route::post('/health/visits', [HealthController::class, 'storeVisit'])->middleware('permission:health.record');
            Route::get('/health/visits/{visit}', [HealthController::class, 'showVisit'])->middleware('permission:health.view');
            Route::get('/health/records', [HealthController::class, 'records'])->middleware('permission:health.view');
            Route::post('/health/records', [HealthController::class, 'storeRecord'])->middleware('permission:health.record');
            Route::get('/health/records/{record}', [HealthController::class, 'showRecord'])->middleware('permission:health.view');

            // Transport
            Route::get('/transport/routes', [TransportController::class, 'routes'])->middleware('permission:transport.view');
            Route::post('/transport/routes', [TransportController::class, 'storeRoute'])->middleware('permission:transport.manage');
            Route::get('/transport/routes/{route}', [TransportController::class, 'showRoute'])->middleware('permission:transport.view');
            Route::post('/transport/routes/{route}/stops', [TransportController::class, 'addStop'])->middleware('permission:transport.manage');
            Route::get('/transport/assignments', [TransportController::class, 'assignments'])->middleware('permission:transport.view');
            Route::post('/transport/assignments', [TransportController::class, 'storeAssignment'])->middleware('permission:transport.manage');

            // Reports
            Route::get('/reports/summary', [ReportsController::class, 'summary'])->middleware('permission:reports.view');
            Route::get('/reports/export.csv', [ReportsController::class, 'exportCsv'])->middleware('permission:reports.export');
            Route::get('/reports/export.xlsx', [ReportsController::class, 'exportXlsx'])->middleware('permission:reports.export');
            Route::get('/reports/export.pdf', [ReportsController::class, 'exportPdf'])->middleware('permission:reports.export');

            // Audit trail (permission seeded in RolesAndPermissionsSeeder)
            Route::get('/audit', [AuditLogController::class, 'index'])->middleware('permission:audit.view');
            Route::get('/audit/actions', [AuditLogController::class, 'actions'])->middleware('permission:audit.view');
            Route::get('/audit/users', [AuditLogController::class, 'users'])->middleware('permission:audit.view');

            // Public content: events calendar + contact enquiries
            Route::get('/events', [ContentController::class, 'events'])->middleware('permission:events.manage');
            Route::post('/events', [ContentController::class, 'storeEvent'])->middleware('permission:events.manage');
            Route::match(['put', 'patch'], '/events/{event}', [ContentController::class, 'updateEvent'])->middleware('permission:events.manage');
            Route::delete('/events/{event}', [ContentController::class, 'destroyEvent'])->middleware('permission:events.manage');
            Route::get('/inquiries', [ContentController::class, 'inquiries'])->middleware('permission:inquiries.view');
            Route::match(['put', 'patch'], '/inquiries/{inquiry}', [ContentController::class, 'updateInquiry'])->middleware('permission:inquiries.manage');
        });
    });
});
