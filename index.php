<?php
declare(strict_types=1);

$source = strtolower(trim((string)($_GET['utm_source'] ?? '')));
$routes = [
    'a' => 'servio',
    'b' => 'cura',
];

if (!isset($routes[$source])) {
    http_response_code(404);
    header('Cache-Control: no-store');
    exit;
}

if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    http_response_code(426);
    header('Cache-Control: no-store');
    header('Upgrade: TLS/1.2');
    exit;
}

setcookie('site', $routes[$source], [
    'expires' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

header('Cache-Control: no-store');
header('Location: /', true, 303);
exit;
