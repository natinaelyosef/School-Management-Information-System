<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'students';

    protected $guarded = ['id'];

    protected $appends = ['full_name'];

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''));
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function schoolLevel()
    {
        return $this->belongsTo(SchoolLevel::class, 'level_id');
    }

    public function grade()
    {
        return $this->belongsTo(Grade::class, 'grade_id');
    }

    public function section()
    {
        return $this->belongsTo(Section::class, 'section_id');
    }

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function events()
    {
        return $this->hasMany(StudentEvent::class, 'student_id');
    }

    public function healthRecords()
    {
        return $this->hasMany(HealthRecord::class, 'student_id');
    }

    public function disciplineRecords()
    {
        return $this->hasMany(DisciplineRecord::class, 'student_id');
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    public function parents()
    {
        return $this->belongsToMany(ParentModel::class, 'parent_student', 'student_id', 'parent_id');
    }
}
