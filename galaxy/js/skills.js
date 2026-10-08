/* ============================================================
 *  星海牧场 · 技能层（动作队列 / 专精 / 炼金 / 强化 / 任务 / 市场 / 建筑 / 离线）
 * ============================================================ */

/* ---------- 动作 ---------- */
function actionTime(skill, a) {
  const B = bonuses();
  let spd = 1 + B.speed;
  if (skill === 'enhancing') spd += equipAgg().enhanceSpeed / 100;
  const ml = masteryLevel(skill, a.id);
  spd += ml * 0.001;
  return Math.max(0.3, a.time / Math.max(0.2, spd));
}

function canStart(q) {
  const a = ACTION_MAP[q.skill + ':' + q.actId];
  if (!a) return { ok: false, msg: '动作不存在' };
  if (skillLevel(q.skill) < a.lvl) return { ok: false, msg: '需要 ' + SKILL_MAP[q.skill].name + ' ' + a.lvl + ' 级' };
  if (a.kind === 'enhance') {
    const sl = a.slot;
    if (!S.equip[sl]) return { ok: false, msg: '该部位没有装备' };
    const need = enhanceCost(S.enhance[sl] || 0);
    if (count('essence') < need) return { ok: false, msg: '需要 ' + need + ' 星精华' };
    if ((S.enhance[sl] || 0) >= 10) return { ok: false, msg: '已达 +10 上限' };
    return { ok: true };
  }
  if (a.kind === 'coinify' || a.kind === 'decompose' || a.kind === 'transmute') {
    const t = S.alchTarget;
    if (!t || count(t) < (a.kind === 'transmute' ? 3 : 1)) return { ok: false, msg: '请在炼金面板选择足够的材料' };
    return { ok: true };
  }
  if (a.in && !hasItems(a.in)) return { ok: false, msg: '材料不足' };
  return { ok: true };
}

function enhanceCost(cur) { return Math.round(2 + cur * 3); }

function consumeFor(a) {
  if (a.kind === 'enhance') { takeItems({ essence: enhanceCost(S.enhance[a.slot] || 0) }); return true; }
  if (a.kind === 'coinify' || a.kind === 'decompose') { takeItems({ [S.alchTarget]: 1 }); return true; }
  if (a.kind === 'transmute') { takeItems({ [S.alchTarget]: 3 }); return true; }
  if (a.in) return takeItems(a.in);
  return true;
}

function tryStart() {
  while (S.queue.length) {
    const q = S.queue[0];
    const a = ACTION_MAP[q.skill + ':' + q.actId];
    if (!a) { S.queue.shift(); continue; }
    const c = canStart(q);
    if (!c.ok) {
      if (c.msg !== '材料不足') { S.queue.shift(); pushLog('⚠ ' + a.name + '：' + c.msg); continue; }
      S.action = null;
      return false;
    }
    consumeFor(a);
    if (q.n > 0) { q.n--; if (q.n <= 0) S.queue.shift(); }
    S.action = { skill: q.skill, actId: q.actId, t: 0, dur: actionTime(q.skill, a) };
    UI.dirty = true;
    return true;
  }
  S.action = null;
  UI.dirty = true;
  return false;
}

function queueAction(skill, actId, n) {
  const a = ACTION_MAP[skill + ':' + actId];
  if (!a) return;
  if (skillLevel(skill) < a.lvl) { UI.toast('需要 ' + SKILL_MAP[skill].name + ' ' + a.lvl + ' 级'); return; }
  const last = S.queue[S.queue.length - 1];
  if (last && last.skill === skill && last.actId === actId && last.n > 0 && n > 0) { last.n += n; }
  else S.queue.push({ skill: skill, actId: actId, n: n == null ? 1 : n });
  if (!S.action) tryStart();
  UI.dirty = true;
}

function clearQueue() { S.queue = []; S.action = null; UI.dirty = true; }

function addXp(skill, amt) {
  const B = bonuses();
  const before = skillLevel(skill);
  S.skills[skill] = Math.min(XP_CAP, (S.skills[skill] || 0) + amt * (1 + B.xp + B.wisdom));
  const after = skillLevel(skill);
  if (after > before) {
    pushLog('★ ' + SKILL_MAP[skill].name + ' 升至 ' + after + ' 级！');
    UI.dirty = true;
  }
}

