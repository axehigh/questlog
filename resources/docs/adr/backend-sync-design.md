# Simple Backend & Sync Architecture for Chore Quest

## Goal
Enable cross-device sync between children's devices and parent devices (for approvals and Coin management) with a minimal, simple backend setup.

## Option A: Node.js / Express + SQLite (Single File Backend)
Keep the frontend as a pure static single-page app (`index.html`, `app.js`, etc.), and add a tiny Express backend service that stores the JSON state in SQLite or a local JSON file.

### Backend (`server.js`)
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname)); // Serve static app files

// Get state
app.get('/api/state', (req, res) => {
    if (!fs.existsSync(DATA_FILE)) return res.json(null);
    res.sendFile(DATA_FILE);
});

// Save state (with simple family/sync key if needed)
app.post('/api/state', (req, res) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Chore Quest sync server running on http://localhost:${PORT}`));
```

### Frontend Integration (`app.js`)
Instead of `localStorage` only (or as a wrapper), sync with `/api/state`:
- On load: `fetch('/api/state').then(r => r.json()).then(state => { if (state) mergeOrLoad(state); })`
- On change (debounced): `fetch('/api/state', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(appState) })`
- Polling / EventSource: Poll `GET /api/state` every 5–10 seconds or when the window regains focus so the parent device sees completed chores instantly.

---

## Option B: Serverless / Cloudflare Worker + KV
If hosting publicly without managing a persistent server process:
- A Cloudflare Worker handling `/api/state` with KV storage.
- Zero maintenance, free tier, accessible anywhere across cellular / Wi-Fi networks.

---

## Recommendation for Chore Quest
Since there is no build step and simplicity is key, adding a small `server.js` (Express) alongside the existing static files allows running the entire app and sync via `node server.js` instead of `python3 -m http.server 8000`.
