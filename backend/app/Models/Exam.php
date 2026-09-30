<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Exam extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'exams';

    protected $guarded = ['id'];

    public function examSubjects()
    {
        return $this->hasMany(ExamSubject::class, 'exam_id');
    }

    public function subjects()
    {
        return $this->hasMany(ExamSubject::class, 'exam_id');
    }
}
