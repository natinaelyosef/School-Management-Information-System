<?php

namespace Database\Seeders;

use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Staff directory rows used by the public teacher page and timetable selects. */
class TeacherDirectorySeeder extends Seeder
{
    protected const TEACHERS = [
        ['employee_no' => 'TCH-001', 'first_name' => 'Daniel', 'last_name' => 'Tesfaye', 'qualification' => 'MSc Mathematics', 'specialization' => 'Mathematics', 'email' => 'teacher@school.et'],
        ['employee_no' => 'TCH-002', 'first_name' => 'Meron', 'last_name' => 'Abebe', 'qualification' => 'BA English, TEFL', 'specialization' => 'English'],
        ['employee_no' => 'TCH-003', 'first_name' => 'Yonas', 'last_name' => 'Haile', 'qualification' => 'MSc Physics', 'specialization' => 'Physics'],
        ['employee_no' => 'TCH-004', 'first_name' => 'Selam', 'last_name' => 'Girma', 'qualification' => 'BEd Biology', 'specialization' => 'Biology'],
        ['employee_no' => 'TCH-005', 'first_name' => 'Kalkidan', 'last_name' => 'Mulugeta', 'qualification' => 'BA Amharic', 'specialization' => 'Amharic'],
        ['employee_no' => 'TCH-006', 'first_name' => 'Nardos', 'last_name' => 'Assefa', 'qualification' => 'Montessori Diploma', 'specialization' => 'Preschool'],
        ['employee_no' => 'TCH-007', 'first_name' => 'Henok', 'last_name' => 'Mekonnen', 'qualification' => 'BSc ICT', 'specialization' => 'ICT & Robotics'],
        ['employee_no' => 'TCH-008', 'first_name' => 'Rahel', 'last_name' => 'Bekele', 'qualification' => 'BA Geography', 'specialization' => 'Social Studies'],
    ];

    public function run(): void
    {
        if (Teacher::withTrashed()->count() > 0) {
            $this->command?->info('Teacher directory already present - skipped.');

            return;
        }

        foreach (self::TEACHERS as $spec) {
            Teacher::create([
                'user_id' => User::where('email', $spec['email'] ?? '')->value('id'),
                'employee_no' => $spec['employee_no'],
                'first_name' => $spec['first_name'],
                'last_name' => $spec['last_name'],
                'email' => ($spec['email'] ?? ($spec['employee_no'].'@school.et')),
                'phone' => '+2519'.random_int(10000000, 99999999),
                'qualification' => $spec['qualification'],
                'specialization' => $spec['specialization'],
                'employment_status' => 'active',
                'hire_date' => now()->subYears(random_int(1, 9))->toDateString(),
            ]);
        }

        $this->command?->info('Seeded '.count(self::TEACHERS).' teacher profiles.');
    }
}
