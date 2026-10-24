// Run with: node --test scripts/reward-edge-cases.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync('app.js', 'utf8');
const defaults = fs.readFileSync('catalog.json', 'utf8');
const key = 'chore_quest_gamer_data';

function fixture(saved) {
    const storage = new Map(saved === undefined ? [] : [[key, saved]]);
    const elements = new Map();
    const context = vm.createContext({
        assert, console, crypto: webcrypto, window: {}, defaults,
        document: {getElementById(id) {
            if (!elements.has(id)) elements.set(id, {value: '', checked: false, classList: {add() {}, remove() {}}});
            return elements.get(id);
        }},
        localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v)}
    });
    const run = code => vm.runInContext(code, context);
    run(source);
    run(`
        catalog = JSON.parse(defaults);
        let date = '2026-10-24';
        Date = class extends Date {
            constructor(...args) { super(...(args.length ? args : [date + 'T12:00:00'])); }
        };
        renderApp = showToast = playGamerSound = triggerConfetti = () => {};
        function quest(overrides = {}) {
            const chore = {id: 'test_' + appState.chores.length, title: 'Test', emoji: '🎮',
                assignedTo: appState.activeKidId, points: 10, coins: 10, penalty: 5,
                day: today(), daily: false, mandatory: false, requiresReview: false,
                status: 'active', ...overrides};
            appState.chores.push(chore);
            return chore;
        }
    `);
    return {run, storage, elements};
}

function loaded() {
    const f = fixture();
    f.run('loadFromStorage(); rollDailyQuests(); const kid = appState.kids[0];');
    return f;
}

test('completion is idempotent; spending, refunds, misses and overrides never reduce XP', () => {
    loaded().run(`
        const task = quest();
        markChoreDone(task.id); markChoreDone(task.id);
        assert.equal(kid.xp, 10);
        assert.equal(kid.coins, 10);
        appState.isParentMode = true;
        adjustKidCoins(kid.id, 100);
        claimReward('r1', -999);
        const request = appState.redemptions[0];
        const reserved = kid.coins;
        claimReward('r1');
        assert.equal(appState.redemptions.length, 1);
        assert.equal(kid.coins, reserved);
        processRedemption(request.id, false);
        processRedemption(request.id, false);
        assert.equal(kid.coins, 110);
        failChore(quest().id);
        adjustKidCoins(kid.id, -1000);
        assert.equal(kid.coins, 0);
        assert.equal(kid.xp, 10);
        assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).kids[0].xp, 10);
    `);
});

test('penalties independently cap at balance, configuration, five, half award and daily earnings', () => {
    for (const [balance, earned, award, penalty, expected] of [
        [100, 0, 100, 100, 0], [100, 3, 100, 100, 3],
        [2, 100, 100, 100, 2], [100, 100, 100, 2, 2],
        [100, 100, 100, 100, 5], [100, 100, 7, 100, 3]
    ]) {
        const {run} = loaded();
        run(`
            kid.coins = ${balance}; kid.xp = 123;
            dayRecord(kid, today()).earned = ${earned};
            appState.isParentMode = true;
            const task = quest({coins: ${award}, penalty: ${penalty}});
            failChore(task.id); failChore(task.id);
            assert.equal(task.actualPenalty, ${expected});
            assert.equal(kid.coins, ${balance - expected});
            assert.equal(kid.xp, 123);
        `);
    }
});

test('multiple penalties cannot raid savings beyond original day earnings', () => {
    loaded().run(`
        kid.coins = 100;
        dayRecord(kid, today()).earned = 7;
        appState.isParentMode = true;
        for (let i = 0; i < 4; i++) failChore(quest().id);
        assert.equal(kid.coins, 93);
        assert.equal(dayRecord(kid, today()).lost, 7);
    `);
});

