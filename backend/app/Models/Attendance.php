<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory;

    protected $table = 'attendances';

    protected $guarded = ['id'];

    public function attendanceRecords()
    {
        return $this->hasMany(AttendanceRecord::class, 'attendance_id');
    }

    public function records()
    {
        return $this->hasMany(AttendanceRecord::class, 'attendance_id');
    }
}