function addSubXp(sub, amt) {
  const B = bonuses();
  S.subs[sub] = Math.min(XP_CAP, (S.subs[sub] || 0) + amt * (1 + B.xp + B.wisdom));
}

function masteryGain(skill, a) {
  const B = bonuses();
  const ml = masteryLevel(skill, a.id);
  const mt = Math.min(400, masteryTotal(skill));
  const base = (1 + 0.35 * ml + 0.015 * mt) * a.time * 25;
  return base * (1 + B.mxp);
}

/* 完成一次动作 */
function completeAction() {
  const act = S.action;
  if (!act) return;
  const a = ACTION_MAP[act.skill + ':' + act.actId];
  if (!a) { S.action = null; return; }
  const B = bonuses();
  const sk = act.skill;
  let burned = false; /* 采集/烹饪分支里赋值，函数尾部 addXp 会用到 */

  if (a.kind === 'enhance') {
    const sl = a.slot;
    const cur = S.enhance[sl] || 0;
    const lvl = skillLevel('enhancing');
    const ml = masteryLevel('enhancing', a.id);
    const chance = Math.min(0.95, 0.55 + lvl * 0.008 + ml * 0.003 - cur * 0.05);
    if (Math.random() < chance) {
      S.enhance[sl] = cur + 1;
      pushLog('✔ 强化成功！' + ITEMS[S.equip[sl]].name + ' → +' + S.enhance[sl]);
    } else {
      S.enhance[sl] = 0;
      pushLog('✖ 强化失败，' + ITEMS[S.equip[sl]].name + ' 退回 +0');
    }
  } else if (a.kind === 'coinify') {
    const t = S.alchTarget;
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.95, 0.40 + lvl * 0.004 + ml * 0.003);
    if (Math.random() < chance) {
      const g = Math.round(ITEMS[t].price * 1.6);
      addGold(g);
      pushLog('💰 金币化成功，获得 ' + fmt(g) + ' 金币');
    } else {
      addItem('essence', 1);
      pushLog('✖ 金币化失败，物品消失（返还 1 星精华）');
    }
  } else if (a.kind === 'decompose') {
    const t = S.alchTarget;
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.95, 0.45 + lvl * 0.004 + ml * 0.003);
    if (Math.random() < chance) {
      const n = Math.max(1, Math.round(ITEMS[t].price / 60));
      addItem('essence', n);
      pushLog('💎 分解成功，获得 ' + n + ' 星精华');
    } else { pushLog('✖ 分解失败'); }
  } else if (a.kind === 'transmute') {
    const t = S.alchTarget;
    const it = ITEMS[t];
    const nxt = nextTierItem(t);
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.9, 0.35 + lvl * 0.003 + ml * 0.003);
    if (nxt && Math.random() < chance) { addItem(nxt, 1); pushLog('♻ 嬗变成功：' + it.name + ' → ' + ITEMS[nxt].name); }
    else { addItem('essence', 1); pushLog('✖ 嬗变失败'); }
  } else {
    /* 采集 / 加工 / 烹饪 / 酿造 */
    const eff = efficiency(sk);
    let mult = Math.floor(eff);
    if (Math.random() < (eff % 1)) mult += 1;
    mult += 1;
    if (a.kind === 'cook') {
      const ml = masteryLevel(sk, a.id);
      const burn = Math.max(0, 0.22 - ml * 0.0022 - skillLevel(sk) * 0.0012 - eff * 0.15);
      if (Math.random() < burn) burned = true;
    }
    if (burned) {
      pushLog('🔥 烹饪失败，' + a.name + ' 烧焦了');
    } else {
      for (const k in a.out) addItem(k, a.out[k] * mult);
      if (S.stats) S.stats.crafted++;
    }
    if (a.rare) {
      for (const k in a.rare) {
        if (Math.random() < a.rare[k] * (1 + B.rare)) { addItem(k, 1); }
      }
    }
    onTaskProgress(sk, a, burned ? 0 : mult);
  }

  addXp(sk, a.xp * (burned ? 0.4 : 1));
  addMastery(sk, a.id, masteryGain(sk, a));
  S.stats.actions++;
  S.action = null;
  tryStart();
  UI.dirty = true;
}

