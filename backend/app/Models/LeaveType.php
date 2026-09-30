<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveType extends Model
{
    use HasFactory;

    protected $table = 'leave_types';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'quota_days' => 'integer',
            'is_paid' => 'boolean',
            'requires_document' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function requests()
    {
        return $this->hasMany(LeaveRequest::class, 'leave_type_id');
    }
}
