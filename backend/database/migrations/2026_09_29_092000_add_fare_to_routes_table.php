<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->decimal('fare', 10, 2)->nullable()->after('driver_name');
            $table->unsignedInteger('capacity')->nullable()->after('fare');
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn(['fare', 'capacity']);
        });
    }
};
