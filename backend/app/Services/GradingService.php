<?php

namespace App\Services;

use App\Models\GradingScale;

class GradingService
{
    /**
     * Default letter thresholds used when no grading_scales rows exist.
     *
     * @var array<int, array{min: float, letter: string, point: float}>
     */
    public const THRESHOLDS = [
        ['min' => 90, 'letter' => 'A+', 'point' => 4.0],
        ['min' => 80, 'letter' => 'A', 'point' => 3.75],
        ['min' => 70, 'letter' => 'B', 'point' => 3.0],
        ['min' => 60, 'letter' => 'C', 'point' => 2.0],
        ['min' => 50, 'letter' => 'D', 'point' => 1.0],
        ['min' => 0, 'letter' => 'F', 'point' => 0.0],
    ];

    /**
     * @return array{letter: string, point: float|null}
     */
    public function letterFor(?float $score, ?int $schoolLevelId = null, ?int $academicYearId = null): array
    {
        if ($score === null) {
            return ['letter' => '', 'point' => null];
        }

        $scale = $this->scaleFor($score, $schoolLevelId, $academicYearId);

        if ($scale) {
            return [
                'letter' => (string) $scale->grade_letter,
                'point' => $scale->grade_point !== null ? (float) $scale->grade_point : null,
            ];
        }

        foreach (self::THRESHOLDS as $threshold) {
            if ($score >= $threshold['min']) {
                return ['letter' => $threshold['letter'], 'point' => $threshold['point']];
            }
        }

        return ['letter' => 'F', 'point' => 0.0];
    }

    public function hasCustomScale(?int $schoolLevelId = null, ?int $academicYearId = null): bool
    {
        return $this->queryScales($schoolLevelId, $academicYearId)->exists();
    }

    protected function scaleFor(float $score, ?int $schoolLevelId, ?int $academicYearId): ?GradingScale
    {
        $scales = $this->queryScales($schoolLevelId, $academicYearId)->get();

        if ($scales->isEmpty()) {
            return null;
        }

        $candidates = $scales->filter(fn ($s) => $score >= (float) $s->min_score && $score <= (float) $s->max_score);

        if ($candidates->isEmpty()) {
            return null;
        }

        $exact = $candidates->first(fn ($s) => $s->school_level_id === $schoolLevelId && $s->academic_year_id === $academicYearId);
        if ($exact) {
            return $exact;
        }

        $byLevel = $candidates->first(fn ($s) => $schoolLevelId !== null && $s->school_level_id === $schoolLevelId);
        if ($byLevel) {
            return $byLevel;
        }

        $byYear = $candidates->first(fn ($s) => $academicYearId !== null && $s->academic_year_id === $academicYearId);
        if ($byYear) {
            return $byYear;
        }

        return $candidates->first(fn ($s) => $s->school_level_id === null && $s->academic_year_id === null)
            ?? $candidates->first();
    }

    protected function queryScales(?int $schoolLevelId, ?int $academicYearId)
    {
        return GradingScale::query()->whereBetween('min_score', [0, 100])
            ->when($schoolLevelId !== null || $academicYearId !== null, function ($q) use ($schoolLevelId, $academicYearId) {
                $q->where(function ($qq) use ($schoolLevelId, $academicYearId) {
                    $qq->where(fn ($w) => $w->whereNull('school_level_id')->whereNull('academic_year_id'));
                    if ($schoolLevelId !== null) {
                        $qq->orWhere('school_level_id', $schoolLevelId);
                    }
                    if ($academicYearId !== null) {
                        $qq->orWhere('academic_year_id', $academicYearId);
                    }
                });
            })
            ->orderByRaw('school_level_id IS NULL, academic_year_id IS NULL');
    }
}
