# Chore Quest

A static browser app. No installation or build step is required.

## GitHub Pages

The site is ready for project Pages: `index.html` is at the repository root,
and local scripts and styles use relative paths, so they work under `/questlog/`.

1. Commit the site files and publish them to the branch you want to deploy
   (currently `master`).
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select that branch and **/ (root)**, then **Save**.
5. After deployment completes, open <https://axehigh.github.io/questlog/>.

No custom GitHub Actions workflow or build command is needed. Later commits to
the selected branch automatically update the site. CDN scripts and Google Fonts
require internet access. Game data stays in that browser's localStorage; it is
not synced between devices or copied from localhost to the published site.

## Prototype catalog and economy

`catalog.json` contains the exact 17 source task names/face values, starter
profiles **Alex and Chris**, and configurable reward prices. Existing families
keep their players, balances, customized collections (even empty lists), history
and pending reward price snapshots. Editing this file never replaces saved data.

- **Lifetime XP** is nonspendable and never reduced. **Coins** buy rewards. No
  ranks, rank bars/badges, rank bonuses or compounding multipliers remain.
- First use seeds daily personal tidying and optional 15/30-minute reading,
  plus single-owner household jobs: Alex handles cat care/table; Chris handles
  dishwasher/trash. Baseline earnings are 80/95 Coins/day, plus optional reading
  and extras. More players are supported; deploy personal templates for them.
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
  periods are local Monday–Sunday. Cooking is deployed once per actual job;
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

Storage stays at `chore_quest_gamer_data` (schema 2 with additive metadata).
Legacy points copy equally into XP and Coins to avoid losing either balance;
the exact original is retained once in
`chore_quest_gamer_data_legacy_backup`. No silent reset or automatic catalog
re-addition occurs. Invalid source/saved data blocks startup: back up/export
storage before repairing, never clear it as error recovery. This is a local
shared-device prototype, not secure authentication: PIN, dates and storage can
be manipulated. There is no sync or server-side verification.

## Local prototype use

From the repository root:

```sh
node --check app.js
node --check tailwind.config.js
python3 -m http.server 8000
```

Open <http://localhost:8000/>. Syntax checks are not browser testing. Tests and
reviews are intentionally not run/added during this prototype iteration;
existing logic scripts target older rules and need updating before later use.
`npm test` is only a failing placeholder. When manual smoke is requested, check
player switching, tabs, forms, template assignment, scheduled dates, local
daily/weekly rollover, reading exclusivity/late review/bonus, and reward requests.
