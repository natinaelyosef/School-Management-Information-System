<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\ParentModel;
use App\Models\SchoolLevel;
use App\Models\SchoolSetting;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentInvoice;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Populates a demo school so every role dashboard has real data:
 * admin@school.et / teacher@school.et / parent@school.et ... (password: "password")
 *
 * Skips silently when data already exists, so it is safe to re-run.
 */
class DemoDataSeeder extends Seeder
{
    protected const DEMO_USERS = [
        ['name' => 'Samuel Tadesse', 'email' => 'admin@school.et', 'role' => 'super_admin'],
        ['name' => 'Mulugeta Assefa', 'email' => 'subadmin@school.et', 'role' => 'school_admin'],
        ['name' => 'Marta Girma', 'email' => 'principal@school.et', 'role' => 'principal'],
        ['name' => 'Daniel Bekele', 'email' => 'academic@school.et', 'role' => 'academic_coordinator'],
        ['name' => 'Hanna Alemu', 'email' => 'registrar@school.et', 'role' => 'registrar'],
        ['name' => 'Ruth Solomon', 'email' => 'registration@school.et', 'role' => 'registration_office'],
        ['name' => 'Mr. Daniel Tesfaye', 'email' => 'teacher@school.et', 'role' => 'teacher'],
        ['name' => 'Abel Haile', 'email' => 'accountant@school.et', 'role' => 'accountant'],
        ['name' => 'Sara Mengistu', 'email' => 'librarian@school.et', 'role' => 'librarian'],
        ['name' => 'Nurse Tigist', 'email' => 'nurse@school.et', 'role' => 'nurse'],
        ['name' => 'Abebe Kebede', 'email' => 'parent@school.et', 'role' => 'parent'],
        ['name' => 'John Doe', 'email' => 'student@school.et', 'role' => 'student'],
    ];

