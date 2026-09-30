<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'telegram_chat_id')) {
                $table->string('telegram_chat_id')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'notify_sms')) {
                $table->boolean('notify_sms')->default(false)->after('telegram_chat_id');
            }
            if (! Schema::hasColumn('users', 'notify_telegram')) {
                $table->boolean('notify_telegram')->default(false)->after('notify_sms');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['notify_telegram', 'notify_sms', 'telegram_chat_id'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
