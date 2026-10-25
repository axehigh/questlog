# Chore Quest

A single-page browser app with local PHP storage. No dependency installation or
build step is required. PHP is required to run it.

## Hosting and storage

Run `npm run dev` and open <http://127.0.0.1:8000/>. GitHub Pages and other
static-only servers cannot run the app's PHP API. CDN scripts and Google Fonts
require internet access.

- `index.html`, `app.js`, `styles.css` and `tailwind.config.js` are the frontend.
- `data/catalog.json` supplies starter profiles, task templates and reward prices.
- Virtual `/api.php` is handled by `server/api.php`; `state/state.json` stores the
  full schema-2 family snapshot. The frontend never writes the source catalog.
- `server/router.php` allows only the frontend assets, catalog and API routes;
  server code and saved state are not served as static files. Use this router,
  not an unrestricted document-root server.

All devices using the same PHP service share one family. Startup reads the server;
an empty server is seeded from the catalog and saved before the app becomes ready.
Actions queue full snapshots in order, using the previous server ETag as `If-Match`.
Focus/minute refresh reads server changes only when no local writes are pending,
without changing a still-active selected player. Daily/weekly rollover still runs.
Concurrent edits may be rejected rather than merged: a stale write (409), failed
request or invalid saved data blocks use and asks for a reload. A failed response
does not prove a write failed on the server. There is no browser-only fallback,
automatic conflict recovery or offline saving. Old localStorage data is ignored,
not migrated or backed up by the client.

**Prototype mode:** current data is disposable. Preservation, migration and recovery
are not requirements at this stage; reset/reseed deliberately when needed. Existing
backend reset backups are implementation safeguards, not a client recovery workflow.

## Prototype catalog and economy

### Start here

1. Each time the page loads, choose **Alex**, **Chris** or **Parent** (saved
   families keep their actual names). Parent enters PIN **1234** by default and
   opens Admin without a child selected. Parent can add a player or restore an
   archived one, then exit Admin to the chooser. Saved names are authoritative;
   use Parent → Manage Players → **Rename** to change an old name without losing
   its balances/history. No player is silently renamed or selected.
2. **My chores → Today** shows required work first, then optional chores already
   assigned to you, scheduled sessions and anything waiting for a parent check.
   Do the work, then tap **I did it**. Coins buy rewards; lifetime XP is a permanent
   record, not spending money. Past chores are under the secondary history menu.
3. **Choose an extra chore** shows the source catalog with clear availability.
   Small optional personal tasks (own-room vacuuming, simple meal prep, reading)
   can be chosen directly. Daily/weekly choices repeat until a parent removes
   them, at most once per period. Personal on-demand choices allow one per local
   day (including a completion that day), with no previous active/pending job.
   Meal prep assumes a parent has already agreed it is safe for that child;
   the prototype has no age or kitchen-safety profile settings.
4. **Ask parent to assign** is an in-person handoff: enter Parent PIN, check the
   preselected template and child in Admin, and deliberately deploy it. It does
   not pay anything or create a stored request. Shared jobs, mandatory chores,
   training and high-value/reviewed work cannot be self-assigned. Someone else’s
   job is labelled with its owner, never offered for claiming.
5. Parents unlock into Admin. Review is explicitly scoped to the selected child;
   reward requests show all children. Switching profiles always locks Admin,
   closes dialogs and returns to the new child’s Today. Reenter the PIN to review.
   Active child choices remain available in Parent Admin too. **Exit Admin** locks
   controls and returns to the selected child, or to the chooser if none is selected.

### Keep players safely: archive and restore

In unlocked Parent Admin, **Archive…** asks for deliberate confirmation naming
the player. It does not delete any data: XP, Coins, chores, ledgers, reading
records and redemption history remain. Archived players disappear from the
child chooser and assignment targets; their chores do not recur, auto-miss,
earn or incur penalties, and they cannot submit work or spend Coins. Parents
can still fulfill or decline/refund existing reward requests in Rewards.

**Restore** is explicit in Manage Players and selects no child automatically.
Same-day/week work keeps its existing state. When a recurring period has passed,
the old instance stays in history (unsubmitted work expires free; pending reviews
retain original dates), and daily/weekly work resumes in the current period.
There are no backfilled awards or catch-up penalties for archived time. Past
scheduled sessions expire free; unscheduled one-off work remains available.
Shared assignments restored alongside another owner's job still cannot pay
twice; resolve conflicts before approval. Archive does not erase earlier misses
or manufacture streak days. Even if every player is archived, **Parent** remains
on the entry screen so a parent can restore or add someone.

Choosing is explicit: saved deletions and empty collections are not automatically
restored. Choosing a catalog task adds only that task and never reprices an
existing assignment. Use **Rewards** to request a reward with available Coins.

`data/catalog.json` contains the exact 19 source task names/face values, starter
profiles **Alex and Chris**, and configurable reward prices. Existing families
keep their players, balances, customized collections (even empty lists), history
and pending reward price snapshots. Editing this file never replaces saved data.
This JSON file is static defaults, not the writable family snapshot. Saved
collections (including empty lists and deletions) win over these defaults.

- **Lifetime XP** is nonspendable and never reduced. **Coins** buy rewards. No
  ranks, rank bars/badges, rank bonuses or compounding multipliers remain.
- First use seeds daily personal tidying and optional 15/30-minute reading,
  plus single-owner household jobs: Alex handles cat care/table; Chris handles
  dishwasher/trash. Baseline earnings are 80/95 Coins/day, plus optional reading
  and extras. More players are supported; parents deploy required tasks, while
  children can explicitly choose small optional personal templates.
