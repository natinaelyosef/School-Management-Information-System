<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Student;
use App\Models\TransportAssignment;
use App\Models\TransportRoute;
use App\Models\Vehicle;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransportController extends Controller
{
    use LogsActivity;

    public function routes(Request $request)
    {
        $q = TransportRoute::query()->with('vehicle')->withCount('stops');

        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('name', 'like', "%{$s}%")
                ->orWhere('code', 'like', "%{$s}%")
                ->orWhere('driver_name', 'like', "%{$s}%"));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($q->orderBy('name')->paginate($request->integer('per_page', 20)));
    }

    public function storeRoute(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:60|unique:routes,code',
            'description' => 'nullable|string',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'driver_name' => 'nullable|string|max:255',
            'fare' => 'nullable|numeric|min:0',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'vehicle' => 'nullable|array',
            'vehicle.plate_no' => 'required_with:vehicle|nullable|string|max:30|unique:vehicles,plate_no',
            'vehicle.model' => 'nullable|string|max:100',
            'vehicle.capacity' => 'nullable|integer|min:1',
            'vehicle.driver_name' => 'nullable|string|max:255',
            'vehicle.driver_phone' => 'nullable|string|max:30',
        ]);

        $route = DB::transaction(function () use ($data) {
            $vehicleId = $data['vehicle_id'] ?? null;

            if (! $vehicleId && ! empty($data['vehicle']['plate_no'])) {
                $vehicle = Vehicle::create([
                    'plate_no' => $data['vehicle']['plate_no'],
                    'model' => $data['vehicle']['model'] ?? null,
                    'capacity' => $data['vehicle']['capacity'] ?? $data['capacity'] ?? null,
                    'driver_name' => $data['vehicle']['driver_name'] ?? $data['driver_name'] ?? null,
                    'driver_phone' => $data['vehicle']['driver_phone'] ?? null,
                ]);
                $vehicleId = $vehicle->id;
            }

            return TransportRoute::create([
                'name' => $data['name'],
                'code' => $data['code'] ?? null,
                'description' => $data['description'] ?? null,
                'vehicle_id' => $vehicleId,
                'driver_name' => $data['driver_name']
                    ?? ($data['vehicle']['driver_name'] ?? null)
                    ?? ($vehicleId ? Vehicle::where('id', $vehicleId)->value('driver_name') : null),
                'fare' => $data['fare'] ?? null,
                'capacity' => $data['capacity']
                    ?? ($data['vehicle']['capacity'] ?? null)
                    ?? ($vehicleId ? Vehicle::where('id', $vehicleId)->value('capacity') : null),
                'is_active' => $data['is_active'] ?? true,
            ]);
        });

        self::logActivity('transport.routes.create', $route, null, $route);

        return response()->json($route->load('vehicle'), 201);
    }

    public function showRoute(TransportRoute $route)
    {
        return response()->json($route->load([
            'vehicle',
            'stops' => fn ($q) => $q->orderBy('order_index'),
        ])->loadCount('assignments'));
    }

    public function addStop(Request $request, TransportRoute $route)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'arrival_time' => 'nullable|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
            'order_index' => 'nullable|integer|min:0',
        ]);

        $stop = $route->stops()->create([
            'name' => $data['name'],
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'arrival_time' => $data['arrival_time'] ?? null,
            'order_index' => $data['order_index'] ?? ($route->stops()->count() + 1),
        ]);

        self::logActivity('transport.stops.create', $stop, null, $stop);

        return response()->json($stop, 201);
    }

    public function assignments(Request $request)
    {
        $q = TransportAssignment::with(['student', 'route']);

        if ($request->filled('route_id')) {
            $q->where('route_id', $request->integer('route_id'));
        }
        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    public function storeAssignment(Request $request)
    {
        $data = $request->validate([
            'route_id' => 'required|exists:routes,id',
            'student_id' => 'required|exists:students,id',
            'route_stop_id' => 'nullable|exists:route_stops,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'pickup_time' => 'nullable|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
            'status' => 'nullable|in:active,inactive,suspended',
        ]);

        $student = Student::find($data['student_id']);

        $academicYearId = $data['academic_year_id']
            ?? $student?->academic_year_id
            ?? AcademicYear::where('is_current', true)->value('id')
            ?? AcademicYear::orderBy('id', 'desc')->value('id');

        $assignment = TransportAssignment::updateOrCreate(
            [
                'student_id' => $data['student_id'],
                'route_id' => $data['route_id'],
                'academic_year_id' => $academicYearId,
            ],
            [
                'route_stop_id' => $data['route_stop_id'] ?? null,
                'pickup_time' => $data['pickup_time'] ?? null,
                'status' => $data['status'] ?? 'active',
            ]
        );

        self::logActivity('transport.assignments.create', $assignment, null, $assignment);

        return response()->json($assignment->load(['student', 'route']), 201);
    }
}
