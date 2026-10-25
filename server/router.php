<?php
// Always handle the request here: never let the development server expose the repo.
$root = dirname(__DIR__);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
header('X-Content-Type-Options: nosniff');

if ($path === '/api.php') {
    require __DIR__ . '/api.php';
    return;
}

$files = [
    '/' => ['index.html', 'text/html; charset=utf-8'],
    '/index.html' => ['index.html', 'text/html; charset=utf-8'],
    '/app.js' => ['app.js', 'text/javascript; charset=utf-8'],
    '/styles.css' => ['styles.css', 'text/css; charset=utf-8'],
    '/tailwind.config.js' => ['tailwind.config.js', 'text/javascript; charset=utf-8'],
    '/data/catalog.json' => ['data/catalog.json', 'application/json; charset=utf-8'],
];

if (!isset($files[$path])) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Not found"}';
    return;
}
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Method not allowed"}';
    return;
}

[$file, $type] = $files[$path];
$bytes = @file_get_contents($root . '/' . $file);
if ($bytes === false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Unable to read application file"}';
    return;
}
header('Content-Type: ' . $type);
header('Content-Length: ' . strlen($bytes));
if ($method !== 'HEAD') {
    echo $bytes;
}
