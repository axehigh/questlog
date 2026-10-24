# Parent Notifications Design for Chore Quest

## Goal
Notify parents when children complete chores that require approval, request rewards, or submit weekly reading milestones, without complex app store submissions or paid push services.

## Simple Approaches for Notifications

### 1. Web Push API (Service Workers + VAPID)
- **How it works:** Register a simple service worker in the browser and subscribe to Web Push notifications.
- **Pros:** Native browser push notifications even when the parent's browser tab is closed.
- **Cons:** Requires setting up a small VAPID key generator and backend endpoint (like our PHP server or Firebase) to dispatch push payloads when `status` changes to `pending`.

### 2. Email Notifications (via PHP Mail or Firebase Cloud Functions)
- **How it works:** When a child submits a task requiring review or requests a reward, the backend sends a quick email to the parent (e.g. `parent@example.com`).
- **Pros:** Extremely reliable, parents check email constantly.
- **Cons:** Requires a mail server / SMTP (very easy if using PHP `mail()` on your PHP server or SendGrid/Resend).

### 3. Telegram / Discord Webhook (Super Simple & Instant!)
- **How it works:** 
  - Create a private Telegram bot (free, takes 2 minutes via BotFather) or a Discord webhook channel.
  - When a child submits work, the app (or backend) fires a simple webhook request: `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>&text=Alex+completed+Bake+Bread!+Needs+approval.`
- **Pros:** **Zero server cost, instant phone push notifications** via Telegram/Discord app, extremely easy to code with a single `fetch()` call.
- **Cons:** Requires creating a bot token (one-time parent setup).

---

## Recommended "Nice-to-Have" Approach: **Telegram / Discord Webhook**
For a prototype or family app, a Telegram bot webhook requires **no mail servers, no complex push service worker certificates, and instantly pings the parent's phone** whenever approval is needed.
