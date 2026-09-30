<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $q = Announcement::query()->latest('published_at');
        if ($request->filled('audience')) {
            $q->where('audience', $request->string('audience'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'body' => 'required|string',
            'audience' => 'nullable|string',
            'grade_id' => 'nullable|exists:grades,id',
            'academic_year_id' => 'nullable|exists:academic_years,id',
            'published_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_pinned' => 'nullable|boolean',
            'status' => 'nullable|string',
        ]);
        $data['created_by'] = $request->user()->id;

        return response()->json(Announcement::create($data), 201);
    }

    public function show(Announcement $announcement)
    {
        return response()->json($announcement);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $announcement->update($request->all());

        return response()->json($announcement);
    }

    public function destroy(Announcement $announcement)
    {
        $announcement->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function publish(Announcement $announcement)
    {
        $announcement->update(['status' => 'published', 'published_at' => now()]);

        return response()->json($announcement);
    }
}
