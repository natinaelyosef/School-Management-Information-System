<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactInquiry extends Model
{
    use HasFactory;

    protected $table = 'contact_inquiries';

    protected $guarded = ['id'];

    public function handler()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
