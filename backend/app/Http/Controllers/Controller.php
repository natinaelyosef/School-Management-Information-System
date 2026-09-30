<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

abstract class Controller
{
    /**
     * A valid empty paginator response — Collection::paginate() does not exist,
     * so guarded list endpoints return this instead when the viewer may see
     * nothing (a parent with no children, a student with no linked records).
     */
    protected function emptyPaginator(Request $request, ?int $perPage = null): LengthAwarePaginator
    {
        $perPage = $perPage ?? $request->integer('per_page', 20);

        return new LengthAwarePaginator([], 0, $perPage, 1, [
            'path' => $request->url(),
            'pageName' => 'page',
        ]);
    }
}
