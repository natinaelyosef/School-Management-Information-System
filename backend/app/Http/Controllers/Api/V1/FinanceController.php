<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FeeStructure;
use App\Models\Payment;
use App\Models\PaymentProof;
use App\Models\PaymentTask;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\PaymentEscalationService;
use App\Services\PaymentVerificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FinanceController extends Controller
{
    public function invoices(Request $request)
    {
        $q = StudentInvoice::with('student');

        // Parents/students only ever see their own children's invoices.
        $childIds = $this->childIds($request->user());
        if ($childIds !== null) {
            if ($childIds->isEmpty()) {
                return response()->json($this->emptyPaginator($request));
            }
            $q->whereIn('student_id', $childIds);
        }

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('overdue')) {
            $q->whereNotNull('due_date')->whereDate('due_date', '<', today())->where('balance', '>', 0);
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    /** Student ids the authenticated parent/student is allowed to bill for (null = unrestricted). */
    protected function childIds($user): ?Collection
    {
        if ($user->can('invoices.create') || $user->can('payments.verify')) {
            return null; // finance staff: unrestricted
        }

        $isFamily = (bool) $user->student || (bool) $user->parentProfile;
        if (! $isFamily) {
            return null; // other staff reached this through invoices.view / payments.view
        }

        if ($user->student) {
            return collect([$user->student->id]);
        }

        if ($user->parentProfile) {
            return $user->parentProfile->students()->pluck('students.id');
        }

        return collect();
    }

    public function storeInvoice(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'term_id' => 'nullable|exists:terms,id',
            'enrollment_id' => 'nullable|exists:enrollments,id',
            'issue_date' => 'required|date',
            'due_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.fee_structure_id' => 'nullable|exists:fee_structures,id',
            'discount' => 'nullable|numeric|min:0',
        ]);

        $invoice = DB::transaction(function () use ($data, $request) {
            $subtotal = collect($data['items'])->sum(fn ($i) => ($i['quantity'] ?? 1) * $i['unit_price']);
            $discount = $data['discount'] ?? 0;
            $total = max(0, $subtotal - $discount);
            $inv = StudentInvoice::create([
                'invoice_no' => 'INV-'.date('Y').'-'.strtoupper(Str::random(6)),
                'student_id' => $data['student_id'],
                'academic_year_id' => $data['academic_year_id'] ?? null,
                'term_id' => $data['term_id'] ?? null,
                'enrollment_id' => $data['enrollment_id'] ?? null,
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'] ?? null,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'amount_paid' => 0,
                'balance' => $total,
                'status' => 'unpaid',
                'created_by' => $request->user()->id,
            ]);
            foreach ($data['items'] as $item) {
                $qty = $item['quantity'] ?? 1;
                $inv->items()->create([
                    'fee_structure_id' => $item['fee_structure_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $qty,
                    'unit_price' => $item['unit_price'],
                    'total' => $qty * $item['unit_price'],
                ]);
            }

            return $inv;
        });

        return response()->json($invoice->load('items'), 201);
    }

    public function showInvoice(StudentInvoice $invoice)
    {
        $childIds = $this->childIds(auth()->user());
        if ($childIds !== null && ! $childIds->contains($invoice->student_id)) {
            abort(403, 'You cannot view this invoice.');
        }

        return response()->json($invoice->load(['items', 'student', 'payments']));
    }

    public function updateInvoice(Request $request, StudentInvoice $invoice)
    {
        $invoice->update($request->only(['due_date', 'notes', 'status']));

        return response()->json($invoice);
    }

    public function payments(Request $request)
    {
        $q = Payment::with(['student', 'invoice']);

        // Parents/students may only see payments belonging to their own children.
        $childIds = $this->childIds($request->user());
        if ($childIds !== null) {
            if ($childIds->isEmpty()) {
                return response()->json($this->emptyPaginator($request));
            }
            $q->whereIn('student_id', $childIds);
        }

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    public function storePayment(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'student_invoice_id' => 'nullable|exists:student_invoices,id',
            'amount' => 'required|numeric|min:0',
            'payment_date' => 'required|date',
            'payment_method' => 'nullable|string',
            'reference' => 'nullable|string',
            'proof_path' => 'nullable|string',
        ]);
        $payment = Payment::create([
            'student_id' => $data['student_id'],
            'student_invoice_id' => $data['student_invoice_id'] ?? null,
            'amount' => $data['amount'],
            'payment_date' => $data['payment_date'],
            'payment_method' => $data['payment_method'] ?? 'cash',
            'reference' => $data['reference'] ?? null,
            'status' => 'pending',
            'received_by' => $request->user()->id,
        ]);
        if (! empty($data['proof_path'])) {
            $payment->proofs()->create(['file_path' => $data['proof_path'], 'uploaded_by' => $request->user()->id]);
        }

        return response()->json($payment->load('proofs'), 201);
    }

    public function showPayment(Payment $payment)
    {
        $childIds = $this->childIds(auth()->user());
        if ($childIds !== null && ! $childIds->contains($payment->student_id)) {
            abort(403, 'You cannot view this payment.');
        }

        return response()->json($payment->load(['proofs', 'verifications', 'invoice', 'student']));
    }

    public function uploadProof(Request $request, Payment $payment)
    {
        $data = $request->validate(['file_path' => 'required|string', 'original_name' => 'nullable|string']);
        $proof = $payment->proofs()->create([
            'file_path' => $data['file_path'],
            'original_name' => $data['original_name'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json($proof, 201);
    }

    /**
     * Parent submits a bank-transfer payment proof against an invoice.
     * Creates a Payment in UNDER_VERIFICATION and stores the uploaded file.
     */
    public function submitProof(Request $request, NotificationService $notify)
    {
        $data = $request->validate([
            'invoice_id' => 'required|exists:student_invoices,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'bank' => 'nullable|string|max:120',
            'reference' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:500',
            'receipt' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);

        $invoice = StudentInvoice::with('student')->findOrFail($data['invoice_id']);

        $childIds = $this->childIds($request->user());
        if ($childIds !== null && ! $childIds->contains($invoice->student_id)) {
            abort(403, 'You cannot submit payment for this invoice.');
        }

        abort_if((float) $data['amount'] > (float) $invoice->balance + 0.009, 422, 'Amount exceeds outstanding balance.');

        $payment = DB::transaction(function () use ($data, $invoice, $request) {
            $path = $request->file('receipt')->store('payment-proofs', 'public');

            $payment = Payment::create([
                'student_invoice_id' => $invoice->id,
                'student_id' => $invoice->student_id,
                'amount' => $data['amount'],
                'payment_date' => $data['payment_date'],
                'payment_method' => 'bank_transfer',
                'reference' => $data['reference'] ?? null,
                'notes' => trim(($data['bank'] ?? '').' '.($data['note'] ?? '')) ?: null,
                'status' => 'under_verification',
                'received_by' => $request->user()->id,
            ]);

            PaymentProof::create([
                'payment_id' => $payment->id,
                'file_path' => $path,
                'original_name' => $request->file('receipt')->getClientOriginalName(),
                'mime_type' => $request->file('receipt')->getClientMimeType(),
                'uploaded_by' => $request->user()->id,
            ]);

            return $payment;
        });

        // Tell every accountant that a proof is waiting.
        try {
            User::role('accountant')->get()->concat(
                User::role('super_admin')->get()
            )->unique('id')->each(fn ($staff) => $notify->send(
                $staff,
                'payment',
                'New payment proof awaiting verification',
                sprintf('%s submitted %s for invoice %s.', $invoice->student?->full_name, number_format((float) $data['amount'], 2), $invoice->invoice_no),
                'database',
                $payment
            ));
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json($payment->load(['proofs', 'invoice']), 201);
    }

    /** Queue of proofs waiting for an accountant decision. */
    public function verificationQueue(Request $request)
    {
        $q = Payment::with(['student', 'invoice', 'proofs', 'verifications'])
            ->whereIn('status', ['under_verification', 'proof_submitted', 'more_information_required'])
            ->latest();

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function proofImage(PaymentProof $proof)
    {
        abort_unless(Storage::disk('public')->exists($proof->file_path), 404);

        return Storage::disk('public')->response($proof->file_path, $proof->original_name ?: 'proof');
    }

    public function verify(Request $request, Payment $payment, PaymentVerificationService $service)
    {
        $data = $request->validate([
            'action' => 'required|in:verified,rejected,more_information_required',
            'comment' => 'nullable|string|max:500',
        ]);

        $payment = $service->verify(
            $payment,
            $request->user(),
            $data['action'],
            $data['comment'] ?? null,
            $request->input('channel', 'database')
        );

        return response()->json($payment);
    }

    /**
     * Printable receipt for a verified payment. Parents download this from the
     * finance dashboard after the accountant approves their bank transfer.
     */
    public function receipt(Request $request, Payment $payment)
    {
        $childIds = $this->childIds($request->user());
        if ($childIds !== null && ! $childIds->contains($payment->student_id)) {
            abort(403, 'You cannot view this receipt.');
        }

        abort_unless($payment->status === 'verified', 422, 'A receipt is only available once the payment has been verified.');

        $payment->load(['student.grade', 'student.section', 'invoice', 'verifications.user']);

        $settings = SchoolSetting::whereIn('key', [
            'school_name', 'school_address', 'school_phone', 'school_email',
        ])->pluck('value', 'key');

        $verification = $payment->verifications->firstWhere('action', 'verified')
            ?? $payment->verifications->last();

        $document = Pdf::loadView('finance/receipt', [
            'payment' => $payment,
            'verification' => $verification,
            'schoolName' => $settings['school_name'] ?? config('app.name'),
            'schoolAddress' => $settings['school_address'] ?? '',
            'schoolPhone' => $settings['school_phone'] ?? '',
            'schoolEmail' => $settings['school_email'] ?? '',
            'generatedAt' => now()->format('d M Y, H:i'),
        ]);

        return $document->download(sprintf('receipt-%s.pdf', $payment->reference ?: 'PAY-'.$payment->id));
    }

    // ---- Fee structures ----------------------------------------------------

    public function feeStructures(Request $request)
    {
        return response()->json(
            FeeStructure::with(['schoolLevel', 'grade'])
                ->orderBy('name')
                ->paginate($request->integer('per_page', 50))
        );
    }

    public function storeFeeStructure(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'amount' => 'required|numeric|min:0',
            'academic_year_id' => 'required|exists:academic_years,id',
            'school_level_id' => 'nullable|exists:school_levels,id',
            'grade_id' => 'nullable|exists:grades,id',
            'category' => 'nullable|string|max:60',
            'frequency' => 'nullable|string|max:30',
            'due_date' => 'nullable|date',
            'is_mandatory' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $structure = FeeStructure::create($data + ['category' => $data['category'] ?? 'tuition']);

        return response()->json($structure->load(['schoolLevel', 'grade', 'academicYear']), 201);
    }

    public function destroyFeeStructure(FeeStructure $feeStructure)
    {
        $feeStructure->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Overdue escalation ------------------------------------------------

    /** Counts for the accountant's payment/escalation dashboard. */
    public function escalation()
    {
        return response()->json(app(PaymentEscalationService::class)->dashboard());
    }

    public function tasks(Request $request)
    {
        $q = PaymentTask::with(['invoice.student', 'assignee', 'completer'])->latest();

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('type')) {
            $q->where('type', $request->string('type'));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function completeTask(Request $request, PaymentTask $task)
    {
        $data = $request->validate([
            'outcome' => 'required|in:reached,will_pay,arrangement,wrong_number,no_answer,other',
            'notes' => 'nullable|string|max:1000',
        ]);

        $task->update([
            'status' => 'completed',
            'outcome' => $data['outcome'],
            'outcome_notes' => $data['notes'] ?? null,
            'completed_by' => $request->user()->id,
            'completed_at' => now(),
        ]);

        return response()->json($task->fresh());
    }

    public function reopenTask(PaymentTask $task)
    {
        $task->update(['status' => 'open', 'completed_by' => null, 'completed_at' => null]);

        return response()->json($task->fresh());
    }
}
