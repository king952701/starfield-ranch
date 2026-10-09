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
  /* 天赋「堆垛」：连续执行同一动作时逐次提速 */
  if (window.Talents) {
    const X = window.Talents.extras();
    if (X.bulk > 0 && S.talentStreak && S.talentStreak.k === skill + ':' + a.id) {
      spd += Math.min(X.bulk * S.talentStreak.n, 0.15);
    }
  }
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

function enhanceCost(cur) {
  let n = 2 + cur * 3;
  if (window.Talents) n *= window.Talents.extras().enhCostMul;   /* 天赋「节用」 */
  return Math.max(1, Math.round(n));
}

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
  if (S.queue.length >= queueSlots()) {
    UI.toast('队列已满（' + queueSlots() + '/' + Q_SLOT_MAX + '）—— 去「队列」面板解锁更多槽位');
    return;
  }
  const last = S.queue[S.queue.length - 1];
  if (last && last.skill === skill && last.actId === actId && last.n > 0 && n > 0) { last.n += n; }
  else S.queue.push({ skill: skill, actId: actId, n: n == null ? 1 : n });
  if (!S.action) tryStart();
  UI.dirty = true;
}

/* ============================================================
 *  成就：领取奖励 / 一键领取 / 总览
 * ============================================================ */
function claimAch(id) {
  if (!ITEMS[id] || !achCanClaim(id)) return false;
  const lv = achCur(id);
  const r = achReward(id, lv);
  addGold(r.gold);
  if (r.gem) addItem('gem', r.gem);
  if (r.tokens) S.tokens = (S.tokens || 0) + r.tokens;
  if (r.cowbell) S.cowbell = (S.cowbell || 0) + r.cowbell;
  if (!S.ach[id]) S.ach[id] = { lv: 0 };
  S.ach[id].lv = lv + 1;
  pushLog('🏆 成就 ' + ITEMS[id].name + ' 第 ' + (lv + 1) + ' 档达成：' + achRewardText(r));
  UI.dirty = true;
  UI.toast('🏆 ' + ITEMS[id].name + ' ' + achRewardText(r));
  sfxEvt('levelup'); sfxEvt('up');   /* 成就旋律（Kenney Music Jingles, CC0） */
  return true;
}
function claimAllAch() {
  let got = 0, gold = 0;
  for (let i = 0; i < ITEM_LIST.length; i++) {
    const id = ITEM_LIST[i].id;
    if (!achCanClaim(id)) continue;
    const gr = achReward(id, achCur(id)).gold;
    if (claimAch(id)) { got++; gold += gr; }
  }
  UI.toast(got ? ('🏆 一键领取 ' + got + ' 项成就，+' + fmt(gold) + ' 金币') : '暂时没有可领取的成就');
  return got;
}
function achSummary() {
  let total = 0, claimed = 0, ready = 0, allDone = 0, tracking = 0;
  for (let i = 0; i < ITEM_LIST.length; i++) {
    const id = ITEM_LIST[i].id;
    const mx = achMaxStage(id), lv = achStage(id);
    total += mx;
    claimed += Math.min(lv, mx);
    if (achCanClaim(id)) ready++;
    if (lv >= mx) allDone++;
    if (achProg(id) > 0) tracking++;
  }
  return { total: total, claimed: claimed, ready: ready, allDone: allDone, tracking: tracking, kinds: ITEM_LIST.length };
}

/* ---------- 工作队列：置顶 / 插入指定槽位 / 上下移动 / 解锁 ---------- */
function mkQ(skill, actId, n) { return { skill: skill, actId: actId, n: n == null ? 1 : n }; }

/* 置顶：立即中断当前动作，把该动作插到队首马上开工 */
function queueTop(skill, actId, n) {
  const a = ACTION_MAP[skill + ':' + actId];
  if (!a) return;
  if (skillLevel(skill) < a.lvl) { UI.toast('需要 ' + SKILL_MAP[skill].name + ' ' + a.lvl + ' 级'); return; }
  let stoppedInf = false;
  /* 队首若是 ∞ 项，先摘掉，否则新项永远排不到它前面 */
  if (S.queue.length && S.queue[0].n === -1 &&
      !(S.queue[0].skill === skill && S.queue[0].actId === actId)) {
    S.queue.shift();
    stoppedInf = true;
  }
  S.action = null;
  S.queue.unshift(mkQ(skill, actId, n));
  /* 超出槽位上限时挤掉队尾 */
  while (S.queue.length > queueSlots()) S.queue.pop();
  tryStart();
  UI.dirty = true;
  UI.toast(stoppedInf ? ('已置顶「' + a.name + '」，并停止原来的 ∞ 连续') : ('已置顶「' + a.name + '」'));
}

