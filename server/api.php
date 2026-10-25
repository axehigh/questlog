<?php
// Local shared-device storage, not authentication. Notifications are not implemented.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
umask(0077);

function reply(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function syncDirectory(string $directory): void
{
    $handle = @fopen($directory, 'r');
    if ($handle === false) {
        throw new RuntimeException('Unable to open storage directory for sync');
    }
    try {
        if (!@fsync($handle)) {
            throw new RuntimeException('Unable to sync storage directory');
        }
    } finally {
        fclose($handle);
    }
}

function atomicWrite(string $path, string $bytes): void
{
    $temporary = @tempnam(dirname($path), '.write-');
    if ($temporary === false) {
        throw new RuntimeException('Unable to create storage temporary file');
    }
    $handle = null;
    try {
        $handle = @fopen($temporary, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Unable to open storage temporary file');
        }
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $written = @fwrite($handle, substr($bytes, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('Unable to write storage');
            }
            $offset += $written;
        }
        if (!@fflush($handle) || !@fsync($handle)) {
            throw new RuntimeException('Unable to sync storage');
        }
        $closed = @fclose($handle);
        $handle = null;
        if (!$closed || !@rename($temporary, $path)) {
            throw new RuntimeException('Unable to replace storage');
        }
        syncDirectory(dirname($path));
    } finally {
        if (is_resource($handle)) {
            fclose($handle);
        }
        if (file_exists($temporary)) {
            @unlink($temporary);
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) {
    header('Allow: GET, POST, DELETE');
    reply(405, ['error' => 'Method not allowed']);
}

if ($method === 'POST') {
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        reply(415, ['error' => 'Content-Type must be application/json']);
    }
    // Full snapshots are limited to 2 MiB; reject rather than truncate history.
    $limit = 2 * 1024 * 1024;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) {
        reply(413, ['error' => 'Snapshot exceeds the 2 MiB limit']);
    }
    $input = @file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($input === false) {
        reply(400, ['error' => 'Unable to read request body']);
    }
    if (strlen($input) > $limit) {
        reply(413, ['error' => 'Snapshot exceeds the 2 MiB limit']);
    }
    $data = json_decode($input);
    if (json_last_error() !== JSON_ERROR_NONE || !is_object($data)) {
        reply(400, ['error' => 'Snapshot must be a JSON object']);
    }
    if (($data->schemaVersion ?? null) !== 2
        || !is_string($data->parentPin ?? null)
        || !preg_match('/^[0-9]{4}$/D', $data->parentPin)) {
        reply(400, ['error' => 'Snapshot requires schemaVersion 2 and a four-digit parentPin']);
    }
    foreach (['kids', 'chores', 'rewards', 'redemptions'] as $collection) {
        if (!isset($data->$collection) || !is_array($data->$collection)) {
            reply(400, ['error' => 'Snapshot requires kids, chores, rewards and redemptions arrays']);
        }
    }
}

$directory = dirname(__DIR__) . '/state';
$path = $directory . '/state.json';
try {
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create storage directory');
    }
    // One stable lock also covers atomic replacements and resets of the state file.
    $lock = @fopen($directory . '/.lock', 'c');
    if ($lock === false || !@flock($lock, $method === 'GET' ? LOCK_SH : LOCK_EX)) {
        throw new RuntimeException('Unable to lock storage');
    }
    clearstatcache(true, $path);
    $bytes = file_exists($path) ? @file_get_contents($path) : null;
    if ($bytes === false) {
        throw new RuntimeException('Unable to read stored snapshot');
    }
    if ($bytes !== null && (!is_object(json_decode($bytes)) || json_last_error() !== JSON_ERROR_NONE)) {
        throw new RuntimeException('Stored snapshot is invalid; preserve it for recovery');
    }
    $etag = $bytes === null ? '"none"' : '"' . hash('sha256', $bytes) . '"';
    if ($method === 'GET') {
        header('ETag: ' . $etag);
        echo $bytes ?? 'null';
        exit;
    }
    if (($_SERVER['HTTP_IF_MATCH'] ?? '') !== $etag) {
        reply(409, ['error' => 'Snapshot changed or If-Match is missing; GET and reconcile before retrying']);
    }
    if ($method === 'POST') {
        atomicWrite($path, $input);
        $etag = '"' . hash('sha256', $input) . '"';
    } else {
        if ($bytes !== null) {
            $backups = $directory . '/backups';
            if (!is_dir($backups) && !@mkdir($backups, 0700) && !is_dir($backups)) {
                throw new RuntimeException('Unable to create backup directory; reset cancelled');
            }
            syncDirectory($directory);
            $backup = $backups . '/state-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.json';
            atomicWrite($backup, $bytes);
            if (!@unlink($path)) {
                throw new RuntimeException('Unable to remove snapshot; backup preserved');
            }
            syncDirectory($directory);
        }
        $etag = '"none"';
    }
    header('ETag: ' . $etag);
    reply(200, ['success' => true]);
} catch (Throwable $error) {
    // Fixed messages only: never return submitted snapshots, PINs or server paths.
    reply(500, ['error' => 'Storage operation failed; keep local data and GET before retrying. Reset backups, if created, are preserved.']);
}
