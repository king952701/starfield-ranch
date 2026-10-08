/* ============================================================
 *  星海牧场 · 核心层（经验曲线 / 状态 / 背包 / 装备 / 存档）
 *  经验曲线沿用 Melvor Idle 公式：
 *  ΔXP(L) = floor( (L-1 + 300 * 2^((L-1)/7)) / 4 )
 * ============================================================ */

const SAVE_KEY = 'starfield_ranch_v1';

/* ---------- 经验表 ---------- */
function xpDiff(L) { return Math.floor((L - 1 + 300 * Math.pow(2, (L - 1) / 7)) / 4); }
const LVL_XP = [0];
for (let L = 2; L <= 99; L++) LVL_XP[L] = LVL_XP[L - 1] + xpDiff(L);
const MST_XP = [0];
for (let L = 2; L <= 99; L++) MST_XP[L] = MST_XP[L - 1] + Math.max(1, Math.round(xpDiff(L) / 10));
const XP_CAP = LVL_XP[99];

function levelOf(xp, table) {
  const t = table || LVL_XP;
  let lo = 1, hi = t.length - 1;
  if (xp >= t[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}
function lvlInfo(xp, table) {
  const t = table || LVL_XP;
  const cap = t.length - 1;
  const lvl = levelOf(xp, t);
  if (lvl >= cap) return { lvl: cap, cur: 0, need: 0, pct: 1, total: xp };
  const cur = xp - t[lvl], need = t[lvl + 1] - t[lvl];
  return { lvl: lvl, cur: cur, need: need, pct: need > 0 ? cur / need : 1, total: xp };
}

/* ---------- 状态 ---------- */
const S = {
  name: '牧牛人', server: '星海一区', created: Date.now(), savedAt: Date.now(),
  gold: 800, cowbell: 5, tokens: 0, taskPoints: 0,
  skills: {}, subs: {}, mastery: {}, pool: {},
  bank: {}, bag: {}, equip: {}, enhance: {},
  buffs: [], queue: [], action: null,
  houses: {}, shop: {}, bell: {},
  tasks: [], lastTask: Date.now(), nextTask: Date.now(),
  guild: null, guildJoinedAt: 0,
  market: { orders: [], refresh: 0, history: [] },
  combat: null,
  stats: { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 },
  flags: { tutorial: false },
  log: []
};

function newGame(name) {
  S.name = name || '牧牛人';
  S.created = Date.now();
  S.savedAt = Date.now();
  SKILLS.forEach(function (s) {
    if (s.id === 'combat') return;
    S.skills[s.id] = 0;
    S.mastery[s.id] = {};
    S.pool[s.id] = 0;
  });
  COMBAT_SUBS.forEach(function (c) { S.subs[c.id] = 0; });
  S.gold = 800; S.cowbell = 5;
  S.bank = { milk: 8, blueberry: 8, cream: 3, log: 3, cotton: 3, cupcake: 1 };
  S.equip = { weapon: 'sword_0' };
  S.enhance = {};
  S.alchTarget = 'milk';
  S.bag = { cupcake: 3 };
  S.tasks = []; S.shop = {}; S.bell = {}; S.buffs = []; S.chat = [];
  S.combat = null; S.action = null;
  S.queue = [];
  S.houses = {}; HOUSES.forEach(function (h) { S.houses[h.id] = 0; });
  S.stats = { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 };
  S.lastTask = Date.now();
  S.nextTask = Date.now() + 1000 * 60 * 3;
  refreshMarket(true);
  genTask();
  pushLog('欢迎来到星海牧场，' + S.name + '！');
}

/* ---------- 背包 ---------- */
function count(id) { return S.bank[id] || 0; }
function addItem(id, n) {
  n = n || 1;
  if (!ITEMS[id]) return 0;
  S.bank[id] = (S.bank[id] || 0) + n;
  UI.dirty = true;
  return n;
}
function hasItems(req) {
  if (!req) return true;
  for (const k in req) { if ((req[k] || 0) > 0 && count(k) < req[k]) return false; }
  return true;
}
function takeItems(req) {
  if (!hasItems(req)) return false;
  for (const k in req) { if ((req[k] || 0) > 0) S.bank[k] = count(k) - req[k]; if (S.bank[k] <= 0) delete S.bank[k]; }
  UI.dirty = true;
  return true;
}
function addGold(n) { S.gold = Math.max(0, Math.round(S.gold + n)); if (n > 0) S.stats.earned += Math.round(n); UI.dirty = true; }

/* ---------- 等级 ---------- */
function skillLevel(id) { return levelOf(S.skills[id] || 0, LVL_XP); }
function subLevel(id) {
  const base = levelOf(S.subs[id] || 0, LVL_XP);
  let bonus = 0;
  HOUSES.forEach(function (h) { if (h.sub === id) bonus += (S.houses[h.id] || 0); });
  return base + bonus;
}
function combatLevel() {
  const st = subLevel('stamina'), it = subLevel('intelligence'), at = subLevel('attack'), df = subLevel('defense');
  const me = subLevel('melee'), ra = subLevel('ranged'), mg = subLevel('magic');
  return (0.1 * (st + it + at + df + Math.max(me, ra, mg)) + 0.5 * Math.max(at, df, me, ra, mg));
}
function totalLevel() {
  let t = 0;
  SKILLS.forEach(function (s) { if (s.id !== 'combat') t += skillLevel(s.id); });
  return t + Math.floor(combatLevel());
}

/* ---------- 专精 ---------- */
function masteryLevel(skill, actId) { return levelOf((S.mastery[skill] && S.mastery[skill][actId]) || 0, MST_XP); }
function masteryTotal(skill) {
  let t = 0;
  const m = S.mastery[skill] || {};
  for (const k in m) t += levelOf(m[k], MST_XP);
  return t;
}
function masteryMax(skill) { return ACTIONS[skill] ? ACTIONS[skill].length * MASTERY_CAP : 0; }
function poolCap(skill) {
  const n = (ACTIONS[skill] ? ACTIONS[skill].length : 1);
  let cap = 12000 + 800 * n;
  const b = S.bell['b_pool'] || 0;
  cap *= (1 + 0.25 * b);
  return Math.round(cap);
}
function poolPct(skill) { return Math.min(1, (S.pool[skill] || 0) / poolCap(skill)); }
function poolCheckpoint(skill) {
  const p = poolPct(skill);
  let lv = 0;
  if (p >= 0.10) lv = 1;
  if (p >= 0.25) lv = 2;
  if (p >= 0.50) lv = 3;
  if (p >= 0.95) lv = 4;
  return lv;
}
const POOL_BONUS = [
  null,
  { mxp: 0.05, label: '10% — 该技能专精经验 +5%' },
  { eff: 0.03, label: '25% — 该技能效率 +3%' },
  { xp: 0.05, label: '50% — 全局经验 +5%' },
  { eff: 0.10, mxp: 0.05, label: '95% — 该技能效率 +10%，全局专精经验 +5%' }
];

function addMastery(skill, actId, amt) {
  if (!S.mastery[skill]) S.mastery[skill] = {};
  const before = levelOf(S.mastery[skill][actId] || 0, MST_XP);
  S.mastery[skill][actId] = (S.mastery[skill][actId] || 0) + amt;
  const after = levelOf(S.mastery[skill][actId], MST_XP);
  const add = amt * 0.25;
  S.pool[skill] = Math.min(poolCap(skill), (S.pool[skill] || 0) + add);
  if (after > before) pushLog('✦ ' + SKILL_MAP[skill].name + ' 专精「' + ACTION_MAP[skill + ':' + actId].name + '」升至 ' + after + ' 级');
  return add;
}

/* ---------- 装备 ---------- */
function equipped(slot) { return S.equip[slot] || null; }
function enhLevel(slot) { return S.enhance[slot] || 0; }
function enhMul(slot) { return 1 + 0.08 * enhLevel(slot); }

function equipAgg() {
  const agg = { st: {}, eff: {}, enhanceSpeed: 0 };
  SLOTS.forEach(function (sl) {
    const id = S.equip[sl.id];
    if (!id) return;
    const it = ITEMS[id];
    if (!it) return;
    const mul = enhMul(sl.id);
    if (it.st) for (const k in it.st) agg.st[k] = (agg.st[k] || 0) + it.st[k] * (k === 'spd' ? 1 : mul);
    if (it.eff) for (const k in it.eff) agg.eff[k] = (agg.eff[k] || 0) + it.eff[k];
    if (it.enhanceSpeed) agg.enhanceSpeed += it.enhanceSpeed;
  });
  return agg;
}

/* ---------- 增益 ---------- */
function activeBuffs() {
  const now = Date.now();
  S.buffs = S.buffs.filter(function (b) { return b.until > now; });
  return S.buffs;
}
function buffVal(kind, key) {
  let v = 0;
  activeBuffs().forEach(function (b) { if (b.kind === kind && b[key]) v += b[key]; });
  return v;
}
function drinkBuff(kind) {
  let v = 0;
  activeBuffs().forEach(function (b) { if (b.kind === kind) v = Math.max(v, b.dmg || b.eff || 0); });
  return v;
}
function addBuff(b) { b.until = Date.now() + b.dur * 1000; S.buffs.push(b); UI.dirty = true; }

/* ---------- 全局加成汇总 ---------- */
function bonuses() {
  const agg = equipAgg();
  const B = {
    xp: 0, mxp: 0, eff: {}, speed: 0, rare: 0, wisdom: 0,
    dmg: 0, acc: 0, armor: 0, subs: {}, poolCapMul: 1, offline: 24
  };
  // 牛铃商店
  B.xp += 0.10 * (S.bell['b_xp'] || 0);
  B.rare += 0.05 * (S.bell['b_rare'] || 0);
  B.offline += 12 * (S.bell['b_offline'] || 0) + 6 * ((S.shop['t_off1'] ? 1 : 0) + (S.shop['t_off2'] ? 1 : 0));
  // 任务徽章
  B.dmg += 0.04 * (S.shop['t_dmg'] || 0);
  B.speed += 0.04 * (S.shop['t_spd'] || 0);
  // 专精池检查点
  SKILLS.forEach(function (s) {
    if (s.id === 'combat') return;
    const cp = poolCheckpoint(s.id);
    const pb = POOL_BONUS[cp];
    if (!pb) return;
    if (pb.mxp) B.mxp += pb.mxp;
    if (pb.xp) B.xp += pb.xp;
    if (pb.eff) B.eff[s.id] = (B.eff[s.id] || 0) + pb.eff;
  });
  // 装备效率
  for (const k in agg.eff) B.eff[k] = (B.eff[k] || 0) + agg.eff[k] / 100;
  // 装备智慧 / 稀有
  B.wisdom += (agg.st.wisdom || 0);
  B.rare += (agg.st.rareFind || 0);
  // 公会
  if (S.guild) { B.xp += 0.03; B.rare += 0.02; }
  // 饮品
  B.effAll = drinkBuff('skill');
  B.dmg += drinkBuff('combat');
  // 牧场建筑（稀有发现）
  let hl = 0;
  HOUSES.forEach(function (h) { hl += (S.houses[h.id] || 0); });
  B.rare += 0.002 * hl;
  B.wisdom += 0.0005 * hl;
  return B;
}

function efficiency(skill) {
  const B = bonuses();
  let e = (B.eff[skill] || 0);
  // 专精：每级 +0.4%（采集/加工/烹饪）
  const mt = masteryTotal(skill);
  e += mt * 0.0004;
  if (SKILL_MAP[skill] && (SKILL_MAP[skill].cat === 'gather' || SKILL_MAP[skill].cat === 'artisan' || SKILL_MAP[skill].cat === 'culinary')) {
    e += B.effAll || 0;
  }
  // 工具
  const toolId = S.equip.tool;
  if (toolId && ITEMS[toolId] && ITEMS[toolId].toolSkill === skill) e += (ITEMS[toolId].eff[skill] || 0) / 100;
  return e;
}
function actionSpeedMul() {
  const B = bonuses();
  return 1 + B.speed;
}

/* ---------- 日志 ---------- */
function pushLog(msg) {
  S.log.unshift({ t: Date.now(), m: msg });
  if (S.log.length > 60) S.log.length = 60;
  UI.dirty = true;
}

/* ---------- 存档 ---------- */
function saveGame() {
  S.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    Object.keys(d).forEach(function (k) { S[k] = d[k]; });
    SKILLS.forEach(function (s) {
      if (s.id === 'combat') return;
      if (S.skills[s.id] == null) S.skills[s.id] = 0;
      if (!S.mastery[s.id]) S.mastery[s.id] = {};
      if (S.pool[s.id] == null) S.pool[s.id] = 0;
    });
    COMBAT_SUBS.forEach(function (c) { if (S.subs[c.id] == null) S.subs[c.id] = 0; });
    if (!S.stats) S.stats = { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 };
    return true;
  } catch (e) { return false; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

/* ---------- 数字格式化 ---------- */
function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) < 1000) return '' + n;
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  let x = n;
  while (Math.abs(x) >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)) + u[i];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return h + '小时' + (m ? m + '分' : '');
  if (m > 0) return m + '分' + s + '秒';
  return s + '秒';
}
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
