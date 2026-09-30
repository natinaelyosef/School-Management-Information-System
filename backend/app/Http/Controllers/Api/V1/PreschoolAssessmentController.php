<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\PreschoolAssessment;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\Term;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PreschoolAssessmentController extends Controller
{
    use LogsActivity;

    public const DEFAULT_RATINGS = ['excellent', 'good', 'developing', 'needs_support'];

    public function index(Request $request)
    {
        $q = PreschoolAssessment::with(['student']);

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('term_id')) {
            $q->where('term_id', $request->integer('term_id'));
        }
        if ($request->filled('academic_year_id')) {
            $q->where('academic_year_id', $request->integer('academic_year_id'));
        }
        if ($request->filled('rating')) {
            $q->where('rating', $request->string('rating'));
        }

        return response()->json($q->latest('assessment_date')->paginate($request->integer('per_page', 20)));
    }

    public function show(PreschoolAssessment $preschoolAssessment)
    {
        return response()->json($this->present($preschoolAssessment->load('student')));
    }

    public function store(Request $request)
    {
        $ratings = $this->ratingScale();

        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'term_id' => 'nullable|exists:terms,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'skill' => 'required|string|max:255',
            'indicator' => 'nullable|string|max:255',
            'rating' => ['required', 'string', 'max:60', Rule::in($ratings)],
            'notes' => 'nullable|string',
            'assessment_date' => 'nullable|date',
        ]);

        $student = Student::find($data['student_id']);
        $term = ! empty($data['term_id']) ? Term::find($data['term_id']) : Term::where('is_current', true)->first();

        $academicYearId = $data['academic_year_id']
            ?? $term?->academic_year_id
            ?? $student?->academic_year_id
            ?? AcademicYear::where('is_current', true)->value('id')
            ?? AcademicYear::orderBy('id', 'desc')->value('id');

        if (! $academicYearId) {
            abort(422, 'academic_year_id is required (no academic year found).');
        }

        $assessment = PreschoolAssessment::create([
            'student_id' => $data['student_id'],
            'academic_year_id' => $academicYearId,
            'term_id' => $term?->id,
            'domain' => $data['skill'],
            'indicator' => $data['indicator'] ?? null,
            'rating' => $data['rating'],
            'comment' => $data['notes'] ?? null,
            'assessed_by' => $request->user()->id,
            'assessment_date' => $data['assessment_date'] ?? now()->toDateString(),
        ]);

        self::logActivity('preschool_assessments.create', $assessment, null, $assessment);

        return response()->json($this->present($assessment->load('student')), 201);
    }

    protected function present(PreschoolAssessment $assessment): PreschoolAssessment
    {
        $assessment->setAttribute('skill', $assessment->domain);
        $assessment->setAttribute('notes', $assessment->comment);
        $assessment->setAttribute('available_ratings', $this->ratingScale());

        return $assessment;
    }

    protected function ratingScale(): array
    {
        $setting = SchoolSetting::where('key', 'preschool_rating_scale')->first();

        if (! $setting || blank($setting->value)) {
            return self::DEFAULT_RATINGS;
        }

        $value = trim((string) $setting->value);

        if (str_starts_with($value, '[')) {
            $decoded = json_decode($value, true);
            if (is_array($decoded) && $decoded !== []) {
                return array_values(array_map('strval', $decoded));
            }
        }

        $parts = array_values(array_filter(array_map('trim', explode(',', $value))));

        return $parts !== [] ? $parts : self::DEFAULT_RATINGS;
    }
}
