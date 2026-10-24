# Deployment & Backend Options for Cross-Device Sync

## 1. PHP Server (You already have access!)
Since you have access to a PHP server (like cPanel, shared hosting, or a VPS with PHP), this is often the **easiest and cheapest** backend option because:
- Almost all PHP hosts support JSON file writing or SQLite out of the box.
- No Node.js process manager (`pm2`, etc.) required.
- You can deploy both your static frontend AND a tiny PHP sync script to the exact same web host.

### Tiny PHP Backend (`api.php`)
```php
<?php
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
    // Basic validation that it's valid JSON
    $data = json_decode($input, true);
    if ($data) {
        file_put_contents($dataFile, $input);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
    }
}
?>
```
*Frontend integration:* Change storage sync calls to fetch/post to `api.php`.

---

## 2. Firebase (You already use it for another app!)
Since you are already familiar with Firebase, **Firebase Realtime Database** or **Firestore** is a fantastic choice:
- **Pros:** Real-time listeners! When the child taps "I did it", the parent's device updates **instantly** without polling. Generous free tier (Spark plan).
- **Cons:** Requires adding the Firebase SDK script tag and configuring rules.

### How it works with Chore Quest:
1. Include Firebase JS SDK via CDN in `index.html`.
2. Initialize Firebase with your project config.
3. Replace `localStorage` sync with:
   - `onSnapshot` / `onValue` to listen for state changes in real-time.
   - `setDoc` / `set` whenever `saveToStorage()` runs.

---

## 3. Static Hosting + Free External JSON KV API (Zero Backend)
If you want to keep hosting on simple static pages (GitHub Pages, Netlify, Vercel):
- Use a free JSON key-value store service like **JSONBlob.com**, **JSONBin.io**, or a free Cloudflare Worker.
- Every family gets a unique sync token/ID. The app syncs state via `fetch()` to that endpoint.

---

## Which one do you prefer?
1. **PHP Server** (`api.php` + JSON file on your existing host)
2. **Firebase** (Real-time sync using your existing Firebase setup)
3. **Static + Cloud KV** (JSONBlob / Cloudflare Worker, keeping hosting 100% static)