function nextTierItem(id) {
  const fams = [MILK, BERRY, WOOD, BAR, FIBER, CLOTH];
  for (let f = 0; f < fams.length; f++) {
    for (let i = 0; i < fams[f].length - 1; i++) {
      if (fams[f][i][0] === id) return fams[f][i + 1][0];
    }
  }
  return null;
}

/* 每帧推进 */
function tickAction(dt) {
  if (!S.action) { if (S.queue.length) tryStart(); return; }
  S.action.t += dt;
  if (S.action.t >= S.action.dur) completeAction();
}

/* ---------- 任务板 ---------- */
function taskInterval() {
  let h = 8;
  ['t_cd1', 't_cd2', 't_cd3', 't_cd4'].forEach(function (k) { if (S.shop[k]) h--; });
  return h * 3600 * 1000;
}
function taskSlots() { return 6 + (S.shop['t_slot'] || 0); }

function genTask() {
  if (S.tasks.length >= taskSlots()) { S.nextTask = Date.now() + taskInterval(); return; }
  const diff = pick(TASK_DIFF);
  const r = Math.random();
  let t = null;
  if (r < 0.5) {
    /* 采集/加工：产出某物品 */
    const pool = [];
    ['milking', 'foraging', 'woodcutting', 'cheesesmithing', 'tailoring', 'cooking', 'brewing'].forEach(function (sk) {
      ACTIONS[sk].forEach(function (a) {
        if (!a.out) return;
        if (skillLevel(sk) + 8 < a.lvl) return;
        for (const k in a.out) pool.push({ sk: sk, a: a, item: k });
      });
    });
    if (pool.length) {
      const c = pick(pool);
      const need = Math.round(rnd(15, 60) * diff.mul * (1 + skillLevel(c.sk) / 60));
      t = { kind: 'item', skill: c.sk, actId: c.a.id, item: c.item, need: need, have: 0 };
    }
  } else if (r < 0.8) {
    const pool = [];
    ['cheesesmithing', 'crafting', 'tailoring'].forEach(function (sk) {
      ACTIONS[sk].forEach(function (a) {
        if (!a.makeItem) return;
        if (skillLevel(sk) + 10 < a.lvl) return;
        pool.push({ sk: sk, a: a, item: a.makeItem });
      });
    });
    if (pool.length) {
      const c = pick(pool);
      const need = Math.max(1, Math.round(rnd(2, 8) * diff.mul * 0.5));
      t = { kind: 'make', skill: c.sk, actId: c.a.id, item: c.item, need: need, have: 0 };
    }
  }
  if (!t) {
    const z = pick(ZONE_DEFS.filter(function (z) { return combatLevel() + 10 >= z.lvl; })) || ZONE_DEFS[0];
    const need = Math.max(3, Math.round(rnd(10, 30) * diff.mul * 0.4));
    t = { kind: 'kill', zone: z.id, need: need, have: 0 };
  }
  t.id = 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  t.diff = diff.id;
  const base = (ITEMS[t.item] ? ITEMS[t.item].price : 60) * t.need;
  const rate = 1 + 0.25 * (S.shop['t_rate'] || 0);
  t.gold = Math.round((2000 + base * 1.4) * diff.mul * rate);
  t.tokens = Math.round((1 + diff.id * 1.5) * rate);
  S.tasks.push(t);
  S.nextTask = Date.now() + taskInterval();
  pushLog('📜 新的任务：' + taskText(t));
  UI.dirty = true;
}

function taskText(t) {
  if (t.kind === 'kill') return '在「' + ZONE_DEFS.filter(function (z) { return z.id === t.zone; })[0].name + '」击败 ' + t.need + ' 只怪物';
  return (t.kind === 'make' ? '制作 ' : '获得 ') + t.need + ' × ' + ITEMS[t.item].name;
}