    public function run(): void
    {
        if (User::where('email', 'admin@school.et')->exists()) {
            $this->command?->info('Demo data already present — skipped.');

            return;
        }

        $level = SchoolLevel::firstOrCreate(
            ['code' => 'MID'],
            ['name' => 'Middle School', 'order_index' => 2]
        );
        $preschool = SchoolLevel::firstOrCreate(
            ['code' => 'PRE'],
            ['name' => 'Preschool', 'order_index' => 1]
        );
        $high = SchoolLevel::firstOrCreate(
            ['code' => 'HIGH'],
            ['name' => 'High School', 'order_index' => 3]
        );

        $year = AcademicYear::firstOrCreate(
            ['code' => '2026'],
            [
                'name' => '2026/2027', 'is_current' => true,
                'start_date' => '2026-09-01', 'end_date' => '2027-06-30',
            ]
        );
        $term = Term::firstOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'Term 1'],
            ['is_current' => true, 'start_date' => '2026-09-01', 'end_date' => '2026-12-15']
        );

        $grades = [];
        foreach ([[$preschool, 'KG 1'], [$preschool, 'KG 2'], [$level, 'Grade 7'], [$level, 'Grade 8'], [$high, 'Grade 10'], [$high, 'Grade 12']] as $i => [$lv, $name]) {
            $grades[$name] = Grade::firstOrCreate(
                ['school_level_id' => $lv->id, 'name' => $name],
                ['order_index' => $i + 1]
            );
        }

        $sections = [];
        foreach ($grades as $gradeName => $grade) {
            foreach (['A', 'B'] as $s) {
                $sections[$gradeName.$s] = Section::firstOrCreate(
                    ['grade_id' => $grade->id, 'name' => $s]
                );
            }
        }

        $subjects = [];
        foreach ([['Mathematics', 'MATH'], ['English', 'ENG'], ['Science', 'SCI'], ['Social Studies', 'SST'], ['ICT', 'ICT'], ['Amharic', 'AMH']] as [$name, $code]) {
            $subjects[$code] = Subject::firstOrCreate(['code' => $code], ['name' => $name]);
        }

        $users = [];
        foreach (self::DEMO_USERS as $spec) {
            $user = User::firstOrCreate(
                ['email' => $spec['email']],
                [
                    'name' => $spec['name'],
                    'password' => Hash::make('password'),
                    'status' => 'active',
                    'is_active' => true,
                ]
            );
            $user->syncRoles([$spec['role']]);
            $users[$spec['role']] = $user;
        }

        $parentProfile = ParentModel::firstOrCreate(
            ['user_id' => $users['parent']->id],
            [
                'first_name' => 'Abebe', 'last_name' => 'Kebede',
                'phone' => '+251911000001', 'email' => 'parent@school.et',
            ]
        );

        $studentSpecs = [
            ['first_name' => 'John', 'last_name' => 'Doe', 'gender' => 'male', 'dob' => '2014-05-12', 'grade' => 'Grade 8', 'user' => 'student'],
            ['first_name' => 'Hana', 'last_name' => 'Abebe', 'gender' => 'female', 'dob' => '2017-02-03', 'grade' => 'Grade 7', 'user' => null],
            ['first_name' => 'Sara', 'last_name' => 'Kebede', 'gender' => 'female', 'dob' => '2021-08-19', 'grade' => 'KG 1', 'user' => null],
        ];

        $students = [];
        foreach ($studentSpecs as $i => $spec) {
            $grade = $grades[$spec['grade']];
            $section = $sections[$spec['grade'].'A'];

            $student = Student::firstOrCreate(
                ['admission_no' => sprintf('STD-2026-%05d', $i + 1)],
                [
                    'first_name' => $spec['first_name'],
                    'last_name' => $spec['last_name'],
                    'gender' => $spec['gender'],
                    'dob' => $spec['dob'],
                    'level_id' => $grade->school_level_id,
                    'grade_id' => $grade->id,
                    'section_id' => $section->id,
                    'academic_year_id' => $year->id,
                    'status' => 'active',
                    'user_id' => $spec['user'] ? $users[$spec['user']]->id : null,
                ]
            );
            $parentProfile->students()->syncWithoutDetaching([$student->id]);
            $students[$spec['first_name']] = $student;
        }

        $this->seedInvoices($students, $year, $term, $users);
        $this->seedSettings();
    }

    protected function seedInvoices(array $students, AcademicYear $year, Term $term, array $users): void
    {
        if (StudentInvoice::count() > 0) {
            return;
        }

        $specs = [
            // Partially paid, overdue -> the parent can upload a proof for the balance.
            ['student' => 'John', 'no' => 'INV-2026-00251', 'total' => 15000, 'paid' => 8000, 'due' => '2026-10-30', 'status' => 'partial'],
            ['student' => 'Hana', 'no' => 'INV-2026-00252', 'total' => 14000, 'paid' => 0, 'due' => '2026-10-30', 'status' => 'unpaid'],
            ['student' => 'Sara', 'no' => 'INV-2026-00253', 'total' => 6500, 'paid' => 6500, 'due' => '2026-09-30', 'status' => 'paid'],
        ];

        foreach ($specs as $spec) {
            $student = $students[$spec['student']];
            $invoice = StudentInvoice::create([
                'invoice_no' => $spec['no'],
                'student_id' => $student->id,
                'academic_year_id' => $year->id,
                'term_id' => $term->id,
                'issue_date' => '2026-09-01',
                'due_date' => $spec['due'],
                'subtotal' => $spec['total'],
                'total' => $spec['total'],
                'amount_paid' => $spec['paid'],
                'balance' => $spec['total'] - $spec['paid'],
                'status' => $spec['status'],
                'created_by' => $users['accountant']->id,
            ]);

            $invoice->items()->create([
                'description' => 'Term 1 tuition',
                'quantity' => 1,
                'unit_price' => $spec['total'],
                'total' => $spec['total'],
            ]);
        }
    }

    protected function seedSettings(): void
    {
        $settings = [
            ['key' => 'payment_bank_name', 'value' => 'Commercial Bank of Ethiopia', 'group' => 'payment'],
            ['key' => 'payment_account_name', 'value' => 'Bright Future Academy', 'group' => 'payment'],
            ['key' => 'payment_account_number', 'value' => '100012345678', 'group' => 'payment'],
            ['key' => 'payment_reference_hint', 'value' => 'Use the student ID or invoice number (e.g. INV-2026-00251)', 'group' => 'payment'],
            ['key' => 'payment_instructions', 'value' => 'Transfer the fee to the account above, then upload your payment screenshot on the Fees page within 3 days. The finance office verifies every transfer manually.', 'group' => 'payment'],
            ['key' => 'school_name', 'value' => 'Bright Future Academy', 'group' => 'general'],
            ['key' => 'school_phone', 'value' => '+251 11 555 0100', 'group' => 'general'],
            ['key' => 'school_email', 'value' => 'info@brightfuture.edu.et', 'group' => 'general'],
            ['key' => 'school_address', 'value' => 'Bole Road, Addis Ababa, Ethiopia', 'group' => 'general'],
        ];

        foreach ($settings as $row) {
            SchoolSetting::firstOrCreate(['key' => $row['key']], $row);
        }
    }
}
