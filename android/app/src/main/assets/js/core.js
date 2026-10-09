/* ============================================================
 *  星海牧场 · 核心层（经验曲线 / 状态 / 背包 / 装备 / 存档）
 *  经验曲线（自拟递增公式）：
 *  ΔXP(L) = floor( (L-1 + 300 * 2^((L-1)/7)) / 4 )
 * ============================================================ */

const SAVE_KEY = 'starfield_ranch_v1';
const SAVE_VERSION = 2;   /* 存档结构版本：新增字段时 +1，loadGame 按版本补齐 */

/* ---------- 经验表 ---------- */
function xpDiff(L) { return Math.floor((L - 1 + 300 * Math.pow(2, (L - 1) / 7)) / 4); }
/* 等级 L 的累计经验。下标 1 必须显式置 0，否则整张表从 [2] 起全是 NaN */
const LVL_XP = [0, 0];
for (let L = 2; L <= 99; L++) LVL_XP[L] = LVL_XP[L - 1] + xpDiff(L);
const MST_XP = [0, 0];
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
  skills: {}, subs: {}, mastery: {}, pool: {}, talents: {}, talentResets: 0, talentStreak: null,
  bank: {}, bag: {}, equip: {}, enhance: {},
  buffs: [], queue: [], action: null,
  houses: {}, shop: {}, bell: {},
  tasks: [], lastTask: Date.now(), nextTask: Date.now(),
  guild: null, guildJoinedAt: 0,
  market: { orders: [], refresh: 0, history: [] },
  /* 拍卖行：listings 为挂单列表，seq 自增 id */
  ah: { listings: [], seq: 1, refresh: 0 },
  combat: null,
  stats: { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 },
  flags: { tutorial: false },
  log: []
};

function newGame(name) {
  S.name = name || '牧牛人';
  S.version = SAVE_VERSION;
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
  S.tut = { step: 0 };   /* 首启引导从头开始 */
  S.talents = {};        /* 天赋树：{ 节点id: 1 } */
  S.talentResets = 0;    /* 洗点次数（前 3 次免费） */
  S.talentStreak = null; /* 连击状态：{ k: '技能:动作', n: 次数 } */
  S.combat = null; S.action = null;
  S.queue = [];
  S.queueSlots = Q_SLOT_DEFAULT;
  S.ach = {}; S.achSt = {};
  S.houses = {}; HOUSES.forEach(function (h) { S.houses[h.id] = 0; });
  S.stats = { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 };
  S.lastTask = Date.now();
  S.nextTask = Date.now() + 1000 * 60 * 3;
  S.ah = { listings: [], seq: 1, refresh: 0 };
  refreshMarket(true);
  ahRefresh(true);
  genTask();
  pushLog('欢迎来到星海牧场，' + S.name + '！');
}

/* ---------- 背包 ---------- */
function count(id) { return S.bank[id] || 0; }
/* ============================================================
 *  音效钩子
 *  桌面版未加载 audio.js 时静默无效，不影响任何逻辑。
 * ============================================================ */
function sfxEvt(n) {
  try { if (window.SFX) window.SFX.play(n); } catch (e) { }
}

function addItem(id, n) {
  n = n || 1;
  if (!ITEMS[id]) return 0;
  S.bank[id] = (S.bank[id] || 0) + n;
  if (!S.achSt) S.achSt = {};
  S.achSt[id] = (S.achSt[id] || 0) + n;   /* 成就用：累计获得数，不随消耗减少 */
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
/* 金币唯一出入口：收入记 earned、支出记 spent。
   此前 spent 恒为 0（只有被丢弃的 `S.stats.spent += 0`），玩家永远看不到自己花了多少。 */
function addGold(n) {
  S.gold = Math.max(0, Math.round(S.gold + n));
  if (n > 0) S.stats.earned += Math.round(n);
  else if (n < 0) S.stats.spent += Math.round(-n);
  UI.dirty = true;
}
function spendGold(n) { addGold(-Math.abs(n)); }

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
  /* 天赋树：未点亮任何节点时下列各项均为 0，回溯后与旧版行为完全一致 */
  if (window.Talents) {
    const T = window.Talents.bonus();
    if (T.xp) B.xp += T.xp;
    if (T.mxp) B.mxp += T.mxp;
    if (T.speed) B.speed += T.speed;
    if (T.rare) B.rare += T.rare;
    if (T.wisdom) B.wisdom += T.wisdom;
    if (T.offline) B.offline += T.offline;
    if (T.dmg) B.dmg += T.dmg;
    if (T.acc) B.acc += T.acc;
    if (T.armor) B.armor += T.armor;
    if (T.effAll) B.effAll += T.effAll;
    for (const k in T.eff) B.eff[k] = (B.eff[k] || 0) + T.eff[k];
  }
  return B;
}

