<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SchoolLevel extends Model
{
    use HasFactory;

    protected $table = 'school_levels';

    protected $guarded = ['id'];

    public function grades()
    {
        return $this->hasMany(Grade::class, 'school_level_id');
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class, 'school_level_id');
    }
}
