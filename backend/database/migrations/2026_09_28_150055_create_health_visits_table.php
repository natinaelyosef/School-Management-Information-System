<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('visit_date');
            $table->text('complaint')->nullable();
            $table->text('diagnosis')->nullable();
            $table->text('treatment')->nullable();
            $table->decimal('temperature', 4, 1)->nullable();
            $table->boolean('referred')->default(false);
            $table->foreignId('attended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('parent_notified')->default(false);
            $table->date('follow_up_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_visits');
    }
};
