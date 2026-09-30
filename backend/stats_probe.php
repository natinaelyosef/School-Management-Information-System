<?php

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$roleFilter = $argv[1] ?? null;

$users = App\Models\User::query()->with('roles')->get()
    ->filter(fn ($u) => $roleFilter ? in_array($roleFilter, $u->getRoleNames()->all(), true) : true)
    ->values();

if ($users->isEmpty()) {
    echo "no matching users\n";
    exit(1);
}

$controller = new App\Http\Controllers\Api\V1\StatsController;

foreach ($users->take(6) as $u) {
    $request = Illuminate\Http\Request::create('/api/v1/stats', 'GET');
    $request->setUserResolver(fn () => $u);

    try {
        $response = $controller->index($request);
        $payload = json_decode($response->getContent(), true);
        echo "== {$u->email} [".implode(',', $u->getRoleNames()->all())."]\n";
        echo '   keys: '.implode(', ', array_keys($payload))."\n";
        echo '   summary: '.json_encode(array_filter(
            $payload,
            fn ($k) => ! in_array($k, ['my_tasks', 'upcoming', 'news'], true),
            ARRAY_FILTER_USE_KEY
        ), JSON_PARTIAL_OUTPUT_ON_ERROR)."\n";
    } catch (\Throwable $e) {
        echo "== {$u->email} FAILED: ".get_class($e).': '.$e->getMessage()."\n";
        echo '   '.$e->getFile().':'.$e->getLine()."\n";
    }
}
