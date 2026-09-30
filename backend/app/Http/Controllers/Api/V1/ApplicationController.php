<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\Enrollment;
use App\Models\FeeStructure;
use App\Models\Grade;
use App\Models\ParentModel;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\Term;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\AdmissionNumber;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ApplicationController extends Controller
{
    use LogsActivity;

    protected const REQUIRED_DOCUMENTS = [
        'Original birth certificate (plus 2 photocopies)',
        'Previous school report card or transfer letter (Grade 1 and above)',
        '4 recent passport photos',
        'Copy of parent/guardian ID',
        'Immunization record (Preschool and KG)',
    ];

    protected function nextApplicationNo(): string
    {
        $year = date('Y');
        $count = Application::whereYear('created_at', $year)->count() + 1;

        return sprintf('APP-%s-%05d', $year, $count);
    }

    public function index(Request $request)
    {
        $q = Application::query()->latest();
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'gender' => 'nullable|string',
            'dob' => 'nullable|date',
            'applying_grade_id' => 'nullable|exists:grades,id',
            'applying_level_id' => 'nullable|exists:school_levels,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'parent_name' => 'nullable|string',
            'parent_phone' => 'nullable|string',
            'parent_email' => 'nullable|email',
            'address' => 'nullable|string',
        ]);
        $app = DB::transaction(function () use ($data, $request) {
            return Application::create(array_merge($data, [
                'application_no' => $this->nextApplicationNo(),
                'status' => 'pending',
                'submitted_at' => now(),
                'created_by' => $request->user()?->id,
            ]));
        });
        self::logActivity('applications.create', $app, null, $app);

        return response()->json($app, 201);
    }

    public function show(Application $application)
    {
        return response()->json($application->load('documents'));
    }

    public function update(Request $request, Application $application)
    {
        $old = $application->toArray();
        $application->update($request->all());
        self::logActivity('applications.review', $application, $old, $application->fresh());

        return response()->json($application);
    }

    public function destroy(Application $application)
    {
        $application->delete();
        self::logActivity('applications.delete', $application);

        return response()->json(['message' => 'Deleted.']);
    }

    public function uploadDocument(Request $request, Application $application)
    {
        $data = $request->validate([
            'document_type' => 'required|string',
            'file_path' => 'required|string',
        ]);
        $doc = $application->documents()->create($data);

        return response()->json($doc, 201);
    }

    public function decide(Request $request, Application $application)
    {
        $data = $request->validate([
            'status' => 'required|in:accepted,rejected,waitlisted,suspended,enrolled',
            'notes' => 'nullable|string',
        ]);
        $old = $application->toArray();
        $application->update(['status' => $data['status'], 'notes' => $data['notes'] ?? $application->notes, 'decided_at' => now()]);
        self::logActivity('applications.decide', $application, $old, $application->fresh());

        return response()->json($application);
    }

    public function contact(Request $request, Application $application)
    {
        $data = $request->validate([
            'method' => 'required|in:phone,telegram,visit,sms,email',
            'note' => 'required|string|max:1000',
        ]);

        $application->update([
            'contact_method' => $data['method'],
            'contacted_at' => now(),
            'contact_note' => $data['note'],
        ]);
        self::logActivity('applications.contact', $application, null, $application->fresh());

        return response()->json($application);
    }

    public function offer(Application $application)
    {
        [$fee, $payment] = $this->offerDetails($application);

        return response()->json([
            'application' => $application,
            'fee' => $fee,
            'payment' => $payment,
            'documents' => self::REQUIRED_DOCUMENTS,
            'message' => $this->offerMessage($application, $fee, $payment),
            'parent' => $this->parentContact($application),
        ]);
    }

    public function notifyAccepted(Request $request, Application $application, NotificationService $notifications)
    {
        abort_unless($application->status === 'accepted', 422, 'Accept the application before sending the acceptance message.');

        [$fee, $payment] = $this->offerDetails($application);
        $message = $this->offerMessage($application, $fee, $payment);
        $account = null;

        $parentUser = $this->parentUser($application);
        if (! $parentUser) {
            [$parent, $account] = $this->ensureParent($application, null);
            $parentUser = $parent->user_id ? User::find($parent->user_id) : null;
            $application->update(['parent_id' => $parent->id]);
        }

        $channels = ['database'];
        if ($parentUser && $notifications->isChannelEnabled('telegram')) {
            $channels[] = 'telegram';
        }

        $logs = $parentUser
            ? $notifications->sendMany(
                $parentUser,
                'application_accepted',
                'Application accepted — '.$application->application_no,
                $message,
                $channels,
                $application
            )
            : [];

        if ($parentUser) {
            $application->update(['notified_at' => now()]);
        }
        self::logActivity('applications.notify', $application, null, $application->fresh());

        return response()->json([
            'application' => $application->fresh(),
            'recipient' => $parentUser ? $parentUser->only(['id', 'name', 'email', 'phone']) : null,
            'parent_account' => $account,
            'channels' => collect($logs)->mapWithKeys(fn ($log) => [$log->channel => $log->status])->all(),
            'delivered' => collect($logs)->contains(fn ($log) => $log->status === 'sent'),
            'fee' => $fee,
            'payment' => $payment,
            'message' => $message,
        ]);
    }

    public function enroll(Request $request, Application $application, NotificationService $notifications)
    {
        $data = $request->validate([
            'grade_id' => 'required|exists:grades,id',
            'section_id' => 'nullable|exists:sections,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'parent_password' => 'nullable|string|min:6|max:64',
            'notify' => 'nullable|boolean',
        ]);

        abort_unless($application->status === 'accepted', 422, 'Accept the application before enrolling the student.');
        abort_if((bool) $application->student_id, 422, 'This application is already enrolled.');

        $result = DB::transaction(function () use ($data, $application, $request) {
            $grade = Grade::findOrFail($data['grade_id']);
            $yearId = $data['academic_year_id']
                ?? $application->academic_year_id
                ?? AcademicYear::where('is_current', true)->value('id');

            $student = Student::create([
                'admission_no' => AdmissionNumber::next(),
                'first_name' => $application->first_name,
                'last_name' => $application->last_name,
                'gender' => $application->gender,
                'dob' => $application->dob,
                'level_id' => $grade->school_level_id,
                'grade_id' => $grade->id,
                'section_id' => $data['section_id'] ?? null,
                'academic_year_id' => $yearId,
                'status' => 'active',
            ]);

            $enrollment = Enrollment::create([
                'student_id' => $student->id,
                'academic_year_id' => $yearId,
                'level_id' => $grade->school_level_id,
                'grade_id' => $grade->id,
                'section_id' => $data['section_id'] ?? null,
                'enrollment_date' => now()->toDateString(),
                'status' => 'enrolled',
            ]);

            [$parent, $account] = $this->ensureParent($application, $data['parent_password'] ?? null);
            if ($parent) {
                $parent->students()->syncWithoutDetaching([
                    $student->id => ['relationship' => $parent->relationship ?: 'guardian', 'is_primary' => true],
                ]);
            }

            $invoice = $this->createEnrollmentInvoice($student, $enrollment, $grade, $request->user()->id);

            $application->update([
                'status' => 'enrolled',
                'enrolled_at' => now(),
                'student_id' => $student->id,
                'parent_id' => $parent?->id,
            ]);

            return [$student, $enrollment, $parent, $account, $invoice];
        });

        [$student, $enrollment, $parent, $account, $invoice] = $result;

        $parentUser = $parent?->user_id ? User::find($parent->user_id) : null;
        if (($data['notify'] ?? true) && $parentUser) {
            $gradeName = Grade::find($data['grade_id'])?->name;
            $message = $this->enrollmentMessage($application, $student, $gradeName, $invoice);
            $channels = $notifications->isChannelEnabled('telegram') ? ['database', 'telegram'] : ['database'];
            $notifications->sendMany(
                $parentUser,
                'enrollment',
                'Registration complete — '.$student->admission_no,
                $message,
                $channels,
                $student
            );
            $application->update(['notified_at' => $application->notified_at ?? now()]);
        }

        self::logActivity('applications.enroll', $application, null, $application->fresh());

        return response()->json([
            'application' => $application->fresh(),
            'student' => $student,
            'parent' => $parent,
            'enrollment' => $enrollment,
            'invoice' => $invoice,
            'parent_account' => $account,
        ], 201);
    }

    protected function ensureParent(Application $application, ?string $password): array
    {
        $parent = null;

        if ($application->parent_id) {
            $parent = ParentModel::find($application->parent_id);
        }

        if (! $parent) {
            $lookup = array_values(array_filter([$application->parent_email, $application->parent_phone]));
            foreach ($lookup as $value) {
                $parent = ParentModel::where('email', $value)->orWhere('phone', $value)->first();
                if ($parent) {
                    break;
                }
            }
        }

        if (! $parent) {
            $name = trim((string) $application->parent_name);
            $parts = preg_split('/\s+/', $name) ?: ['Guardian'];
            $parent = ParentModel::create([
                'first_name' => $parts[0],
                'last_name' => $parts[1] ?? $application->last_name,
                'phone' => $application->parent_phone,
                'email' => $application->parent_email,
                'address' => $application->address,
                'relationship' => 'guardian',
            ]);
        }

        $account = null;

        if (! $parent->user_id) {
            $email = $parent->email ?: sprintf('parent%d@admissions.school.et', $parent->id);
            $password = $password ?: Str::random(10);

            $user = User::where('email', $email)->first();

            if (! $user) {
                $user = User::create([
                    'name' => trim($parent->first_name.' '.$parent->last_name),
                    'email' => $email,
                    'password' => $password,
                    'phone' => $parent->phone,
                    'status' => 'active',
                    'is_active' => true,
                    'notify_telegram' => true,
                    'notify_sms' => true,
                ]);
                $user->assignRole('parent');
                $account = ['id' => $user->id, 'email' => $user->email, 'password' => $password];
            } else {
                $account = ['id' => $user->id, 'email' => $user->email, 'password' => null];
            }

            $parent->update(['user_id' => $user->id]);
        }

        return [$parent, $account];
    }

    protected function createEnrollmentInvoice(Student $student, Enrollment $enrollment, Grade $grade, int $userId): ?StudentInvoice
    {
        $fee = $this->feeForGrade($grade, $enrollment->academic_year_id);
        if (! $fee) {
            return null;
        }

        $termId = Term::where('academic_year_id', $enrollment->academic_year_id)
            ->where('is_current', true)
            ->value('id');

        $invoice = StudentInvoice::create([
            'invoice_no' => 'INV-'.date('Y').'-'.strtoupper(Str::random(6)),
            'student_id' => $student->id,
            'academic_year_id' => $enrollment->academic_year_id,
            'term_id' => $termId,
            'enrollment_id' => $enrollment->id,
            'issue_date' => now()->toDateString(),
            'due_date' => $fee->due_date ?? now()->addDays(14)->toDateString(),
            'subtotal' => $fee->amount,
            'discount' => 0,
            'total' => $fee->amount,
            'amount_paid' => 0,
            'balance' => $fee->amount,
            'status' => 'unpaid',
            'created_by' => $userId,
        ]);

        $invoice->items()->create([
            'fee_structure_id' => $fee->id,
            'description' => $fee->name,
            'quantity' => 1,
            'unit_price' => $fee->amount,
            'total' => $fee->amount,
        ]);

        return $invoice;
    }

    protected function feeForGrade(Grade $grade, ?int $yearId): ?FeeStructure
    {
        $yearId = $yearId ?? AcademicYear::where('is_current', true)->value('id');

        $q = FeeStructure::where('is_active', 1)
            ->where(fn ($qq) => $qq->whereNull('academic_year_id')->orWhere('academic_year_id', $yearId))
            ->orderByRaw('grade_id is null')
            ->orderByRaw('school_level_id is null')
            ->orderBy('amount', 'desc');

        return $q->get()->first(fn (FeeStructure $f) => $f->grade_id === $grade->id
            || ($f->school_level_id && $f->school_level_id === $grade->school_level_id)
            || (! $f->grade_id && ! $f->school_level_id));
    }

    protected function offerDetails(Application $application): array
    {
        $grade = $application->applying_grade_id ? Grade::find($application->applying_grade_id) : null;
        $yearId = $application->academic_year_id ?? AcademicYear::where('is_current', true)->value('id');

        $fee = $grade ? $this->feeForGrade($grade, $yearId) : null;

        return [
            $fee ? [
                'id' => $fee->id,
                'name' => $fee->name,
                'amount' => (float) $fee->amount,
                'frequency' => $fee->frequency,
                'due_date' => $fee->due_date,
            ] : null,
            $this->paymentDetails(),
        ];
    }

    protected function paymentDetails(): array
    {
        $settings = SchoolSetting::whereIn('key', [
            'payment_bank_name', 'payment_account_name', 'payment_account_number',
            'payment_reference_hint', 'payment_instructions',
            'school_name', 'school_phone', 'school_address',
        ])->pluck('value', 'key');

        return [
            'bank_name' => $settings['payment_bank_name'] ?? null,
            'account_name' => $settings['payment_account_name'] ?? null,
            'account_number' => $settings['payment_account_number'] ?? null,
            'reference_hint' => $settings['payment_reference_hint'] ?? null,
            'instructions' => $settings['payment_instructions'] ?? null,
            'school_name' => $settings['school_name'] ?? null,
            'school_phone' => $settings['school_phone'] ?? null,
            'school_address' => $settings['school_address'] ?? null,
        ];
    }

    protected function parentContact(Application $application): array
    {
        return [
            'name' => $application->parent_name,
            'phone' => $application->parent_phone,
            'email' => $application->parent_email,
        ];
    }

    protected function parentUser(Application $application): ?User
    {
        if ($application->parent_id) {
            $parent = ParentModel::find($application->parent_id);
            if ($parent?->user_id) {
                return User::find($parent->user_id);
            }
        }

        foreach (array_values(array_filter([$application->parent_email, $application->parent_phone])) as $value) {
            $user = User::where('email', $value)->orWhere('phone', $value)->first();
            if ($user) {
                return $user;
            }

            $parent = ParentModel::where('email', $value)->orWhere('phone', $value)->first();
            if ($parent?->user_id) {
                return User::find($parent->user_id);
            }
        }

        return null;
    }

    protected function gradeLabel(Application $application): string
    {
        $grade = $application->applying_grade_id ? Grade::find($application->applying_grade_id) : null;

        return $grade?->name ?: 'the grade applied for';
    }

    protected function offerMessage(Application $application, ?array $fee, array $payment): string
    {
        $lines = [];
        $lines[] = sprintf(
            'Congratulations! %s has ACCEPTED %s %s\'s application (%s) for %s.',
            $payment['school_name'] ?: 'The school',
            $application->first_name,
            $application->last_name,
            $application->application_no,
            $this->gradeLabel($application)
        );

        $lines[] = '';
        if ($fee) {
            $lines[] = sprintf(
                'School fees for this grade: %s ETB (%s).',
                number_format((float) $fee['amount'], 2),
                $fee['frequency'] ?: 'per term'
            );
        } else {
            $lines[] = 'School fees for this grade will be confirmed at the Registration Office.';
        }

        $lines[] = '';
        $lines[] = 'Please come to the Registration Office at the school to complete registration and bring:';
        foreach (self::REQUIRED_DOCUMENTS as $document) {
            $lines[] = '  - '.$document;
        }

        $lines[] = '';
        $lines[] = 'Payment can be made in cash at the school finance office, or by bank transfer:';
        if ($payment['bank_name'] || $payment['account_number']) {
            $lines[] = sprintf(
                '  Bank: %s | Account name: %s | Account number: %s',
                $payment['bank_name'] ?: '—',
                $payment['account_name'] ?: '—',
                $payment['account_number'] ?: '—'
            );
        }
        if ($payment['reference_hint']) {
            $lines[] = '  Reference: '.$payment['reference_hint'];
        }
        if ($payment['instructions']) {
            $lines[] = '  '.$payment['instructions'];
        }

        $lines[] = '';
        $lines[] = sprintf(
            'Registration office: %s%s',
            $payment['school_phone'] ?: '',
            $payment['school_address'] ? ' — '.$payment['school_address'] : ''
        );

        return implode("\n", array_filter($lines, fn ($l) => $l !== null));
    }

    protected function enrollmentMessage(Application $application, Student $student, ?string $gradeName, ?StudentInvoice $invoice): string
    {
        $payment = $this->paymentDetails();

        $lines = [];
        $lines[] = sprintf(
            'Registration complete for %s %s. Admission number: %s. Class assigned: %s.',
            $student->first_name,
            $student->last_name,
            $student->admission_no,
            $gradeName ?: 'to be confirmed at the office'
        );

        if ($invoice) {
            $lines[] = sprintf(
                'Invoice %s: %s ETB due %s.',
                $invoice->invoice_no,
                number_format((float) $invoice->total, 2),
                $invoice->due_date
            );
            $lines[] = 'Pay in cash at the finance office or by bank transfer.';
            if ($payment['bank_name'] || $payment['account_number']) {
                $lines[] = sprintf(
                    '  Bank: %s | Account: %s',
                    $payment['bank_name'] ?: '—',
                    $payment['account_number'] ?: '—'
                );
            }
        }

        $lines[] = 'Your parent portal account is ready — use the email shared with you at the office to sign in and follow school updates, fees and messages from teachers.';

        return implode("\n", $lines);
    }
}