function onTaskProgress(skill, a, qty) {
  if (!S.tasks.length) return;
  let done = false;
  S.tasks.forEach(function (t) {
    if (t.kind === 'kill' || t.have >= t.need) return;
    if (t.actId === a.id && t.skill === skill) { t.have += qty; if (t.have >= t.need) done = true; }
    else if (t.kind === 'item' && a.out && a.out[t.item] && t.skill === skill) { t.have += qty * (a.out[t.item] || 0); if (t.have >= t.need) done = true; }
  });
  if (done) UI.dirty = true;
}
function onTaskKill(zoneId) {
  S.tasks.forEach(function (t) { if (t.kind === 'kill' && t.zone === zoneId) { t.have++; } });
  UI.dirty = true;
}
function claimTask(id) {
  const i = S.tasks.findIndex(function (t) { return t.id === id; });
  if (i < 0) return;
  const t = S.tasks[i];
  if (t.have < t.need) { UI.toast('任务尚未完成'); return; }
  addGold(t.gold);
  S.tokens += t.tokens;
  S.taskPoints += t.tokens;
  S.tasks.splice(i, 1);
  pushLog('✅ 完成任务，获得 ' + fmt(t.gold) + ' 金币、' + t.tokens + ' 任务代币');
  UI.dirty = true;
}
function dropTask(id) {
  const i = S.tasks.findIndex(function (t) { return t.id === id; });
  if (i >= 0) { S.tasks.splice(i, 1); UI.dirty = true; }
}
function rerollTask(id, useBell) {
  const i = S.tasks.findIndex(function (t) { return t.id === id; });
  if (i < 0) return;
  const cost = useBell ? 1 : 10000;
  if (useBell) { if (S.cowbell < cost) { UI.toast('牛铃不足'); return; } S.cowbell -= cost; }
  else { if (S.gold < cost) { UI.toast('金币不足'); return; } S.gold -= cost; }
  S.tasks.splice(i, 1);
  genTask();
  UI.dirty = true;
}
function tickTasks() {
  if (Date.now() >= S.nextTask) genTask();
}

/* ---------- 市场 ---------- */
function refreshMarket(force) {
  const now = Date.now();
  if (!force && now - S.market.refresh < 20 * 60 * 1000) return;
  S.market.refresh = now;
  const pool = ITEM_LIST.filter(function (i) { return i.cat === 'mat' || i.cat === 'food' || i.cat === 'drink'; });
  S.market.orders = [];
  for (let i = 0; i < 8; i++) {
    const it = pick(pool);
    const buy = Math.random() < 0.55;
    const qty = Math.max(1, Math.round(rnd(5, 50)));
    S.market.orders.push({
      id: 'o' + i, item: it.id, qty: qty, left: qty, buy: buy,
      mul: buy ? rnd(1.35, 2.0) : rnd(0.5, 0.75)
    });
  }
  UI.dirty = true;
}
function sellItem(id, n) {
  n = Math.min(n, count(id));
  if (n <= 0) return;
  takeItems({ [id]: n });
  const g = Math.round(ITEMS[id].price * 0.5 * n);
  addGold(g);
  S.stats.spent += 0;
  pushLog('售出 ' + n + ' × ' + ITEMS[id].name + '，获得 ' + fmt(g) + ' 金币');
}
function fillOrder(oid) {
  const o = S.market.orders.filter(function (x) { return x.id === oid; })[0];
  if (!o || o.left <= 0) return;
  const n = o.left;
  if (o.buy) {
    if (count(o.item) < n) { UI.toast('物品不足（需 ' + n + '）'); return; }
    takeItems({ [o.item]: n });
    const g = Math.round(ITEMS[o.item].price * o.mul * n);
    addGold(g);
    pushLog('完成订单：售出 ' + n + ' × ' + ITEMS[o.item].name + '，+' + fmt(g) + ' 金币');
    o.left = 0;
  } else {
    const g = Math.round(ITEMS[o.item].price * o.mul * n);
    if (S.gold < g) { UI.toast('金币不足'); return; }
    S.gold -= g;
    addItem(o.item, n);
    pushLog('完成订单：购入 ' + n + ' × ' + ITEMS[o.item].name + '，-' + fmt(g) + ' 金币');
    o.left = 0;
  }
  UI.dirty = true;
}

