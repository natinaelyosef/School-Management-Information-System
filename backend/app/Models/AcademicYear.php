<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademicYear extends Model
{
    use HasFactory;

    protected $table = 'academic_years';

    protected $guarded = ['id'];

    public function terms()
    {
        return $this->hasMany(Term::class, 'academic_year_id');
    }
}
