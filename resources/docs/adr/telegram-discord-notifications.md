# Telegram & Discord Notification Architecture for Chore Quest

## Overview
Telegram and Discord both provide robust, free, and instant bot/webhook APIs that can alert parents the exact moment a child submits a chore for review or requests a reward.

---

## Option 1: Telegram Bot (Recommended for Mobile Push)
Telegram is ideal because parents receive instant push notifications on their phones via the Telegram app.

### Setup (One-time, 2 minutes):
1. Message `@BotFather` on Telegram to create a new bot (e.g., `ChoreQuestBot`). You'll receive a **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
2. Get your personal **Chat ID** (by messaging `@userinfobot` or using `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. Store the Bot Token and Chat ID in app settings or your PHP backend config.

### Triggering a Notification (via JS `fetch()` or PHP):
```javascript
async function sendTelegramAlert(message) {
    const token = 'YOUR_BOT_TOKEN';
    const chatId = 'YOUR_CHAT_ID';
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;
    
    try {
        await fetch(url);
    } catch (e) {
        console.error('Failed to send Telegram alert', e);
    }
}

// Example usage when a chore requires review:
// sendTelegramAlert("🎮 Alex completed 'Bake Bread'! Open Chore Quest to approve.");
```

---

## Option 2: Discord Webhook (Recommended if family uses Discord)
If the family already uses Discord, you can create a dedicated channel (e.g., `#parent-alerts`) and post messages via a webhook URL.

### Setup (One-time, 1 minute):
1. In Discord server settings → Integrations → Webhooks, create a new webhook and copy its **Webhook URL**.

### Triggering a Notification:
```async function sendDiscordAlert(message) {
    const webhookUrl = 'YOUR_DISCORD_WEBHOOK_URL';
    
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                content: `🔔 **Chore Quest Alert**\n${message}`
            })
        });
    } catch (e) {
        console.error('Failed to send Discord alert', e);
    }
}

// Example usage:
// sendDiscordAlert("🌟 Chris requested a reward: +30 Min Weekend Gaming Extension!");
```

---

## Integration with Sync (PHP / Firebase)
- **Frontend / Client-side:** Whenever `markChoreDone()` or `claimReward()` is called for an item needing review/approval, the app can directly fire the Telegram or Discord notification.
- **Backend-side (PHP `api.php`):** Alternatively, when `api.php` receives a state update, it can check if any new `pending` chores or redemptions were added, and send the webhook server-side so it never misses an alert!
