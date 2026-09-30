<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('student_id')->nullable()->after('created_by')->constrained('students')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->after('student_id')->constrained('parents')->nullOnDelete();
            $table->string('contact_method')->nullable()->after('notes');
            $table->timestamp('contacted_at')->nullable()->after('contact_method');
            $table->text('contact_note')->nullable()->after('contacted_at');
            $table->timestamp('notified_at')->nullable()->after('contact_note');
            $table->timestamp('enrolled_at')->nullable()->after('notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('student_id');
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['contact_method', 'contacted_at', 'contact_note', 'notified_at', 'enrolled_at']);
        });
    }
};