/* ============================================================
 *  拍卖行（魔兽世界风格）
 *  - 挂单：起始价 / 一口价 / 拍卖时长 / 押金
 *  - 竞标：每次至少加价 5%，被超价立即退款
 *  - 结算：成交退押金，流拍退物品不退押金
 * ============================================================ */
const AH_DURS = [
  { id: 'short', name: '短', hours: 2, mul: 1 },
  { id: 'med', name: '中', hours: 8, mul: 2 },
  { id: 'long', name: '长', hours: 24, mul: 3 }
];
const AH_NPC = ['银河商人', '牧牛人工会', '星尘杂货', '奶牛爵士', '云端商栈', '牧野行商', '霜刃拍卖师'];
const AH_LIVE = 16;

function ahDur(id) {
  for (let i = 0; i < AH_DURS.length; i++) if (AH_DURS[i].id === id) return AH_DURS[i];
  return AH_DURS[0];
}
function ahDeposit(itemId, qty, durMul) {
  const base = (ITEMS[itemId] ? ITEMS[itemId].price : 10) * qty;
  return Math.max(1, Math.round(base * 0.05 * durMul));
}
function ahMinBid(l) {
  if (!l || l.done) return 0;
  return l.bid > 0 ? Math.ceil(l.bid * 1.05) : l.start;
}
/* 建议起始价：略低于基准价 */
function ahSuggest(itemId) {
  const it = ITEMS[itemId];
  if (!it) return 1;
  return Math.max(1, Math.round(it.price * 0.8));
}

function ahRefresh(force) {
  if (!S.ah) S.ah = { listings: [], seq: 1, refresh: 0 };
  if (!S.ah.listings) S.ah.listings = [];
  if (typeof S.ah.seq !== 'number') S.ah.seq = 1;
  const now = Date.now();
  if (!force && now - (S.ah.refresh || 0) < 30 * 60 * 1000) return;
  S.ah.refresh = now;
  const pool = ITEM_LIST.filter(function (i) {
    return i.cat === 'mat' || i.cat === 'food' || i.cat === 'drink' ||
      (i.cat === 'equip' && i.price < 80000);
  });
  if (!pool.length) return;
  let live = S.ah.listings.filter(function (l) { return !l.mine && !l.done; });
  let guard = 0;
  while (live.length < AH_LIVE && guard++ < 80) {
    const it = pick(pool);
    const qty = Math.max(1, Math.round(rnd(1, 12)));
    const dur = pick(AH_DURS);
    const start = Math.max(1, Math.round(it.price * rnd(0.55, 0.95)));
    const buyout = Math.random() < 0.72 ? Math.round(start * rnd(1.25, 1.9)) : 0;
    const bid = Math.random() < 0.32 ? Math.round(start * rnd(1.02, 1.18)) : 0;
    live.push({
      id: 'a' + (S.ah.seq++), item: it.id, qty: qty, start: start, buyout: buyout,
      bid: bid, bidder: bid ? pick(AH_NPC) : null, mine: false, seller: pick(AH_NPC),
      dur: dur.id, end: now + dur.hours * 3600000 * rnd(0.25, 1), deposit: 0,
      done: false, result: null
    });
  }
  S.ah.listings = S.ah.listings.filter(function (l) { return l.mine; }).concat(live);
  UI.dirty = true;
}

