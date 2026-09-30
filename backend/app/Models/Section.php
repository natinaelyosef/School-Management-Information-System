<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    use HasFactory;

    protected $table = 'sections';

    protected $guarded = ['id'];

    public function grade()
    {
        return $this->belongsTo(Grade::class, 'grade_id');
    }
}