/* 插入到第 pos 个槽位（1 起），超出队列长度则排到末尾 */
function queueInsert(skill, actId, n, pos) {
  const a = ACTION_MAP[skill + ':' + actId];
  if (!a) return;
  if (skillLevel(skill) < a.lvl) { UI.toast('需要 ' + SKILL_MAP[skill].name + ' ' + a.lvl + ' 级'); return; }
  if (S.queue.length >= queueSlots()) {
    UI.toast('队列已满（' + queueSlots() + '/' + Q_SLOT_MAX + '）');
    return;
  }
  let p = Math.round(pos) || 1;
  if (p < 1) p = 1;
  if (p > S.queue.length + 1) p = S.queue.length + 1;
  S.queue.splice(p - 1, 0, mkQ(skill, actId, n));
  while (S.queue.length > queueSlots()) S.queue.pop();
  if (!S.action) tryStart();
  UI.dirty = true;
  UI.toast('「' + a.name + '」已加入队列 #' + p);
}

/* 队列内上下移动：dir = -1 上移 / +1 下移 */
function queueMove(i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || i >= S.queue.length || j >= S.queue.length) return;
  const t = S.queue[i];
  S.queue[i] = S.queue[j];
  S.queue[j] = t;
  /* 动了队首且当前正在执行：立刻切换到新的队首 */
  if ((i === 0 || j === 0) && S.action) { S.action = null; tryStart(); }
  UI.dirty = true;
}

