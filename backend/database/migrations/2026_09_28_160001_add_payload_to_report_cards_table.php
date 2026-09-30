<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_cards', function (Blueprint $table) {
            if (! Schema::hasColumn('report_cards', 'payload')) {
                $table->json('payload')->nullable()->after('principal_comment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('report_cards', function (Blueprint $table) {
            if (Schema::hasColumn('report_cards', 'payload')) {
                $table->dropColumn('payload');
            }
        });
    }
};
