Reviewer: Radagast-Reviewer-1 - model: github-copilot/claude-opus-5.5
Scope: Uncommitted working tree in /home/pt184/dev_olona/web/chores (`app.js`, `index.html`, `catalog.json`, `scripts/check-rewards.cjs`, `scripts/reward-edge-cases.test.cjs`). I reviewed it against issue https://github.com/axehigh/questlog/issues/1, `resources/docs/adr/reward-system-rationale.md` and `AGENTS.md`. No baseline commit was available, so I could not separate new code from older code by diff. Items marked "pre-existing" come from inherited UI code patterns. I could not run tests because shell access was denied in this session, so all findings come from reading the code.
Verdict: The reward engine works and is well guarded: XP is never reduced, misses are capped by the day's earnings, Coins are reserved once, migration fails safely, and dynamic text is escaped. I found no critical or high-severity issues. The remaining issues are a stale UI at the midnight rollover, an optional-daily penalty that conflicts with its label, completed/failed history that disappears, and a few smaller UX and hardening gaps.

## Findings

1. **ID:** R1
   **Severity:** MEDIUM
   **Title:** A quest click after midnight silently penalizes the player and leaves the old quest on screen
   **Location:** `app.js:L543-L546` (also `app.js:L574-L578`, `app.js:L141`)
   **Category:** bug
   **Evidence:** `markChoreDone` first calls `rollDailyQuests()`. That call can mark the displayed daily quest as `missed` and deduct Coins through `applyMiss`. The function then reaches `if (!chore || chore.status !== 'active' ...) return;` and returns without calling `renderApp()` or `showToast`. Rendering only happens on window focus or on the 60-second `setInterval(renderApp, 60000)`. Repro: open the app at 23:59 with an unsubmitted daily quest, wait until 00:00:10, and click "Complete". Nothing visible happens, Coins drop, and the old card stays on screen for up to 60 seconds. `failChore` follows the same path.
   **Why it matters:** A teen sees a tap that does nothing and then loses Coins with no explanation. That is the kind of unexplained loss the ADR warns about.
   **Recommended fix:** If the roll changed state or the chore is no longer actionable, re-render and explain it. For example, at the start of `markChoreDone`:
   ```js
   rollDailyQuests();
   const chore = appState.chores.find(c => c.id === choreId);
   if (!chore || chore.status !== 'active' || ...) {
       renderApp();
       return showToast('That quest expired at midnight - a fresh one is ready.', 'alert-circle');
   }
   ```
   Also add a test in `reward-edge-cases.test.cjs`: set `date` to the next day, call `markChoreDone(oldId)`, and assert that a render or toast stub was called.
   **Fix confidence:** HIGH

2. **ID:** R2
   **Severity:** MEDIUM
   **Title:** Optional dailies are charged Coins at midnight although the UI calls them "Optional"
   **Location:** `app.js:L478-L479`, `app.js:L337`, `catalog.json:L5`
   **Category:** correctness
   **Evidence:** `rollDailyQuests` runs `if (chore.status === 'active') applyMiss(chore);` for every expired daily, with no `mandatory` check. Catalog `c3` ("Take Out Trash") has `"mandatory":false,"penalty":2`, and the card shows "Optional daily" together with "Miss: up to 2 Coins". Not doing an optional task therefore costs Coins automatically every night when that day had earnings.
   **Why it matters:** The "Optional" label conflicts with the automatic penalty. The ADR says penalties should target missed obligations and current gains, and penalizing a task labeled optional undermines trust. `AGENTS.md` says only "Unsubmitted dailies expire and repeat", which does not clearly say whether optional ones are penalized.
   **Recommended fix:** Choose one rule and document it in `AGENTS.md`:
   - Charge expired dailies only when `chore.mandatory` is true. For example, change `L479` to `if (chore.status === 'active') chore.mandatory ? applyMiss(chore) : (chore.status = 'missed', chore.actualPenalty = 0);`.
   - Or keep the penalty and change the label to "Daily (penalty if skipped)".

   Either way, add a test that rolls an optional daily over and asserts the Coin result.
   **Fix confidence:** MEDIUM - this is a product rule decision, and the docs do not state the intended behavior.

3. **ID:** R3
   **Severity:** LOW
   **Title:** The daily rollover deletes completed and missed daily records, so the Done and Failed tabs empty at midnight
   **Location:** `app.js:L477-L485`
   **Category:** correctness
   **Evidence:** In the `chore.daily && chore.day < date` branch, the code pushes only the fresh copy and, if the old chore is still pending, the old chore. Old `completed` or `missed` dailies are never pushed to `next`, so they and their `actualPenalty` disappear. `kid.days[...]` keeps only IDs and totals.
   **Why it matters:** After midnight, a parent cannot see which dailies were missed yesterday or how many Coins were deducted. That makes disputes hard to settle and makes penalties feel arbitrary.
   **Recommended fix:** Keep finished instances as non-repeating history, for example `else if (chore.status !== 'active') { chore.daily = false; next.push(chore); }`. Optionally prune entries older than N days. Do this together with R1/R2, and update the rollover test, which currently snapshots `appState.chores`.
   **Fix confidence:** MEDIUM - keeping history makes the list grow, so a pruning policy is needed.

4. **ID:** R4
   **Severity:** LOW
   **Title:** A pending daily carried past midnight is labeled "One-time"
   **Location:** `app.js:L482`, `app.js:L337`
   **Category:** correctness
   **Evidence:** A pending daily carried over at rollover gets `chore.daily = false`. The card then shows `chore.daily ? ... : 'One-time'`, so yesterday's homework appears as a one-time task next to today's fresh copy.
   **Why it matters:** This confuses parents reviewing late submissions: it looks like a duplicate one-time task instead of yesterday's daily.
   **Recommended fix:** Set a marker such as `chore.carriedOver = true` (or keep `originalDaily: true`) and render "Yesterday's daily · awaiting review" or "<day> daily" when it is set.
   **Fix confidence:** HIGH