/* 解锁下一个队列槽位 */
function queueUnlock() {
  const nx = queueNextSlot();
  if (!nx) { UI.toast('队列槽位已达上限 ' + Q_SLOT_MAX); return false; }
  const c = nx.cost;
  const lack = [];
  for (const k in c.items) {
    if (!ITEMS[k]) continue;
    if (count(k) < c.items[k]) lack.push(ITEMS[k].name + '×' + c.items[k]);
  }
  if (S.gold < c.gold) lack.push('金币 ' + fmt(c.gold));
  if (lack.length) { UI.toast('材料不足：' + lack.join('、')); return false; }
  addGold(-c.gold);
  takeItems(c.items);
  S.queueSlots = nx.slot;
  pushLog('⚙ 工作队列扩充到第 ' + nx.slot + ' 格');
  sfxEvt('up');
  UI.dirty = true;
  UI.toast('队列已扩充到 ' + nx.slot + ' 格！');
  return true;
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
  let mul = 1 + B.xp + B.wisdom;
  if (window.Talents) {
    const X = window.Talents.extras();
    if (X.subXp) mul += X.subXp;                                /* 天赋「荣誉展品」 */
  }
  S.subs[sub] = Math.min(XP_CAP, (S.subs[sub] || 0) + amt * mul);
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
  /* 天赋的规则类效果（非 bonuses 体系），未点天赋时全部为中性值 */
  const X0 = window.Talents ? window.Talents.extras() : null;
  let burned = false; /* 采集/烹饪分支里赋值，函数尾部 addXp 会用到 */

  if (a.kind === 'enhance') {
    const sl = a.slot;
    const cur = S.enhance[sl] || 0;
    const lvl = skillLevel('enhancing');
    const ml = masteryLevel('enhancing', a.id);
    const chance = Math.min(0.95, 0.55 + lvl * 0.008 + ml * 0.003 - cur * 0.05 + (X0 ? X0.enhAdd : 0));
    if (Math.random() < chance) {
      S.enhance[sl] = cur + 1;
      pushLog('✔ 强化成功！' + ITEMS[S.equip[sl]].name + ' → +' + S.enhance[sl]);
      sfxEvt('equip'); sfxEvt('shield');
    } else {
      /* 天赋「不灭炉火」：失败只退回一半等级，不再清零 */
      const keep = X0 && X0.enhKeep ? Math.floor(cur / 2) : 0;
      S.enhance[sl] = keep;
      pushLog('✖ 强化失败，' + ITEMS[S.equip[sl]].name + ' 退回 +' + keep);
      sfxEvt('err');
    }
  } else if (a.kind === 'coinify') {
    const t = S.alchTarget;
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.95, 0.40 + lvl * 0.004 + ml * 0.003 + (X0 ? X0.alchAdd : 0));
    if (Math.random() < chance) {
      const g = Math.round(ITEMS[t].price * 1.6 * (1 + (X0 ? X0.coinGold : 0)));
      addGold(g);
      pushLog('💰 金币化成功，获得 ' + fmt(g) + ' 金币');
      sfxEvt('coin');
    } else {
      addItem('essence', 1);
      pushLog('✖ 金币化失败，物品消失（返还 1 星精华）');
      sfxEvt('err');
    }
  } else if (a.kind === 'decompose') {
    const t = S.alchTarget;
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.95, 0.45 + lvl * 0.004 + ml * 0.003 + (X0 ? X0.alchAdd : 0));
    if (Math.random() < chance) {
      const n = Math.max(1, Math.round((ITEMS[t].price / 60) * (1 + (X0 ? X0.decomposeMul : 0))));
      addItem('essence', n);
      pushLog('💎 分解成功，获得 ' + n + ' 星精华');
    } else { pushLog('✖ 分解失败'); }
  } else if (a.kind === 'transmute') {
    const t = S.alchTarget;
    const it = ITEMS[t];
    const nxt = nextTierItem(t);
    const lvl = skillLevel('alchemy'), ml = masteryLevel('alchemy', a.id);
    const chance = Math.min(0.9, 0.35 + lvl * 0.003 + ml * 0.003 + (X0 ? X0.alchAdd : 0));
    if (nxt && Math.random() < chance) { addItem(nxt, 1); pushLog('♻ 嬗变成功：' + it.name + ' → ' + ITEMS[nxt].name); }
    else { addItem('essence', 1); pushLog('✖ 嬗变失败'); }
  } else {
    /* 采集 / 加工 / 烹饪 / 酿造 */
    const eff = efficiency(sk, a.id);
    let mult = Math.floor(eff);
    if (Math.random() < (eff % 1)) mult += 1;
    mult += 1;
    /* ---- 天赋：连枷节奏（连续同动作）/ 熟成链（背包留有余粮）/ 双收 ---- */
    if (X0) {
      if (X0.streak > 0 && S.talentStreak && S.talentStreak.k === sk + ':' + a.id) {
        mult *= (1 + Math.min(X0.streak * S.talentStreak.n, 0.20));
      }
      if (X0.chain > 0 && a.in) {
        let chained = false;
        for (const mk in a.in) { if ((count(mk) || 0) >= 10) { chained = true; break; } }
        if (chained) mult *= (1 + X0.chain);
      }
      if (X0.dbl > 0 && Math.random() < X0.dbl) mult *= 2;
    }
    if (a.kind === 'cook') {
      const ml = masteryLevel(sk, a.id);
      const burnRaw = Math.max(0, 0.22 - ml * 0.0022 - skillLevel(sk) * 0.0012 - eff * 0.15);
      const burn = burnRaw * (X0 ? X0.burnMul : 1);   /* 天赋「稳火」减半焦糊 */
      if (Math.random() < burn) burned = true;
    }
    if (burned) {
      pushLog('🔥 烹饪失败，' + a.name + ' 烧焦了');
      sfxEvt('err');
    } else {
      for (const k in a.out) addItem(k, Math.max(1, Math.round(a.out[k] * mult)));
      if (S.stats) S.stats.crafted++;
      /* 生产音效：按技能给不同质感（Kenney Impact Sounds, CC0） */
      if (sk === 'woodcutting') sfxEvt('wood');
      else if (sk === 'cheesesmithing' || sk === 'tailoring' || sk === 'crafting') sfxEvt('craft');
      else if (sk === 'cooking' || sk === 'brewing') sfxEvt('soft');
      else sfxEvt('gather');
    }
    if (a.rare) {
      for (const k in a.rare) {
        if (Math.random() < clampChance(a.rare[k] * (1 + B.rare), NUM.RARE_CAP)) { addItem(k, 1); }
      }
    }
    onTaskProgress(sk, a, burned ? 0 : Math.round(mult));
  }

  /* 连击状态：连续同一动作则累加，换动作则重置（供「连枷节奏」「堆垛」使用） */
  {
    const key = sk + ':' + act.actId;
    S.talentStreak = { k: key, n: (S.talentStreak && S.talentStreak.k === key ? S.talentStreak.n + 1 : 1) };
  }

  const lvlBefore = skillLevel(sk);
  addXp(sk, a.xp * (burned ? 0.4 : 1));
  addMastery(sk, a.id, masteryGain(sk, a));
  S.stats.actions++;
  /* 升级：铃声提示（Kenney impactBell, CC0） */
  if (skillLevel(sk) > lvlBefore) sfxEvt('levelup');
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
  if (window.Talents) h *= window.Talents.extras().taskIntMul;   /* 天赋「消息灵通」 */
  return h * 3600 * 1000;
}
function taskSlots() {
  let n = 6 + (S.shop['t_slot'] || 0);
  if (window.Talents) n += window.Talents.extras().taskSlot;     /* 天赋「多线操盘」 */
  return n;
}

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
  if (window.Talents) t.gold = Math.round(t.gold * (1 + window.Talents.extras().task));  /* 天赋「人脉」等 */
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
  if (!ITEMS[id]) return;            /* 脏存档里的未知 id：直接忽略，不抛错 */
  n = Math.min(n, count(id));
  if (n <= 0) return;
  takeItems({ [id]: n });
  const g = Math.round(ITEMS[id].price * NUM.SELL_RATIO * n * (window.Talents ? (1 + window.Talents.extras().sell) : 1));
  addGold(g);
  sfxEvt('sell');
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
 *  拍卖行（挂单 / 竞标 / 一口价模式）
 *  - 挂单：起始价 / 一口价 / 拍卖时长 / 押金
 *  - 竞标：每次至少加价 5%，被超价立即退款
 *  - 结算：成交退押金，流拍退物品不退押金
 * ============================================================ */
