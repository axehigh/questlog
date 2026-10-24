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
        const STORAGE_KEY = 'chore_quest_gamer_data';
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
                const response = await fetch('catalog.json');
                requireValue(response.ok, `Catalog HTTP ${response.status}`);
                catalog = await response.json();
                defaultKids = catalog.kids;
                // Validate defaults even when this browser already has a custom catalog.
                checkRows(catalog.chores, 'templates');
                checkRows(defaultKids, 'starter players');
                catalog.chores.forEach(c => requireValue(typeof c.title === 'string' && typeof c.emoji === 'string' && validAmount(c.points) && validAmount(c.coins) && validAmount(c.penalty) && ['daily','weekly','on-demand'].includes(c.cadence) && ['shared','personal'].includes(c.ownership) && typeof c.mandatory === 'boolean' && typeof c.requiresReview === 'boolean' && (!c.bonus || (c.bonus === 'reading' && Number.isInteger(c.requiredDays) && c.requiredDays >= 1 && c.requiredDays <= 7)), 'Invalid catalog template'));
                catalog.chores.filter(c => c.seed && c.ownership === 'shared').forEach(c => requireValue(defaultKids.some(k => k.id === c.defaultOwner), 'Unknown shared seed owner'));
                validateData({kids: defaultKids, chores: seedChores(), rewards: catalog.rewards, redemptions: [], parentPin: '1234'});
                loadFromStorage();
                initEmojiPickers();
                renderApp();
                window.addEventListener('focus', renderApp);
                setInterval(renderApp, 60000);
            } catch (error) {
                document.getElementById('app').textContent = `Unable to load Chore Quest: ${error.message}. Saved data has not been replaced. Check catalog.json and browser storage, then reload. Serve this folder over HTTP (python3 -m http.server 8000); file:// is not supported.`;
            }
        };

        function expandChores(chores, kids = defaultKids) {
            requireValue(Array.isArray(chores), 'Invalid catalog chores');
            return chores.flatMap(c => (c.assignedTo === 'all' ? kids : [kids.find(k => k.id === c.assignedTo)]).map(k => {
                requireValue(k, 'Unknown quest player');
                return {...c, id: c.assignedTo === 'all' ? `${c.id}_${k.id}` : c.id, assignedTo: k.id, day: c.day || today()};
            }));
        }
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
        function loadFromStorage() {
            const saved = localStorage.getItem(STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : {schemaVersion: 2, kids: defaultKids, chores: seedChores(), rewards: catalog.rewards, redemptions: [], parentPin: '1234'};
            requireValue(!parsed.schemaVersion || parsed.schemaVersion === 2, 'Unsupported saved data version');
            if (!parsed.schemaVersion) {
                // History cannot be reconstructed: retain every legacy point in BOTH ledgers.
                parsed.kids = (parsed.kids === undefined ? defaultKids : parsed.kids).map(k => ({...k, xp: k.xp ?? k.points ?? 0, coins: k.coins ?? k.points ?? 0, days: k.days ?? {}, streak: k.days ? k.streak ?? 0 : 0}));
                parsed.chores = expandChores((parsed.chores === undefined ? [] : parsed.chores).map(c => ({...c, coins: c.coins ?? Math.max(1, Math.ceil(c.points / 5)), penalty: c.penalty ?? 0, daily: c.daily ?? false, mandatory: c.mandatory ?? false, requiresReview: c.requiresReview ?? true})), parsed.kids);
                parsed.rewards = (parsed.rewards === undefined ? catalog.rewards : parsed.rewards).map(r => ({...r, tier: r.tier ?? 1}));
                if (parsed.redemptions === undefined) parsed.redemptions = [];
                if (parsed.parentPin === undefined) parsed.parentPin = '1234';
            }
            validateData(parsed);
            parsed.kids.forEach(k => {
                k.readingDays ??= [];
                k.readingBonuses ??= {};
            });
            if (saved && !parsed.schemaVersion && !localStorage.getItem(`${STORAGE_KEY}_legacy_backup`)) localStorage.setItem(`${STORAGE_KEY}_legacy_backup`, saved);
            Object.assign(appState, {kids: parsed.kids, chores: parsed.chores, rewards: parsed.rewards, redemptions: parsed.redemptions, parentPin: parsed.parentPin});
            savedData = parsed;
            if (appState.kids.length > 0) {
                appState.activeKidId = appState.kids[0].id;
            }
        }

        function saveToStorage() {
            validateData(appState);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...savedData,
                schemaVersion: 2,
                kids: appState.kids,
                chores: appState.chores,
                rewards: appState.rewards,
                parentPin: appState.parentPin,
                redemptions: appState.redemptions
                }));
            } catch (error) {
                window.alert('Unable to save changes in browser storage. Stop using this page and reload after fixing storage access/space. Your previous saved data has not been replaced.');
                throw error;
            }
        }

        // --- RENDER FUNCTIONS ---
        function renderApp() {
            rollDailyQuests();
            renderKidSelector();
            renderKidHero();
            renderChores();
            renderRewards();
            renderRedemptions();
            renderParentControls();
            renderTemplates();
            updateNavigation();
            lucide.createIcons();
        }

        // Render Player Selector Bar
        function renderKidSelector() {
            const container = document.getElementById('kid-selector-bar');
            container.innerHTML = '';

            appState.kids.forEach(kid => {
                const isActive = kid.id === appState.activeKidId;
                const btn = document.createElement('button');
                btn.onclick = () => selectKid(kid.id);
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
                return isKidMatch && (c.status === appState.activeTab || (appState.activeTab === 'missed' && c.status === 'expired'));
            });

            // Tab counter badges
            ['active', 'pending', 'completed', 'missed'].forEach(tab => {
                const count = appState.chores.filter(c =>
                    (c.assignedTo === appState.activeKidId || c.assignedTo === 'all') && (c.status === tab || (tab === 'missed' && c.status === 'expired'))
                ).length;
                document.getElementById(`count-${tab}`).textContent = count;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12 px-4 bg-darkcard rounded-2xl border border-darkborder">
                        <div class="text-4xl mb-2">👾</div>
                        <p class="font-bold font-heading text-white text-sm">NO QUESTS FOUND IN THIS SECTOR</p>
                        <p class="text-xs text-slate-500 mt-1">Check other tabs or ask Parent Admin for new deployments.</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(chore => {
                const card = document.createElement('div');
                card.className = "bg-darkcard p-3.5 rounded-2xl border border-darkborder flex items-center justify-between gap-3 shadow-md hover:border-slate-700 transition-all";

                let actionArea = '';

                if (appState.activeTab === 'active') {
                    const sharedConflict = sharedJobBlocked(chore);
                    const blocked = readingBlocked(chore) || sharedConflict || chore.day > today();
                    actionArea = `
                        <button onclick="markChoreDone('${chore.id}')" ${blocked ? 'disabled' : ''} class="disabled:opacity-40 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-heading text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-emerald-950 btn-bounce">
                            <i data-lucide="check" class="w-4 h-4"></i> ${chore.day > today() ? 'Scheduled' : sharedConflict ? 'Parent: choose owner' : blocked ? 'Reading chosen' : 'Complete'}
                        </button>
                    `;
                } else if (appState.activeTab === 'pending') {
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
                } else if (appState.activeTab === 'completed') {
                    actionArea = `<span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Cleared</span>`;
                } else if (appState.activeTab === 'missed') {
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
        }

        // Render Rewards Loot Shop
        function renderRewards() {
            const container = document.getElementById('rewards-list');
            container.innerHTML = '';

            const currentKid = appState.kids.find(k => k.id === appState.activeKidId);

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
                    <div class="flex items-center space-x-1">
                        <button onclick="adjustKidCoins('${kid.id}', -5)" aria-label="Remove 5 Coins" class="bg-valored/20 text-valored border border-valored/40 px-2 py-1 rounded text-xs font-bold btn-bounce">-5</button>
                        <button onclick="adjustKidCoins('${kid.id}', 5)" aria-label="Add 5 Coins" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-1 rounded text-xs font-bold btn-bounce">+5</button>
                        <button onclick="deleteKid('${kid.id}')" class="text-slate-600 hover:text-valored p-1 ml-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
            return appState.chores.some(c => c.id !== chore.id &&
                (c.templateId === template.id || c.title === template.title) &&
                ['active','pending','completed'].includes(c.status) &&
                (template.cadence === 'on-demand' ? ['active','pending'].includes(c.status) : period(c) === period(chore)));
        }

        function queueReadingBonuses() {
            const template = catalog.chores.find(c => c.bonus === 'reading');
            if (!template) return false;
            let changed = false;
            appState.kids.forEach(kid => {
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
            target.innerHTML = '<option value="">Choose one player</option>' + appState.kids.map(k => `<option value="${k.id}">${escapeHTML(k.name)}</option>`).join('');
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
            if (!template || template.bonus || !appState.kids.some(k => k.id === kidId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today()) return showToast('Choose a player and a current/future session date.', 'alert-circle');
            const period = template.cadence === 'weekly' ? weekStart(date) : date;
            const duplicate = appState.chores.some(c => (c.templateId === template.id || c.title === template.title) &&
                (template.ownership === 'shared' || c.assignedTo === kidId) &&
                (['active','pending'].includes(c.status) || (template.cadence !== 'on-demand' && (c.period || (template.cadence === 'weekly' ? weekStart(c.day) : c.day)) === period)));
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
            const kid = appState.kids.find(k => k.id === chore.assignedTo);
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
            next.filter(c => c.daily && c.mandatory).forEach(c => {
                const day = dayRecord(appState.kids.find(k => k.id === c.assignedTo), c.day);
                if (!day.required.includes(c.id)) { day.required.push(c.id); changed = true; }
            });
            if (queueReadingBonuses()) changed = true;
            if (changed) saveToStorage();
            return changed;
        }

        function grantChore(chore) {
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
            appState.activeKidId = id;
            renderApp();
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
            lucide.createIcons();
        }

        function switchMainView(view) {
            if (!['chores','shop','parent'].includes(view) || (view === 'parent' && !appState.isParentMode)) return;
            appState.activeView = view;
            document.getElementById('view-chores').classList.toggle('hidden', view !== 'chores');
            document.getElementById('view-shop').classList.toggle('hidden', view !== 'shop');
            document.getElementById('view-parent').classList.toggle('hidden', view !== 'parent');
            updateNavigation();
        }

        // Submit Quest for Completion
        function markChoreDone(choreId) {
            const rolled = rollDailyQuests();
            const chore = appState.chores.find(c => c.id === choreId);
            if (!chore || chore.status !== 'active' || (!appState.isParentMode && chore.assignedTo !== appState.activeKidId)) {
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
            if (!chore || !['active','pending'].includes(chore.status)) {
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
            const kid = appState.kids.find(k => k.id === appState.activeKidId);
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
            const kid = appState.kids.find(k => k.id === kidId);
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
                row.innerHTML = `<p>${escapeHTML(kid.name)} · ${escapeHTML(r.title)} · ${r.cost} Coins</p><p>${r.status === 'pending' ? 'Pending parent fulfillment · Coins reserved' : r.status === 'declined' ? 'Declined · Coins refunded' : 'Fulfilled'}</p>${appState.isParentMode && r.status === 'pending' ? `<button class="text-emerald-400 p-2" onclick="processRedemption('${r.id}', true)">Fulfill</button><button class="text-valored p-2" onclick="processRedemption('${r.id}', false)">Decline & refund</button>` : ''}`;
                container.appendChild(row);
            });
        }

        // --- PARENT AUTHENTICATION ---

        function toggleParentMode() {
            if (appState.isParentMode) {
                appState.isParentMode = false;
                switchMainView('chores');
                ['modal-chore','modal-kid','modal-reward'].forEach(closeModal);
                document.getElementById('mode-btn-text').textContent = 'Parent PIN';
                document.getElementById('mode-subtitle').textContent = 'Gamer Player Zone';
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
            } else {
                showToast('Invalid PIN! Default is 1234', 'alert-circle');
            }
        }

        // --- MODALS & FORMS ---

        function openModal(id) {
            document.getElementById(id).classList.remove('hidden');
        }

        function closeModal(id) {
            document.getElementById(id).classList.add('hidden');
        }

        function openAddChoreModal() {
            if (!appState.isParentMode) return;
            const select = document.getElementById('chore-assigned');
            select.innerHTML = '<option value="">Choose one player (one job, one award)</option>';
            appState.kids.forEach(k => {
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
            if (!name || name.length > 120 || !validAmount(points) || points < 1 || points > 1000 || !validAmount(coins) || coins > 1000 || !validAmount(penalty) || penalty > 1000 || !appState.kids.some(k => k.id === assigned) || !['daily','weekly','on-demand'].includes(cadence)) return showToast('Choose one player. XP 1–1000, Coins and nominal penalty 0–1000. Applied loss is still bounded.', 'alert-circle');
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
            if (!appState.activeKidId) appState.activeKidId = newKid.id;

            saveToStorage();
            closeModal('modal-kid');
            showToast('Gamer Tag Profile Created!', 'user-check');
            renderApp();
        }

        function deleteKid(id) {
            if (!appState.isParentMode) return;
            if (appState.redemptions.some(r => r.kidId === id && r.status === 'pending')) return showToast('Process pending redemptions before deleting this player.', 'alert-circle');
            if (appState.kids.length <= 1) {
                showToast('At least one Gamer profile must exist.', 'alert-circle');
                return;
            }
            appState.kids = appState.kids.filter(k => k.id !== id);
            appState.chores = appState.chores.filter(c => c.assignedTo !== id);
            appState.redemptions = appState.redemptions.filter(r => r.kidId !== id);
            if (appState.activeKidId === id) {
                appState.activeKidId = appState.kids[0].id;
            }
            saveToStorage();
            renderApp();
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
            const toast = document.getElementById('toast');
            const msgEl = document.getElementById('toast-msg');
            const iconEl = document.getElementById('toast-icon');

            msgEl.textContent = message;
            if (iconEl) iconEl.setAttribute('data-lucide', iconName);
            lucide.createIcons();

            toast.classList.remove('-translate-y-20', 'opacity-0', 'pointer-events-none');
            toast.classList.add('translate-y-0', 'opacity-100');

            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('-translate-y-20', 'opacity-0', 'pointer-events-none');
            }, 2500);
        }
