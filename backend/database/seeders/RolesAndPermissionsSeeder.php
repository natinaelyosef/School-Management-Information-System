<?php

namespace Database\Seeders;

use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // users
            'users.view', 'users.create', 'users.edit', 'users.delete', 'users.activate', 'users.reset_password',
            // departments (roles) management — super admin & sub admin
            'roles.manage',
            // students / parents / teachers / staff
            'students.view', 'students.create', 'students.edit', 'students.delete', 'students.promote',
            'parents.view', 'parents.create', 'parents.edit', 'parents.delete',
            'teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete',
            'staff.view', 'staff.manage',
            // attendance
            'attendance.view', 'attendance.mark', 'attendance.edit',
            // behaviour: merit, demerit and incident log
            'discipline.view', 'discipline.record', 'discipline.manage',
            // staff leave
            'leave.view', 'leave.request', 'leave.approve', 'leave.manage',
            // grades / exams / assignments
            'grades.view', 'grades.enter', 'grades.edit', 'grades.publish', 'grades.create',
            'assignments.view', 'assignments.create', 'assignments.grade', 'assignments.submit',
            'exams.view', 'exams.create', 'exams.enter_results', 'exams.publish',
            // subjects / timetable
            'subjects.view', 'subjects.create', 'subjects.edit',
            'timetable.manage',
            // fees / payments
            'fees.view', 'fees.create', 'fees.edit', 'fees.delete',
            'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.cancel',
            'payments.view', 'payments.receive', 'payments.verify', 'payments.refund',
            // library / health / transport
            'library.view', 'library.manage', 'library.borrow',
            'health.view', 'health.record', 'health.manage',
            'transport.view', 'transport.manage',
            // admissions
            'applications.view', 'applications.create', 'applications.review', 'applications.decide',
            // comms
            'messaging.send', 'messaging.moderate',
            'campaigns.view', 'campaigns.send',
            'announcements.view', 'announcements.create', 'announcements.publish',
            // public content / enquiries / escalation tasks
            'events.manage', 'inquiries.view', 'inquiries.manage',
            'tasks.view', 'tasks.manage',
            // reports / settings / audit
            'reports.view', 'reports.export',
            'settings.view', 'settings.edit',
            'audit.view',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        $rolePermissions = [
            'super_admin' => $permissions, // all
            'school_admin' => array_filter($permissions, fn ($p) => $p !== 'audit.view'),
            'principal' => [
                'users.view', 'students.view', 'parents.view', 'teachers.view', 'staff.view',
                'leave.view', 'leave.approve', 'leave.manage',
                'attendance.view', 'grades.view', 'grades.publish', 'assignments.view',
                'discipline.view', 'discipline.record', 'discipline.manage',
                'exams.view', 'exams.publish', 'fees.view', 'invoices.view', 'payments.view',
                'library.view', 'health.view', 'transport.view',
                'subjects.view', 'timetable.manage',
                'applications.view', 'applications.review', 'applications.decide',
                'messaging.send', 'campaigns.view', 'campaigns.send',
                'announcements.view', 'announcements.create', 'announcements.publish',
                'events.manage', 'inquiries.view', 'inquiries.manage', 'tasks.view', 'tasks.manage',
                'reports.view', 'reports.export', 'settings.view', 'audit.view',
            ],
            'academic_coordinator' => [
                'students.view', 'teachers.view', 'attendance.view', 'attendance.mark', 'attendance.edit',
                'discipline.view', 'discipline.record',
                'leave.view', 'leave.request',
                'grades.view', 'grades.enter', 'grades.edit', 'grades.create',
                'assignments.view', 'assignments.create',
                'assignments.grade', 'exams.view', 'exams.create', 'exams.enter_results',
                'subjects.view', 'subjects.create', 'subjects.edit', 'timetable.manage',
                'applications.view', 'applications.review', 'messaging.send', 'announcements.view',
                'events.manage', 'reports.view', 'reports.export',
            ],
            'registrar' => [
                'students.view', 'students.create', 'students.edit', 'students.promote',
                'parents.view', 'parents.create', 'parents.edit',
                'attendance.view', 'subjects.view', 'applications.view', 'applications.create', 'applications.review', 'applications.decide',
                'discipline.view',
                'inquiries.view', 'inquiries.manage', 'events.manage',
                'messaging.send', 'campaigns.view', 'campaigns.send', 'announcements.view',
                'reports.view', 'reports.export',
            ],
            'registration_office' => [
                'applications.view', 'applications.create', 'applications.review', 'applications.decide',
                'students.view', 'students.create', 'students.edit',
                'parents.view', 'parents.create', 'parents.edit',
                'fees.view', 'invoices.view', 'invoices.create',
                'payments.view', 'payments.receive',
                'messaging.send', 'campaigns.view', 'campaigns.send', 'announcements.view',
                'reports.view', 'reports.export',
            ],
            'teacher' => [
                'students.view', 'attendance.view', 'attendance.mark',
                'discipline.view', 'discipline.record',
                'leave.view', 'leave.request',
                'grades.view', 'grades.enter', 'grades.create',
                'subjects.view', 'assignments.view', 'assignments.create', 'assignments.grade',
                'exams.view', 'exams.enter_results', 'messaging.send', 'announcements.view',
                'reports.view', 'reports.export',
            ],
            'accountant' => [
                'students.view', 'fees.view', 'fees.create', 'fees.edit',
                'leave.view', 'leave.request',
                'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.cancel',
                'payments.view', 'payments.receive', 'payments.verify',
                'tasks.view', 'tasks.manage',
                'messaging.send', 'announcements.view', 'reports.view', 'reports.export',
            ],
            'librarian' => [
                'students.view', 'library.view', 'library.manage', 'library.borrow',
                'leave.view', 'leave.request',
                'messaging.send', 'announcements.view',
            ],
            'nurse' => [
                'students.view', 'health.view', 'health.record', 'health.manage',
                'leave.view', 'leave.request',
                'messaging.send', 'announcements.view',
            ],
            'parent' => [
                'students.view', 'grades.view', 'attendance.view', 'assignments.view',
                'discipline.view',
                'invoices.view', 'payments.view', 'messaging.send', 'announcements.view',
                'applications.view', 'applications.create',
            ],
            'student' => [
                'grades.view', 'attendance.view', 'assignments.view', 'assignments.submit',
                'messaging.send', 'announcements.view', 'library.view', 'library.borrow',
            ],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($perms);
        }

        // The leave types a school commonly offers. Quotas are per person, per year.
        foreach ([
            ['name' => 'annual', 'label' => 'Annual leave', 'quota_days' => 30, 'is_paid' => true],
            ['name' => 'sick', 'label' => 'Sick leave', 'quota_days' => 15, 'is_paid' => true, 'requires_document' => true],
            ['name' => 'maternity', 'label' => 'Maternity leave', 'quota_days' => 120, 'is_paid' => true],
            ['name' => 'study', 'label' => 'Study leave', 'quota_days' => 10, 'is_paid' => true],
            ['name' => 'bereavement', 'label' => 'Bereavement leave', 'quota_days' => 5, 'is_paid' => true],
            ['name' => 'unpaid', 'label' => 'Unpaid leave', 'quota_days' => 0, 'is_paid' => false],
        ] as $type) {
            LeaveType::firstOrCreate(['name' => $type['name']], $type);
        }

        $admin = User::firstOrCreate(
            ['email' => 'admin@school.local'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'is_active' => true,
                'status' => 'active',
            ]
        );
        $admin->assignRole('super_admin');

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
