<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\SchoolLevel;
use App\Models\Section;
use App\Models\Term;
use Illuminate\Http\Request;

class SchoolStructureController extends Controller
{
    protected array $map = [
        'levels' => SchoolLevel::class,
        'grades' => Grade::class,
        'sections' => Section::class,
        'years' => AcademicYear::class,
        'terms' => Term::class,
    ];

    protected function model(string $resource): string
    {
        abort_unless(isset($this->map[$resource]), 404, 'Unknown resource');

        return $this->map[$resource];
    }

    public function index(Request $request, string $resource)
    {
        $class = $this->model($resource);

        return response()->json($class::paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request, string $resource)
    {
        $class = $this->model($resource);
        $validated = $request->validate(['name' => 'sometimes|string', 'code' => 'nullable|string']);
        $data = array_merge($validated, $request->except(['name', 'code']));
        $item = $class::create($data);

        return response()->json($item, 201);
    }

    public function show(string $resource, int $id)
    {
        $class = $this->model($resource);

        return response()->json($class::findOrFail($id));
    }

    public function update(Request $request, string $resource, int $id)
    {
        $class = $this->model($resource);
        $item = $class::findOrFail($id);
        $item->update($request->all());

        return response()->json($item);
    }

    public function destroy(string $resource, int $id)
    {
        $class = $this->model($resource);
        $class::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
