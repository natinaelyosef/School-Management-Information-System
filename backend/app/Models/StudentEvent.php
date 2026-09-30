<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentEvent extends Model
{
    use HasFactory;

    protected $table = 'student_events';

    protected $guarded = ['id'];

    protected $casts = [
        'event_date' => 'date',
        'meta' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function fromGrade()
    {
        return $this->belongsTo(Grade::class, 'from_grade_id');
    }

    public function toGrade()
    {
        return $this->belongsTo(Grade::class, 'to_grade_id');
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