test('child cannot approve, fail, adjust, delete or grant another player quest', () => {
    loaded().run(`
        const task = quest({requiresReview: true});
        markChoreDone(task.id);
        approveChore(task.id); rejectChore(task.id); failChore(task.id);
        adjustKidCoins(kid.id, 100); deleteChore(task.id); deleteReward('r1');
        const other = quest({assignedTo: appState.kids[1].id});
        markChoreDone(other.id); grantChore(other);
        assert.equal(task.status, 'pending');
        assert.equal(other.status, 'active');
        assert.equal(kid.xp, 0); assert.equal(kid.coins, 0);
        assert.equal(appState.rewards.length, 9);
        appState.isParentMode = true;
        approveChore(task.id); approveChore(task.id);
        assert.equal(kid.xp, 10); assert.equal(kid.coins, 10);
    `);
});

test('high-value thresholds require review even if catalog disables review', () => {
    loaded().run(`
        for (const amounts of [{points: 40, coins: 0}, {points: 1, coins: 15}]) {
            const task = quest(amounts);
            markChoreDone(task.id); grantChore(task);
            assert.equal(task.status, 'pending');
        }
        assert.equal(kid.xp, 0); assert.equal(kid.coins, 0);
    `);
});

test('redemption snapshots survive reward deletion; only parent can fulfill/refund once', () => {
    loaded().run(`
        kid.coins = 100; kid.xp = 50;
        claimReward('r1', 0);
        const request = appState.redemptions[0];
        const price = request.cost;
        assert.equal(kid.coins, 100 - price);
        processRedemption(request.id, true); processRedemption(request.id, false);
        assert.equal(request.status, 'pending');
        appState.isParentMode = true;
        deleteKid(kid.id);
        assert.ok(appState.kids.includes(kid));
        deleteReward('r1');
        saveToStorage(); loadFromStorage();
        const restored = appState.redemptions[0];
        assert.equal(restored.title, request.title); assert.equal(restored.cost, price);
        processRedemption(restored.id, true); processRedemption(restored.id, false);
        assert.equal(restored.status, 'fulfilled');
        assert.equal(appState.kids[0].coins, 100 - price);
        assert.equal(appState.kids[0].xp, 50);
    `);
});

test('invalid prices, insufficient balance, invalid adjustments and balance overflow are rejected', () => {
    loaded().run(`
        const reward = appState.rewards[0];
        for (const cost of [0, -1, 1.5, NaN, Infinity, '1', 1000000001]) {
            reward.cost = cost; claimReward(reward.id);
            assert.equal(appState.redemptions.length, 0);
        }
        reward.cost = 15; claimReward(reward.id);
        assert.equal(appState.redemptions.length, 0);
        appState.isParentMode = true;
        for (const amount of [1.5, NaN, Infinity, '5', 1001, -1001]) adjustKidCoins(kid.id, amount);
        assert.equal(kid.coins, 0);
        kid.coins = 1000000000; adjustKidCoins(kid.id, 5);
        const task = quest(); grantChore(task);
        assert.equal(kid.coins, 1000000000); assert.equal(task.status, 'active');
        kid.coins = 0; kid.xp = 1000000000; grantChore(task);
        assert.equal(kid.xp, 1000000000); assert.equal(kid.coins, 0);
    `);
});

test('streak counts calendar days, not tasks, resets for misses and skipped days', () => {
    loaded().run(`
        appState.chores = []; kid.days = {};
        markChoreDone(quest().id); markChoreDone(quest().id);
        assert.equal(getStreak(kid), 1);
        date = '2026-10-25';
        assert.equal(getStreak(kid), 1);
        markChoreDone(quest().id);
        assert.equal(getStreak(kid), 2);
        const mandatory = quest({daily: true, mandatory: true});
        rollDailyQuests();
        assert.equal(getStreak(kid), 1); // today's mandatory task is incomplete
        markChoreDone(mandatory.id);
        assert.equal(getStreak(kid), 2);
        appState.isParentMode = true;
        failChore(quest({daily: true, mandatory: true}).id);
        assert.equal(getStreak(kid), 0);
        date = '2026-10-27';
        rollDailyQuests();
        assert.equal(getStreak(kid), 0);
        assert.equal(kid.coins, 35); // no streak multiplier
    `);
});

