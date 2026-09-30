<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('term_id')->nullable()->constrained('terms')->nullOnDelete();
            $table->decimal('overall_average', 5, 2)->nullable();
            $table->string('overall_grade')->nullable();
            $table->integer('rank_in_class')->nullable();
            $table->integer('total_students')->nullable();
            $table->decimal('attendance_rate', 5, 2)->nullable();
            $table->text('teacher_comment')->nullable();
            $table->text('principal_comment')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'academic_year_id', 'term_id'], 'report_cards_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_cards');
    }
};
