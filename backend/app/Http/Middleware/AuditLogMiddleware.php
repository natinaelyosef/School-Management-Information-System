<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditLogMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])
            && str_starts_with($request->path(), 'api/v1')
            && $response->isSuccessful()) {
            try {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'action' => strtolower($request->method()).':'.$request->path(),
                    'auditable_type' => null,
                    'auditable_id' => null,
                    'new_values' => $request->except(['password', 'password_confirmation']),
                    'ip_address' => $request->ip(),
                    'user_agent' => substr((string) $request->userAgent(), 0, 1000),
                ]);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $response;
    }
}
