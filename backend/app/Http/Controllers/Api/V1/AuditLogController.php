<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $q = AuditLog::query()->with('user')->latest();

        if ($request->filled('user_id')) {
            $q->where('user_id', $request->integer('user_id'));
        }
        if ($request->filled('action')) {
            $q->where('action', 'like', $request->string('action').'%');
        }
        if ($request->filled('from')) {
            $q->whereDate('created_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('created_at', '<=', $request->date('to'));
        }
        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('action', 'like', "%{$s}%")
                ->orWhere('auditable_type', 'like', "%{$s}%"));
        }

        return response()->json($q->paginate($request->integer('per_page', 30)));
    }

    /** Distinct action prefixes — powers the filter dropdown. */
    public function actions()
    {
        return response()->json(
            AuditLog::query()->select('action')->distinct()->orderBy('action')->pluck('action')
        );
    }

    /** Users that appear in the audit trail — second filter dropdown. */
    public function users()
    {
        return response()->json(
            User::whereIn('id', AuditLog::select('user_id')->whereNotNull('user_id')->distinct())
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
        );
    }
}
