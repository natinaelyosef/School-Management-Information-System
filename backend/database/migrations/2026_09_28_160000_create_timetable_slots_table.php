<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timetable_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('grade_id')->constrained('grades')->cascadeOnDelete();
            $table->foreignId('section_id')->constrained('sections')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->tinyInteger('day'); // 1 = Monday .. 6 = Saturday
            $table->tinyInteger('period');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('room')->nullable();
            $table->timestamps();

            $table->unique(['day', 'period', 'grade_id', 'section_id'], 'timetable_slots_class_unique');
            $table->index(['teacher_id', 'day', 'period'], 'timetable_slots_teacher_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_slots');
    }
};
