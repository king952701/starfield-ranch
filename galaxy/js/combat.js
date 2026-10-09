/* ============================================================
 *  星海牧场 · 战斗层
 *  双层减伤模型（闪避层 + 护甲/抗性层）
 * ============================================================ */

const Combat = {
  /* ---------- 玩家战斗属性 ---------- */
  stats: function () {
    const agg = equipAgg();
    const st = agg.st;
    const B = bonuses();
    const w = S.equip.weapon ? ITEMS[S.equip.weapon] : null;
    const style = w ? w.style : 'slash';
    const dmgType = w ? w.dmgType : 'physical';
    const defensive = w && st.defensive;

    const sl = {
      stamina: subLevel('stamina'), intelligence: subLevel('intelligence'),
      attack: subLevel('attack'), defense: subLevel('defense'),
      melee: subLevel('melee'), ranged: subLevel('ranged'), magic: subLevel('magic')
    };
    const maxHp = Math.round(100 + 10 * sl.stamina + (st.hp || 0));
    const maxMp = Math.round(50 + 10 * sl.intelligence + (st.mp || 0));

    let atkSpdBonus = sl.attack / 2000 + 0.005 * (S.houses['dojo'] || 0) + 0.003 * (S.houses['archery'] || 0);
    const interval = Math.max(0.6, (w ? (st.spd || w.st.spd) : 3.0) / (1 + atkSpdBonus));

    const accuracy = 60 + 5 * sl.attack + (st.acc || 0);
    const evasion = 20 + 3 * sl.defense + (st.eva || 0);
    const armor = (st.armor || 0) + 2 * sl.defense;
    const resist = (st.resist || 0) + 1.5 * sl.defense;

    const wdmg = (style === 'ranged' ? (st.rangedDmg || 0) : style === 'magic' ? (st.magicDmg || 0) : (st.meleeDmg || 0));
    const powerLvl = defensive ? sl.defense : (style === 'ranged' ? sl.ranged : style === 'magic' ? sl.magic : sl.melee);
    let maxHit = (wdmg + 5 + powerLvl * 1.2) * (1 + powerLvl / 40);
    maxHit *= (1 + B.dmg + (st.amplify || 0));

    const hpReg = 0.001 + 0.0003 * (S.houses['dining'] || 0);
    const mpReg = 0.001 + 0.0003 * (S.houses['library'] || 0);

    return {
      style: style, dmgType: dmgType, defensive: !!defensive,
      maxHp: maxHp, maxMp: maxMp, interval: interval,
      accuracy: accuracy, evasion: evasion, armor: armor, resist: resist,
      maxHit: maxHit, crit: (st.crit || 0), pen: sl.attack * 0.8,
      proc: st.proc || null, hpReg: hpReg, mpReg: mpReg,
      rareFind: B.rare, subs: sl, weapon: w
    };
  },

  hitChance: function (acc, eva) {
    const a = Math.pow(Math.max(1, acc), 1.4), e = Math.pow(Math.max(1, eva), 1.4);
    return a / (a + e);
  },
  mitigate: function (dmg, def, pen) {
    const d = def - pen;
    return d >= 0 ? dmg * 100 / (100 + d) : dmg * (100 - d) / 100;
  },

  /* ---------- 开始 / 停止 ---------- */
  start: function (zoneId) {
    const z = ZONE_DEFS.filter(function (x) { return x.id === zoneId; })[0];
    if (!z) return;
    if (combatLevel() < z.lvl * 0.5) { UI.toast('战斗等级过低，建议先提升装备'); }
    const P = Combat.stats();
    S.combat = {
      active: true, zone: zoneId, kills: 0, streak: 0,
      hp: P.maxHp, mp: P.maxMp, atkT: 0, mobT: 1.0, spawnT: 0,
      cd: {}, buffs: {}, mob: null, log: []
    };
    Combat.spawn(false);
    UI.dirty = true;
  },
  stop: function () {
    if (S.combat) S.combat.active = false;
    UI.dirty = true;
  },
  spawn: function (forceBoss) {
    const c = S.combat;
    const z = ZONE_DEFS.filter(function (x) { return x.id === c.zone; })[0];
    const isBoss = forceBoss || (c.kills > 0 && c.kills % 10 === 9);
    let id;
    if (isBoss) id = z.boss[0];
    else id = pick(z.mobs)[0];
    const m = MONSTERS[id];
    const hp = m.hp;
    c.mob = {
      id: id, hp: hp, maxHp: hp, boss: !!m.boss,
      abT: m.ability ? m.ability.cd : 999, nextBoss: isBoss
    };
    c.mobT = m.spd;
    c.spawnT = 0;
    UI.dirty = true;
  },

  /* ---------- 日志 ---------- */
  say: function (msg, cls) {
    const c = S.combat;
    if (!c) return;
    c.log.unshift({ m: msg, c: cls || '' });
    if (c.log.length > 40) c.log.length = 40;
  },

  /* ---------- 主循环 ---------- */
  simulate: function (dt) {
    const c = S.combat;
    if (!c || !c.active) return;
    const P = Combat.stats();

    /* 冷却 / buff */
    for (const k in c.cd) if (c.cd[k] > 0) c.cd[k] -= dt;
    for (const k in c.buffs) { c.buffs[k] -= dt; if (c.buffs[k] <= 0) delete c.buffs[k]; }

    /* 回复 */
    const regen = (c.buffs['regen'] ? 0.03 : 0);
    c.hp = Math.min(P.maxHp, c.hp + P.maxHp * (P.hpReg + regen) * dt);
    c.mp = Math.min(P.maxMp, c.mp + P.maxMp * (P.mpReg + regen) * dt);

    /* 自动进食 */
    if (c.hp / P.maxHp < 0.4) Combat.eat(P);

    if (c.spawnT > 0) { c.spawnT -= dt; return; }
    if (!c.mob) { Combat.spawn(false); return; }

    /* 技能 */
    Combat.tryAbility(P, dt);
    if (!c.mob || !c.active) return;

    /* 玩家攻击 */
    c.atkT -= dt;
    if (c.atkT <= 0) { Combat.playerAttack(P); c.atkT += P.interval; }
    if (!c.mob || !c.active) return;

    /* 怪物攻击 */
    const m = MONSTERS[c.mob.id];
    c.mobT -= dt;
    if (c.mobT <= 0) { Combat.enemyAttack(P, m); c.mobT += m.spd; if (m.ability) { c.mob.abT -= m.spd; if (c.mob.abT <= 0) { Combat.enemyAbility(P, m); c.mob.abT = m.ability.cd; } } }

    if (c.hp <= 0) Combat.die();
  },

  tryAbility: function (P, dt) {
    const c = S.combat;
    const m = MONSTERS[c.mob.id];
    const cl = combatLevel();
    const list = ABILITIES.filter(function (ab) {
      if (cl < ab.lvl) return false;
      if (ab.style !== 'any' && ab.style !== P.style) return false;
      if ((c.cd[ab.id] || 0) > 0) return false;
      if (c.mp < ab.mp) return false;
      if (ab.buff && c.buffs[ab.id]) return false;
      return true;
    });
    if (!list.length) return;
    let ab = null;
    if (P.mp < P.maxMp * 0.25) ab = list.filter(function (x) { return x.id === 'meditate'; })[0];
    if (!ab) ab = list.filter(function (x) { return x.buff; })[0];
    if (!ab) ab = list.filter(function (x) { return x.mult >= 1.8; })[0] || list[0];
    if (!ab) return;

    c.mp -= ab.mp;
    c.cd[ab.id] = ab.cd;
    if (ab.buff) {
      c.buffs[ab.id] = ab.buff.dur;
      if (ab.buff.regen) c.buffs['regen'] = ab.buff.dur;
      Combat.say('施展【' + ab.name + '】', 'buff');
    } else {
      const hit = Combat.hitChance(P.accuracy * (1 + (c.buffs['precision'] ? 0.35 : 0)), m.eva);
      if (Math.random() < hit) {
        const dmgMul = ab.mult * (1 + (c.buffs['berserk'] ? 0.3 : 0));
        const dmg = Combat.mitigate(P.maxHit * dmgMul, Combat.mobDef(m, P.dmgType), P.pen);
        c.mob.hp -= dmg;
        Combat.say('【' + ab.name + '】造成 ' + fmt(dmg) + ' 伤害', 'skill');
      } else {
        Combat.say('【' + ab.name + '】被闪避', 'miss');
      }
      /* 元素触发 */
      if (P.proc) Combat.proc(P, m);
      if (c.mob && c.mob.hp <= 0) Combat.kill();
    }
    if (c.mob.hp <= 0) Combat.kill();
  },

  proc: function (P, m) {
    const c = S.combat;
    if (P.proc === 'blaze') {
      const d = Combat.mitigate(P.maxHit * 0.3, Combat.mobDef(m, 'fire'), P.pen);
      c.mob.hp -= d;
      Combat.say('🔥 炽焰触发 ' + fmt(d), 'proc');
    } else if (P.proc === 'bloom') {
      c.hp = Math.min(P.maxHp, c.hp + 10 + P.maxHit * 0.15);
      Combat.say('🌱 绽放回复生命', 'proc');
    } else if (P.proc === 'ripple') {
      c.mp = Math.min(P.maxMp, c.mp + 10);
      for (const k in c.cd) c.cd[k] = Math.max(0, c.cd[k] - 2);
      Combat.say('💧 涟漪回复内力', 'proc');
    }
  },

  mobDef: function (m, dtype) {
    return (dtype === 'physical') ? m.armor : m.resist;
  },

  playerAttack: function (P) {
    const c = S.combat;
    if (!c || !c.mob) return;
    const m = MONSTERS[c.mob.id];
    const hit = Combat.hitChance(P.accuracy * (1 + (c.buffs['precision'] ? 0.35 : 0)), m.eva);
    if (Math.random() > hit) { Combat.say('攻击被 ' + m.name + ' 闪避', 'miss'); return; }
    let crit = false, dmg = P.maxHit * rnd(0.6, 1);
    const critChance = Math.min(0.9, P.crit + (P.style === 'ranged' ? hit * 0.3 : 0));
    if (Math.random() < critChance) { crit = true; dmg = P.maxHit; }
    dmg *= (1 + (c.buffs['berserk'] ? 0.3 : 0));
    dmg = Combat.mitigate(dmg, Combat.mobDef(m, P.dmgType), P.pen);
    c.mob.hp -= dmg;
    Combat.say((crit ? '💥 暴击 ' : '命中 ') + fmt(dmg), crit ? 'crit' : 'hit');
    if (c.mob.hp <= 0) Combat.kill();
  },

  enemyAttack: function (P, m) {
    const c = S.combat;
    const hit = Combat.hitChance(m.acc, P.evasion);
    if (Math.random() > hit) { Combat.say('闪避了 ' + m.name + ' 的攻击', 'dodge'); return; }
    let dmg = m.dmg * rnd(0.6, 1);
    const def = (m.dmgType === 'physical') ? P.armor * (1 + (c.buffs['toughness'] ? 0.5 : 0)) : P.resist;
    dmg = Combat.mitigate(dmg, def, m.pen);
    c.hp -= dmg;
    Combat.say(m.name + ' 造成 ' + fmt(dmg) + ' 伤害', 'ehit');
  },

  enemyAbility: function (P, m) {
    const c = S.combat;
    const hit = Combat.hitChance(m.acc * 1.2, P.evasion);
    if (Math.random() > hit) { Combat.say('闪避了【' + m.ability.name + '】', 'dodge'); return; }
    let dmg = m.dmg * m.ability.mult;
    dmg = Combat.mitigate(dmg, (m.dmgType === 'physical') ? P.armor : P.resist, m.pen);
    c.hp -= dmg;
    Combat.say('☠ 【' + m.ability.name + '】造成 ' + fmt(dmg) + ' 伤害', 'ehit');
  },

  eat: function (P) {
    const c = S.combat;
    let best = null;
    for (const id in S.bag) {
      if (!S.bag[id] || !ITEMS[id]) continue;
      if (ITEMS[id].cat !== 'food') continue;
      if (!best || ITEMS[id].heal > ITEMS[best].heal) best = id;
    }
    if (!best) return;
    S.bag[best]--;
    if (S.bag[best] <= 0) delete S.bag[best];
    c.hp = Math.min(P.maxHp, c.hp + ITEMS[best].heal);
    if (ITEMS[best].mana) c.mp = Math.min(P.maxMp, c.mp + ITEMS[best].mana);
    Combat.say('🍖 食用 ' + ITEMS[best].name + '（+' + ITEMS[best].heal + '）', 'eat');
    UI.dirty = true;
  },

  kill: function () {
    const c = S.combat;
    const m = MONSTERS[c.mob.id];
    const z = ZONE_DEFS.filter(function (x) { return x.id === c.zone; })[0];
    const P = Combat.stats();
    c.kills++;
    c.streak++;
    S.stats.kills++;

    /* 经验分配（MWI 规则） */
    const primary = (P.style === 'ranged') ? 'ranged' : (P.style === 'magic' ? 'magic' : 'melee');
    const xp = m.xp;
    addSubXp(primary, xp * 0.44);
    addSubXp('stamina', xp * 0.14);
    addSubXp('intelligence', xp * 0.14);
    addSubXp('attack', xp * 0.14);
    addSubXp('defense', xp * 0.14);

    /* 金币 */
    const gold = Math.round(m.xp * 0.5 * (m.boss ? 4 : 1));
    addGold(gold);

    /* 掉落 */
    const B = bonuses();
    const loot = [];
    if (Math.random() < 0.35 + B.rare) {
      const it = pick(z.loot);
      const n = Math.round(rnd(1, 3)) * (m.boss ? 3 : 1);
      addItem(it, n); loot.push(ITEMS[it].name + ' ×' + n);
    }
    if (Math.random() < 0.18 + B.rare) { addItem('essence', m.boss ? 4 : 1); loot.push('星精华'); }
    if (Math.random() < 0.06 + B.rare * 0.5) { addItem('gem', 1); loot.push('星辉宝石'); }
    if (Math.random() < 0.05) { addItem('tea_leaf', Math.round(rnd(1, 4))); loot.push('茶叶'); }
    if (Math.random() < 0.04 + B.rare * 0.3) {
      const t = Math.min(6, Math.floor(z.lvl / 15));
      const pool = ITEM_LIST.filter(function (i) { return i.cat === 'equip' && i.line && i.line.indexOf('plate') === 0 && i.tier === t; });
      if (pool.length) { const e = pick(pool); addItem(e.id, 1); loot.push(e.name + '（装备）'); }
    }
    if (m.boss) { addItem('chest_common', 1); loot.push('陨石宝箱'); }

    onTaskKill(c.zone);
    Combat.say('☠ 击败 ' + m.name + '！+' + fmt(xp) + ' 经验、+' + fmt(gold) + ' 金币' + (loot.length ? '、' + loot.join('、') : ''), 'kill');
    c.mob = null;
    c.spawnT = 1.2;
    UI.dirty = true;
  },

  die: function () {
    const c = S.combat;
    c.active = false;
    S.stats.deaths++;
    const lost = Math.round(S.gold * 0.02);
    S.gold = Math.max(0, S.gold - lost);
    Combat.say('💀 你被击倒了！损失 ' + fmt(lost) + ' 金币', 'kill');
    c.hp = 1;
    pushLog('💀 战斗失败：在' + ZONE_DEFS.filter(function (x) { return x.id === c.zone; })[0].name + '被击倒');
    UI.dirty = true;
  }
};
