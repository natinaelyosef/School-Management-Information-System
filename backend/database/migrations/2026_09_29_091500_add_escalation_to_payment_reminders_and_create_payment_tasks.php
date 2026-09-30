<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_reminders', function (Blueprint $table) {
            $table->string('stage')->default('reminder')->after('channel');
            $table->unsignedSmallInteger('days_overdue')->default(0)->after('stage');
            $table->string('result')->nullable()->after('status');

            $table->unique(
                ['student_invoice_id', 'stage', 'days_overdue'],
                'payment_reminders_stage_unique'
            );
        });

        Schema::create('payment_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_invoice_id')->constrained('student_invoices')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->string('type')->default('contact_parent');
            $table->string('priority')->default('normal');
            $table->string('status')->default('open');
            $table->string('title');
            $table->text('notes')->nullable();
            $table->date('due_date')->nullable();
            $table->string('outcome')->nullable();
            $table->text('outcome_notes')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_tasks');
        Schema::table('payment_reminders', function (Blueprint $table) {
            $table->dropUnique('payment_reminders_stage_unique');
            $table->dropColumn(['stage', 'days_overdue', 'result']);
        });
    }
};