/* ============================================================
 *  NPC 商人回购（低于拍卖行价，即时变现，用于回收过剩物资）
 * ============================================================ */
function vendorSell(id, n) {
  n = Math.min(Math.round(n) || 0, count(id));
  if (n <= 0) return 0;
  takeItems({ [id]: n });
  const g = Math.round(buyback(id) * n * (window.Talents ? (1 + window.Talents.extras().sell) : 1));
  addGold(g);
  pushLog('卖给商人 ' + n + ' × ' + ITEMS[id].name + '，+' + fmt(g) + ' 金币');
  UI.dirty = true;
  return g;
}
/* 回购指定品质的全部物品 */
function vendorSellQuality(q) {
  let kinds = 0, qty = 0, gold = 0;
  for (const k in S.bank) {
    if (!ITEMS[k] || S.bank[k] <= 0) continue;
    if (qualityOf(k) !== q) continue;
    kinds++; qty += S.bank[k];
    gold += buyback(k) * S.bank[k];
    delete S.bank[k];
  }
  if (qty > 0) {
    addGold(gold);
    pushLog('商人回购 ' + qualityName(q) + '物资 ' + kinds + ' 种 / ' + fmt(qty) + ' 件，+' + fmt(gold) + ' 金币');
  }
  UI.dirty = true;
  return { kinds: kinds, qty: qty, gold: gold };
}
function vendorSellAll(skipConfirm) {
  /* 回购价按品质固定，与市价无关：高价物品的回购价可能只有市价的 1%~12%，
     原先「回购全部」一键执行且无提示，玩家一次点击就可能亏掉大半资产。
     现按「回购价 / 直接出售价」拆分：明显亏的物品需二次确认。 */
  const cheap = [], risky = [];
  let gold = 0, qty = 0, kinds = 0;
  for (const k in S.bank) {
    if (!ITEMS[k] || S.bank[k] <= 0) continue;
    const per = buyback(k);
    const mv = (ITEMS[k].price || 0) * NUM.SELL_RATIO;   /* 参照价：直接出售能拿到的金币 */
    const n = S.bank[k];
    const row = { id: k, n: n, gold: per * n, market: mv * n };
    (mv > 0 && per / mv >= NUM.VENDOR_AUTO_RATIO ? cheap : risky).push(row);
  }
  let list = cheap.slice();
  if (risky.length) {
    let loss = 0;
    risky.forEach(function (r) { loss += Math.max(0, r.market - r.gold); });
    const msg = '另有 ' + risky.length + ' 种物资的回购价低于直接出售价，'
      + '一并回购会少获得约 ' + fmt(loss) + ' 金币。\n仍要全部回购吗？';
    if (skipConfirm || window.confirm(msg)) list = cheap.concat(risky);
  }
  list.forEach(function (r) {
    if (!S.bank[r.id]) return;
    delete S.bank[r.id];
    gold += r.gold; qty += r.n; kinds++;
  });
  if (qty > 0) {
    addGold(gold);
    pushLog('商人回购全部物资 ' + kinds + ' 种 / ' + fmt(qty) + ' 件，+' + fmt(gold) + ' 金币');
  }
  UI.dirty = true;
  return { kinds: kinds, qty: qty, gold: gold, skipped: risky.length && list.length === cheap.length ? risky.length : 0 };
}
/* 银行各品质统计 */
function bankQualityStats() {
  const out = [];
  for (let q = 0; q < QUALITY.length; q++) out.push({ q: q, kinds: 0, qty: 0, gold: 0 });
  for (const k in S.bank) {
    if (!ITEMS[k] || S.bank[k] <= 0) continue;
    const q = qualityOf(k);
    out[q].kinds++;
    out[q].qty += S.bank[k];
    out[q].gold += buyback(k) * S.bank[k];
  }
  return out;
}

