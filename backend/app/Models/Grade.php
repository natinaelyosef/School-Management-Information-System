<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Grade extends Model
{
    use HasFactory;

    protected $table = 'grades';

    protected $guarded = ['id'];

    public function schoolLevel()
    {
        return $this->belongsTo(SchoolLevel::class, 'school_level_id');
    }

    public function sections()
    {
        return $this->hasMany(Section::class, 'grade_id');
    }
}
