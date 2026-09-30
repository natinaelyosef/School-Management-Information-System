<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('health_visits', function (Blueprint $table) {
            if (! Schema::hasColumn('health_visits', 'medication')) {
                $table->text('medication')->nullable()->after('treatment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('health_visits', function (Blueprint $table) {
            if (Schema::hasColumn('health_visits', 'medication')) {
                $table->dropColumn('medication');
            }
        });
    }
};
