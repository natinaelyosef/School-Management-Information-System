<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApplicationDocument extends Model
{
    use HasFactory;

    protected $table = 'application_documents';

    protected $guarded = ['id'];

    public function application()
    {
        return $this->belongsTo(Application::class, 'application_id');
    }
}
