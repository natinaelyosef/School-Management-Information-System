<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Borrowing extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'borrowings';

    protected $guarded = ['id'];

    public function book()
    {
        return $this->belongsTo(Book::class, 'book_id');
    }

    public function bookCopy()
    {
        return $this->belongsTo(BookCopy::class, 'book_copy_id');
    }

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function fines()
    {
        return $this->hasMany(LibraryFine::class, 'borrowing_id');
    }
}