function ahPost(item, qty, start, buyout, durId) {
  if (!ITEMS[item]) return false;
  qty = Math.max(1, Math.min(Math.round(qty) || 1, count(item)));
  if (count(item) < qty) { UI.toast('物品不足'); return false; }
  const dur = ahDur(durId);
  start = Math.max(1, Math.round(start));
  buyout = buyout > 0 ? Math.round(buyout) : 0;
  if (buyout && buyout <= start) { UI.toast('一口价需高于起始价'); return false; }
  const dep = ahDeposit(item, qty, dur.mul);
  if (S.gold < dep) { UI.toast('押金不足（需 ' + fmt(dep) + '）'); return false; }
  takeItems({ [item]: qty });
  S.gold -= dep;
  S.ah.listings.unshift({
    id: 'a' + (S.ah.seq++), item: item, qty: qty, start: start, buyout: buyout,
    bid: 0, bidder: null, mine: true, seller: S.name, dur: dur.id,
    end: Date.now() + dur.hours * 3600000, deposit: dep, done: false, result: null
  });
  pushLog('已上架 ' + qty + ' × ' + ITEMS[item].name + '（起始 ' + fmt(start) + '，押金 ' + fmt(dep) + '）');
  UI.dirty = true;
  return true;
}

function ahFind(id) {
  for (let i = 0; i < S.ah.listings.length; i++) if (S.ah.listings[i].id === id) return S.ah.listings[i];
  return null;
}

/* 竞标：立即扣款；若原本就是最高出价者只补差价 */
function ahBid(id) {
  const l = ahFind(id);
  if (!l || l.done || l.mine) return;
  const price = ahMinBid(l);
  if (l.buyout && price > l.buyout) { ahBuyout(id); return; }
  const total = price * l.qty;
  const refund = (l.bidder === 'me') ? l.bid * l.qty : 0;
  const need = total - refund;
  if (S.gold < need) { UI.toast('金币不足（还需 ' + fmt(need) + '）'); return; }
  S.gold -= need;
  l.bid = price; l.bidder = 'me';
  pushLog('竞标 ' + ITEMS[l.item].name + ' ×' + l.qty + ' @ ' + fmt(price) + '/个');
  UI.dirty = true;
}

function ahBuyout(id) {
  const l = ahFind(id);
  if (!l || l.done || l.mine || !l.buyout) return;
  const refund = (l.bidder === 'me') ? l.bid * l.qty : 0;
  const need = l.buyout * l.qty - refund;
  if (S.gold < need) { UI.toast('金币不足（还需 ' + fmt(need) + '）'); return; }
  S.gold -= need;
  addItem(l.item, l.qty);
  pushLog('一口价购入 ' + l.qty + ' × ' + ITEMS[l.item].name + '，-' + fmt(l.buyout * l.qty) + ' 金币');
  l.done = true; l.result = 'sold'; l.bidder = 'me';
  UI.dirty = true;
}

function ahCancel(id) {
  const l = ahFind(id);
  if (!l || !l.mine || l.done) return;
  if (l.bidder) { UI.toast('已有人出价，无法取消'); return; }
  addItem(l.item, l.qty);
  l.done = true; l.result = 'cancel';
  pushLog('取消拍卖：' + l.qty + ' × ' + ITEMS[l.item].name + ' 已退回');
  UI.dirty = true;
}

/* 每秒调用：处理 NPC 竞争与到期结算 */
function ahTick() {
  if (!S.ah || !S.ah.listings) return;
  const now = Date.now();
  let changed = false;
  for (let i = 0; i < S.ah.listings.length; i++) {
    const l = S.ah.listings[i];
    if (!l || l.done) continue;
    /* 玩家领先时，NPC 有概率超价（营造竞价感） */
    if (l.bidder === 'me' && Math.random() < 0.004) {
      const nb = Math.ceil(l.bid * 1.05);
      if (!l.buyout || nb < l.buyout) {
        addGold(l.bid * l.qty);
        l.bid = nb; l.bidder = pick(AH_NPC);
        pushLog('⚔ ' + l.bidder + ' 把 ' + ITEMS[l.item].name + ' 抬到 ' + fmt(nb) + '/个');
        changed = true;
        continue;
      }
    }
    if (now >= l.end) {
      l.done = true;
      if (l.mine) {
        if (l.bidder) {
          addGold(l.bid * l.qty + l.deposit);
          l.result = 'sold';
          pushLog('💰 拍卖成交：' + l.qty + ' × ' + ITEMS[l.item].name + ' 售出 ' + fmt(l.bid * l.qty) + ' 金币');
        } else {
          addItem(l.item, l.qty);
          l.result = 'expired';
          pushLog('⏳ 流拍：' + l.qty + ' × ' + ITEMS[l.item].name + ' 退回（押金 ' + fmt(l.deposit) + ' 不退）');
        }
      } else if (l.bidder === 'me') {
        addItem(l.item, l.qty);
        l.result = 'won';
        pushLog('🏆 竞拍获胜：获得 ' + l.qty + ' × ' + ITEMS[l.item].name + '（' + fmt(l.bid * l.qty) + ' 金币）');
      } else {
        l.result = 'gone';
      }
      changed = true;
    }
  }
  if (changed) {
    S.ah.listings = S.ah.listings.filter(function (l) { return l.mine || !l.done; });
    UI.dirty = true;
  }
  ahRefresh(false);
}