function efficiency(skill, actId) {
  const B = bonuses();
  let e = (B.eff[skill] || 0);
  /* 专精：当前动作主导 + 该技能总和的小额加成。
     原实现只按「该技能全部动作的专精总和 ×0.0004」计算，练满一个动作会给同技能所有动作加效率，
     手工艺（约 118 个动作）可达 +467%；现改为两级系数并加总上限。 */
  const aid = (actId != null) ? actId : (S.action && S.action.skill === skill ? S.action.actId : null);
  if (aid != null && S.mastery[skill] && S.mastery[skill][aid] != null) {
    e += levelOf(S.mastery[skill][aid], MST_XP) * NUM.EFF_MASTERY_MAIN;
  }
  e += masteryTotal(skill) * NUM.EFF_MASTERY_SUM;
  if (SKILL_MAP[skill] && (SKILL_MAP[skill].cat === 'gather' || SKILL_MAP[skill].cat === 'artisan' || SKILL_MAP[skill].cat === 'culinary')) {
    e += B.effAll || 0;
  }
  /* 工具效率已在 bonuses() 中经 equipAgg() 计入 B.eff（SLOTS 含 tool 槽），
     此处若再累加一次会造成 +45% 实际生效 +90% 的重复计算。 */
  return Math.min(e, NUM.EFF_CAP);
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
/* ============================================================
 *  品质体系与商人回购价
 *  回购价是全局金币回收的锚：远低于市价，用于回收过剩物资、
 *  防止后期物资堆积导致的通货膨胀。玩家想卖高价应走拍卖行。
 * ============================================================ */
const QUALITY = [
  { name: '粗糙', col: '#8a8f9e', buy: 1 },
  { name: '普通', col: '#8ad8ff', buy: 4 },
  { name: '优良', col: '#6ddc9c', buy: 8 },
  { name: '精良', col: '#5b8cff', buy: 20 },
  { name: '稀有', col: '#a67cff', buy: 50 },
  { name: '史诗', col: '#f2c14e', buy: 120 },
  { name: '传说', col: '#ff9a4d', buy: 300 },
  { name: '神话', col: '#ff6b8a', buy: 800 },
  { name: '星辉', col: '#66ffe0', buy: 2000 }
];

function qualityOf(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  if (typeof it.tier === 'number') {
    const t = it.tier;
    if (t >= 0 && t < QUALITY.length) return t;
  }
  const p = it.price || 1;
  if (p < 40) return 0;
  if (p < 150) return 1;
  if (p < 600) return 2;
  if (p < 2400) return 3;
  if (p < 9000) return 4;
  if (p < 40000) return 5;
  if (p < 150000) return 6;
  return 7;
}
function qualityName(q) { return QUALITY[q] ? QUALITY[q].name : '—'; }
function qualityCol(q) { return QUALITY[q] ? QUALITY[q].col : '#8892b8'; }
function buyback(id) { return QUALITY[qualityOf(id)].buy; }

/* 背包分类：材料 / 道具 / 装备(防具) / 武器 / 工具 / 护符 */
function bagCatOf(id) {
  const it = ITEMS[id];
  if (!it) return 'mat';
  if (it.cat === 'mat') return 'mat';
  if (it.cat === 'equip') {
    if (it.slot === 'weapon') return 'weapon';
    if (it.slot === 'tool' || it.toolSkill) return 'tool';
    if (it.slot === 'neck' || it.slot === 'ring' || it.slot === 'offhand') return 'amulet';
    return 'equip';
  }
  return 'use';
}
const BAG_CATS = [
  { id: 'all', name: '全部', ic: '📦' },
  { id: 'mat', name: '材料', ic: '🧪' },
  { id: 'use', name: '道具', ic: '🧰' },
  { id: 'equip', name: '装备', ic: '🛡️' },
  { id: 'weapon', name: '武器', ic: '🗡️' },
  { id: 'tool', name: '工具', ic: '🛠️' },
  { id: 'amulet', name: '护符', ic: '📿' }
];

/* ============================================================
 *  成就系统
 *  游戏里每一个物品都有一条成就链：累计产出达标 → 领取 → 升级下一档。
 *  目标数量按物品的 tier 与获取难度测算（越稀有要求越少），
 *  奖励随档位递增，且必须"确定"。
 * ============================================================ */
const ACH_MULT = [1, 10, 100, 1000];      /* 各档目标相对基准的倍数 */

/* 该物品成就链有几档 */
function achStages(id) {
  const it = ITEMS[id];
  if (!it) return 1;
  if (it.cat === 'equip') return 3;
  if (it.cat === 'food' || it.cat === 'drink') return 3;
  return 4;
}
/* 基准目标量：按 tier 越高要求越少 */
function achBase(id) {
  const it = ITEMS[id];
  if (!it) return 100;
  const t = (typeof it.tier === 'number' && it.tier > 0) ? it.tier : 0;
  if (it.cat === 'equip') return Math.max(1, Math.round(24 / (1 + t * 0.8)));
  if (it.cat === 'food' || it.cat === 'drink') return Math.max(10, Math.round(60 / (1 + t * 0.5)));
  return Math.max(5, Math.round(100 / (1 + t * 0.75)));
}
function achGoal(id, lv) {
  const m = ACH_MULT[lv] != null ? ACH_MULT[lv] : Math.round(1000 * Math.pow(10, lv - 3));
  return Math.max(1, Math.round(achBase(id) * m));
}
function achProg(id) { return (S.achSt && S.achSt[id]) || 0; }
function achStage(id) { return (S.ach && S.ach[id] && S.ach[id].lv) || 0; }
function achMaxStage(id) { return achStages(id); }
function achAllDone(id) { return achStage(id) >= achMaxStage(id); }
/* 当前正在挑战的档位索引（-1 = 全部完成） */
function achCur(id) {
  const lv = achStage(id);
  return lv >= achMaxStage(id) ? -1 : lv;
}
function achCanClaim(id) {
  const lv = achCur(id);
  if (lv < 0) return false;
  return achProg(id) >= achGoal(id, lv);
}
/* 奖励：与档位 + 品质挂钩，确定性生成 */
function achReward(id, lv) {
  const q = qualityOf(id);
  return {
    gold: Math.round(200 * Math.pow(10, lv) * (1 + q * 0.45)),
    gem: lv >= 1 ? lv : 0,          /* 💠 钻石（星辉宝石） */
    tokens: Math.floor(lv / 2),
    cowbell: lv >= 2 ? 1 : 0
  };
}
function achRewardText(r) {
  const p = [];
  if (r.gold) p.push('💰' + fmt(r.gold) + ' 金币');
  if (r.gem) p.push('💠' + r.gem + ' 钻石');
  if (r.tokens) p.push('🎟' + r.tokens);
  if (r.cowbell) p.push('🔔' + r.cowbell);
  return p.join(' + ');
}

/* ============================================================
 *  工作队列槽位
 *  初始 3 格，最多 8 格；解锁要同时消耗金币与物资，
 *  把过剩产出回收成"进度"，拉长养成周期。
 * ============================================================ */
const Q_SLOT_DEFAULT = 3;
const Q_SLOT_MAX = 8;
/* 下标 i 对应「解锁到第 (Q_SLOT_DEFAULT + 1 + i) 格」的成本 */
const Q_SLOT_COST = [
  { gold: 3000, items: { cream: 15, bamboo_cloth: 3 } },
  { gold: 20000, items: { herb: 30, essence: 5 } },
  { gold: 120000, items: { silk_cloth: 6, gem: 8 } },
  { gold: 700000, items: { essence: 30, nova_cloth: 3 } },
  { gold: 4000000, items: { gem: 40, nova_cloth: 8 } }
];

function queueSlots() {
  let n = (typeof S.queueSlots === 'number' && S.queueSlots > 0) ? S.queueSlots : Q_SLOT_DEFAULT;
  if (window.Talents) n += window.Talents.extras().queueSlot;   /* 天赋「流水线」 */
  return n;
}
/* 下一个可解锁的槽位信息（已满则返回 null） */
function queueNextSlot() {
  var cur = queueSlots();
  if (cur >= Q_SLOT_MAX) return null;
  var idx = cur - Q_SLOT_DEFAULT;
  if (idx < 0) idx = 0;
  if (idx >= Q_SLOT_COST.length) return null;
  return { slot: cur + 1, cost: Q_SLOT_COST[idx] };
}

function saveGame() {
  S.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
  catch (e) {
    /* 配额已满或隐私模式：原先静默吞掉，玩家会以为已经存上了 */
    const msg = '存档写入失败（存储不可用或已满），请先导出备份';
    if (window.UI && typeof window.UI.toast === 'function') window.UI.toast(msg);
    else if (window.MUI && typeof window.MUI.toast === 'function') window.MUI.toast(msg);
    if (window.console) console.warn(msg, e);
  }
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
    if (typeof S.queueSlots !== 'number') S.queueSlots = Q_SLOT_DEFAULT;   /* 老存档迁移 */
    if (!S.queue) S.queue = [];
    if (!S.ach) S.ach = {};          /* 成就：每条链的等级 */
    if (!S.achSt) S.achSt = {};      /* 成就：每物品累计获得数 */
    if (!S.stats) S.stats = { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 };
    if (!S.talents) S.talents = {};          /* 天赋树：老存档迁移为「未点任何节点」 */
    if (S.talentResets == null) S.talentResets = 0;
    if (!S.talentStreak) S.talentStreak = null;
    /* 存档版本号：老档缺失时按 v1 补齐，之后按版本逐步迁移 */
    if (typeof S.version !== 'number') S.version = 1;
    if (S.version < 2) {
      if (!S.lock) S.lock = {};          /* 物品锁定：原本由 iteminfo.js 惰性创建 */
      if (!S.ah) S.ah = { listings: [], seq: 1, refresh: 0 };
      SKILLS.forEach(function (s) {
        if (s.id === 'combat') return;
        if (S.pool[s.id] == null) S.pool[s.id] = 0;
      });
      S.version = 2;
    }
    return true;
  } catch (e) { return false; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

/* ---------- 数字格式化 ---------- */
function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
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
