<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

trait LogsActivity
{
    public static function logActivity(string $action, ?Model $model = null, $old = null, $new = null): void
    {
        try {
            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => $action,
                'auditable_type' => $model ? get_class($model) : null,
                'auditable_id' => $model?->getKey(),
                'old_values' => $old ? (is_array($old) ? $old : $old->toArray()) : null,
                'new_values' => $new ? (is_array($new) ? $new : $new->toArray()) : null,
                'ip_address' => request()->ip(),
                'user_agent' => substr((string) request()->userAgent(), 0, 1000),
            ]);
        } catch (\Throwable $e) {
            // never break the request because of audit logging
            report($e);
        }
    }
}
