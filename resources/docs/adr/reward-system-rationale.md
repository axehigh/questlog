You are hitting on a core principle in behavioral psychology called **Loss Aversion** (pioneered by psychologists Daniel Kahneman and Amos Tversky).

Loss aversion demonstrates that **the pain of losing something is psychologically roughly twice as powerful as the pleasure of gaining the equivalent thing.** Losing $20 hurts significantly more than finding $20 feels good.

When applying this to a 14-year-old and chore systems, there are distinct psychological dynamics to weigh—especially with points, punishments, and rewards.

---

### Why Docking Points Feels So Harsh (Loss Aversion)

* **The Urgency Factor:** Loss aversion creates an immediate reaction. If a teen knows that skipping a task results in a loss of banked points, they feel a threat to something they already "own." This creates stronger immediate motivation to prevent the loss than a potential future reward creates to achieve a gain.
* **The Demotivation Trap (The Danger):** If a child works hard for days to build a balance of 500 points, and then gets docked 300 points for a bad day, they feel a heavy sense of **sunk-cost frustration**. When the score resets or drops drastically, the reaction is often *"Why even try? You're just going to take them away anyway."*
* **The Solution:** Docking works best when it targets **current daily gains or streak multipliers**, rather than wiping out saved, long-term wealth. For example, failing a task forfeits that day's potential points or breaks a bonus streak, rather than raiding their saved "bank account."

---

### What Makes a "Good" Reward System for 14-Year-Olds?

At 14, standard rewards like "gold stars" or abstract praise don't work. Effective incentives for this age group rely on three main pillars:

1. **Autonomy & Agency:** Giving them control over their time or choices (e.g., controlling weekend schedules or choosing meals).
2. **Immediate Gratification vs. Big Goals:** A mix of low-cost, quick redemptions (redeemable daily) and high-cost "bucket list" items (saved up over weeks).
3. **Low-Threshold Currency:** Points need to feel easy to earn and clear to spend, without feeling like an endless grind.

---

### Menu of Effective Rewards for 14-Year-Old Boys

Here is a structured list of rewards categorized by what actually drives motivation at that age:

#### Tier 1: Micro-Rewards (Short-Term / Quick Redemptions)

* **Screen Time Extensions:** +30 or +60 minutes of gaming time on Friday/Saturday night.
* **Chore Pass / Skip Card:** Skip one minor daily chore (e.g., take out trash) with no penalty.
* **Bedtime Buffer:** +30 minutes past standard bedtime on a weekend night.
* **Control the Aux Cord / Music:** Choose the playlist for the next family car ride.

#### Tier 2: Mid-Tier Rewards (Weekly / Moderate Effort)

* **Custom Meal / Takeout Choice:** Pick the Friday night dinner or choose the family takeout restaurant.
* **In-Game Currency / Cosmetic Allowance:** A small digital card/allowance (e.g., Roblox Robux, Valorant Points, or a Minecraft skin pack).
* **Friends Over / Gaming Session:** Host a uninterrupted gaming session or sleepover with friends without extra chore interruptions.

#### Tier 3: High-Tier "Boss" Rewards (Long-Term Savings / Major Effort)

* **Gear & Upgrades:** Gaming equipment upgrades (headset, mousepad, controller, or custom keyboard caps).
* **Outing with Friends:** Funded trip to the movies, bowling, trampoline park, or arcade with a friend.
* **Cash-Out Option:** Converting a large chunk of points directly into spending money for personal items.

---

## Agreed prototype decision — 24 October 2026

The text above is retained as the original rationale; the following decisions supersede its suggestions about spendable points and streak multipliers.

- Start with **Alex and Chris**; Parent Admin can add more players. Existing family profiles are never renamed or replaced.
- Remove ranks, rank badges and progress bars entirely. **Lifetime XP is nonspendable and never reduced**; Coins are the spendable balance. No bonus is tied to rank and there is no compounding/streak multiplier. The day streak is feedback only.
- Keep all 17 task names and face awards from `resources/docs/data/task-catalog-data.md` in `catalog.json`. Preserve numeric nominal penalties (20/25/30/50); optional reading, cooking and bonus tasks use zero. Applied penalties are the minimum of the nominal amount, half the task's Coin award (rounded down), available Coins, and the **original local day's earnings minus prior penalties**. There is no flat 5-Coin cap; optional expiries never incur a loss, and zero-earning days never raid savings. Parent Coin adjustments are an explicit override, never an XP deduction.
- Pet care and tidying recur daily. Personal tidying is per player; shared daily jobs have one owner: Alex starts with cat care/table, Chris with dishwasher/trash. This gives 80/95 baseline Coins per day before optional reading or extra tasks. Own-room vacuuming is weekly per player; stairs/gaming room/TV room vacuuming is weekly and explicitly assigned to one player. Cooking is on-demand per job. Training is a parent-scheduled single session, not a mandatory daily.
- Choose **15 OR 30 minutes of reading per local day**, not both. Five distinct completed/approved reading days within a **Monday–Sunday** week queue the **250 XP / 250 Coins** bonus for parent confirmation, once per player per week. Pending reading reserves that day's choice; late approval counts on its original date. A durable reading-day/week ledger prevents duplicate payouts across rollover or late review; rejected weekly bonuses are final for that week.
- Tiny tasks normally complete instantly; **at least 75 XP or 75 Coins** always needs parent review, as does the weekly bonus. Parents can explicitly request review for smaller custom tasks. Catalog snapshots preserve existing review settings and prices.
- Seed only recurring daily tasks on first use (including optional reading choices). Parent Admin deploys individual templates for existing families and other cadences, always choosing a target. Shared jobs cannot be deployed twice for the same period. Recurring assignments retain their owner; reassignment is an explicit parent action, not automatic rotation. Existing catalogs, empty/deleted lists, history, balances and redemption price snapshots remain authoritative; missing defaults return only on explicit parent import/deployment.
- Price default perks for roughly **80–200 Coins/day**: Micro 50–150, Mid 350–750, Major 2500–5000. Current defaults are 50–100 / 500–750 / 3000 Coins. Major default is a parent-agreed family-day plan, not promised funding. Cash, paid digital currency, gear and funded outings are **opt-in rewards added/priced by the parent**, with no guaranteed exchange rate. All requests reserve Coins and require parent fulfillment or decline/refund.
- Keep the static, classic-script app and existing storage key/schema-2 data, with additive cadence/template/reading metadata. Legacy points still migrate equally into XP and Coins with an exact pre-migration backup. No automatic catalog replacement, ledger reset, or history pruning.