- Unlock Parent PIN (`1234`), open Admin, select a **Source Catalog** template
  and **one target player**, then Deploy. This works for existing installations
  without resetting anything. Shared tasks pay only one player per job/period;
  duplicate deployments are blocked. To move an unsubmitted shared job, delete
  its old assignment before redeploying. Owners do not rotate automatically.
  Recognizable shared duplicates from older saves are retained, but cannot pay
  twice: a parent must delete duplicate unsubmitted assignments to choose one
  owner; an already completed job blocks another payout for that period.
- Pet care/tidying/household jobs recur daily. Own-room vacuuming is weekly per
  player; each shared vacuum area must be explicitly assigned weekly. Weekly
  periods are local Monday–Sunday. Shared cooking is deployed once per actual job;
  training is a single parent-scheduled session, never a mandatory daily.
- Choose **15 OR 30 minutes** of reading per player/local day, not both.
  A pending submission reserves the choice. Five distinct completed/approved
  reading dates within one Mon–Sun week queue **250 XP + 250 Coins** for parent
  confirmation in Review. Late approvals count in the original week. Persistent
  reading-day and weekly-decision records prevent repeat payouts; a rejected
  bonus is final for that week. Reading expiry is optional and costs nothing.
- Tasks at **75 XP or 75 Coins** and above always require parent review; smaller
  tasks normally pay instantly unless explicitly configured for review. The
  weekly bonus always requires confirmation. Existing saved review flags remain.
- Source penalties are **nominal**, not guaranteed deductions. Actual loss is
  the minimum of nominal penalty, half the task's Coin award (rounded down),
  available balance, and **the original local day's earnings minus earlier
  penalties**. There is no flat 5-Coin cap or savings raid on zero-earning days.
  The card shows nominal/max potential loss; Missed shows actual loss. Only
  mandatory daily expiry auto-penalizes; optional/weekly expiry is free.
  Parents may explicitly mark work missed; direct +/-5 Coin adjustments are an
  intentional override. XP is never affected.
- Daily/weekly instances roll over on open, focus or minute refresh. Dated
  history, expired records and pending reviews are retained. Streak is only
  feedback: complete an activity and all mandatory dailies to qualify that day;
  a mandatory miss or skipped day breaks continuity. No payout multiplier.
- Suggested reward bands for roughly 80–200 Coins/day: **Micro 50–150**, **Mid
  350–750**, **Major 2500–5000**. Default perks cost 50–100 / 500–750 / 3000.
  The major default is a parent-agreed family-day plan, not promised funding.
  Cash, paid digital currency, gear and funded outings must be opted into,
  priced and agreed by a parent using Add Loot Reward; no money exchange rate
  is guaranteed. Source rewards can be explicitly imported via **Add missing
  default rewards** (confirmation required). This may restore deleted defaults,
  but never changes existing prices or custom rewards.
- Reward requests reserve Coins immediately. Only a parent can fulfill or
  decline/refund, once; requests retain their quoted price/title even if the
  reward is removed. A minor chore pass is manually applied by deleting the
  agreed minor task, without XP.

Invalid source/saved data blocks startup instead of silently replacing it. The
client validates chore-domain data; the server validates the snapshot envelope,
not whether a child really completed a chore. This is a local shared-device
prototype, not secure authentication: the PIN, dates, code and saved state can be
manipulated. The API does not authenticate callers or enforce the Parent PIN.

### Deliberately restart the prototype

Choose **Parent**, enter the saved PIN, then in Admin use **Reset prototype data**.
Read the irreversible-loss warning and type exactly **RESET**; Cancel or anything
else changes nothing. This resets **all** Chore Quest server-saved profiles
(active and archived), XP/Coins, chores, custom catalog/reward copies, history,
requests and saved PIN for **all devices using this PHP service**, not just this
browser. The client waits for queued writes, then sends `DELETE /api.php` with
the latest `If-Match`. On confirmation the page reloads and seeds the current
`data/catalog.json`: **Alex/Chris**, current tasks/reward defaults and PIN **1234**.
It does not change source JSON or remove old browser storage. Reset is deliberately
irreversible in the UI; no backup/export step is required for disposable data.
The backend currently keeps a private pre-reset copy under `state/backups/`.
On failure or an uncertain response, the app blocks and reports that reset was
not confirmed (server data may already have been removed); it never claims success.

## Local prototype use

From the repository root:

```sh
node --check app.js
node --check tailwind.config.js
npm run dev
```

Open <http://127.0.0.1:8000/>. The dev script uses PHP's built-in server and
requires `php` on PATH (the installed user-local PHP works); no `npm install`
or build is needed. Stop it with Ctrl+C. Use this instead of Python's static
server, which does not execute PHP and can expose PHP source.

If port 8000 is already in use, run `PORT=8001 npm run dev` and open
<http://127.0.0.1:8001/> instead.

The PHP router serves the frontend and its API together. PHP needs write access
to `state/`; snapshots are limited to 2 MiB and oversize saves are rejected, not
truncated. Runtime state and backups are private local files, not source defaults.
Keep this loopback-only server for local development; do not expose it publicly.
File routing and ETag checks prevent accidental exposure/overwrites, not unauthorized
API use. Never put credentials in frontend files, the catalog, requests or commits.
There is no notification integration: no WhatsApp/email/push is sent for chore or
reward requests, and no notification credentials/configuration are needed.

Syntax checks are not browser testing. Tests and
reviews are intentionally not run/added during this prototype iteration;
existing logic scripts target older rules and need updating before later use.
`npm test` is only a failing placeholder. When manual smoke is requested, check
player switching, tabs, forms, template assignment, scheduled dates, local
daily/weekly rollover, reading exclusivity/late review/bonus, and reward requests.
