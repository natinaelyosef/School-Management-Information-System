<?php

namespace App\Services;

use App\Models\Grade;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

class CommunicationService
{
    public const AUDIENCES = ['all_parents', 'grade', 'section', 'staff'];

    /**
     * Who a message is for, given a target. Returns unique, active user accounts
     * — a parent with two children in the same class is still one recipient.
     *
     * @param  array{audience?: string, grade_id?: int|null, section_id?: int|null, role?: string|null}  $target
     * @return Collection<int, User>
     */
    public function recipients(array $target): Collection
    {
        $audience = $target['audience'] ?? 'all_parents';

        $ids = match ($audience) {
            'grade' => $this->parentIdsForStudents($target['grade_id'] ?? null, null),
            'section' => $this->parentIdsForStudents(null, $target['section_id'] ?? null),
            'staff' => $this->staffIds($target['role'] ?? null),
            default => User::whereHas('roles', fn ($q) => $q->where('name', 'parent'))
                ->where('is_active', true)
                ->pluck('id'),
        };

        return User::whereIn('id', $ids)->where('is_active', true)->get();
    }

    /**
     * User ids of the parents of students in a grade or section, deduplicated.
     *
     * @return Collection<int, int>
     */
    private function parentIdsForStudents(?int $gradeId, ?int $sectionId): Collection
    {
        return DB::table('parent_student')
            ->join('students', 'students.id', '=', 'parent_student.student_id')
            ->join('parents', 'parents.id', '=', 'parent_student.parent_id')
            ->join('users', 'users.id', '=', 'parents.user_id')
            ->whereNull('students.deleted_at')
            ->whereNull('parents.deleted_at')
            ->whereNull('users.deleted_at')
            ->where('users.is_active', true)
            ->when($gradeId, fn ($q) => $q->where('students.grade_id', $gradeId))
            ->when($sectionId, fn ($q) => $q->where('students.section_id', $sectionId))
            ->distinct()
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    /** @return Collection<int, int> */
    private function staffIds(?string $role): Collection
    {
        if (blank($role)) {
            return collect();
        }

        return DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('roles.name', $role)
            ->where('model_has_roles.model_type', (new User())->getMorphClass())
            ->whereNull('users.deleted_at')
            ->where('users.is_active', true)
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    /**
     * Every selectable target with the number of people it reaches, so a
     * campaign is never fired blind.
     *
     * @return array<int, array<string, mixed>>
     */
    public function audienceOptions(): array
    {
        $options = [
            [
                'value' => 'all_parents',
                'label' => 'All parents & guardians',
                'count' => $this->recipients(['audience' => 'all_parents'])->count(),
            ],
        ];

        foreach (Grade::orderBy('name')->get(['id', 'name']) as $grade) {
            $options[] = [
                'value' => 'grade',
                'label' => $grade->name,
                'grade_id' => $grade->id,
                'count' => $this->recipients(['audience' => 'grade', 'grade_id' => $grade->id])->count(),
            ];

            foreach (Section::where('grade_id', $grade->id)->orderBy('name')->get(['id', 'name']) as $section) {
                $options[] = [
                    'value' => 'section',
                    'label' => $grade->name.' — '.$section->name,
                    'grade_id' => $grade->id,
                    'section_id' => $section->id,
                    'count' => $this->recipients([
                        'audience' => 'section', 'section_id' => $section->id,
                    ])->count(),
                ];
            }
        }

        foreach (Role::orderBy('name')->pluck('name') as $name) {
            $options[] = [
                'value' => 'staff',
                'label' => 'Staff: '.str_replace('_', ' ', $name),
                'role' => $name,
                'count' => $this->recipients(['audience' => 'staff', 'role' => $name])->count(),
            ];
        }

        return $options;
    }
}
