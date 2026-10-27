# Chore Quest

A family chore-and-reward app: children complete chores, earn lifetime XP and
spend Coins on parent-agreed rewards. One PHP service stores the shared family
state for all devices.

## Quick start

Requires PHP on your PATH and npm to run the shortcut below. No dependency
installation or build step is needed. CDN scripts and Google Fonts need internet.

From the repository root:

```sh
npm run dev
```

Open <http://127.0.0.1:8000/>. Stop with Ctrl+C. To use another port:

```sh
PORT=8001 npm run dev
```

Then open <http://127.0.0.1:8001/>. Keep this development server loopback-only.
Use the supplied PHP router. PHP needs write access to `state/`.

## Using the app

- Choose a player on every fresh load, or choose **Parent** to open Admin.
  Enter that player's PIN on entry and every switch (even the current player).
  The default Parent PIN is **1396 only for fresh/reset families**; deploying updates
  does not change an existing family's saved PIN.
- In **My chores → Today**, do the work and tap **I did it**. Small optional
  personal tasks are available through **Choose an extra chore**; other work
  needs a parent assignment. Coins buy rewards; XP is never spent.
- Parents manage players, deploy catalog templates, review work and fulfill or
  decline/refund reward requests. Switching children locks parent controls.
  Requests are in-app only: no email, WhatsApp or push notifications are sent.

See the [app and storage guide](resources/docs/user-guide.md) for recurring
chores, reading bonuses, penalties, archive/restore and reward rules.

## Server PIN configuration

Copy `.env.example` to ignored `.env` only if you do not already have one; otherwise
add the runtime keys without replacing existing deployment settings. PHP reads
literal, unquoted `KEY=value` lines (no shell expansion); process environment
variables override `.env`, including empty values. Keep each runtime key unique.

- `APP_ENV=production` (also the safe behavior when absent): prompt for both PINs.
  **Only exact `APP_ENV=development` skips both parent and player prompts**, including
  Parent entry from the chooser and Ask parent handoffs. Use only for local development.
  Reload open pages after changing settings.
- `PLAYER_PINS={}`: privately fill this JSON object with stable player IDs as keys
  and four-digit PIN **strings** as values. First-run IDs are `k1` (Alex) and `k2`
  (Chris). For a new/renamed player, tap their profile: the PIN dialog displays
  their stable ID. A parent/server operator adds that ID and its chosen PIN to
  the private server configuration. There is no default player PIN, and an
  unconfigured player cannot enter outside development mode. Never put real PINs
  in examples, source, family snapshots or uploaded client assets.

Only the development bypass boolean is sent to the browser; player PIN checks
run on the server. Configuration/request failures do not unlock profiles.
This does not change saved Parent PINs, profiles, balances or history.

## Shared storage, safety and reset

- All devices using the same PHP service share one family. There is no offline
  saving or browser-only fallback. Conflicting writes, failed requests or invalid
  data block use and ask for a reload; an error does not prove a write failed.
- Parent and player PINs are casual shared-device UI safeguards, **not authentication**. The storage API
  does not enforce it. Public hosting requires HTTPS and whole-site password
  protection, including API/assets; anyone with that access can read, replace or
  reset the family. It is not secure parent/child authorization.
- **Prototype data is disposable.** In Parent Admin, **Reset prototype data**
  requires an irreversible-loss warning and typing `RESET`. It resets all saved
  family data and the PIN for **every device** on that PHP service, then reloads
  current catalog defaults (Alex/Chris, PIN 1396). No backup/export is required;
  reset is irreversible in the UI. See [reset details](resources/docs/user-guide.md#resetting-the-prototype).

## More information

- [Safe hosting and one.com SFTP deployment](resources/docs/deployment.md) —
  prerequisites, authentication, secrets, uploads and verification.
- [App and storage guide](resources/docs/user-guide.md) — everyday behavior and
  shared-save/reset caveats.
- [Contributor instructions](AGENTS.md) — implementation and prototype validation
  policies. Tests/reviews are opt-in; `npm test` is a failing placeholder.
