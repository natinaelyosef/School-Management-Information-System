<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudentInvoice extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'student_invoices';

    protected $guarded = ['id'];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function invoiceItems()
    {
        return $this->hasMany(InvoiceItem::class, 'student_invoice_id');
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class, 'student_invoice_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'student_invoice_id');
    }
}