/* ============================================================
 *  行情趋势：确定性伪随机历史价格（同一天同一物品结果稳定）
 * ============================================================ */
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}
function rnd01(seed) {
  let x = seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return (x % 100000) / 100000;
}
function priceSeries(id, days) {
  const it = ITEMS[id];
  if (!it) return [];
  const base = Math.max(1, it.price || 1);
  const today = Math.floor(Date.now() / 86400000);
  const start = today - days + 1;
  let v = base * (0.74 + rnd01(hash32(id)) * 0.22);
  const out = [];
  for (let i = 0; i < days; i++) {
    const seed = hash32(id + '|' + (start + i));
    const drift = (rnd01(seed) - 0.485) * 0.12;      /* 日波动 */
    v = Math.max(base * 0.35, Math.min(base * 2.6, v * (1 + drift)));
    v += (base - v) * 0.055;                          /* 向基准回归 */
    out.push({ day: start + i, p: Math.max(1, Math.round(v)) });
  }
  return out;
}
function dayLabel(d) {
  const dt = new Date(d * 86400000);
  const m = dt.getMonth() + 1, dd = dt.getDate();
  return (m < 10 ? '0' + m : m) + '/' + (dd < 10 ? '0' + dd : dd);
}

/* ============================================================
 *  配方检索：某材料能参与哪些制作
 * ============================================================ */
function recipesUsing(id) {
  const out = [];
  for (const sk in ACTIONS) {
    ACTIONS[sk].forEach(function (a) {
      if (a.in && a.in[id]) out.push({ skill: sk, act: a });
    });
  }
  return out;
}
function firstRecipe(id) {
  const r = recipesUsing(id);
  return r.length ? r[0] : null;
}

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
  let m = 0.05 * durMul;
  if (window.Talents) m *= (1 + window.Talents.extras().ahFee);   /* 天赋「保证金」 */
  return Math.max(1, Math.round(base * m));
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

/* ---------- 离线进度结算 ---------- */
/* 离线快进超出时间预算时，把「已结算部分」按剩余次数比例放大补齐：
   收益不丢，也不必真的跑完几十万次结算。专精与稀有掉落按已结算部分计入（略保守）。 */
