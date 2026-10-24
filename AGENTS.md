# Chore Quest

- Static single-page app: `index.html` markup, `styles.css` custom styles,
  `tailwind.config.js` browser Tailwind theme, `app.js` classic-script state,
  rendering and handlers. No framework, installed dependencies or build step.
- Preserve CDN order: Tailwind, Lucide, canvas-confetti, Tailwind config; custom
  CSS follows. Keep `app.js` at the end of the body and initialization in
  `window.onload`; inline handlers require globally accessible functions.
- `index.js` is an unrelated package placeholder. Do not add a build pipeline.
- Run with `python3 -m http.server 8000`, open `http://localhost:8000`.
  Fetching the JSON requires HTTP; CDNs/Google Fonts need internet access.
- Prototype instructions: do not run/add tests, generate reviews, stage, commit
  or push unless the user explicitly requests that work. Syntax-only commands
  are `node --check app.js` and `node --check tailwind.config.js`. The existing
  scripts reflect older rules and are not current acceptance coverage;
  `npm test` is a deliberately failing placeholder. Browser smoke checks, when
  requested, should cover player switching, tabs, Parent PIN (1234), template
  deployment, scheduled training, daily/weekly rollover, reading exclusivity,
  late review, weekly bonus and redemption fulfillment/refund.

## Catalog and runtime rules

- `catalog.json` owns source profiles, all 17 task templates and reward prices.
  Use unique alphanumeric/hyphen/underscore IDs and whole nonnegative amounts;
  reward cost is positive and tier is 1/2/3 (Micro/Mid/Major). Invalid source or
  saved data blocks startup without clearing/replacing storage.
- Alex/Chris are first-run players only. More players can be added with zero XP;
  no default tasks are automatically added to an existing or new extra profile.
- Every fresh load starts at explicit profile choice (no saved/default selection).
  Empty families show parent setup, not a placeholder child. Child switching,
  including tapping the current child, locks parent controls, closes dialogs and
  returns to Today. Adding/archiving/restoring a profile never silently selects
  another. Parent is a prominent entry choice: PIN opens Admin with no child
  selected. Exit Admin returns to the selected child or, with none, the chooser.
  Parent-only rename keeps profile IDs/balances/history; never rewrite saved
  names to match the first-run Alex/Chris defaults.
- Players are archived/restored only by an unlocked parent, never deleted.
  Archive confirmation names the player and explains that no data is removed.
  Archived players remain in Admin but not child choosers or assignment targets.
  Skip their chores in rollover, required-day registration and bonus queuing;
  block their chore submissions, earnings, misses, spending and manual adjustments.
  Preserve chores, balances, ledgers and requests. Parents may still settle or
  refund existing redemption requests. On restore, outdated recurring instances
  become history (pending reviews retain dates) and resume in the current period
  without catch-up losses/awards; past active scheduled sessions expire free.
  Same-period work retains its state, preventing repeat awards. Shared conflicts
  still block payout until resolved. Archiving the last active player is allowed:
  Parent entry always provides an add/restore path, including after reload.
- Today groups required, assigned optional, scheduled and pending chores. History
  is secondary. Children may explicitly choose small optional personal catalog
  templates only (not mandatory, scheduled, bonus or parent-reviewed/high-value).
  Daily/weekly choices repeat until parent deletion; one award per period.
  On-demand personal choices are limited to one choice/completion day and no
  outstanding active/pending duplicate. Reading exclusivity remains in force.
  Ask parent is an in-person PIN handoff, not a stored request: after unlock it
  opens the chosen template/child in Admin for deliberate deployment. Cancelling
  or switching child clears this handoff. Shared ownership is never self-claimed.
- Templates have `points` (lifetime XP), `coins`, nominal `penalty`, `cadence`
  (daily/weekly/on-demand), `ownership` (personal/shared), `mandatory`,
  `requiresReview`, title and emoji. `seed` enables first-run daily deployment;
  shared seeds have one `defaultOwner`. Training is on-demand with `scheduled`
  and a parent-chosen date. Weekly periods run Monday–Sunday in local time.
- First run seeds only daily pet/household/tidying tasks and optional reading.
  Personal tasks are per player; shared tasks have ONE named owner, never an
  `all` fanout. Alex gets cat/table; Chris gets dishwasher/trash. Baseline Coins
  are 80/95 per day, plus optional reading or extra work. Shared weekly vacuuming and
  shared cooking/training require explicit parent template deployment; small
  personal optional choices can be selected by the child.
