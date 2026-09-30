<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Grade;
use App\Models\Payment;
use App\Models\SchoolLevel;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Services\ExportService;
use App\Traits\LogsActivity;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    use LogsActivity;

    public const REPORTS = ['attendance', 'finance', 'enrollment', 'academics'];

    public function summary(Request $request)
    {
        $report = $this->resolveReport($request);

        return response()->json($this->build($report)['summary']);
    }

    public function exportXlsx(Request $request, ExportService $export)
    {
        $report = $this->resolveReport($request);
        $data = $this->build($report);

        $filename = "report-{$report}-".now()->format('Y-m-d');

        self::logActivity('reports.export', null, null, ['report' => $report, 'format' => 'xlsx']);

        return $export->xlsx(
            $filename,
            $data['headers'],
            $data['rows'],
            ucfirst($report).' report — '.now()->format('d M Y')
        );
    }

    public function exportCsv(Request $request)
    {
        $report = $this->resolveReport($request);
        $data = $this->build($report);

        $filename = "report-{$report}-".now()->format('Y-m-d').'.csv';
        $headers = $data['headers'];
        $rows = $data['rows'];

        return response()->streamDownload(function () use ($headers, $rows) {
            $output = fopen('php://output', 'w');
            if ($output === false) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, $headers);

            foreach ($rows as $row) {
                fputcsv($output, $row);
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /** Same data as the CSV/XLSX exports, rendered as a printable PDF. */
    public function exportPdf(Request $request)
    {
        $report = $this->resolveReport($request);
        $data = $this->build($report);

        self::logActivity('reports.export', null, null, ['report' => $report, 'format' => 'pdf']);

        $document = Pdf::loadView('reports/pdf', [
            'report' => $report,
            'title' => ucfirst($report).' report',
            'headers' => $data['headers'],
            'rows' => $data['rows'],
            'summary' => $data['summary'],
            'generatedAt' => now()->format('d M Y, H:i'),
            'schoolName' => SchoolSetting::where('key', 'school_name')->value('value') ?? config('app.name'),
        ]);

        return $document->download(sprintf('report-%s-%s.pdf', $report, now()->format('Y-m-d')));
    }

    protected function resolveReport(Request $request): string
    {
        $report = (string) $request->query('report');

        if (! in_array($report, self::REPORTS, true)) {
            abort(422, 'Invalid report. Allowed: '.implode(', ', self::REPORTS));
        }

        return $report;
    }

    protected function build(string $report): array
    {
        return match ($report) {
            'attendance' => $this->attendanceReport(),
            'finance' => $this->financeReport(),
            'enrollment' => $this->enrollmentReport(),
            'academics' => $this->academicsReport(),
        };
    }

    protected function attendanceReport(): array
    {
        $totals = collect(
            AttendanceRecord::query()
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status')
                ->all()
        );

        foreach (['present', 'absent', 'late', 'excused'] as $status) {
            $totals->put($status, (int) ($totals[$status] ?? 0));
        }

        $driver = DB::connection()->getDriverName();
        $monthExpression = match ($driver) {
            'sqlite' => "strftime('%Y-%m', attendances.date)",
            'mysql', 'mariadb' => "DATE_FORMAT(attendances.date, '%Y-%m')",
            default => "strftime('%Y-%m', attendances.date)",
        };

        $grouped = DB::table('attendance_records')
            ->join('attendances', 'attendances.id', '=', 'attendance_records.attendance_id')
            ->selectRaw($monthExpression.' as month, attendance_records.status, count(*) as total')
            ->groupBy('month', 'attendance_records.status')
            ->get();

        $months = [];

        foreach ($grouped as $row) {
            $month = (string) $row->month;
            $months[$month] ??= [
                'month' => $month,
                'present' => 0,
                'absent' => 0,
                'late' => 0,
                'excused' => 0,
                'total' => 0,
            ];

            $status = (string) $row->status;
            if (! isset($months[$month][$status])) {
                $months[$month][$status] = 0;
            }

            $months[$month][$status] += (int) $row->total;
            $months[$month]['total'] += (int) $row->total;
        }

        ksort($months);

        $monthly = [];

        foreach ($months as $month) {
            $attended = $month['present'] + ($month['late'] ?? 0);
            $month['percentage'] = $month['total'] > 0
                ? round(($attended / $month['total']) * 100, 2)
                : 0.0;
            $monthly[] = $month;
        }

        $headers = ['month', 'present', 'absent', 'late', 'excused', 'total', 'percentage'];
        $rows = array_map(fn ($m) => [
            $m['month'],
            $m['present'],
            $m['absent'],
            $m['late'] ?? 0,
            $m['excused'] ?? 0,
            $m['total'],
            $m['percentage'],
        ], $monthly);

        $overallTotal = $monthly ? array_sum(array_column($monthly, 'total')) : 0;
        $overallAttended = $monthly ? array_sum(array_column($monthly, 'present')) + array_sum(array_column($monthly, 'late')) : 0;

        return [
            'summary' => [
                'report' => 'attendance',
                'totals' => $totals->toArray(),
                'monthly' => $monthly,
                'overall_percentage' => $overallTotal > 0 ? round(($overallAttended / $overallTotal) * 100, 2) : 0.0,
            ],
            'headers' => $headers,
            'rows' => $rows,
        ];
    }

    protected function financeReport(): array
    {
        $totalInvoiced = (float) StudentInvoice::sum('total');
        $totalPaid = (float) Payment::sum('amount');
        $outstanding = (float) StudentInvoice::sum('balance');
        $totalDiscount = (float) StudentInvoice::sum('discount');

        $byStatus = StudentInvoice::query()
            ->selectRaw('status, count(*) as count, sum(total) as total, sum(balance) as outstanding')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'count' => (int) $row->count,
                'total' => (float) $row->total,
                'outstanding' => (float) $row->outstanding,
            ])
            ->values();

        $paymentsByStatus = Payment::query()
            ->selectRaw('status, count(*) as count, sum(amount) as amount')
            ->groupBy('status')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->status => [
                'count' => (int) $row->count,
                'amount' => (float) $row->amount,
            ]]);

        $invoices = StudentInvoice::with('student')
            ->orderBy('id')
            ->get();

        $headers = ['invoice_no', 'student', 'issue_date', 'due_date', 'total', 'amount_paid', 'balance', 'status'];
        $rows = $invoices->map(fn ($invoice) => [
            $invoice->invoice_no,
            trim(($invoice->student?->first_name ?? '').' '.($invoice->student?->last_name ?? '')),
            $invoice->issue_date,
            $invoice->due_date,
            (float) $invoice->total,
            (float) $invoice->amount_paid,
            (float) $invoice->balance,
            $invoice->status,
        ])->values()->all();

        return [
            'summary' => [
                'report' => 'finance',
                'total_invoiced' => $totalInvoiced,
                'total_paid' => $totalPaid,
                'outstanding' => $outstanding,
                'total_discount' => $totalDiscount,
                'by_status' => $byStatus,
                'payments_by_status' => $paymentsByStatus,
            ],
            'headers' => $headers,
            'rows' => $rows,
        ];
    }

    protected function enrollmentReport(): array
    {
        $levelNames = SchoolLevel::pluck('name', 'id');
        $gradeRows = Grade::with('schoolLevel')->orderBy('order_index')->orderBy('name')->get();

        $byLevel = Student::query()
            ->selectRaw('level_id, count(*) as total')
            ->groupBy('level_id')
            ->get()
            ->map(fn ($row) => [
                'level_id' => $row->level_id,
                'name' => $row->level_id !== null ? ($levelNames[$row->level_id] ?? null) : null,
                'count' => (int) $row->total,
            ])
            ->sortBy(fn ($row) => $row['name'] ?? '~~~')
            ->values();

        $byGrade = [];

        foreach ($gradeRows as $grade) {
            $byGrade[] = [
                'grade_id' => $grade->id,
                'grade' => $grade->name,
                'level' => $grade->schoolLevel?->name,
                'count' => Student::where('grade_id', $grade->id)->count(),
            ];
        }

        $headers = ['level', 'grade', 'students'];
        $rows = array_map(fn ($g) => [$g['level'], $g['grade'], $g['count']], $byGrade);

        foreach ($byLevel as $level) {
            $rows[] = [$level['name'] ?? 'Unassigned', 'All grades', $level['count']];
        }

        return [
            'summary' => [
                'report' => 'enrollment',
                'total' => Student::count(),
                'by_level' => $byLevel,
                'by_grade' => $byGrade,
            ],
            'headers' => $headers,
            'rows' => $rows,
        ];
    }

    protected function academicsReport(): array
    {
        $rows = DB::table('exam_results')
            ->join('exam_subjects', 'exam_subjects.id', '=', 'exam_results.exam_subject_id')
            ->join('subjects', 'subjects.id', '=', 'exam_subjects.subject_id')
            ->selectRaw(
                'subjects.id as subject_id, subjects.name as name, subjects.code as code, '.
                'count(*) as results_count, avg(exam_results.marks_obtained) as average_score, '.
                'avg(exam_subjects.total_marks) as average_total'
            )
            ->groupBy('subjects.id', 'subjects.name', 'subjects.code')
            ->orderBy('subjects.name')
            ->get();

        $summary = $rows->map(function ($row) {
            $averageTotal = $row->average_total !== null ? (float) $row->average_total : 0.0;
            $averageScore = $row->average_score !== null ? (float) $row->average_score : 0.0;

            return [
                'subject_id' => (int) $row->subject_id,
                'subject' => $row->name,
                'code' => $row->code,
                'results_count' => (int) $row->results_count,
                'average_score' => round($averageScore, 2),
                'average_percent' => $averageTotal > 0 ? round(($averageScore / $averageTotal) * 100, 2) : null,
            ];
        })->values();

        $headers = ['subject', 'code', 'results_count', 'average_score', 'average_percent'];
        $csvRows = $summary->map(fn ($row) => [
            $row['subject'],
            $row['code'],
            $row['results_count'],
            $row['average_score'],
            $row['average_percent'],
        ])->all();

        return [
            'summary' => [
                'report' => 'academics',
                'subjects' => $summary,
                'average_score' => $summary->isNotEmpty()
                    ? round($summary->avg('average_score'), 2)
                    : null,
            ],
            'headers' => $headers,
            'rows' => $csvRows,
        ];
    }
}
