# Parent Task Administration & Catalog Sync Design

## Goal
Allow parents to easily add, edit, or customize tasks and rewards directly from the Parent Admin view in the app, with changes automatically persisting to the backend data layer (PHP/JSON or Firebase) so they sync instantly across all devices.

---

## Current State vs. What's Needed
- **Current state:** Parent Admin lets parents deploy catalog templates, archive players, adjust coins, and view redemptions. Custom task creation exists in a basic form, but full CRUD (Create, Read, Update, Delete) for task catalog templates and reward prices needs robust integration with saved/backend state.
- **Backend persistence:** When configured with a backend (PHP or Firebase), any parent administration change (adding a custom reward, modifying task points/penalties, adding a new household chore) must save to the central state so children's devices pick up the new tasks immediately upon syncing.

---

## Proposed Administration Features for Parent Admin

### 1. Custom Task Creator & Editor
- **Inputs:** Title, Emoji, XP/Points, Coins, Nominal Penalty, Cadence (`daily`, `weekly`, `on-demand`), Ownership (`personal`, `shared`), Mandatory toggle, Requires Review toggle.
- **Action:** Saves directly to the family's shared chore catalog/templates.

### 2. Reward Vault Manager
- **Inputs:** Title, Emoji, Cost, Tier (Micro 1, Mid 2, Major 3).
- **Action:** Add/edit family rewards so parents can introduce custom perks or adjust prices.

### 3. Synchronization & Persistence
- Every parent admin action updates `appState`, triggers `saveToStorage()`, and pushes the updated JSON state to the backend (`api.php` or Firebase).
- When a child's device polls or listens for state changes, it receives the updated task catalog and available rewards automatically.