test('rollover expires active dailies once, creates independent fresh quests and preserves savings', () => {
    loaded().run(`
        kid.coins = 200;
        const oldIds = appState.chores.filter(c => c.daily).map(c => c.id);
        date = '2026-10-27'; rollDailyQuests();
        assert.equal(kid.coins, 200);
        assert.equal(kid.days['2026-10-24'].missed, true);
        assert.equal(getStreak(kid), 0);
        assert.ok(appState.chores.filter(c => c.daily).every(c => c.day === date && !oldIds.includes(c.id)));
        const snapshot = JSON.stringify(appState.chores);
        rollDailyQuests();
        assert.equal(JSON.stringify(appState.chores), snapshot);
    `);
});

test('late approval counts original date and leaves new mandatory daily incomplete', () => {
    loaded().run(`
        appState.chores = []; kid.days = {};
        const task = quest({daily: true, mandatory: true, requiresReview: true});
        rollDailyQuests(); markChoreDone(task.id);
        assert.equal(getStreak(kid), 0); assert.equal(kid.xp, 0);
        date = '2026-10-25'; rollDailyQuests();
        const fresh = appState.chores.find(c => c.daily);
        assert.equal(task.status, 'pending'); assert.equal(task.day, '2026-10-24');
        assert.notEqual(fresh.id, task.id); assert.equal(fresh.status, 'active');
        appState.isParentMode = true; approveChore(task.id);
        assert.equal(getStreak(kid), 1);
        assert.deepEqual(kid.days['2026-10-24'].completed, [task.id]);
        assert.equal(kid.days['2026-10-25'].completed.length, 0);
        markChoreDone(fresh.id);
        assert.equal(getStreak(kid), 2);
        assert.equal(kid.coins, 20);
    `);
});

test('rejecting a rolled pending mandatory quest records original-day miss', () => {
    loaded().run(`
        appState.chores = []; kid.days = {}; kid.coins = 100;
        const task = quest({daily: true, mandatory: true, requiresReview: true});
        rollDailyQuests(); markChoreDone(task.id);
        date = '2026-10-25'; rollDailyQuests();
        dayRecord(kid, today()).earned = 50;
        appState.isParentMode = true; rejectChore(task.id);
        assert.equal(kid.days['2026-10-24'].missed, true);
        assert.equal(kid.coins, 100); // cannot charge today's earnings for yesterday's miss
        assert.equal(kid.xp, 0);
    `);
});

test('legacy migration preserves fields, exact backup, custom catalogs and original prices', () => {
    const legacy = JSON.stringify({kids: [{id: 'custom', name: 'Saved', avatar: '🎮', points: 123, streak: 8, note: 'keep'}],
        chores: [{id: 'old', title: 'Saved task', emoji: '🎮', assignedTo: 'custom', points: 21, penalty: 90, status: 'active'}],
        rewards: [{id: 'old_reward', title: 'Saved loot', emoji: '🎮', cost: 999}], parentPin: '9876'}, null, 2);
    const {run, storage} = fixture(legacy);
    run(`
        loadFromStorage();
        assert.equal(appState.kids[0].xp, 123); assert.equal(appState.kids[0].coins, 123);
        assert.equal(appState.kids[0].points, 123); assert.equal(appState.kids[0].note, 'keep');
        assert.equal(getStreak(appState.kids[0]), 0);
        const task = appState.chores[0];
        assert.equal(task.coins, 5); assert.equal(task.penalty, 5);
        assert.equal(task.daily, false); assert.equal(task.requiresReview, true);
        assert.equal(appState.rewards[0].cost, 999); assert.equal(appState.rewards[0].tier, 1);
        assert.equal(appState.parentPin, '9876');
        saveToStorage(); loadFromStorage(); saveToStorage();
    `);
    assert.equal(storage.get(key + '_legacy_backup'), legacy);
    assert.equal(JSON.parse(storage.get(key)).schemaVersion, 2);
});

test('saved custom edits and deliberately empty catalogs override JSON defaults', () => {
    const {run} = loaded();
    run(`
        appState.chores = []; appState.rewards = [];
        saveToStorage(); loadFromStorage();
        assert.equal(appState.chores.length, 0); assert.equal(appState.rewards.length, 0);
        appState.rewards.push({id: 'custom', title: 'Custom loot', emoji: '🎮', cost: 17, tier: 2});
        saveToStorage();
        catalog.rewards[0].cost = 999; loadFromStorage();
        assert.equal(appState.rewards.length, 1); assert.equal(appState.rewards[0].cost, 17);
    `);
});

