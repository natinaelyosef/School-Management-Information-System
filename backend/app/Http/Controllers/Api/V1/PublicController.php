<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Application;
use App\Models\ContactInquiry;
use App\Models\Event;
use App\Models\SchoolSetting;
use App\Models\Teacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Endpoints the anonymous public website calls. Everything here is read-only
 * except the contact form and the admission application — both of which are
 * intentionally unauthenticated but strictly validated and rate-limited.
 */
class PublicController extends Controller
{
    /** School identity + contact details used by the navbar, footer and hero. */
    public function site()
    {
        $settings = SchoolSetting::whereIn('key', [
            'school_name', 'school_phone', 'school_email', 'school_address',
            'school_motto', 'school_established', 'school_logo',
            'stat_students', 'stat_teachers', 'stat_levels', 'stat_years',
        ])->pluck('value', 'key');

        return response()->json([
            'name' => $settings['school_name'] ?? 'Bright Future Academy',
            'phone' => $settings['school_phone'] ?? null,
            'email' => $settings['school_email'] ?? null,
            'address' => $settings['school_address'] ?? null,
            'motto' => $settings['school_motto'] ?? null,
            'established' => $settings['school_established'] ?? null,
            'logo' => $settings['school_logo'] ?? null,
            'stats' => [
                'students' => $settings['stat_students'] ?? '2,500+',
                'teachers' => $settings['stat_teachers'] ?? '120+',
                'levels' => $settings['stat_levels'] ?? '3',
                'years' => $settings['stat_years'] ?? '15+',
            ],
        ]);
    }

    /** Published news — backed by announcements so staff manage one place. */
    public function news(Request $request)
    {
        $q = Announcement::query()
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->when(
                $request->filled('featured'),
                fn ($qq) => $qq->where('is_pinned', true)
            );

        return response()->json($q->paginate($request->integer('per_page', 9)));
    }

    public function events(Request $request)
    {
        $q = Event::query()
            ->where('status', 'published')
            ->where('starts_at', '>=', now()->subDay())
            ->orderBy('starts_at');

        if ($request->boolean('past')) {
            $q = Event::query()->where('status', 'published')
                ->where('starts_at', '<', now())
                ->orderByDesc('starts_at');
        }

        return response()->json($q->paginate($request->integer('per_page', 9)));
    }

    /** Public staff directory — no emails or phone numbers beyond the school switchboard. */
    public function teachers(Request $request)
    {
        $q = Teacher::query()
            ->where('employment_status', 'active')
            ->orderBy('last_name');

        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('first_name', 'like', "%{$s}%")
                ->orWhere('last_name', 'like', "%{$s}%")
                ->orWhere('specialization', 'like', "%{$s}%"));
        }

        return response()->json($q->paginate($request->integer('per_page', 12)));
    }

    public function contact(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:150',
            'phone' => 'nullable|string|max:30',
            'type' => 'nullable|in:general,admission,appointment,visit,callback,other',
            'subject' => 'nullable|string|max:200',
            'message' => 'required|string|max:3000',
            'preferred_contact' => 'nullable|in:email,phone',
        ]);

        $inquiry = ContactInquiry::create($data + [
            'reference' => 'INQ-'.date('Y').'-'.strtoupper(Str::random(6)),
            'status' => 'new',
        ]);

        return response()->json([
            'reference' => $inquiry->reference,
            'message' => 'Thank you — we will contact you shortly.',
        ], 201);
    }

    /** Anonymous admission application. Returns the application number used to track it. */
    public function apply(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'gender' => 'nullable|in:male,female,other',
            'dob' => 'nullable|date',
            'applying_level_id' => 'nullable|exists:school_levels,id',
            'applying_grade_id' => 'nullable|exists:grades,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'previous_school' => 'nullable|string|max:200',
            'parent_name' => 'required|string|max:150',
            'parent_phone' => 'required|string|max:30',
            'parent_email' => 'required|email|max:150',
            'address' => 'nullable|string|max:255',
            'emergency_contact' => 'nullable|string|max:60',
            'note' => 'nullable|string|max:1000',
        ]);

        $application = DB::transaction(function () use ($data) {
            $year = date('Y');
            $count = Application::whereYear('created_at', $year)->count() + 1;

            return Application::create([
                'application_no' => sprintf('APP-%s-%05d', $year, $count),
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'gender' => $data['gender'] ?? null,
                'dob' => $data['dob'] ?? null,
                'applying_level_id' => $data['applying_level_id'] ?? null,
                'applying_grade_id' => $data['applying_grade_id'] ?? null,
                'academic_year_id' => $data['academic_year_id'] ?? null,
                'parent_name' => $data['parent_name'],
                'parent_phone' => $data['parent_phone'],
                'parent_email' => $data['parent_email'],
                'address' => $data['address'] ?? null,
                'status' => 'pending',
                'submitted_at' => now(),
                'notes' => $this->applicationNote($data),
            ]);
        });

        return response()->json([
            'application_no' => $application->application_no,
            'status' => $application->status,
            'submitted_at' => $application->submitted_at,
        ], 201);
    }

    /** Fields the public form collects that the admissions table has no column for. */
    protected function applicationNote(array $data): ?string
    {
        $extra = collect(['previous_school' => $data['previous_school'] ?? null,
            'emergency_contact' => $data['emergency_contact'] ?? null,
            'note' => $data['note'] ?? null,
        ])->filter()->map(fn ($v, $k) => str_replace('_', ' ', $k).': '.$v);

        return $extra->isEmpty() ? null : $extra->implode("\n");
    }

    /** Parent tracks their application by number + the email they applied with. */
    public function track(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:30',
            'email' => 'required|email|max:150',
        ]);

        $application = Application::where('application_no', $data['code'])
            ->where('parent_email', $data['email'])
            ->first();

        abort_unless($application, 404, 'No application matches that number and email.');

        return response()->json([
            'application_no' => $application->application_no,
            'student' => trim($application->first_name.' '.$application->last_name),
            'status' => $application->status,
            'submitted_at' => $application->submitted_at,
            'decided_at' => $application->decided_at,
            'notes' => $application->notes,
            'documents' => $application->documents()->count(),
        ]);
    }
}
