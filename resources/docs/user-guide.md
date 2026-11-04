# App and shared-storage guide

See the [README](../../README.md) for quick start and the
[deployment guide](deployment.md) before hosting beyond local development.

## Players and parent controls

Each page load starts at the player chooser. Fresh families have Alex and Chris;
saved families keep their names and PIN. **Parent** opens Admin without a child
selected. PIN **1396 applies only to fresh/reset families**; code updates do not
change a saved PIN. Change an existing PIN separately, not by resetting data.

Player entry requires that player's PIN. Once entered, only the current player
and **Log out** are shown, not other player choices. Log out returns to the initial
chooser before anyone can enter again, even as the same player. Wrong/canceled
PIN entry leaves the chooser unchanged. Player PINs are configured
privately by stable profile ID on the server, not in family data or the Add Player
form; see [server PIN configuration](../../README.md#server-pin-configuration).
New players need a configured PIN before entry. Explicit local development mode
skips both parent and player PIN prompts, but still requires logout before choosing
another player; these PINs are UI safeguards, not authentication.

In Admin, use **Manage Players** to add, rename, archive or restore players.
Rename keeps balances/history. Added players need deliberate task assignments.
**Log out**, also available in Admin when entered from a child, locks Admin,
closes dialogs and cancels pending PIN entry or chore handoffs without changing
saved player data. The next entry starts at Today. **Exit Admin** locks controls
and returns to the selected child, or the chooser if none is selected. Review is
scoped to the selected child; reward requests show all children.

**Archive…** asks for confirmation naming the player; it does not delete data.
Archived players disappear from child choosers/assignment targets. Their chores
do not recur, auto-miss, earn or incur penalties; they cannot submit or spend.
Parents can still fulfill or decline/refund their existing reward requests.
**Restore** selects nobody automatically. Same-day/week work keeps its state;
older recurring work becomes history and resumes in the current period without
catch-up awards or penalties. Pending reviews keep original dates; past scheduled
sessions expire free, while unscheduled one-off work remains. Shared conflicts
must be resolved before payout. Archive neither erases old misses nor creates
streak days. Parent remains available even if every player is archived.

## Chores and earnings

- **My chores → Today** groups required work, assigned optional chores, scheduled
  sessions and pending reviews. Complete the work, then tap **I did it**; past
  records are in the secondary history menu. Lifetime XP is nonspendable and
  never reduced; Coins buy rewards. There are no ranks or payout multipliers.
- **Choose an extra chore** offers small optional personal tasks, such as own-room
  vacuuming, simple meal prep and reading. Meal prep assumes prior parent agreement
  on safety; the prototype has no age/kitchen-safety settings. Daily/weekly choices
  repeat until parent removal, with at most one award per period. Personal on-demand
  choices allow one choice/completion per local day and no active/pending duplicate.
- **Ask parent to assign** is an in-person PIN handoff, not a stored request or
  payout. Admin preselects the template and child for deliberate deployment.
  Shared, mandatory, scheduled and high-value/reviewed work cannot be self-assigned;
  another player's shared job is labelled with its owner, not claimable.
- Parents deploy a **Source Catalog** template to **one target player**, including
  in existing families without a reset. Daily/weekly jobs repeat for that owner;
  owners do not rotate. Delete an unsubmitted shared assignment before reassigning.
  Shared jobs pay once per period; older duplicate assignments block payout until
  a parent removes unsubmitted duplicates. A completion blocks a second payout.
- First use seeds daily pet/household/tidying work and optional reading. Alex gets
  cat/table jobs, Chris dishwasher/trash: baseline earnings are 80/95 Coins/day,
  plus reading/extras. Fresh/reset starter profiles begin with **1000 Coins**;
  existing saves keep their balances. Own-room vacuuming is personal weekly work; shared vacuum
  areas need explicit weekly assignment. Shared cooking is per actual job;
  training is a parent-scheduled one-off, not mandatory daily work.
- Tasks worth **75 XP or 75 Coins or more** always need parent review; smaller
  tasks usually pay instantly unless explicitly reviewed. Saved review flags remain.
- Reading allows **15 OR 30 minutes per player/local day**, not both; pending
  submissions reserve that choice. Five distinct approved/completed dates within
  a local Monday–Sunday week queue **250 XP + 250 Coins** for parent confirmation.
  Late approvals count in the original week. Retained reading dates and weekly
  decisions prevent repeat claims; a rejected bonus is final for that week.
- Penalties are nominal, not guaranteed. Actual loss is the minimum of the
  player's available Coin balance, nominal penalty and half the task's Coin award
  (rounded down). No flat 5-Coin cap; losses can come from saved Coins and never
  reduce XP. Cards show nominal/max potential loss; Missed shows actual loss.
  Only mandatory daily expiry auto-penalizes; optional/weekly expiry is free.
  Parents may explicitly mark work missed; direct +/-5 Coins is an override.
  None of these deductions affects XP.
- Daily rollover is local midnight, weekly rollover Monday, checked on open,
  focus and minute refresh. History and original-date pending reviews remain.
  Streak feedback requires a completion and all mandatory dailies completed on
  that day; pending reviews count only once approved for the original day.
  Mandatory misses or skipped days break continuity; streaks do not multiply pay.

## Rewards and defaults

**Rewards** requests reserve Coins immediately. Only a parent can fulfill or
decline/refund, once; pending duplicates are blocked and requests retain quoted
title/price after reward deletion. A minor chore pass is applied manually by
deleting the agreed minor task, without XP.

Suggested reward bands for roughly 80–200 Coins/day are **Micro 50–150**, **Mid
350–750**, **Major 2500–5000**; current default perks cost 50–100 / 500–750 / 3000.
The major default is a parent-agreed family-day plan, not promised funding.
Cash, paid currency, gear and funded outings require parent opt-in, pricing and
agreement via **Add Loot Reward**; there is no guaranteed money exchange rate.

`data/catalog.json` supplies starter profiles, 19 task templates and reward prices;
it is not the writable family snapshot. Saved collections, including empty lists
and deletions, always win. Editing defaults neither replaces saved assignments
nor reprices rewards/requests. **Add missing default rewards** requires confirmation
and may restore deleted defaults, but never changes existing prices/custom rewards.

## Day review and test clock

**Day Review** in Admin shows one chosen date for every player: required tasks,
completed required work, not-done/missed/expired items, pending reviews, and the
Coins earned or lost that day. Weekly work counts on the Monday that starts its
week; other tasks count on their assigned date. Archived players are labelled.
Pick another date to review history.

**Test time travel** in Admin moves the family clock forward without waiting for
midnight. Use **+1 day**, **+7 days**, or jump to a date up to 30 days ahead per
action; repeat for longer ranges. Each step runs the real rollover, so daily work
repeats, unsubmitted mandatory work auto-fails with the current Coin penalty, and
optional/weekly expiry stays free. The simulated date is saved with family data,
so reloads and other devices stay consistent. **Use real date** is allowed only
when the simulated date is not in the future; otherwise reset prototype data to
start over. Reset clears the simulated date.

## Shared storage and failures

Virtual `/api.php` is handled by `server/api.php`; `state/state.json` stores the
full schema-2 family snapshot. All devices on the service share it. Startup reads
the server; an empty server is seeded and saved before use. The frontend never
writes the source catalog. PHP needs write access to `state/`; snapshots over
**2 MiB** are rejected, not truncated. State/backups must remain private: use the
development allowlist router or the deployment guide's Apache rules, never an
unrestricted document-root server.

Actions queue full snapshots in order using the previous ETag as `If-Match`.
Focus/minute refresh reads remote changes only with no pending local writes,
without changing a still-active selected player; daily/weekly rollover still runs.
Concurrent edits are rejected, not merged: stale writes (409), failed requests or
invalid data block use and ask for reload. A failed response does not prove the
server rejected the write. There is no automatic conflict recovery, offline
saving or browser-only fallback. Old localStorage data is ignored, not migrated
or backed up by the client.

The client validates chore-domain data; the server validates the snapshot envelope,
not whether chores were really completed. PIN, dates, source and saved state can
be manipulated; the API does not authenticate callers or enforce the Parent PIN.
Never put credentials in frontend files, catalog, requests or commits. No
notification integration or notification credentials/configuration are needed.

## Resetting the prototype

**Current prototype data is disposable**: preservation, migration and recovery are
not requirements. Existing backend safeguards are not a client recovery workflow.

Choose **Parent**, enter the saved PIN and use **Reset prototype data** in Admin.
Read the irreversible-loss warning and type exactly `RESET`; Cancel or any other
input changes nothing. This resets **all server-saved family data for every device
using this PHP service**: active/archived profiles, XP/Coins, chores, custom
catalog/reward copies, history, requests, saved PIN and any simulated test date.

The client waits for queued writes, then sends `DELETE /api.php` with the latest
`If-Match`. On confirmation it reloads and seeds current catalog defaults:
**Alex/Chris, task/reward defaults and PIN 1396**. Source JSON and old browser
storage are unchanged. Reset is irreversible in the UI; no backup/export step is
required. The backend currently keeps a private pre-reset copy in `state/backups/`.
On failure or an uncertain response, the app blocks and reports reset unconfirmed:
server data may already have been removed. It does not claim success.
