<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discipline_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('term_id')->nullable()->constrained('terms')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            // merit = a reward worth logging, demerit = a rule broken,
            // incident = a serious event needing follow up, note = context only.
            $table->enum('type', ['merit', 'demerit', 'incident', 'note'])->default('note');
            $table->string('category', 40)->default('conduct');
            $table->unsignedTinyInteger('severity')->nullable(); // 1 (minor) to 5 (serious)
            $table->smallInteger('points')->default(0); // merits add, demerits subtract
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('occurred_on');
            $table->enum('status', ['open', 'resolved', 'appealed'])->default('open');
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'status']);
            $table->index(['type', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discipline_records');
    }
};
