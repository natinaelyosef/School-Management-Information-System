<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HealthRecord;
use App\Models\HealthVisit;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;

class HealthController extends Controller
{
    use LogsActivity;

    public function visits(Request $request)
    {
        $q = HealthVisit::with('student');

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('from')) {
            $q->whereDate('visit_date', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('visit_date', '<=', $request->date('to'));
        }

        return response()->json($q->latest('visit_date')->paginate($request->integer('per_page', 20)));
    }

    public function showVisit(HealthVisit $visit)
    {
        return response()->json($visit->load('student'));
    }

    public function storeVisit(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'symptoms' => 'nullable|string',
            'treatment' => 'nullable|string',
            'medication' => 'nullable|string',
            'follow_up' => 'nullable|date',
            'visit_date' => 'nullable|date',
            'diagnosis' => 'nullable|string',
            'temperature' => 'nullable|numeric|min:0|max:50',
            'referred' => 'nullable|boolean',
            'parent_notified' => 'nullable|boolean',
        ]);

        $visit = HealthVisit::create([
            'student_id' => $data['student_id'],
            'visit_date' => $data['visit_date'] ?? now()->toDateString(),
            'complaint' => $data['symptoms'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'treatment' => $data['treatment'] ?? null,
            'medication' => $data['medication'] ?? null,
            'temperature' => $data['temperature'] ?? null,
            'referred' => $data['referred'] ?? false,
            'parent_notified' => $data['parent_notified'] ?? false,
            'follow_up_date' => $data['follow_up'] ?? null,
            'attended_by' => $request->user()->id,
        ]);

        self::logActivity('health.visits.create', $visit, null, $visit);

        return response()->json($this->presentVisit($visit->load('student')), 201);
    }

    public function records(Request $request)
    {
        $q = HealthRecord::with('student');

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    public function showRecord(HealthRecord $record)
    {
        return response()->json($record->load('student'));
    }

    public function storeRecord(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
            'allergies' => 'nullable|string',
            'blood_group' => 'nullable|string|max:10',
            'medical_notes' => 'nullable|string',
            'chronic_conditions' => 'nullable|string',
            'disabilities' => 'nullable|string',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'doctor_name' => 'nullable|string|max:255',
            'doctor_phone' => 'nullable|string|max:30',
        ]);

        $record = HealthRecord::updateOrCreate(
            ['student_id' => $data['student_id']],
            [
                'allergies' => $data['allergies'] ?? null,
                'blood_group' => $data['blood_group'] ?? null,
                'notes' => $data['medical_notes'] ?? null,
                'chronic_conditions' => $data['chronic_conditions'] ?? null,
                'disabilities' => $data['disabilities'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'doctor_name' => $data['doctor_name'] ?? null,
                'doctor_phone' => $data['doctor_phone'] ?? null,
            ]
        );

        self::logActivity('health.records.store', $record, null, $record);

        return response()->json($this->presentRecord($record->load('student')), 201);
    }

    protected function presentVisit(HealthVisit $visit): HealthVisit
    {
        $visit->setAttribute('symptoms', $visit->complaint);
        $visit->setAttribute('follow_up', $visit->follow_up_date);

        return $visit;
    }

    protected function presentRecord(HealthRecord $record): HealthRecord
    {
        $record->setAttribute('medical_notes', $record->notes);

        return $record;
    }
}