function extrapolateOffline(scale, b0, xp0, g0) {
  for (const k in S.bank) {
    const d = (S.bank[k] || 0) - (b0[k] || 0);
    if (d > 0) S.bank[k] = (S.bank[k] || 0) + Math.round(d * scale);
  }
  const dg = S.gold - g0;
  if (dg > 0) S.gold += Math.round(dg * scale);
  SKILLS.forEach(function (s) {
    if (s.id === 'combat') return;
    const d = (S.skills[s.id] || 0) - (xp0[s.id] || 0);
    if (d > 0) S.skills[s.id] = (S.skills[s.id] || 0) + Math.round(d * scale);
  });
}
function offlineCapSec() {
  const B = bonuses();
  return B.offline * 3600;
}
function runOffline(sec) {
  sec = Math.min(sec, offlineCapSec());
  if (sec < 30) return null;
  const res = { sec: sec, acts: 0, gold: 0, kills: 0, xp: {}, laps: 0 };

  /* 结算前的快照：用来算清这段时间到底攒了什么 */
  const g0 = S.gold;
  const b0 = {}; for (const k in S.bank) b0[k] = S.bank[k];
  const lv0 = {}, xp0 = {};
  SKILLS.forEach(function (s) {
    if (s.id === 'combat') return;
    lv0[s.id] = skillLevel(s.id);
    xp0[s.id] = S.skills[s.id] || 0;
  });
  const k0 = (S.stats && S.stats.kills) || 0;
  const d0 = (S.stats && S.stats.deaths) || 0;

  /* 天赋「夜市 / 夜巡」：同样的离线时长，结算出更多的进度 */
  const om = window.Talents ? (1 + window.Talents.extras().offlineMul) : 1;

  /* 技能：按「时间预算」快进。
     原实现用「最多完成 20000 次动作」截断：24h 离线 + 动作 0.3s 时只能结算约 7%，
     玩家越快反而拿得越少。现改为次数上限仅防死循环，超出时间预算时按已结算部分的平均值外推。 */
  const nowMs = function () { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
  const ffStart = nowMs();
  let guard = NUM.OFFLINE_MAX_ACTS;
  let left = sec * om;
  let truncated = false;
  let durSum = 0;
  while (left > 0 && guard-- > 0) {
    if (!S.action && !tryStart()) break;
    if (!S.action) break;
    const need = S.action.dur - S.action.t;
    if (need <= left) { left -= need; durSum += S.action.dur; completeAction(); res.acts++; }
    else { S.action.t += left; left = 0; }
    if ((res.acts & 1023) === 0 && nowMs() - ffStart > NUM.OFFLINE_BUDGET_MS) { truncated = true; break; }
  }
  if (truncated && res.acts > 0 && durSum > 0) {
    const avgDur = durSum / res.acts;
    const more = Math.min(Math.floor(left / avgDur), NUM.OFFLINE_MAX_ACTS - res.acts);
    if (more > 0) {
      extrapolateOffline(more / res.acts, b0, xp0, g0);
      res.acts += more;
      res.extrapolated = true;
    }
  }
  res.truncated = truncated;
  res.gold = S.gold - g0;
  /* 战斗：粗粒度模拟 */
  if (S.combat && S.combat.active) {
    let csec = Math.min(sec * om, 4 * 3600 * om);
    let step = 1.0;
    let g = 0;
    while (csec > 0 && g++ < 20000) {
      Combat.simulate(step);
      csec -= step;
      if (!S.combat || !S.combat.active) break;
    }
  }
  res.combat = !!(S.combat && S.combat.active);
  res.kills = ((S.stats && S.stats.kills) || 0) - k0;
  res.deaths = ((S.stats && S.stats.deaths) || 0) - d0;

  /* 技能：经验增量与升级记录 */
  res.xp = {}; res.lvups = [];
  SKILLS.forEach(function (s) {
    if (s.id === 'combat') return;
    const d = (S.skills[s.id] || 0) - (xp0[s.id] || 0);
    if (d > 0) res.xp[s.id] = d;
    const lv = skillLevel(s.id);
    if (lv > lv0[s.id]) res.lvups.push({ id: s.id, from: lv0[s.id], to: lv });
  });

  /* 物资：按「数量 × 单价」从高到低取前 6 件 */
  const deltas = [];
  for (const k in S.bank) {
    const d = S.bank[k] - (b0[k] || 0);
    if (d <= 0) continue;
    const it = ITEMS[k];
    deltas.push({
      id: k, n: d, icon: it ? it.icon : '📦', name: it ? it.name : k,
      val: d * (it && it.price ? it.price : 1)
    });
  }
  deltas.sort(function (a, b) { return b.val - a.val; });
  res.items = deltas.slice(0, 6);
  res.itemKinds = deltas.length;

  S.stats.offline += sec;
  return res;
}
