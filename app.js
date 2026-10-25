        // --- DATA STATE ---
        let appState = {
            isParentMode: false,
            activeKidId: null,
            activeTab: 'active', // active, pending, completed, missed
            activeView: 'chores', // chores, shop, parent
            parentPin: '1234',
            kids: [],
            chores: [],
            rewards: [],
            redemptions: []
        };

        // First-run profiles and prices come from the source catalog, never overwrite saves.
        let defaultKids;
        let savedData = {};

        // Default Gaming Chores
        let catalog;
        let requestedTemplateId = null;
        let prototypeResetInProgress = false;
        let serverETag = null;
        let saveQueue = Promise.resolve();
        let pendingWrites = 0;
        let localRevision = 0;
        let storageFailed = false;
        let refreshInProgress = false;
        const activeKids = () => appState.kids.filter(k => !k.archived);
        const activePlayer = id => appState.kids.find(k => k.id === id && !k.archived);
        const validAmount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
        const newId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
        const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
        const today = () => localDay(new Date());
        function localDay(date) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        function previousDay(day) {
            const date = new Date(`${day}T12:00:00`);
            date.setDate(date.getDate() - 1);
            return localDay(date);
        }
        function weekStart(day) {
            const date = new Date(`${day}T12:00:00`);
            date.setDate(date.getDate() - (date.getDay() + 6) % 7);
            return localDay(date);
        }
        const needsReview = chore => chore.requiresReview || chore.points >= 75 || chore.coins >= 75 || chore.bonus === 'reading';
        const maxPenalty = chore => Math.min(chore.penalty, Math.floor(chore.coins / 2));
        const isRecurring = chore => chore.daily || (chore.cadence === 'weekly' && !chore.archived && !chore.bonus);
        function requireValue(condition, message) {
            if (!condition) throw new Error(message);
        }
        function checkRows(rows, name) {
            requireValue(Array.isArray(rows), `Invalid ${name} list`);
            const ids = new Set();
            rows.forEach(row => {
                requireValue(row && typeof row.id === 'string' && /^[\w-]+$/.test(row.id) && !ids.has(row.id), `Invalid/duplicate ${name} ID`);
                ids.add(row.id);
            });
        }
        function validateData(data) {
            ['kids', 'chores', 'rewards'].forEach(key => checkRows(data[key], key));
            data.kids.forEach(k => {
                requireValue(typeof k.name === 'string' && typeof k.avatar === 'string' && validAmount(k.xp) && validAmount(k.coins), 'Invalid player balance/profile');
                requireValue(k.archived === undefined || typeof k.archived === 'boolean', 'Invalid player archive status');
                requireValue(k.days && typeof k.days === 'object' && !Array.isArray(k.days), 'Invalid day history');
                Object.entries(k.days).forEach(([date, day]) => requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && day && Array.isArray(day.required) && Array.isArray(day.completed) && validAmount(day.earned) && validAmount(day.lost) && typeof day.missed === 'boolean', 'Invalid day record'));
                requireValue(k.readingDays === undefined || (Array.isArray(k.readingDays) && k.readingDays.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))), 'Invalid reading dates');
                requireValue(k.readingBonuses === undefined || (k.readingBonuses && typeof k.readingBonuses === 'object' && !Array.isArray(k.readingBonuses) && Object.entries(k.readingBonuses).every(([week, status]) => /^\d{4}-\d{2}-\d{2}$/.test(week) && ['pending','completed','declined'].includes(status))), 'Invalid weekly reading decisions');
            });
            data.chores.forEach(c => requireValue(typeof c.title === 'string' && typeof c.emoji === 'string' && validAmount(c.points) && validAmount(c.coins) && validAmount(c.penalty) && (c.actualPenalty === undefined || validAmount(c.actualPenalty)) && ['active','pending','completed','missed','expired'].includes(c.status) && data.kids.some(k => k.id === c.assignedTo) && /^\d{4}-\d{2}-\d{2}$/.test(c.day) && typeof c.daily === 'boolean' && (c.archivedDaily === undefined || typeof c.archivedDaily === 'boolean') && typeof c.mandatory === 'boolean' && typeof c.requiresReview === 'boolean', 'Invalid quest'));
            data.chores.forEach(c => requireValue((c.cadence === undefined || ['daily','weekly','on-demand'].includes(c.cadence)) && (c.period === undefined || (typeof c.period === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.period))) && (c.archived === undefined || typeof c.archived === 'boolean') && (c.bonus === undefined || (c.bonus === 'reading' && Number.isInteger(c.requiredDays) && c.requiredDays >= 1 && c.requiredDays <= 7 && typeof c.period === 'string')), 'Invalid cadence/bonus metadata'));
            data.rewards.forEach(r => requireValue(typeof r.title === 'string' && typeof r.emoji === 'string' && validAmount(r.cost) && r.cost > 0 && [1,2,3].includes(r.tier), 'Invalid reward price/tier'));
            checkRows(data.redemptions, 'redemptions');
            data.redemptions.forEach(r => requireValue(typeof r.title === 'string' && validAmount(r.cost) && r.cost > 0 && ['pending','fulfilled','declined'].includes(r.status) && data.kids.some(k => k.id === r.kidId), 'Invalid redemption'));
            requireValue(typeof data.parentPin === 'string' && /^\d{4}$/.test(data.parentPin), 'Invalid Parent PIN');
        }

        const EMOJI_CHORES = ['🖥️', '📚', '🧹', '🗑️', '🥤', '🧺', '🐶', '🍽️', '🏋️', '🛏️'];
        const EMOJI_KIDS = ['🎮', '🗡️', '👾', '🤖', '👑', '🔥', '🛡️', '⚡', '🐉', '🎯'];
        const EMOJI_REWARDS = ['🎮', '⛏️', '💎', '🍕', '📺', '🍿', '🎧', '🛹', '🎟️', '🍟'];

        // --- RETRO GAMING AUDIO SYNTHESIZER ---
        function playGamerSound(type) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();

                if (type === 'success') {
                    // 8-Bit Quest Complete Chime
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'square';
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    const now = ctx.currentTime;
                    osc.frequency.setValueAtTime(440, now); // A4
                    osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
                    osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
                    osc.frequency.setValueAtTime(880, now + 0.24); // A5

                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                    osc.start(now);
                    osc.stop(now + 0.4);
                } else if (type === 'penalty') {
                    // Valorant/Gamer Missed Buzz
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    const now = ctx.currentTime;
                    osc.frequency.setValueAtTime(180, now);
                    osc.frequency.linearRampToValueAtTime(90, now + 0.25);

                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

                    osc.start(now);
                    osc.stop(now + 0.25);
                } else if (type === 'redeem') {
                    // Loot Vault Unlock Fanfare
                    const notes = [523.25, 659.25, 783.99, 1046.50];
                    notes.forEach((freq, idx) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.value = freq;
                        osc.connect(gain);
                        gain.connect(ctx.destination);

                        const start = ctx.currentTime + (idx * 0.07);
                        gain.gain.setValueAtTime(0.15, start);
                        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

                        osc.start(start);
                        osc.stop(start + 0.2);
                    });
                }
            } catch(e) {
                // Audio restriction fallback
            }
        }

        // --- INIT & PERSISTENCE ---
        window.onload = async function() {
            try {
                document.getElementById('app').inert = true;
                const response = await fetch('data/catalog.json', {cache: 'no-store'});
                requireValue(response.ok, `Catalog HTTP ${response.status}`);
                catalog = await response.json();
                defaultKids = catalog.kids;
                // Validate defaults even when the saved family has a custom catalog.
                checkRows(catalog.chores, 'templates');
                checkRows(defaultKids, 'starter players');
                catalog.chores.forEach(c => requireValue(typeof c.title === 'string' && typeof c.emoji === 'string' && validAmount(c.points) && validAmount(c.coins) && validAmount(c.penalty) && ['daily','weekly','on-demand'].includes(c.cadence) && ['shared','personal'].includes(c.ownership) && typeof c.mandatory === 'boolean' && typeof c.requiresReview === 'boolean' && (!c.bonus || (c.bonus === 'reading' && Number.isInteger(c.requiredDays) && c.requiredDays >= 1 && c.requiredDays <= 7)), 'Invalid catalog template'));
                catalog.chores.filter(c => c.seed && c.ownership === 'shared').forEach(c => requireValue(defaultKids.some(k => k.id === c.defaultOwner), 'Unknown shared seed owner'));
                validateData({kids: defaultKids, chores: seedChores(), rewards: catalog.rewards, redemptions: [], parentPin: '1234'});
                const saved = await readServerState();
                loadFromStorage(saved.data);
                serverETag = saved.etag;
                rollDailyQuests();
                if (saved.data === null && !pendingWrites) saveToStorage();
                await saveQueue;
                if (storageFailed) return;
                initEmojiPickers();
                renderApp();
                document.getElementById('app').inert = false;
                window.addEventListener('focus', refreshFromServer);
                document.addEventListener('keydown', handleModalKey);
                setInterval(refreshFromServer, 60000);
            } catch (error) {
                document.getElementById('app').inert = false;
                document.getElementById('app').textContent = `Unable to load Chore Quest: ${error.message}. Check data/catalog.json and the PHP storage service, then reload. No browser-only fallback is used. Serve this folder with npm run dev; file:// and static hosting are not supported.`;
            }
        };

        function templateQuest(template, kidId, date = today()) {
            return {...template, id: `c_${newId()}`, templateId: template.id, assignedTo: kidId,
                day: date, period: template.cadence === 'weekly' ? weekStart(date) : date,
                status: 'active', daily: template.cadence === 'daily', archived: false};
        }
        function seedChores() {
            return catalog.chores.filter(c => c.seed && c.cadence === 'daily' && !c.bonus).flatMap(c =>
                (c.ownership === 'personal' ? defaultKids : defaultKids.filter(k => k.id === c.defaultOwner))
                    .map(k => templateQuest(c, k.id)));
        }
        function loadFromStorage(saved) {
            const parsed = saved === null ? JSON.parse(JSON.stringify({schemaVersion: 2, kids: defaultKids, chores: seedChores(), rewards: catalog.rewards, redemptions: [], parentPin: '1234'})) : saved;
            requireValue(parsed && parsed.schemaVersion === 2, 'Unsupported saved data version');
            validateData(parsed);
            parsed.kids.forEach(k => {
                k.readingDays ??= [];
                k.readingBonuses ??= {};
            });
            Object.assign(appState, {kids: parsed.kids, chores: parsed.chores, rewards: parsed.rewards, redemptions: parsed.redemptions, parentPin: parsed.parentPin});
            savedData = parsed;
        }

        function responseETag(response) {
            const etag = response.headers.get('ETag');
            requireValue(etag && /^"(?:none|[a-f0-9]{64})"$/.test(etag), 'Missing or invalid storage ETag');
            return etag;
        }

        async function readServerState() {
            const response = await fetch('api.php', {cache: 'no-store'});
            requireValue(response.ok, `Storage read HTTP ${response.status}`);
            const data = await response.json().catch(() => { throw new Error('Storage returned invalid JSON.'); });
            return {data, etag: responseETag(response)};
        }

        function storageFailure(message) {
            if (storageFailed) return;
            storageFailed = true;
            appState.isParentMode = false;
            document.querySelectorAll('[id^="modal-"]').forEach(modal => modal.classList.add('hidden'));
            document.getElementById('toast').classList.add('hidden');
            const app = document.getElementById('app');
            app.inert = false;
            app.textContent = `${message} This page is blocked. Recent changes may not have been saved; the server may have received a request even if its reply failed. Check the PHP service and reload to read server state. No browser-only fallback or automatic overwrite is used.`;
            window.alert(app.textContent);
        }

        function saveToStorage() {
            if (prototypeResetInProgress || storageFailed) return saveQueue;
            try {
                validateData(appState);
                const snapshot = JSON.stringify({
                ...savedData,
                schemaVersion: 2,
                kids: appState.kids,
                chores: appState.chores,
                rewards: appState.rewards,
                parentPin: appState.parentPin,
                redemptions: appState.redemptions
                });
                pendingWrites++;
                localRevision++;
                saveQueue = saveQueue.then(async () => {
                    if (storageFailed) return;
                    const response = await fetch('api.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'If-Match': serverETag},
                        body: snapshot
                    });
                    requireValue(response.status !== 409, 'Another page or device changed the saved family.');
                    requireValue(response.ok, `Storage write HTTP ${response.status}.`);
                    requireValue((await response.json()).success === true, 'Storage did not confirm the save.');
                    serverETag = responseETag(response);
                }).catch(error => storageFailure(`Unable to save changes: ${error.message}`))
                    .finally(() => { pendingWrites--; });
            } catch (error) {
                storageFailure(`Unable to prepare changes for saving: ${error.message}`);
            }
            return saveQueue;
        }

        async function refreshFromServer() {
            if (prototypeResetInProgress || storageFailed || refreshInProgress) return;
            if (pendingWrites) { renderApp(); return; }
            refreshInProgress = true;
            const revision = localRevision;
            try {
                const saved = await readServerState();
                // A local action during GET owns this page until its queued writes settle.
                if (prototypeResetInProgress || storageFailed || pendingWrites || revision !== localRevision) return;
                if (saved.etag !== serverETag) {
                    loadFromStorage(saved.data);
                    serverETag = saved.etag;
                    ['modal-chore','modal-kid','modal-reward','modal-pin'].forEach(closeModal);
                    requestedTemplateId = null;
                    if (appState.activeKidId && !activePlayer(appState.activeKidId)) {
                        appState.activeKidId = null;
                        appState.isParentMode = false;
                        appState.activeView = 'chores';
                        appState.activeTab = 'active';
                    }
                    if (saved.data === null) await saveToStorage();
                }
                renderApp();
            } catch (error) {
                storageFailure(`Unable to refresh saved data: ${error.message}`);
            } finally {
                refreshInProgress = false;
            }
        }

        // --- RENDER FUNCTIONS ---
        function renderApp() {
            if (prototypeResetInProgress || storageFailed) return;
            rollDailyQuests();
            if (storageFailed) return;
            renderKidSelector();
            renderEntry();
            renderKidHero();
            renderChores();
            renderRewards();
            renderRedemptions();
            renderParentControls();
            renderTemplates();
            renderChoreChoices();
            updateNavigation();
            lucide.createIcons();
        }

        function renderEntry() {
            const kid = appState.kids.find(k => k.id === appState.activeKidId);
            const entry = !kid && !appState.isParentMode;
            document.getElementById('view-entry').classList.toggle('hidden', !entry);
            document.getElementById('kid-selector-bar').classList.toggle('hidden', !kid && !appState.isParentMode);
            document.getElementById('entry-help').textContent = activeKids().length
                ? 'Choose your name to see what you need to do today, choose extra chores and spend your Coins.'
                : 'No active players. Choose Parent to add a player or restore an archived player. Your saved data has not been reset.';
            const container = document.getElementById('entry-players');
            container.innerHTML = '';
            activeKids().forEach(k => {
                const button = document.createElement('button');
                button.className = 'bg-darkcard border border-darkborder rounded-2xl p-5 text-left text-lg font-bold';
                button.textContent = `${k.avatar}  ${k.name} →`;
                button.onclick = () => selectKid(k.id);
                container.appendChild(button);
            });
            document.getElementById('mode-btn-text').textContent = appState.isParentMode ? 'Exit Admin' : 'Parent PIN';
            document.getElementById('mode-subtitle').textContent = appState.isParentMode ? 'Parent controls unlocked · switching child locks them' : kid ? `${kid.name}’s chores & rewards` : 'Choose your profile to start';
        }

        // Render Player Selector Bar
        function renderKidSelector() {
            const container = document.getElementById('kid-selector-bar');
            container.innerHTML = '';

            activeKids().forEach(kid => {
                const isActive = kid.id === appState.activeKidId;
                const btn = document.createElement('button');
                btn.onclick = () => selectKid(kid.id);
                btn.setAttribute('aria-pressed', String(isActive));
                btn.className = `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-bounce ${
                    isActive
                    ? 'bg-valored text-white border border-red-400 shadow-md scale-105 glow-red'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`;
                btn.innerHTML = `
                    <span class="text-sm">${escapeHTML(kid.avatar)}</span>
                    <span class="font-heading">${escapeHTML(kid.name)}</span>
                    <span class="bg-black/40 text-neonyellow px-1.5 py-0.2 rounded font-mono text-[10px] ml-1">${kid.xp}XP</span>
                `;
                container.appendChild(btn);
            });
        }

        // Render Active Gamer Hero Card
        function renderKidHero() {
            const kid = appState.kids.find(k => k.id === appState.activeKidId);
            if (!kid) return;

            document.getElementById('hero-avatar').textContent = kid.avatar;
            document.getElementById('hero-name').textContent = kid.name;
            document.getElementById('hero-points').textContent = kid.xp;
            document.getElementById('hero-coins').textContent = `${kid.coins} Coins`;
            document.getElementById('shop-balance').textContent = `${kid.coins} Coins`;
            document.getElementById('hero-streak').textContent = `${getStreak(kid)} Day Streak`;

            const readingCount = new Set((kid.readingDays || []).filter(d => weekStart(d) === weekStart(today()))).size;
            document.getElementById('reading-progress').textContent = `${readingCount} reading days this Mon–Sun week · choose 15 OR 30 minutes per day. Five days unlock a parent-reviewed weekly bonus (including late approvals).`;
        }

        // Render Quests List
        function renderChores() {
            const container = document.getElementById('chores-list');
            container.innerHTML = '';

            const filtered = appState.chores.filter(c => {
                const isKidMatch = c.assignedTo === appState.activeKidId || c.assignedTo === 'all';
                return isKidMatch && (c.status === appState.activeTab || (appState.activeTab === 'active' && c.status === 'pending') || (appState.activeTab === 'missed' && c.status === 'expired'));
            });
            const group = c => c.status === 'pending' ? 3 : c.day > today() ? 2 : c.mandatory ? 0 : 1;
            if (appState.activeTab === 'active') filtered.sort((a, b) => group(a) - group(b));
            const kid = appState.kids.find(k => k.id === appState.activeKidId);
            if (appState.activeTab === 'active' && kid) {
                const required = appState.chores.filter(c => c.assignedTo === kid.id && c.mandatory && c.status === 'active' && c.day <= today());
                container.innerHTML = `<h3 class="font-bold text-lg">Required today · ${required.length} left</h3>${required.length ? '<p class="text-sm text-slate-300">Start with these assigned chores.</p>' : '<p class="text-sm text-emerald-300">No required chores left to do. Anything waiting for a parent still needs their check.</p>'}`;
            }

            // Tab counter badges
            ['active', 'pending', 'completed', 'missed'].forEach(tab => {
                const count = appState.chores.filter(c =>
                    (c.assignedTo === appState.activeKidId || c.assignedTo === 'all') && (c.status === tab || (tab === 'missed' && c.status === 'expired'))
                ).length;
                document.getElementById(`count-${tab}`).textContent = count;
            });

            if (filtered.length === 0) {
                if (appState.activeTab === 'active') return;
                container.innerHTML = `
                    <div class="text-center py-12 px-4 bg-darkcard rounded-2xl border border-darkborder">
                        <div class="text-4xl mb-2">👾</div>
                        <p class="font-bold text-white text-sm">No chores here yet</p>
                        <button onclick="setTaskTab('active')" class="text-sm text-neoncyan p-3">Back to today & choose a chore</button>
                    </div>
                `;
                return;
            }

            let lastGroup = 0;
            filtered.forEach(chore => {
                if (appState.activeTab === 'active' && group(chore) !== lastGroup) {
                    lastGroup = group(chore);
                    const heading = document.createElement('h3');
                    heading.className = 'font-bold text-lg pt-3';
                    heading.textContent = ['', 'Optional · already assigned to you', 'Coming up · assigned to you', 'Waiting for parent review'][lastGroup];
                    container.appendChild(heading);
                }
                const card = document.createElement('div');
                card.className = "chore-card bg-darkcard p-3.5 rounded-2xl border border-darkborder flex items-center justify-between gap-3 shadow-md hover:border-slate-700 transition-all";

                let actionArea = '';

                if (chore.status === 'active') {
                    const sharedConflict = sharedJobBlocked(chore);
                    const blocked = readingBlocked(chore) || sharedConflict || chore.day > today();
                    actionArea = `
                        <button onclick="markChoreDone('${chore.id}')" ${blocked ? 'disabled' : ''} class="disabled:opacity-40 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-heading text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-emerald-950 btn-bounce">
                            <i data-lucide="check" class="w-4 h-4"></i> ${chore.day > today() ? 'Scheduled' : sharedConflict ? 'Ask parent: owner conflict' : blocked ? 'Reading chosen' : needsReview(chore) && !appState.isParentMode ? 'I did it · ask for check' : 'I did it'}
                        </button>
                    `;
                } else if (chore.status === 'pending') {
                    if (appState.isParentMode) {
                        actionArea = `
                            <div class="flex gap-1.5">
                                <button onclick="approveChore('${chore.id}')" class="bg-emerald-500 text-slate-950 p-2 rounded-xl font-bold btn-bounce" aria-label="Approve quest" title="Approve (+${chore.points} XP, +${chore.coins} Coins)">
                                    <i data-lucide="check" class="w-4 h-4"></i>
                                </button>
                                <button onclick="rejectChore('${chore.id}')" class="bg-valored text-white p-2 rounded-xl font-bold btn-bounce" aria-label="Reject quest" title="Missed (bounded Coin penalty only)">
                                    <i data-lucide="x" class="w-4 h-4"></i>
                                </button>
                            </div>
                        `;
                    } else {
                        actionArea = `<span class="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-lg">Awaiting Review</span>`;
                    }
                } else if (chore.status === 'completed') {
                    actionArea = `<span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Cleared</span>`;
                } else if (['missed','expired'].includes(chore.status)) {
                    actionArea = `<span class="text-xs text-slate-300">${chore.status === 'expired' ? 'Expired · no loss' : `Actual: -${escapeHTML(chore.actualPenalty || 0)} Coins`}</span>`;
                }

                let parentExtras = '';
                if (appState.isParentMode && (chore.status === 'active' || chore.status === 'pending')) {
                    parentExtras = `
                        <div class="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                            <button onclick="failChore('${chore.id}')" class="text-[10px] text-valored font-bold bg-valored/10 px-2 py-0.5 rounded">Mark missed (Coins only)</button>
                            ${chore.bonus ? '' : `<button onclick="deleteChore('${chore.id}')" class="text-[10px] text-slate-500 hover:text-valored px-1">Delete</button>`}
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="flex-1">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl bg-slate-900 p-2 rounded-xl border border-slate-800 block">${escapeHTML(chore.emoji)}</span>
                            <div>
                                <h4 class="font-bold text-white text-xs leading-tight">${escapeHTML(chore.title)}</h4>
                                <p class="text-[10px] text-slate-400">${chore.day} · ${chore.bonus ? `Reading bonus · week of ${escapeHTML(chore.period)}` : chore.daily || chore.archivedDaily ? (chore.mandatory ? 'Mandatory daily' : 'Optional daily') : chore.cadence === 'weekly' ? `Weekly · week of ${escapeHTML(chore.period)}` : chore.scheduled ? 'Scheduled session' : 'On-demand'}${needsReview(chore) ? ' · Parent review' : ''}</p>
                                <div class="flex items-center space-x-2 mt-1">
                                    <span class="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">+${chore.points} XP · +${chore.coins} Coins</span>
                                    ${chore.penalty > 0 ? `<span class="text-[10px] font-bold text-valored bg-valored/10 border border-valored/30 px-1.5 py-0.5 rounded">Nominal ${chore.penalty} · max ${maxPenalty(chore)} Coins; actual ≤ day earnings/balance</span>` : ''}
                                </div>
                            </div>
                        </div>
                        ${parentExtras}
                    </div>
                    <div>
                        ${actionArea}
                    </div>
                `;
                container.appendChild(card);
            });
            if (appState.activeTab === 'active' && !filtered.some(c => c.status === 'pending')) {
                container.insertAdjacentHTML('beforeend', '<p class="text-sm text-slate-300 pt-2">Parent review: nothing waiting.</p>');
            }
        }

        // Source catalog is parent-owned. Only small, optional personal chores are self-selectable.
        const childCanChoose = t => t.ownership === 'personal' && !t.mandatory && !t.scheduled && !t.bonus && !needsReview(t);
        function templateDuplicate(template, kidId, date = today(), childChoice = false) {
            const period = template.cadence === 'weekly' ? weekStart(date) : date;
            return appState.chores.find(c => (activePlayer(c.assignedTo) || c.status === 'completed') && (c.templateId === template.id || c.title === template.title) &&
                (template.ownership === 'shared' || c.assignedTo === kidId) &&
                (['active','pending'].includes(c.status) ||
                    ((template.cadence !== 'on-demand' || childChoice) &&
                        ((template.cadence === 'on-demand' && childChoice && c.day === date) || (c.period || (template.cadence === 'weekly' ? weekStart(c.day) : c.day)) === period))));
        }

        function renderChoreChoices() {
            document.getElementById('chore-choices').classList.toggle('hidden', appState.activeTab !== 'active');
            const container = document.getElementById('catalog-choices');
            container.innerHTML = '';
            if (!appState.activeKidId) return;
            catalog.chores.filter(t => !t.bonus).sort((a, b) => Number(childCanChoose(b)) - Number(childCanChoose(a))).forEach(template => {
                const existing = templateDuplicate(template, appState.activeKidId, today(), true);
                const selectable = childCanChoose(template);
                const blockedReading = readingBlocked({...template, assignedTo: appState.activeKidId, day: today()});
                const owner = existing && appState.kids.find(k => k.id === existing.assignedTo);
                const status = existing ? `${owner?.id !== appState.activeKidId ? `Assigned to ${owner?.name || 'another child'}` : existing.status === 'active' ? 'Already assigned to you · see above' : existing.status === 'pending' ? 'Waiting for parent review' : 'Already recorded for this period'}.`
                    : blockedReading ? 'You already chose reading today.' : selectable ? 'Available for you to choose.' : 'Ask parent to assign this first. No Coins or XP until completed.';
                const frequency = template.cadence === 'weekly' ? 'Once per Mon–Sun week; repeats weekly until a parent removes it.' : template.cadence === 'daily' ? 'Once a day; repeats daily until a parent removes it.' : selectable ? 'One choice per day; finish any previous choice first.' : template.scheduled ? 'Parent schedules each session.' : 'Parent assigns each job.';
                const card = document.createElement('article');
                card.className = 'bg-darkcard p-4 rounded-2xl border border-darkborder space-y-2';
                card.innerHTML = `<h4 class="font-bold text-sm">${escapeHTML(template.emoji)} ${escapeHTML(template.title)}</h4><p class="text-sm text-emerald-300">${template.coins} Coins · ${template.points} lifetime XP</p><p class="text-xs text-slate-300">${escapeHTML(frequency)}</p><p class="text-sm text-slate-300">${escapeHTML(status)}</p>`;
                if (!existing && !blockedReading) {
                    const button = document.createElement('button');
                    button.className = 'bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm font-bold';
                    button.textContent = selectable ? 'Choose this chore' : 'Ask parent to assign';
                    button.onclick = () => chooseCatalogChore(template.id);
                    card.appendChild(button);
                }
                container.appendChild(card);
            });
        }

        function chooseCatalogChore(id) {
            rollDailyQuests();
            const template = catalog.chores.find(t => t.id === id);
            if (!template || template.bonus || !activePlayer(appState.activeKidId)) return;
            if (templateDuplicate(template, appState.activeKidId, today(), true) || readingBlocked({...template, assignedTo: appState.activeKidId, day: today()})) {
                renderApp();
                return showToast('Already assigned, chosen or recorded. Check your chores above.', 'info');
            }
            if (!childCanChoose(template)) {
                requestedTemplateId = id;
                if (appState.isParentMode) openRequestedTemplate();
                else {
                    toggleParentMode();
                    showToast('Hand the device to a parent to agree and assign this chore.', 'shield');
                }
                return;
            }
            appState.chores.push(templateQuest(template, appState.activeKidId));
            saveToStorage();
            setTaskTab('active');
            renderApp();
            document.getElementById('hero-name').focus();
            showToast('Added to your optional chores. Do it first, then tap “I did it”.', 'check');
        }

        function openRequestedTemplate() {
            if (!appState.isParentMode || !requestedTemplateId) return;
            document.getElementById('template-choice').value = requestedTemplateId;
            document.getElementById('template-player').value = appState.activeKidId || '';
            requestedTemplateId = null;
            renderTemplateDetails();
            switchMainView('parent');
            document.getElementById('template-choice').focus();
        }

        // Render Rewards Loot Shop
        function renderRewards() {
            const container = document.getElementById('rewards-list');
            container.innerHTML = '';

            const currentKid = activePlayer(appState.activeKidId);
            document.getElementById('shop-balance').textContent = currentKid ? `${currentKid.coins} Coins` : 'No child selected';

            appState.rewards.forEach(reward => {
                const pending = appState.redemptions.some(r => r.kidId === currentKid?.id && r.rewardId === reward.id && r.status === 'pending');
                const canAfford = currentKid && currentKid.coins >= reward.cost && !pending;
                const card = document.createElement('div');
                card.className = "bg-darkcard p-3.5 rounded-2xl border border-darkborder flex items-center justify-between gap-3 shadow-md";

                let parentDelete = appState.isParentMode ? `<button onclick="deleteReward('${reward.id}')" class="text-slate-600 hover:text-valored p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : '';

                card.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <span class="text-2xl bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/30 block">${escapeHTML(reward.emoji)}</span>
                        <div>
                            <p class="text-[10px] text-neoncyan">Tier ${reward.tier} · ${['','Micro','Mid','Major'][reward.tier]}</p>
                            <h4 class="font-bold text-white text-xs">${escapeHTML(reward.title)}</h4>
                            <span class="text-[10px] font-extrabold text-neonyellow bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded mt-1 inline-block">${reward.cost} Coins</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${parentDelete}
                        <button onclick="claimReward('${reward.id}')"
                            class="px-3.5 py-2 rounded-xl text-xs font-bold font-heading tracking-wider shadow-md transition-all btn-bounce ${
                                canAfford
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 glow-cyan'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }" ${!canAfford ? 'disabled' : ''}>
                            ${pending ? 'PENDING' : 'REQUEST'}
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // Render Parent Admin Panel Controls
        function renderParentControls() {
            const container = document.getElementById('parent-kids-list');
            container.innerHTML = '';
            const selectedKid = appState.kids.find(k => k.id === appState.activeKidId);
            document.getElementById('parent-scope').textContent = selectedKid
                ? `Selected child: ${selectedKid.name}. Chore Review shows only this child; reward requests show all children. Switching child locks parent controls and returns to their chores.`
                : 'Parent Admin mode active. Review all squad chores, player balances, and vault rewards below.';
            const links = document.getElementById('parent-review-links');
            links.innerHTML = '';
            if (selectedKid) {
                const button = document.createElement('button');
                button.className = 'bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all';
                const pending = appState.chores.filter(c => c.assignedTo === selectedKid.id && c.status === 'pending').length;
                button.textContent = `Review ${selectedKid.name}’s chores (${pending})`;
                button.onclick = () => { setTaskTab('pending'); switchMainView('chores'); };
                links.appendChild(button);
            }
            const rewardsButton = document.createElement('button');
            rewardsButton.className = 'bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all';
            rewardsButton.textContent = 'All reward requests & vault';
            rewardsButton.onclick = () => switchMainView('shop');
            links.appendChild(rewardsButton);

            // Render Squad Overview (Chores status per player)
            const squadContainer = document.getElementById('parent-squad-overview');
            if (squadContainer) {
                squadContainer.innerHTML = '';
                appState.kids.forEach(kid => {
                    const kidChores = appState.chores.filter(c => c.assignedTo === kid.id);
                    const activeCount = kidChores.filter(c => c.status === 'active').length;
                    const pendingCount = kidChores.filter(c => c.status === 'pending').length;
                    const completedToday = kidChores.filter(c => c.status === 'completed' && c.day === today()).length;
                    const streak = getStreak(kid);

                    const card = document.createElement('div');
                    card.className = "bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2";
                    card.innerHTML = `
                        <div class="flex justify-between items-center">
                            <div class="flex items-center space-x-2">
                                <span class="text-lg">${escapeHTML(kid.avatar)}</span>
                                <div>
                                    <span class="font-bold text-white text-xs font-heading">${escapeHTML(kid.name)}</span>
                                    ${kid.archived ? '<span class="text-[10px] text-amber-400 ml-1">· Archived</span>' : ''}
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-mono text-amber-400 font-bold">${kid.coins} Coins</span>
                                <span class="text-[10px] block text-slate-400">${kid.xp} XP · ${streak}d streak</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                            <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                                <span class="text-slate-400 block text-[10px]">Active</span>
                                <span class="font-bold text-white">${activeCount}</span>
                            </div>
                            <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                                <span class="text-amber-400 block text-[10px]">In Review</span>
                                <span class="font-bold text-amber-300">${pendingCount}</span>
                            </div>
                            <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                                <span class="text-emerald-400 block text-[10px]">Done Today</span>
                                <span class="font-bold text-emerald-300">${completedToday}</span>
                            </div>
                        </div>
                    `;
                    squadContainer.appendChild(card);
                });
            }

            // Render Master Catalog Chores & Rewards
            const catChores = document.getElementById('parent-catalog-chores');
            if (catChores) {
                catChores.innerHTML = '';
                catalog.chores.forEach(c => {
                    const el = document.createElement('div');
                    el.className = "flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-xl text-xs border border-slate-800";
                    el.innerHTML = `
                        <div>
                            <span class="font-bold text-white">${escapeHTML(c.emoji || '📋')} ${escapeHTML(c.title)}</span>
                            <span class="text-[10px] text-slate-400 block">${c.ownership} · ${c.cadence} · ${c.mandatory ? 'Mandatory' : 'Optional'}</span>
                        </div>
                        <div class="text-right font-mono text-[11px]">
                            <span class="text-emerald-400">+${c.points} XP</span> · <span class="text-amber-400">+${c.coins}C</span>
                        </div>
                    `;
                    catChores.appendChild(el);
                });
            }

            const catRewards = document.getElementById('parent-catalog-rewards');
            if (catRewards) {
                catRewards.innerHTML = '';
                appState.rewards.forEach(r => {
                    const el = document.createElement('div');
                    el.className = "flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-xl text-xs border border-slate-800";
                    el.innerHTML = `
                        <div>
                            <span class="font-bold text-white">${escapeHTML(r.emoji || '🎁')} ${escapeHTML(r.title)}</span>
                            <span class="text-[10px] text-slate-400 block">Tier ${r.tier || 1}</span>
                        </div>
                        <div class="font-mono text-xs font-bold text-amber-400">
                            ${r.cost} Coins
                        </div>
                    `;
                    catRewards.appendChild(el);
                });
            }

            appState.kids.forEach(kid => {
                const row = document.createElement('div');
                row.className = "py-3 flex items-center justify-between gap-2";
                row.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <span class="text-xl">${escapeHTML(kid.avatar)}</span>
                        <div>
                            <span class="font-bold text-white text-xs font-heading block">${escapeHTML(kid.name)}</span>
                            <span class="text-[10px] text-neoncyan font-mono font-bold">${kid.xp} permanent XP · ${kid.coins} Coins</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap justify-end items-center gap-1">
                        <button onclick="renameKid('${kid.id}')" class="text-slate-300 border border-slate-600 rounded-lg px-2 py-2 text-xs">Rename</button>
                        ${kid.archived ? `<button onclick="restoreKid('${kid.id}')" class="text-neoncyan border border-cyan-700 rounded-lg px-2 py-2 text-xs">Restore</button><span class="text-xs text-slate-400">Archived · paused</span>` : `
                        <button onclick="adjustKidCoins('${kid.id}', -5)" aria-label="Remove 5 Coins" class="bg-valored/20 text-valored border border-valored/40 px-2 py-1 rounded text-xs font-bold btn-bounce">-5</button>
                        <button onclick="adjustKidCoins('${kid.id}', 5)" aria-label="Add 5 Coins" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-1 rounded text-xs font-bold btn-bounce">+5</button>
                        <button onclick="archiveKid('${kid.id}')" class="text-slate-300 border border-slate-600 rounded-lg px-2 py-2 text-xs">Archive…</button>`}
                    </div>
                `;
                container.appendChild(row);
            });
        }

        // Navigation state
        function updateNavigation() {
            const parentNavBtn = document.getElementById('nav-parent');
            if (appState.isParentMode) {
                parentNavBtn.classList.remove('hidden');
            } else {
                parentNavBtn.classList.add('hidden');
                if (appState.activeView === 'parent') appState.activeView = 'chores';
            }

            ['chores', 'shop', 'parent'].forEach(v => {
                const btn = document.getElementById(`nav-${v}`);
                if (btn) {
                    if (v === appState.activeView) {
                        btn.className = "flex flex-col items-center text-valored font-bold transition-all btn-bounce";
                    } else {
                        btn.className = "flex flex-col items-center text-slate-500 font-bold hover:text-slate-300 transition-all btn-bounce";
                    }
                }
            });
            parentNavBtn.classList.toggle('hidden', !appState.isParentMode);
            const hasKid = appState.kids.some(k => k.id === appState.activeKidId);
            document.getElementById('main-nav').classList.toggle('hidden', !hasKid && !appState.isParentMode);
            document.getElementById('nav-chores').classList.toggle('hidden', !hasKid);
            document.getElementById('nav-shop').classList.toggle('hidden', !hasKid && !appState.isParentMode);
            ['chores','shop','parent'].forEach(v => {
                const visible = v === appState.activeView && (v === 'parent' ? appState.isParentMode : hasKid || (v === 'shop' && appState.isParentMode));
                document.getElementById(`view-${v}`).classList.toggle('hidden', !visible);
            });
        }

        // --- HANDLERS ---
        function dayRecord(kid, day) {
            return kid.days[day] ||= {required: [], completed: [], earned: 0, lost: 0, missed: false};
        }

        function readingBlocked(chore) {
            if (chore.exclusiveGroup !== 'reading') return false;
            const kid = appState.kids.find(k => k.id === chore.assignedTo);
            return (kid?.readingDays || []).includes(chore.day) || appState.chores.some(c =>
                c.id !== chore.id && c.assignedTo === chore.assignedTo && c.day === chore.day &&
                c.exclusiveGroup === 'reading' && ['pending','completed'].includes(c.status));
        }

        function sharedJobBlocked(chore) {
            const template = catalog.chores.find(t => t.ownership === 'shared' && (t.id === chore.templateId || t.title === chore.title));
            if (!template) return false;
            const period = c => template.cadence === 'weekly' ? c.period || weekStart(c.day) : c.day;
            return appState.chores.some(c => c.id !== chore.id && (activePlayer(c.assignedTo) || c.status === 'completed') &&
                (c.templateId === template.id || c.title === template.title) &&
                ['active','pending','completed'].includes(c.status) &&
                (template.cadence === 'on-demand' ? ['active','pending'].includes(c.status) : period(c) === period(chore)));
        }

        function queueReadingBonuses() {
            const template = catalog.chores.find(c => c.bonus === 'reading');
            if (!template) return false;
            let changed = false;
            appState.kids.forEach(kid => {
                if (kid.archived) return;
                kid.readingDays ||= [];
                kid.readingBonuses ||= {};
                const weeks = new Map();
                new Set(kid.readingDays).forEach(day => {
                    const week = weekStart(day);
                    weeks.set(week, (weeks.get(week) || 0) + 1);
                });
                weeks.forEach((count, week) => {
                    if (count < template.requiredDays || kid.readingBonuses[week]) return;
                    kid.readingBonuses[week] = 'pending';
                    appState.chores.push({...templateQuest(template, kid.id), daily: false, period: week, status: 'pending'});
                    changed = true;
                });
            });
            return changed;
        }

        function renderTemplates() {
            const select = document.getElementById('template-choice');
            if (!select.options.length) {
                catalog.chores.forEach(c => select.add(new Option(c.title, c.id)));
            }
            const target = document.getElementById('template-player');
            const selected = target.value;
            target.innerHTML = '<option value="">Choose one player</option>' + activeKids().map(k => `<option value="${k.id}">${escapeHTML(k.name)}</option>`).join('');
            target.value = selected;
            if (!document.getElementById('template-date').value) document.getElementById('template-date').value = today();
            renderTemplateDetails();
        }

        function renderTemplateDetails() {
            const template = catalog.chores.find(c => c.id === document.getElementById('template-choice').value);
            if (!template) return;
            document.getElementById('template-details').textContent = `${template.points} lifetime XP / ${template.coins} Coins · ${template.ownership} · ${template.scheduled ? 'scheduled session' : template.cadence} · nominal penalty ${template.penalty}, applied max ${maxPenalty(template)} (also bounded by original-day earnings and balance). ${template.bonus ? 'Automatically queued for parent confirmation after five distinct reading days; not manually deployable.' : template.ownership === 'shared' ? 'ONE player per household job. Daily/weekly deployment repeats for this player until deleted.' : 'Deploy separately to each player who needs it. Daily/weekly deployment repeats until deleted.'}`;
            document.getElementById('template-date-field').classList.toggle('hidden', !template.scheduled);
            document.getElementById('template-date').disabled = !template.scheduled;
            document.getElementById('template-deploy').disabled = !!template.bonus;
        }

        function deployTemplate(event) {
            event.preventDefault();
            if (!appState.isParentMode) return;
            rollDailyQuests();
            const template = catalog.chores.find(c => c.id === document.getElementById('template-choice').value);
            const kidId = document.getElementById('template-player').value;
            const date = template?.scheduled ? document.getElementById('template-date').value : today();
            if (!template || template.bonus || !activePlayer(kidId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today()) return showToast('Choose an active player and a current/future session date.', 'alert-circle');
            const duplicate = templateDuplicate(template, kidId, date);
            if (duplicate) return showToast('Already deployed or recorded for this period. Shared jobs have only one owner; delete an unsubmitted assignment before moving it.', 'alert-circle');
            appState.chores.push(templateQuest(template, kidId, date));
            saveToStorage();
            renderApp();
            showToast('Catalog template deployed to one player.', 'crosshair');
        }

        function importDefaultRewards() {
            if (!appState.isParentMode || !window.confirm('Add missing source-catalog rewards? Existing prices, custom rewards and request snapshots will not change. This explicitly restores deleted defaults too.')) return;
            catalog.rewards.forEach(r => {
                if (!appState.rewards.some(saved => saved.id === r.id || saved.title === r.title)) appState.rewards.push({...r});
            });
            saveToStorage();
            renderApp();
        }

        function getStreak(kid) {
            const cleared = day => {
                const record = kid.days[day];
                return record && !record.missed && record.completed.length > 0 && record.required.every(id => record.completed.includes(id));
            };
            if (kid.days[today()]?.missed) return 0;
            let date = cleared(today()) ? today() : previousDay(today());
            let streak = 0;
            while (cleared(date)) { streak++; date = previousDay(date); }
            return streak;
        }

        function applyMiss(chore) {
            const kid = activePlayer(chore.assignedTo);
            if (!kid) return 0;
            const day = dayRecord(kid, chore.day);
            const loss = Math.min(kid.coins, maxPenalty(chore), Math.max(0, day.earned - day.lost));
            kid.coins -= loss;
            day.lost += loss;
            if (chore.daily && chore.mandatory) day.missed = true;
            // Pending copies keep their original mandatory-day obligation.
            if (day.required.includes(chore.id)) day.missed = true;
            chore.status = 'missed';
            chore.actualPenalty = loss;
            if (chore.bonus === 'reading') kid.readingBonuses[chore.period] = 'declined';
            return loss;
        }

        function rollDailyQuests() {
            let changed = false;
            const date = today();
            const next = [];
            appState.chores.forEach(chore => {
                if (!activePlayer(chore.assignedTo)) { next.push(chore); return; }
                const weekly = chore.cadence === 'weekly' && !chore.bonus;
                if (isRecurring(chore) && (weekly ? (chore.period || weekStart(chore.day)) < weekStart(date) : chore.day < date)) {
                    if (chore.status === 'active' && chore.daily && chore.mandatory) applyMiss(chore);
                    // Optional unsubmitted quests simply expire; only obligations auto-fail.
                    next.push({...chore, id: `c_${newId()}`, day: date, period: weekly ? weekStart(date) : date, status: 'active', actualPenalty: 0});
                    // Keep dated results and outstanding reviews without repeating them again.
                    if (chore.status === 'active') chore.status = 'expired';
                    chore.archivedDaily = !!chore.daily;
                    chore.daily = false;
                    chore.archived = true;
                    next.push(chore);
                    changed = true;
                } else next.push(chore);
            });
            appState.chores = next;
            next.filter(c => c.daily && c.mandatory && activePlayer(c.assignedTo)).forEach(c => {
                const day = dayRecord(appState.kids.find(k => k.id === c.assignedTo), c.day);
                if (!day.required.includes(c.id)) { day.required.push(c.id); changed = true; }
            });
            if (queueReadingBonuses()) changed = true;
            if (changed) saveToStorage();
            return changed;
        }

        function grantChore(chore) {
            if (!activePlayer(chore.assignedTo)) return;
            if (!['active','pending'].includes(chore.status)) return;
            if (!appState.isParentMode && (chore.status !== 'active' || chore.assignedTo !== appState.activeKidId || needsReview(chore))) return;
            if (sharedJobBlocked(chore)) return showToast('Shared job already assigned/claimed. Parent: delete duplicate unsubmitted assignments and choose ONE owner.', 'alert-circle');
            if (readingBlocked(chore) || chore.day > today()) return showToast('Only one reading option per local day; future sessions cannot be claimed.', 'alert-circle');
            const kid = appState.kids.find(k => k.id === chore.assignedTo);
            if (chore.bonus === 'reading' && (!appState.isParentMode || kid?.readingBonuses?.[chore.period] !== 'pending' || new Set((kid.readingDays || []).filter(d => weekStart(d) === chore.period)).size < chore.requiredDays)) return;
            if (!kid || !validAmount(kid.xp + chore.points) || !validAmount(kid.coins + chore.coins) || !validAmount(dayRecord(kid, chore.day).earned + chore.coins)) return showToast('Balance limit reached.', 'alert-circle');
            chore.status = 'completed';
            kid.xp += chore.points;
            kid.coins += chore.coins;
            const day = dayRecord(kid, chore.day);
            day.completed.push(chore.id);
            day.earned += chore.coins;
            if (chore.exclusiveGroup === 'reading') {
                (kid.readingDays ||= []).push(chore.day);
                appState.chores.filter(c => c.id !== chore.id && c.assignedTo === kid.id && c.day === chore.day && c.exclusiveGroup === 'reading' && c.status === 'active').forEach(c => { c.status = 'expired'; });
            }
            if (chore.bonus === 'reading') kid.readingBonuses[chore.period] = 'completed';
            queueReadingBonuses();
            saveToStorage();
            playGamerSound('success');
            triggerConfetti();
            showToast(`+${chore.points} permanent XP · +${chore.coins} Coins`, 'award');
            renderApp();
        }

        function selectKid(id) {
            if (!activePlayer(id)) return;
            appState.isParentMode = false;
            requestedTemplateId = null;
            ['modal-chore','modal-kid','modal-reward','modal-pin'].forEach(closeModal);
            appState.activeKidId = id;
            switchMainView('chores');
            setTaskTab('active');
            document.getElementById('template-player').value = '';
            renderApp();
            document.getElementById('hero-name').focus();
        }

        function setTaskTab(tab) {
            appState.activeTab = tab;

            ['active', 'pending', 'completed', 'missed'].forEach(t => {
                const btn = document.getElementById(`tab-btn-${t}`);
                if (t === tab) {
                    btn.className = "flex-1 py-2 rounded-lg text-center transition-all bg-valored text-white font-heading tracking-wider shadow";
                } else {
                    btn.className = "flex-1 py-2 rounded-lg text-center transition-all text-slate-400 hover:text-white font-heading tracking-wider";
                }
            });

            renderChores();
            renderChoreChoices();
            lucide.createIcons();
        }

        function switchMainView(view) {
            if (!['chores','shop','parent'].includes(view) || (view === 'parent' && !appState.isParentMode)) return;
            if (!appState.activeKidId && !appState.isParentMode) return;
            appState.activeView = view;
            document.getElementById('view-chores').classList.toggle('hidden', view !== 'chores');
            document.getElementById('view-shop').classList.toggle('hidden', view !== 'shop');
            document.getElementById('view-parent').classList.toggle('hidden', view !== 'parent');
            updateNavigation();
            renderEntry();
        }

        // Submit Quest for Completion
        function markChoreDone(choreId) {
            const rolled = rollDailyQuests();
            const chore = appState.chores.find(c => c.id === choreId);
            if (!chore || !activePlayer(chore.assignedTo) || chore.status !== 'active' || (!appState.isParentMode && chore.assignedTo !== appState.activeKidId)) {
                if (rolled) {
                    renderApp();
                    showToast(`That quest expired at midnight. A fresh one is ready.${chore?.actualPenalty ? ` -${chore.actualPenalty} Coins; XP is safe.` : ''}`, 'alert-circle');
                }
                return;
            }
            if (chore.day > today() || readingBlocked(chore)) return showToast('Already chose reading for this day, or this session is still in the future.', 'alert-circle');
            if (sharedJobBlocked(chore)) return showToast('Shared job already assigned/claimed. Parent: delete duplicate unsubmitted assignments and choose ONE owner.', 'alert-circle');
            // Non-daily work earns activity on submission day. Pending reviews keep that date.
            if (!chore.daily && !chore.bonus) chore.day = today();

            if (appState.isParentMode || !needsReview(chore)) {
                grantChore(chore);
            } else {
                chore.status = 'pending';
                saveToStorage();
                playGamerSound('success');
                showToast('Quest submitted for Parent Review!', 'shield-alert');
                renderApp();
            }
        }

        // Approve Quest (Parent)
        function approveChore(choreId) {
            if (!appState.isParentMode) return;
            const chore = appState.chores.find(c => c.id === choreId);
            if (!chore || chore.status !== 'pending') return;
            grantChore(chore);
        }

        function rejectChore(choreId) {
            failChore(choreId);
        }

        // Fail Quest / Apply Penalty
        function failChore(choreId) {
            if (!appState.isParentMode) return;
            const rolled = rollDailyQuests();
            const chore = appState.chores.find(c => c.id === choreId);
            if (!chore || !activePlayer(chore.assignedTo) || !['active','pending'].includes(chore.status)) {
                if (rolled) {
                    renderApp();
                    showToast(`That quest expired at midnight. A fresh one is ready.${chore?.actualPenalty ? ` -${chore.actualPenalty} Coins; XP is safe.` : ''}`, 'alert-circle');
                }
                return;
            }
            const loss = applyMiss(chore);

            saveToStorage();
            playGamerSound('penalty');
            showToast(`Missed: -${loss} Coins. XP is safe.`, 'alert-triangle');
            renderApp();
        }

        // Claim Loot Reward
        function claimReward(rewardId) {
            const kid = activePlayer(appState.activeKidId);
            const reward = appState.rewards.find(r => r.id === rewardId);
            if (!kid || !reward || !validAmount(reward.cost) || reward.cost <= 0 || kid.coins < reward.cost || appState.redemptions.some(r => r.kidId === kid.id && r.rewardId === rewardId && r.status === 'pending')) return;
            // Reserve Coins now: parents fulfill or decline/refund this exact quote.
            kid.coins -= reward.cost;
            appState.redemptions.push({id: `r_${newId()}`, rewardId, kidId: kid.id, title: reward.title, cost: reward.cost, status: 'pending'});
            saveToStorage();
            playGamerSound('redeem');
            triggerConfetti();
            showToast('Coins reserved. Parent fulfillment pending.', 'gift');
            renderApp();
        }

        // Parent Manual Adjust Points
        function adjustKidCoins(kidId, amount) {
            if (!appState.isParentMode || !Number.isSafeInteger(amount) || Math.abs(amount) > 1000) return;
            const kid = activePlayer(kidId);
            if (!kid || !validAmount(Math.max(0, kid.coins + amount))) return;

            kid.coins = Math.max(0, kid.coins + amount);
            saveToStorage();
            renderApp();
        }

        function processRedemption(id, approve) {
            if (!appState.isParentMode || typeof approve !== 'boolean') return;
            const request = appState.redemptions.find(r => r.id === id);
            if (!request || request.status !== 'pending') return;
            const kid = appState.kids.find(k => k.id === request.kidId);
            if (!kid || !validAmount(request.cost) || request.cost <= 0) return;
            if (!approve) {
                if (!validAmount(kid.coins + request.cost)) return showToast('Balance limit prevents refund.', 'alert-circle');
                kid.coins += request.cost;
            }
            request.status = approve ? 'fulfilled' : 'declined';
            saveToStorage();
            renderApp();
        }

        function renderRedemptions() {
            const container = document.getElementById('redemptions-list');
            container.innerHTML = '<h3 class="font-bold">Redemption requests</h3>';
            const requests = appState.redemptions.filter(r => appState.isParentMode || r.kidId === appState.activeKidId);
            if (!requests.length) container.innerHTML += '<p class="text-xs text-slate-400">No requests yet.</p>';
            requests.forEach(r => {
                const kid = appState.kids.find(k => k.id === r.kidId);
                const row = document.createElement('div');
                row.className = 'bg-darkcard p-3 rounded-xl text-xs space-y-2 border border-darkborder';
                row.innerHTML = `<p>${escapeHTML(kid.name)}${kid.archived ? ' (archived)' : ''} · ${escapeHTML(r.title)} · ${r.cost} Coins</p><p>${r.status === 'pending' ? 'Pending parent fulfillment · Coins reserved' : r.status === 'declined' ? 'Declined · Coins refunded' : 'Fulfilled'}</p>${appState.isParentMode && r.status === 'pending' ? `<button class="text-emerald-400 p-2" onclick="processRedemption('${r.id}', true)">Fulfill</button><button class="text-valored p-2" onclick="processRedemption('${r.id}', false)">Decline & refund</button>` : ''}`;
                container.appendChild(row);
            });
        }

        // --- PARENT AUTHENTICATION ---

        function enterParent() {
            appState.activeKidId = null;
            requestedTemplateId = null;
            toggleParentMode();
        }

        function toggleParentMode() {
            if (appState.isParentMode) {
                appState.isParentMode = false;
                requestedTemplateId = null;
                appState.activeView = 'chores';
                switchMainView('chores');
                ['modal-chore','modal-kid','modal-reward'].forEach(closeModal);
                document.getElementById('mode-btn-text').textContent = 'Parent PIN';
                showToast('Switched to Player Mode', 'user');
                renderApp();
            } else {
                document.getElementById('pin-input').value = '';
                openModal('modal-pin');
            }
        }

        function verifyPin() {
            const entered = document.getElementById('pin-input').value;
            if (entered === appState.parentPin) {
                appState.isParentMode = true;
                closeModal('modal-pin');
                document.getElementById('mode-btn-text').textContent = 'Exit Admin';
                document.getElementById('mode-subtitle').textContent = 'Parent Admin Mode';
                showToast('Parent Controls Unlocked', 'shield-check');
                renderApp();
                switchMainView('parent');
                openRequestedTemplate();
            } else {
                showToast('Invalid PIN! Default is 1234', 'alert-circle');
            }
        }

        // --- MODALS & FORMS ---

        let modalReturnFocus = null;
        function openModal(id) {
            modalReturnFocus = document.activeElement;
            const modal = document.getElementById(id);
            modal.classList.remove('hidden');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-label', modal.querySelector('h3').textContent.trim());
            (modal.querySelector('input:not([type="hidden"]), select') || modal.querySelector('button'))?.focus();
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            const wasOpen = !modal.classList.contains('hidden');
            modal.classList.add('hidden');
            if (id === 'modal-pin' && !appState.isParentMode) requestedTemplateId = null;
            if (wasOpen && modalReturnFocus?.isConnected) modalReturnFocus.focus();
        }

        function handleModalKey(event) {
            const modal = document.querySelector('[role="dialog"]:not(.hidden)');
            if (!modal) return;
            if (event.key === 'Escape') { event.preventDefault(); closeModal(modal.id); }
            if (event.key !== 'Tab') return;
            const fields = [...modal.querySelectorAll('button, input:not([type="hidden"]), select')].filter(el => !el.disabled && el.getClientRects().length);
            const first = fields[0], last = fields[fields.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }

        function openAddChoreModal() {
            if (!appState.isParentMode) return;
            const select = document.getElementById('chore-assigned');
            select.innerHTML = '<option value="">Choose one player (one job, one award)</option>';
            activeKids().forEach(k => {
                select.innerHTML += `<option value="${k.id}">${escapeHTML(k.name)}</option>`;
            });

            document.getElementById('chore-name').value = '';
            document.getElementById('chore-points').value = 30;
            document.getElementById('chore-coins').value = 10;
            document.getElementById('chore-penalty').value = 3;
            document.getElementById('chore-cadence').value = 'on-demand';
            document.getElementById('chore-mandatory').checked = false;
            document.getElementById('chore-review').checked = false;
            openModal('modal-chore');
        }

        function saveChore(e) {
            e.preventDefault();
            if (!appState.isParentMode) return;
            const name = document.getElementById('chore-name').value.trim();
            if (catalog.chores.some(c => c.title.toLowerCase() === name.toLowerCase())) return showToast('Use Source Catalog deployment for a catalog task, including reading and shared jobs.', 'alert-circle');
            const assigned = document.getElementById('chore-assigned').value;
            const points = Number(document.getElementById('chore-points').value);
            const coins = Number(document.getElementById('chore-coins').value);
            const penalty = Number(document.getElementById('chore-penalty').value);
            const cadence = document.getElementById('chore-cadence').value;
            if (!name || name.length > 120 || !validAmount(points) || points < 1 || points > 1000 || !validAmount(coins) || coins > 1000 || !validAmount(penalty) || penalty > 1000 || !activePlayer(assigned) || !['daily','weekly','on-demand'].includes(cadence)) return showToast('Choose one active player. XP 1–1000, Coins and nominal penalty 0–1000. Applied loss is still bounded.', 'alert-circle');
            const emoji = document.getElementById('chore-emoji').value;

            const newChore = {
                id: 'c_' + newId(),
                title: name,
                assignedTo: assigned,
                points: points,
                coins,
                penalty: penalty,
                emoji: emoji,
                status: 'active',
                day: today(),
                cadence,
                period: cadence === 'weekly' ? weekStart(today()) : today(),
                daily: cadence === 'daily',
                mandatory: cadence === 'daily' && document.getElementById('chore-mandatory').checked,
                requiresReview: points >= 75 || coins >= 75 || document.getElementById('chore-review').checked
            };

            appState.chores.push(newChore);
            saveToStorage();
            closeModal('modal-chore');
            showToast('New Quest Deployed!', 'crosshair');
            renderApp();
        }

        function deleteChore(id) {
            if (!appState.isParentMode) return;
            const chore = appState.chores.find(c => c.id === id);
            if (chore && !activePlayer(chore.assignedTo)) return;
            if (chore?.bonus) return showToast('Approve or reject the weekly bonus; its weekly claim record is retained.', 'alert-circle');
            if (chore) {
                const day = dayRecord(appState.kids.find(k => k.id === chore.assignedTo), chore.day);
                day.required = day.required.filter(required => required !== id);
            }
            appState.chores = appState.chores.filter(c => c.id !== id);
            saveToStorage();
            renderApp();
        }

        function openAddKidModal() {
            if (!appState.isParentMode) return;
            document.getElementById('kid-name').value = '';
            document.getElementById('kid-points').value = 0;
            openModal('modal-kid');
        }

        function saveKid(e) {
            e.preventDefault();
            if (!appState.isParentMode) return;
            const name = document.getElementById('kid-name').value.trim();
            const avatar = document.getElementById('kid-avatar').value;
            const coins = Number(document.getElementById('kid-points').value);
            if (!name || name.length > 40 || !validAmount(coins) || coins > 1000) return showToast('Enter a name and starting Coins from 0–1000.', 'alert-circle');

            const newKid = {
                id: 'k_' + newId(),
                name: name,
                avatar: avatar,
                xp: 0,
                coins,
                days: {}
            };

            appState.kids.push(newKid);

            saveToStorage();
            closeModal('modal-kid');
            showToast('Gamer Tag Profile Created!', 'user-check');
            renderApp();
        }

        function renameKid(id) {
            if (!appState.isParentMode) return;
            const kid = appState.kids.find(k => k.id === id);
            if (!kid) return;
            const name = window.prompt(`Rename ${kid.name}. Balances and history stay with this profile.`, kid.name);
            if (name === null) return;
            if (!name.trim() || name.trim().length > 40) return showToast('Enter a name from 1–40 characters.', 'alert-circle');
            kid.name = name.trim();
            saveToStorage();
            renderApp();
        }

        function archiveKid(id) {
            if (!appState.isParentMode) return;
            const kid = activePlayer(id);
            if (!kid || !window.confirm(`Archive ${kid.name}? No data is removed: XP, Coins, chores, history and reward requests are kept. This player will be hidden and all chores paused: no earnings, automatic misses or penalties while archived. Parent can restore them here, even if no active players remain.`)) return;
            kid.archived = true;
            if (appState.activeKidId === id) appState.activeKidId = null;
            requestedTemplateId = null;
            appState.activeView = 'parent';
            saveToStorage();
            renderApp();
        }

        function restoreKid(id) {
            if (!appState.isParentMode) return;
            const kid = appState.kids.find(k => k.id === id && k.archived);
            if (!kid || !window.confirm(`Restore ${kid.name}? Daily/weekly chores resume in the current period without catch-up penalties or awards. Past scheduled sessions expire without loss. Pending reviews keep their original dates. Shared jobs assigned elsewhere may need parent resolution. No child is selected automatically.`)) return;
            const date = today();
            const resumed = [];
            appState.chores.filter(c => c.assignedTo === id).forEach(chore => {
                const weekly = chore.cadence === 'weekly' && !chore.bonus;
                if (isRecurring(chore) && (weekly ? (chore.period || weekStart(chore.day)) < weekStart(date) : chore.day < date)) {
                    resumed.push({...chore, id: `c_${newId()}`, day: date, period: weekly ? weekStart(date) : date, status: 'active', actualPenalty: 0});
                    if (chore.status === 'active') chore.status = 'expired';
                    chore.archivedDaily = !!chore.daily;
                    chore.daily = false;
                    chore.archived = true;
                } else if (chore.scheduled && chore.status === 'active' && chore.day < date) chore.status = 'expired';
            });
            appState.chores.push(...resumed);
            kid.archived = false;
            saveToStorage();
            renderApp();
        }

        async function resetPrototypeData() {
            if (!appState.isParentMode || prototypeResetInProgress || storageFailed) return;
            const answer = window.prompt('IRREVERSIBLE: reset the server family for ALL devices using this PHP service? This removes every active/archived profile, XP, Coins, chores, rewards/custom catalog copies, history, requests and saved PIN. Reload starts from data/catalog.json (Alex/Chris and current defaults, PIN 1234). Old browser data is ignored and left untouched. Type RESET to continue.');
            if (answer !== 'RESET') return;
            prototypeResetInProgress = true;
            document.getElementById('app').inert = true;
            try {
                await saveQueue;
                if (storageFailed) return;
                const response = await fetch('api.php', {method: 'DELETE', headers: {'If-Match': serverETag}});
                requireValue(response.status !== 409, 'Another page or device changed the saved family; reset was not accepted.');
                requireValue(response.ok, `Storage reset HTTP ${response.status}.`);
                requireValue((await response.json()).success === true && responseETag(response) === '"none"', 'Storage did not confirm the reset.');
            } catch (error) {
                storageFailure(`Reset could not be confirmed: ${error.message} The server family may already have been removed; no successful reset is claimed.`);
                return;
            }
            window.location.reload();
        }

        function openAddRewardModal() {
            if (!appState.isParentMode) return;
            document.getElementById('reward-title').value = '';
            document.getElementById('reward-cost').value = 100;
            openModal('modal-reward');
        }

        function saveReward(e) {
            e.preventDefault();
            if (!appState.isParentMode) return;
            const title = document.getElementById('reward-title').value.trim();
            const cost = Number(document.getElementById('reward-cost').value);
            const tier = Number(document.getElementById('reward-tier').value);
            if (!title || title.length > 120 || !validAmount(cost) || cost < 1 || cost > 100000 || ![1,2,3].includes(tier)) return showToast('Enter a title, tier and whole Coin price from 1–100000.', 'alert-circle');
            const emoji = document.getElementById('reward-emoji').value;

            const newReward = {
                id: 'r_' + newId(),
                title: title,
                cost: cost,
                tier,
                emoji: emoji
            };

            appState.rewards.push(newReward);
            saveToStorage();
            closeModal('modal-reward');
            showToast('Loot added to Vault!', 'gift');
            renderApp();
        }

        function deleteReward(id) {
            if (!appState.isParentMode) return;
            appState.rewards = appState.rewards.filter(r => r.id !== id);
            saveToStorage();
            renderApp();
        }

        // --- EMOJI PICKERS ---
        function initEmojiPickers() {
            buildEmojiPicker('emoji-picker-chore', EMOJI_CHORES, 'chore-emoji');
            buildEmojiPicker('emoji-picker-kid', EMOJI_KIDS, 'kid-avatar');
            buildEmojiPicker('emoji-picker-reward', EMOJI_REWARDS, 'reward-emoji');
        }

        function buildEmojiPicker(containerId, emojiList, targetInputId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';

            emojiList.forEach((emoji, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `text-lg p-2 rounded-xl border ${index === 0 ? 'border-valored bg-valored/20' : 'border-slate-800 bg-slate-900'}`;
                btn.textContent = emoji;
                btn.onclick = () => {
                    Array.from(container.children).forEach(c => c.className = 'text-lg p-2 rounded-xl border border-slate-800 bg-slate-900');
                    btn.className = 'text-lg p-2 rounded-xl border border-valored bg-valored/20';
                    document.getElementById(targetInputId).value = emoji;
                };
                container.appendChild(btn);
            });
        }

        // --- EFFECTS ---

        function triggerConfetti() {
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 90,
                    spread: 70,
                    origin: { y: 0.7 }
                });
            }
        }

        function showToast(message, iconName = 'info') {
            if (storageFailed) return;
            const toast = document.getElementById('toast');
            const msgEl = document.getElementById('toast-msg');
            const iconEl = document.getElementById('toast-icon');

            msgEl.textContent = pendingWrites ? `${message} · Saving to server…` : message;
            if (iconEl) iconEl.setAttribute('data-lucide', iconName);
            lucide.createIcons();

            toast.classList.remove('-translate-y-20', 'opacity-0', 'pointer-events-none');
            toast.classList.add('translate-y-0', 'opacity-100');

            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('-translate-y-20', 'opacity-0', 'pointer-events-none');
            }, 2500);
        }