test('invalid saved data never replaces storage or creates migration backup', () => {
    for (const raw of ['{broken', '{"schemaVersion":3}', JSON.stringify({kids: [{id: 'bad', name: 'Bad', avatar: '🎮', points: -1}], chores: [], rewards: []})]) {
        const {run, storage} = fixture(raw);
        assert.throws(() => run('loadFromStorage()'));
        assert.equal(storage.get(key), raw);
        assert.equal(storage.has(key + '_legacy_backup'), false);
    }
});

test('invalid JSON catalogs block startup without replacing existing storage', async () => {
    for (const kind of ['missing', 'malformed', 'duplicate', 'fractional']) {
        const {run, storage} = loaded();
        run('saveToStorage()');
        const before = storage.get(key);
        run(`
            initEmojiPickers = () => {};
            fetch = async () => ({ok: ${kind !== 'missing'}, status: 404, json: async () => {
                ${kind === 'malformed' ? "throw new Error('Invalid JSON')" : ''}
                const data = JSON.parse(defaults);
                ${kind === 'duplicate' ? 'data.rewards.push({...data.rewards[0]});' : ''}
                ${kind === 'fractional' ? 'data.chores[0].coins = 1.5;' : ''}
                return data;
            }});
        `);
        await run('window.onload()');
        assert.match(run("document.getElementById('app').textContent"), /Unable to load Chore Quest/);
        assert.equal(storage.get(key), before);
    }
});

test('chore form rejects invalid input and expands all-player chores independently', () => {
    const {run, elements} = loaded();
    const set = (id, value) => {
        run(`document.getElementById(${JSON.stringify(id)})`);
        elements.get(id).value = value;
    };
    run('appState.isParentMode = true; const originalCount = appState.chores.length;');
    set('chore-name', 'Custom daily'); set('chore-assigned', 'all'); set('chore-emoji', '🎮');
    for (const [xp, coins, penalty] of [[0, 10, 1], [1001, 10, 1], [1.5, 10, 1], [10, -1, 0], [10, 101, 0], [10, 5, 3], [10, 10, 6], ['NaN', 10, 0]]) {
        set('chore-points', xp); set('chore-coins', coins); set('chore-penalty', penalty);
        run('saveChore({preventDefault() {}}); assert.equal(appState.chores.length, originalCount);');
    }
    set('chore-points', 40); set('chore-coins', 10); set('chore-penalty', 5);
    run(`
        saveChore({preventDefault() {}});
        const added = appState.chores.slice(originalCount);
        assert.equal(added.length, 2); assert.notEqual(added[0].id, added[1].id);
        assert.notEqual(added[0].assignedTo, added[1].assignedTo);
        assert.ok(added.every(c => c.requiresReview));
        markChoreDone(added[0].id);
        assert.equal(added[1].status, 'active');
    `);
});

test('missing legacy collections seed defaults, while an existing backup is never overwritten', () => {
    const raw = JSON.stringify({kids: [{id: 'custom', name: 'Saved', avatar: '🎮', points: 50}]});
    const {run, storage} = fixture(raw);
    storage.set(key + '_legacy_backup', 'original backup');
    run(`
        loadFromStorage();
        assert.equal(appState.rewards.length, catalog.rewards.length);
        assert.equal(appState.chores.length, catalog.chores.length);
        assert.ok(appState.chores.every(c => c.assignedTo === 'custom'));
        saveToStorage();
    `);
    assert.equal(storage.get(key + '_legacy_backup'), 'original backup');
});

test('storage write failure alerts and preserves the exact previously saved data', () => {
    const {run, storage} = loaded();
    run('saveToStorage()');
    const before = storage.get(key);
    run(`
        let alerted = false;
        window.alert = () => { alerted = true; };
        localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
        appState.isParentMode = true;
        assert.throws(() => adjustKidCoins(kid.id, 5), /QuotaExceededError/);
        assert.equal(alerted, true);
    `);
    assert.equal(storage.get(key), before);
});