5. **ID:** R5
   **Severity:** LOW
   **Title:** `actualPenalty` is inserted into HTML without validation or escaping
   **Location:** `app.js:L318`, `app.js:L53`
   **Category:** security
   **Evidence:** `` `-${chore.actualPenalty || 0} Coins` `` is placed into `innerHTML`. `validateData` checks every other rendered chore field (IDs by regex, amounts with `validAmount`, `day` by pattern) but never `actualPenalty`. A saved chore with `"actualPenalty":"<img src=x onerror=...>"` passes `loadFromStorage` and runs as markup in the Failed tab.
   **Why it matters:** The impact is bounded. Anyone who can edit localStorage can already run code in that origin, and `AGENTS.md` says the PIN does not protect against storage edits. Still, this is the only unvalidated dynamic HTML value, so it breaks the otherwise consistent "validate on load" safety boundary.
   **Recommended fix:** Add `(c.actualPenalty === undefined || validAmount(c.actualPenalty))` to the quest check at `L53`, or render with `${Number(chore.actualPenalty) || 0}`. Also add a case to the existing "invalid saved data" test.
   **Fix confidence:** HIGH

6. **ID:** R6
   **Severity:** LOW
   **Title:** The selected emoji in the chore picker does not match the emoji that gets saved
   **Location:** `index.html:L254`, `app.js:L847`, `app.js:L60`
   **Category:** bug
   **Evidence:** The hidden input `chore-emoji` starts with `value="🧹"`, but `buildEmojiPicker` highlights index 0 (`🖥️`) as selected. Saving without touching the picker stores 🧹 while 🖥️ appears selected. Pickers are also not reset when `openAddChoreModal`, `openAddKidModal` or `openAddRewardModal` reopen. This is pre-existing UI code.
   **Why it matters:** The new quest's icon differs from what the parent selected on screen.
   **Recommended fix:** Set the hidden value to `emojiList[0]` in `buildEmojiPicker`, or highlight the entry that matches the current value. Rebuild or reset the picker in each `openAdd*Modal`.
   **Fix confidence:** HIGH

7. **ID:** R7
   **Severity:** LOW
   **Title:** A CDN or render failure shows a misleading catalog error, and later render errors fail silently
   **Location:** `app.js:L130-L144`, `app.js:L201`, `app.js:L140-L141`
   **Category:** correctness
   **Evidence:** `renderApp()` calls `lucide.createIcons()` inside the onload `try`. If the unpkg Lucide script fails to load, `ReferenceError: lucide is not defined` replaces the whole app with "Check catalog.json and browser storage…". This points parents at the wrong cause. Separately, `rollDailyQuests`→`saveToStorage` runs from the focus/interval renders. A validation or quota failure there throws without being caught and re-alerts every minute (storage-failure path at `L186`). The loaded page is also pinned to `lucide@latest` (`index.html:L10`), so an unversioned upstream release can break it.
   **Why it matters:** Recovery guidance is wrong when the network is flaky, and the app can show alert loops.
   **Recommended fix:** Use `if (window.lucide) lucide.createIcons();` in `renderApp`/`setTaskTab`/`showToast`, pin a Lucide version, and include the error type in the blocking message (for example, use the catalog wording only when the error comes from the fetch/validate step).
   **Fix confidence:** MEDIUM

8. **ID:** R8
   **Severity:** LOW
   **Title:** The chore form inputs allow values the JavaScript validation rejects
   **Location:** `index.html:L235`, `index.html:L239`, `app.js:L706`
   **Category:** maintainability
   **Evidence:** `chore-points` has `min="1"` but no `max="1000"` or `step="1"`. The penalty input allows up to 5 even when half the Coin value is lower. The browser accepts these values, and `saveChore` then rejects them with a generic toast.
   **Why it matters:** This causes minor friction on mobile. Constraints shown in the form should match the rule in `AGENTS.md` (XP 1–1000).
   **Recommended fix:** Add `max="1000" step="1"` to `chore-points`. Optionally update the penalty input's `max` from `coins` on input.
   **Fix confidence:** HIGH

9. **ID:** R9
   **Severity:** LOW
   **Title:** The node:test edge-case suite is not documented, and the docs' verification list does not include it
   **Location:** `scripts/reward-edge-cases.test.cjs:L1`, `AGENTS.md` ("Saved-data migration and checks")
   **Category:** test-gap
   **Evidence:** `AGENTS.md` lists only `node scripts/check-rewards.cjs` as the logic check. The broader suite (rollover, late approval, migration, catalog failure, storage failure) runs only with `node --test scripts/reward-edge-cases.test.cjs`, and the docs never mention that command. There is also no test for: clicking a quest across midnight (R1), rolling over an optional daily (R2), a multi-day gap where the original day had earnings, or `actualPenalty` validation (R5).
   **Why it matters:** Contributors following `AGENTS.md` will skip most of the regression coverage for the subtle calendar and penalty rules.
   **Recommended fix:** Add the `node --test` command to the AGENTS checks and add the missing cases listed above.
   **Fix confidence:** HIGH

Merge risk: MEDIUM - The core Coin/XP invariants, migration and parent guards look sound and have focused tests. However, the midnight rollover can silently charge Coins (R1), and the optional-daily penalty rule (R2) affects users directly and has no test. I could not run tests in this session.
