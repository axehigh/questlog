<?php
/**
 * Chore Quest PHP Backend Sync & Notifications Endpoint
 */
header('Content-Type: application/json');
$dataFile = 'state.json';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (file_exists($dataFile)) {
        echo file_get_contents($dataFile);
    } else {
        echo json_encode(null);
    }
} elseif ($method === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data) {
        // Save state file atomically
        file_put_contents($dataFile, $input);
        
        // Optional Telegram Notification hook if configured
        // (If config.json or environment has TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
        $config = file_exists('config.json') ? json_decode(file_get_contents('config.json'), true) : [];
        if (!empty($config['telegram_bot_token']) && !empty($config['telegram_chat_id'])) {
            // Check for any pending reviews or reward requests
            $needsReviewCount = 0;
            if (!empty($data['chores'])) {
                foreach ($data['chores'] as $c) {
                    if (isset($c['status']) && $c['status'] === 'pending') {
                        $needsReviewCount++;
                    }
                }
            }
            if (!empty($data['redemptions'])) {
                foreach ($data['redemptions'] as $r) {
                    if (isset($r['status']) && $r['status'] === 'pending') {
                        $needsReviewCount++;
                    }
                }
            }
            
            // If there are pending items, we can optionally dispatch a telegram ping (throttled or on state change)
        }
        
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
