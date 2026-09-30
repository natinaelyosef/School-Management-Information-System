<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookCopy extends Model
{
    use HasFactory;

    protected $table = 'book_copies';

    protected $guarded = ['id'];

    public function book()
    {
        return $this->belongsTo(Book::class, 'book_id');
    }
}
