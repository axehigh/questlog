// Small logic smoke check, no browser or third-party dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const memory = new Map();
const context = vm.createContext({
    console, crypto: webcrypto, window: {},
    localStorage: {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)}
});
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
context.catalogJSON = fs.readFileSync('catalog.json', 'utf8');
context.assert = assert;
vm.runInContext(`
    catalog = JSON.parse(catalogJSON);
    loadFromStorage();
    rollDailyQuests();
    assert.equal(appState.rewards.length, 9);
    assert.equal(appState.chores.length, 8);
    // Stub UI only; handlers still exercise actual persistence and guards.
    renderApp = showToast = playGamerSound = triggerConfetti = () => {};
    const kid = appState.kids[0];
    const chore = appState.chores.find(c => c.assignedTo === kid.id && !c.requiresReview);
    markChoreDone(chore.id);
    const xp = kid.xp;
    const earned = kid.coins;
    markChoreDone(chore.id);
    assert.equal(kid.xp, xp);
    assert.equal(getStreak(kid), 0); // mandatory homework still outstanding
    appState.isParentMode = true;
    const homework = appState.chores.find(c => c.assignedTo === kid.id && c.requiresReview);
    markChoreDone(homework.id);
    assert.equal(getStreak(kid), 1);
    const permanentXP = kid.xp;
    adjustKidCoins(kid.id, 100);
    const before = kid.coins;
    claimReward('r1', -999); // caller cannot set price
    assert.equal(kid.coins, before - catalog.rewards[0].cost);
    const request = appState.redemptions[0];
    appState.isParentMode = false;
    processRedemption(request.id, false);
    adjustKidCoins(kid.id, -100);
    assert.equal(request.status, 'pending');
    appState.isParentMode = true;
    processRedemption(request.id, false);
    assert.equal(kid.coins, before);
    processRedemption(request.id, false);
    assert.equal(kid.coins, before);
    const miss = appState.chores.find(c => c.assignedTo === kid.id && c.status === 'active');
    const prior = kid.coins;
    failChore(miss.id);
    assert.ok(prior - kid.coins <= Math.min(5, Math.floor(miss.coins / 2), earned + homework.coins));
    assert.equal(kid.xp, permanentXP);
    assert.ok(kid.coins >= 0);
    const yesterday = previousDay(today());
    const old = appState.chores.find(c => c.assignedTo === kid.id && c.daily && c.mandatory);
    old.day = yesterday;
    old.status = 'active';
    dayRecord(kid, yesterday).required.push(old.id);
    rollDailyQuests();
     assert.equal(kid.days[yesterday].missed, true);
     assert.ok(!appState.chores.some(c => c.daily && c.day < today()));
     // Review regressions: clicks crossing midnight, optional expiry and readable history.
     const RealDate = Date;
     let date = '2026-10-24';
     Date = class extends RealDate {
         constructor(...args) { super(...(args.length ? args : [date + 'T12:00:00'])); }
     };
     appState.chores = [];
     kid.days = {};
     kid.coins = 100;
     const daily = {id: 'rollover', title: 'Daily test', emoji: '🎮', assignedTo: kid.id,
         points: 10, coins: 10, penalty: 5, day: date, daily: true,
         mandatory: true, requiresReview: false, status: 'active'};
     let renders = 0;
     let toast = '';
     renderApp = () => { renders++; };
     showToast = message => { toast = message; };
     for (const action of [markChoreDone, failChore]) {
         date = '2026-10-24';
         const task = {...daily};
         appState.chores = [task];
         kid.days = {};
         dayRecord(kid, date).earned = 10;
         date = '2026-10-27';
         const balance = kid.coins;
         const beforeRenders = renders;
         action(task.id);
         assert.equal(kid.coins, balance - 5);
         assert.equal(task.actualPenalty, 5);
         assert.ok(renders > beforeRenders);
         assert.match(toast, /midnight/);
         const snapshot = JSON.stringify(appState.chores);
         rollDailyQuests();
         assert.equal(JSON.stringify(appState.chores), snapshot);
     }
     date = '2026-10-24';
     const optional = {...daily, id: 'optional', mandatory: false};
     const done = {...daily, id: 'done', status: 'completed'};
     const pending = {...daily, id: 'pending', status: 'pending', requiresReview: true};
     const failed = {...daily, id: 'failed', status: 'missed', actualPenalty: 2};
     appState.chores = [optional, done, pending, failed];
     kid.days = {};
     dayRecord(kid, date).earned = 20;
     const balance = kid.coins;
     date = '2026-10-25';
     rollDailyQuests();
     assert.equal(kid.coins, balance);
     assert.equal(dayRecord(kid, '2026-10-24').lost, 0);
     assert.ok(!appState.chores.some(c => c.id === optional.id));
     for (const task of [done, pending, failed]) {
         assert.ok(appState.chores.includes(task));
         assert.equal(task.day, '2026-10-24');
         assert.equal(task.daily, false);
         assert.equal(task.archivedDaily, true);
     }
     saveToStorage(); loadFromStorage();
     assert.equal(appState.chores.find(c => c.id === failed.id).actualPenalty, 2);
     const validSaved = localStorage.getItem(STORAGE_KEY);
     for (const invalid of ['<img src=x onerror=alert(1)>', -1, 1.5, null]) {
         const invalidData = JSON.parse(validSaved);
         invalidData.chores.find(c => c.id === failed.id).actualPenalty = invalid;
         const invalidSaved = JSON.stringify(invalidData);
         localStorage.setItem(STORAGE_KEY, invalidSaved);
         assert.throws(() => loadFromStorage(), /Invalid quest/);
         assert.equal(localStorage.getItem(STORAGE_KEY), invalidSaved);
     }
     localStorage.setItem(STORAGE_KEY, validSaved);
     Date = RealDate;
     const legacy = {kids:[{id:'custom',name:'Saved',avatar:'🎮',points:123,streak:8}],chores:[],rewards:[],parentPin:'1234'};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    loadFromStorage();
    assert.equal(appState.kids[0].xp, 123);
    assert.equal(appState.kids[0].coins, 123);
    assert.equal(appState.rewards.length, 0);
    assert.equal(appState.chores.length, 0);
    assert.equal(getStreak(appState.kids[0]), 0);
    assert.equal(localStorage.getItem(STORAGE_KEY + '_legacy_backup'), JSON.stringify(legacy));
    console.log('Reward logic smoke checks passed.');
`, context);