/* ---------- 牧场建筑 ---------- */
function houseUpgrade(id) {
  const h = HOUSES.filter(function (x) { return x.id === id; })[0];
  const lv = S.houses[id] || 0;
  if (lv >= h.max) return;
  const c = houseCost(lv);
  const woodId = WOOD[Math.min(7, c.woodTier)][0];
  const foodId = FOOD[Math.min(7, c.foodTier)][0];
  if (S.gold < c.gold || count(woodId) < c.wood || count(foodId) < c.food) {
    UI.toast('资源不足：需要 ' + fmt(c.gold) + ' 金币、' + c.wood + '×' + ITEMS[woodId].name + '、' + c.food + '×' + ITEMS[foodId].name);
    return;
  }
  S.gold -= c.gold;
  takeItems({ [woodId]: c.wood, [foodId]: c.food });
  S.houses[id] = lv + 1;
  pushLog('🏠 ' + h.name + ' 升至 ' + (lv + 1) + ' 级');
  UI.dirty = true;
}

/* ---------- 商店 ---------- */
function buyToken(id) {
  const it = TOKEN_SHOP.filter(function (x) { return x.id === id; })[0];
  if (!it) return;
  const cur = S.shop[id] || 0;
  if (cur >= it.max) { UI.toast('已达上限'); return; }
  if (it.need && !S.shop[it.need]) { UI.toast('需先购买前置'); return; }
  if (S.tokens < it.cost) { UI.toast('任务代币不足'); return; }
  S.tokens -= it.cost;
  S.shop[id] = cur + 1;
  pushLog('🛒 购买「' + it.name + '」');
  UI.dirty = true;
}
function buyBell(id) {
  const it = BELL_SHOP.filter(function (x) { return x.id === id; })[0];
  if (!it || it.disabled) return;
  const cur = S.bell[id] || 0;
  if (cur >= it.max) { UI.toast('已达上限'); return; }
  if (S.cowbell < it.cost) { UI.toast('牛铃不足'); return; }
  S.cowbell -= it.cost;
  S.bell[id] = cur + 1;
  pushLog('🔔 购买「' + it.name + '」');
  UI.dirty = true;
}

/* ---------- 离线进度（Melvor 式结算） ---------- */
function offlineCapSec() {
  const B = bonuses();
  return B.offline * 3600;
}
function runOffline(sec) {
  sec = Math.min(sec, offlineCapSec());
  if (sec < 30) return null;
  const res = { sec: sec, acts: 0, gold: 0, kills: 0, xp: {}, laps: 0 };
  const g0 = S.gold;
  let guard = 20000;
  let left = sec;
  /* 技能：解析式快进 */
  while (left > 0 && guard-- > 0) {
    if (!S.action && !tryStart()) break;
    if (!S.action) break;
    const need = S.action.dur - S.action.t;
    if (need <= left) { left -= need; completeAction(); res.acts++; }
    else { S.action.t += left; left = 0; }
  }
  res.gold = S.gold - g0;
  /* 战斗：粗粒度模拟 */
  if (S.combat && S.combat.active) {
    let csec = Math.min(sec, 4 * 3600);
    let step = 1.0;
    let g = 0;
    while (csec > 0 && g++ < 20000) {
      Combat.simulate(step);
      csec -= step;
      if (!S.combat || !S.combat.active) break;
    }
    res.kills = 1;
  }
  S.stats.offline += sec;
  return res;
}