- Parent Admin deploys source templates individually for existing families too.
  Shared jobs cannot be duplicated across players for a period or while pending.
  Daily/weekly deployments repeat for the chosen owner until deleted; no
  automatic owner rotation. Delete an unsubmitted assignment before reassigning.
  Custom tasks target one player; catalog task names must use template deployment.
- Recognizable shared duplicates in older saves are preserved but block payout
  until a parent removes duplicate unsubmitted assignments and chooses one owner.
  An existing completion blocks another payout for that daily/weekly period.
- Existing saved collections (including empty lists and deletions) always win.
  Editing JSON does not reprice or replace task/reward snapshots. Parent reward
  import adds missing defaults only after confirmation and can deliberately
  restore deleted defaults. It does not alter existing prices or requests.
- At least 75 XP OR 75 Coins always requires parent review; the reading bonus
  always does too. Small tasks can complete instantly unless explicitly reviewed.
  Custom form ranges: XP 1–1000, Coins 0–1000, nominal penalty 0–1000. Nominal
  penalty may exceed half the award; the runtime bounds actual deductions.
- There are no ranks, badges, progression bars or multipliers. Lifetime XP only
  increases on task completion; misses, spending, refunds and manual Coin
  adjustments never reduce it. Coins alone buy rewards.
- A miss deducts the minimum of balance, nominal penalty, half the task's Coin
  award (floor), and original-day earned Coins minus previous penalties. No flat
  5-Coin cap. Zero-earning days do not raid savings. The UI distinguishes nominal,
  maximum potential and actual loss. Direct parent +/-5 Coins is an override.
- Local midnight expires/repeats dailies; Monday starts new weekly instances,
  on opening/focus/minute refresh. Only mandatory daily expiry auto-fails with a
  bounded penalty. Optional daily/weekly expiry costs nothing. Expired records,
  completed/missed instances and original-date pending reviews remain in history.
  No automatic pruning. Parents can explicitly mark submitted/active work missed.
- `exclusiveGroup: reading` permits one 15 OR 30 minute award per player/local
  day; pending submissions reserve the choice. `readingDays` retains approved
  dates even if an assignment is deleted. Five distinct dates in one Mon–Sun
  week queue the catalog's `bonus: reading` template (250 XP/Coins) for parent
  confirmation. Late approval counts in the original week. `readingBonuses`
  retains pending/completed/declined decisions per week; no second claim after
  rollover or rejection, and bonus requests cannot be deleted/redeployed.
- A streak day needs a completion and all its mandatory dailies completed.
  Pending reviews qualify only after approval on the original day. Mandatory
  misses and skipped calendar days break continuity. Streak is feedback only.
- Defaults target Micro 50–150, Mid 350–750, Major 2500–5000 Coins for roughly
  80–200/day. Paid currency, cash, gear and funded outings are opt-in parent-added
  rewards, not seeded promises. All real-world costs/scope need parent agreement.
- Redemption immediately reserves the saved catalog price; pending duplicate
  player/reward requests are blocked. Only an unlocked parent fulfills or
  declines/refunds, once. Requests retain price/title after reward deletion or
  import. A minor chore pass is fulfilled manually by deleting the agreed task,
  granting no XP. PIN 1234 is shared-device convenience, not authentication;
  dates, source and browser storage can be manipulated.

## Saved-data compatibility

- Preserve `chore_quest_gamer_data`. Schema 2 retains XP, Coins, dated day
  ledgers, chores/rewards, PIN and redemption history with additive template,
  cadence and reading fields. Preserve unknown top-level saved fields too.
- Legacy `points` copies equally into XP and Coins; spending history cannot be
  reconstructed. Preserve original fields/profiles/catalogs; legacy chores are
  one-time reviewed unless existing flags say otherwise, Coin award is
  `ceil(points / 5)` (minimum 1), and existing nominal penalty is retained.
  Saved reward prices stay unchanged; absent tiers become 1. Undated legacy
  streaks reset because their dates cannot be verified.
- Before first legacy rewrite, retain the exact old JSON once at
  `chore_quest_gamer_data_legacy_backup`. Never clear storage to recover from an
  error. Export/back up before repairing data or deliberately reseeding.
- There is no backend: `catalog.json` is static source/default data and cannot
  be written by the app. Saved browser snapshots always take precedence.
  Prototype-only exception to retaining storage: unlocked Parent Admin may
  deliberately use **Reset prototype data**, after an irreversible all-data
  warning and typing `RESET`. Remove ONLY `chore_quest_gamer_data` and
  `chore_quest_gamer_data_legacy_backup`, then reload from current catalog defaults
  (Alex/Chris, PIN 1234). Never use localStorage.clear(). Report storage failures
  honestly, including possible partial removal; never claim reset succeeded then.
