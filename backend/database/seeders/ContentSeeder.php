<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Event;
use Illuminate\Database\Seeder;

/** Published news + calendar entries the public site and dashboards read. */
class ContentSeeder extends Seeder
{
    public function run(): void
    {
        if (Announcement::withTrashed()->count() === 0) {
            Announcement::insert([
                [
                    'title' => 'Grade 12 results: 98% university entrance pass',
                    'body' => 'Our 2026 cohort achieved a 98% pass rate in the national university entrance examination, with 41 students scoring above 70%.',
                    'audience' => 'all',
                    'status' => 'published',
                    'is_pinned' => true,
                    'published_at' => now()->subDays(3),
                    'created_at' => now()->subDays(3),
                    'updated_at' => now()->subDays(3),
                ],
                [
                    'title' => 'New science block now open',
                    'body' => 'The renovated science wing adds three laboratories, a robotics lab and a maker space for middle and high school students.',
                    'audience' => 'all',
                    'status' => 'published',
                    'is_pinned' => false,
                    'published_at' => now()->subDays(9),
                    'created_at' => now()->subDays(9),
                    'updated_at' => now()->subDays(9),
                ],
                [
                    'title' => 'Term 2 parent-teacher conference schedule',
                    'body' => 'Book your slot through the parent portal. Conferences run 09:00–16:00 and are held grade by grade in the main hall.',
                    'audience' => 'parent,student',
                    'status' => 'published',
                    'is_pinned' => false,
                    'published_at' => now()->subDay(),
                    'created_at' => now()->subDay(),
                    'updated_at' => now()->subDay(),
                ],
                [
                    'title' => 'Fee payment window closes at month end',
                    'body' => 'Term fees can be paid at the finance office or by telebirr. Late payments trigger the standard reminder schedule.',
                    'audience' => 'parent',
                    'status' => 'published',
                    'is_pinned' => false,
                    'published_at' => now()->subHours(6),
                    'created_at' => now()->subHours(6),
                    'updated_at' => now()->subHours(6),
                ],
                [
                    'title' => 'Robotics club wins national finals',
                    'body' => 'Eight students from Grades 9–11 took first place at the national robotics challenge in Addis Ababa.',
                    'audience' => 'all',
                    'status' => 'published',
                    'is_pinned' => false,
                    'published_at' => now()->subDays(14),
                    'created_at' => now()->subDays(14),
                    'updated_at' => now()->subDays(14),
                ],
            ]);
        }

        if (Event::withTrashed()->count() === 0) {
            $base = now()->startOfDay();

            Event::insert([
                [
                    'title' => 'Open Day — campus tours and demos',
                    'description' => 'Meet teachers, tour the labs and see live classroom demos. No registration required.',
                    'location' => 'Main Hall',
                    'audience' => 'all',
                    'starts_at' => $base->copy()->addDays(5)->setTime(9, 0),
                    'ends_at' => $base->copy()->addDays(5)->setTime(15, 0),
                    'status' => 'published',
                    'published_at' => now()->subDays(2),
                    'created_at' => now()->subDays(2),
                    'updated_at' => now()->subDays(2),
                ],
                [
                    'title' => 'Parent-teacher conference',
                    'description' => 'Grade-by-grade slots booked through the parent portal.',
                    'location' => 'Main Hall',
                    'audience' => 'parent',
                    'starts_at' => $base->copy()->addDays(12)->setTime(9, 0),
                    'ends_at' => $base->copy()->addDays(12)->setTime(16, 0),
                    'status' => 'published',
                    'published_at' => now()->subDays(4),
                    'created_at' => now()->subDays(4),
                    'updated_at' => now()->subDays(4),
                ],
                [
                    'title' => 'Inter-school athletics meet',
                    'description' => 'Track and field events for middle and high school squads.',
                    'location' => 'School field',
                    'audience' => 'all',
                    'starts_at' => $base->copy()->addDays(26)->setTime(8, 30),
                    'ends_at' => $base->copy()->addDays(26)->setTime(17, 0),
                    'status' => 'published',
                    'published_at' => now()->subDay(),
                    'created_at' => now()->subDay(),
                    'updated_at' => now()->subDay(),
                ],
                [
                    'title' => 'Mid-term exams begin',
                    'description' => 'Timetables published in the academics section.',
                    'location' => 'Exam halls',
                    'audience' => 'student',
                    'starts_at' => $base->copy()->addDays(40)->setTime(8, 0),
                    'ends_at' => $base->copy()->addDays(40)->setTime(12, 0),
                    'status' => 'published',
                    'published_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'title' => 'Term 1 fee deadline',
                    'description' => 'Last day for on-time term fee payment.',
                    'location' => 'Finance office',
                    'audience' => 'parent',
                    'starts_at' => $base->copy()->addDays(18)->setTime(17, 0),
                    'ends_at' => $base->copy()->addDays(18)->setTime(18, 0),
                    'status' => 'published',
                    'published_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }
}
