<?php

namespace App\Support;

use App\Models\Student;

class AdmissionNumber
{
    public static function next(): string
    {
        $n = Student::withTrashed()->count() + 1;

        do {
            $candidate = sprintf('STD-%d-%05d', (int) date('Y'), $n);
            $n++;
        } while (Student::withTrashed()->where('admission_no', $candidate)->exists());

        return $candidate;
    }
}
