/* ============================================================
 *  星海牧场 · 界面层 2（各面板实现）
 * ============================================================ */

Object.assign(UI, {

  /* ---------------- 技能面板 ---------------- */
  pSkill: function () {
    const sk = UI.skill;
    const S0 = SKILL_MAP[sk];
    if (sk === 'combat') { UI.tab = 'combat'; return UI.pCombat(); }
    const info = lvlInfo(S.skills[sk] || 0);
    const lvl = info.lvl;
    const eff = efficiency(sk);
    const spd = actionSpeedMul();
    const tool = S.equip.tool ? ITEMS[S.equip.tool] : null;
    const toolOk = tool && tool.toolSkill === sk;
    let h = '';
    h += '<div class="ph"><div class="phic">' + S0.icon + '</div><div class="phtxt"><h2>' + S0.name + '</h2><p>' + S0.desc + '</p></div>' +
      '<div class="phlv"><b>' + info.lvl + '</b><span>/ 99</span></div></div>';
    h += '<div class="xpbar"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i><span>' + fmt(info.cur) + ' / ' + fmt(info.need) + ' XP</span></div>';
    h += '<div class="chips">' +
      '<div class="chip">⚡ 效率 <b>+' + (eff * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">⏱ 速度 <b>×' + spd.toFixed(2) + '</b></div>' +
      '<div class="chip">✦ 专精总等级 <b>' + masteryTotal(sk) + '</b></div>' +
      '<div class="chip">' + (toolOk ? '🛠 ' + tool.name + ' <b>+' + tool.eff[sk] + '%</b>' : '🛠 未装备对应工具') + '</div>' +
      '</div>';

    if (sk === 'alchemy') {
      const mats = ITEM_LIST.filter(function (i) { return i.cat === 'mat' && count(i.id) > 0; });
      h += '<div class="sub">转化目标：<select data-sel="alch">' + mats.map(function (m) {
        return '<option value="' + m.id + '"' + (S.alchTarget === m.id ? ' selected' : '') + '>' + m.icon + ' ' + m.name + '（持有 ' + count(m.id) + '）</option>';
      }).join('') + '</select></div>';
    }
    if (sk === 'enhancing') {
      h += '<div class="sub">强化成功率随「强化」等级与专精提升；失败退回 +0。当前各部位强化：' +
        SLOTS.map(function (sl) { return S.equip[sl.id] ? sl.name + ' +' + enhLevel(sl.id) : ''; }).filter(Boolean).join('、') + '</div>';
    }

    /* 分组 */
    const all = ACTIONS[sk];
    const groups = [{ n: sk === 'cheesesmithing' ? '熔炼配方' : (sk === 'tailoring' ? '织造配方' : '动作'), list: all.filter(function (a) { return !a.makeItem; }) }];
    const eq = all.filter(function (a) {
      return a.makeItem && a.lvl <= lvl + 15;
    }).sort(function (x, y) { return y.lvl - x.lvl; });
    if (eq.length) {
      const bySlot = {};
      eq.forEach(function (a) {
        const it = ITEMS[a.makeItem];
        const key = it.slot === 'weapon' ? it.line : it.slot;
        (bySlot[key] = bySlot[key] || []).push(a);
      });
      Object.keys(bySlot).forEach(function (k) {
        const nm = (bySlot[k][0] && ITEMS[bySlot[k][0].makeItem]) ? (SLOT_MAP[ITEMS[bySlot[k][0].makeItem].slot].name) : k;
        groups.push({ n: nm + '制作', list: bySlot[k].slice(0, 28) });
      });
    }

    groups.forEach(function (g) {
      if (!g.list.length) return;
      h += '<h3 class="sec">' + g.n + '</h3><div class="alist">';
      g.list.forEach(function (a) { h += UI.actionRow(sk, a); });
      h += '</div>';
    });
    return h;
  },

  actionRow: function (sk, a) {
    const lvl = skillLevel(sk);
    const ok = lvl >= a.lvl;
    const ml = masteryLevel(sk, a.id);
    const t = actionTime(sk, a);
    const short = UI.reqShort(sk, a);
    let h = '<div class="arow' + (ok ? '' : ' lock') + '">';
    h += '<div class="aic">' + (a.icon || '⏳') + (ml > 0 ? '<em>' + ml + '</em>' : '') + '</div>';
    h += '<div class="amain"><div class="anm">' + a.name + (ok ? '' : '<i class="lk">🔒 ' + a.lvl + '级</i>') + '</div>';
    h += '<div class="ameta">';
    if (a.in) h += '<span class="in">' + Object.keys(a.in).map(function (k) { return ITEMS[k].icon + ITEMS[k].name + '×' + a.in[k] + (count(k) < a.in[k] ? ' <b class="lack">缺</b>' : ''); }).join(' ') + '</span>';
    if (a.out) h += '<span class="out">→ ' + Object.keys(a.out).map(function (k) { return ITEMS[k].icon + ITEMS[k].name + '×' + a.out[k]; }).join(' ') + '</span>';
    if (a.kind === 'coinify') h += '<span class="out">→ 💰 ' + (S.alchTarget ? fmt(ITEMS[S.alchTarget].price * 1.6) : '?') + ' 金币</span>';
    if (a.kind === 'decompose') h += '<span class="out">→ 💎 星精华</span>';
    if (a.kind === 'transmute') h += '<span class="out">→ ' + (S.alchTarget && nextTierItem(S.alchTarget) ? ITEMS[nextTierItem(S.alchTarget)].icon + ITEMS[nextTierItem(S.alchTarget)].name : '?') + '</span>';
    if (a.kind === 'enhance') h += '<span class="out">' + (S.equip[a.slot] ? ITEMS[S.equip[a.slot]].name + ' +' + enhLevel(a.slot) + ' → +' + (enhLevel(a.slot) + 1) + '（需 💎' + enhanceCost(enhLevel(a.slot)) + '）' : '该部位为空') + '</span>';
    h += '</div>';
    h += '<div class="ameta2">⏱ ' + t.toFixed(1) + 's ｜ ★ ' + fmt(a.xp) + ' XP ｜ ' + short + '</div>';
    h += '</div>';
    h += '<div class="abtns">' +
      '<button data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="1">+1</button>' +
      '<button data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="10">+10</button>' +
      '<button data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="inf">∞</button>' +
      '</div></div>';
    return h;
  },

  reqShort: function (sk, a) {
    if (a.kind === 'enhance') {
      const cur = S.equip[a.slot] ? enhLevel(a.slot) : 0;
      const ch = Math.min(0.95, 0.55 + skillLevel('enhancing') * 0.008 + masteryLevel(sk, a.id) * 0.003 - cur * 0.05);
      return '成功率 ' + (ch * 100).toFixed(0) + '%';
    }
    if (a.kind === 'coinify' || a.kind === 'decompose' || a.kind === 'transmute') {
      const base = a.kind === 'transmute' ? 0.35 : (a.kind === 'coinify' ? 0.40 : 0.45);
      const ch = Math.min(0.95, base + skillLevel('alchemy') * 0.004 + masteryLevel(sk, a.id) * 0.003);
      return '成功率 ' + (ch * 100).toFixed(0) + '%';
    }
    if (a.kind === 'cook') {
      const burn = Math.max(0, 0.22 - masteryLevel(sk, a.id) * 0.0022 - skillLevel(sk) * 0.0012 - efficiency(sk, a.id) * 0.15);
      return '失败率 ' + (burn * 100).toFixed(1) + '%';
    }
    return '额外产出 +' + (efficiency(sk, a.id) * 100).toFixed(0) + '%';
  },

  /* ---------------- 战斗面板 ---------------- */
  pCombat: function () {
    const P = Combat.stats();
    const c = S.combat;
    let h = '';
    h += '<div class="ph"><div class="phic">⚔️</div><div class="phtxt"><h2>战斗历练</h2><p>选择区域自动战斗。七项战斗素养决定你的上限。</p></div>' +
      '<div class="phlv"><b>' + combatLevel().toFixed(1) + '</b><span>战斗等级</span></div></div>';
    h += '<div class="subs">' + COMBAT_SUBS.map(function (s) {
      const info = lvlInfo(S.subs[s.id] || 0);
      return '<div class="sub2"><i>' + s.icon + '</i><span>' + s.name + '</span><b>' + subLevel(s.id) + '</b>' +
        '<div class="skbar"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i></div></div>';
    }).join('') + '</div>';

    h += '<h3 class="sec">区域</h3><div class="zones">';
    ZONE_DEFS.forEach(function (z) {
      const need = z.lvl;
      const can = combatLevel() >= need * 0.6;
      const on = c && c.active && c.zone === z.id;
      h += '<div class="zone' + (on ? ' on' : '') + (can ? '' : ' lock') + '" data-act="combat-start" data-a="' + z.id + '">' +
        '<div class="zic">' + z.ic + '</div><div class="znm">' + z.name + '</div>' +
        '<div class="zlv">需求战等 ' + need + '</div>' +
        '<div class="zbtn">' + (on ? '停止' : (can ? '前往' : '过弱')) + '</div></div>';
    });
    h += '</div>';

    if (c && c.mob) {
      const m = MONSTERS[c.mob.id];
      h += '<h3 class="sec">当前战斗 · ' + ZONE_DEFS.filter(function (x) { return x.id === c.zone; })[0].name + '（已击杀 ' + c.kills + '）</h3>';
      h += '<div class="mob"><div class="mobh"><div class="mobic">' + m.icon + '</div><div><b>' + m.name + (m.boss ? ' 👑' : '') + '</b>' +
        '<div class="mobmeta">HP ' + fmt(m.hp) + ' ｜ 命中 ' + fmt(m.acc) + ' ｜ 闪避 ' + fmt(m.eva) + ' ｜ 护甲 ' + fmt(m.armor) + ' ｜ 伤害 ' + fmt(m.dmg) + '</div></div></div>' +
        '<div class="xpbar mob"><i style="width:' + Math.max(0, c.mob.hp / c.mob.maxHp * 100) + '%"></i><span>' + fmt(Math.max(0, c.mob.hp)) + ' / ' + fmt(c.mob.maxHp) + '</span></div>';
      h += '<div class="cds">' + ABILITIES.filter(function (ab) {
        return ab.style === 'any' || ab.style === P.style;
      }).map(function (ab) {
        const cd = (c.cd && c.cd[ab.id]) || 0;
        return '<div class="cd' + (cd > 0 ? ' cool' : '') + '" title="' + ab.desc + '">' + ab.icon + '<em>' + (cd > 0 ? cd.toFixed(0) + 's' : '✔') + '</em></div>';
      }).join('') + '</div></div>';
    }

    /* 战斗背包 */
    h += '<h3 class="sec">战斗背包 <button class="mini" data-act="bagtoggle">' + (UI.bagOpen ? '收起' : '管理') + '</button></h3>';
    h += '<div class="bag">' + Object.keys(S.bag).map(function (id) {
      return '<div class="bagi" data-act="bagdel" data-a="' + id + '">' + ITEMS[id].icon + ITEMS[id].name + '<em>×' + S.bag[id] + '</em></div>';
    }).join('') + (Object.keys(S.bag).length ? '' : '<div class="dim">背包为空 —— 放入食物后会在生命低于 40% 时自动食用</div>') + '</div>';
    if (UI.bagOpen) {
      const foods = ITEM_LIST.filter(function (i) { return i.cat === 'food' && count(i.id) > 0; });
      h += '<div class="alist">' + foods.map(function (f) {
        return '<div class="arow"><div class="aic">' + f.icon + '</div><div class="amain"><div class="anm">' + f.name + '</div>' +
          '<div class="ameta2">恢复 ' + f.heal + ' 生命' + (f.mana ? '、' + f.mana + ' 内力' : '') + ' ｜ 持有 ' + count(f.id) + '</div></div>' +
          '<div class="abtns"><button data-act="bagadd" data-a="' + f.id + '">放入</button></div></div>';
      }).join('') + '</div>';
      const drinks = ITEM_LIST.filter(function (i) { return i.cat === 'drink' && count(i.id) > 0; });
      h += '<h3 class="sec">饮品</h3><div class="alist">' + drinks.map(function (f) {
        return '<div class="arow"><div class="aic">' + f.icon + '</div><div class="amain"><div class="anm">' + f.name + '</div>' +
          '<div class="ameta2">' + (f.buff.kind === 'combat' ? '战斗伤害 +' + Math.round(f.buff.dmg * 100) + '%' : '采集效率 +' + Math.round(f.buff.eff * 100) + '%') + ' ｜ ' + Math.round(f.buff.dur) + '秒 ｜ 持有 ' + count(f.id) + '</div></div>' +
          '<div class="abtns"><button data-act="drink" data-a="' + f.id + '">饮用</button></div></div>';
      }).join('') + '</div>';
    }

    if (c && c.log.length) {
      h += '<h3 class="sec">战斗日志</h3><div class="clog">' + c.log.slice(0, 14).map(function (l) {
        return '<div class="cl ' + l.c + '">' + l.m + '</div>';
      }).join('') + '</div>';
    }
    return h;
  },

  /* ---------------- 装备面板 ---------------- */
  pEquip: function () {
    let h = '<div class="ph"><div class="phic">🛡️</div><div class="phtxt"><h2>装备与强化</h2><p>点击银行中的装备即可穿戴；强化每级 +8% 属性。</p></div></div>';
    h += '<div class="eqgrid">';
    SLOTS.forEach(function (sl) {
      const id = S.equip[sl.id];
      const it = id ? ITEMS[id] : null;
      const e = enhLevel(sl.id);
      h += '<div class="eqcell"><div class="eqslot">' + (it ? it.icon : sl.ic) + (e ? '<em>+' + e : '') + '</em></div>' +
        '<div class="eqnm">' + (it ? it.name : '—') + '</div>' +
        '<div class="eqst">' + (it ? UI.statText(it) : '<span class="dim">' + sl.name + '</span>') + '</div>' +
        (it ? '<button class="mini red" data-act="unequip" data-a="' + sl.id + '">卸下</button>' : '') + '</div>';
    });
    h += '</div>';
    const owned = ITEM_LIST.filter(function (i) { return i.cat === 'equip' && count(i.id) > 0; });
    h += '<h3 class="sec">银行中的装备（' + owned.length + '）</h3><div class="alist">';
    owned.forEach(function (it) { h += UI.equipRow(it); });
    h += '</div>';
    return h;
  },
  equipRow: function (it) {
    return '<div class="arow"><div class="aic">' + it.icon + '</div><div class="amain"><div class="anm">' + it.name +
      (it.lvl ? '<i class="lk">需要 ' + SKILL_MAP[it.recipe.skill].name + ' ' + it.lvl + ' 级</i>' : '') + '</div>' +
      '<div class="ameta2">' + UI.statText(it) + (it.eff ? ' ｜ 效率：' + Object.keys(it.eff).map(function (k) { return SKILL_MAP[k].name + '+' + it.eff[k] + '%'; }).join('、') : '') + '</div></div>' +
      '<div class="abtns"><button data-act="equip" data-a="' + it.id + '">装备</button></div></div>';
  },
  statText: function (it) {
    const s = it.st || {};
    const out = [];
    const names = {
      armor: '护甲', eva: '闪避', hp: '生命', mp: '内力', acc: '命中',
      meleeDmg: '近战伤害', rangedDmg: '远程伤害', magicDmg: '魔法伤害',
      resist: '抗性', crit: '暴击', wisdom: '智慧', rareFind: '稀有', amplify: '增伤'
    };
    for (const k in s) {
      if (k === 'spd') continue;
      if (!names[k]) continue;
      const v = s[k];
      out.push(names[k] + ' +' + (v < 1 ? (v * 100).toFixed(1) + '%' : fmt(v)));
    }
    return out.join(' ｜ ') || '—';
  },

  /* ---------------- 银行面板 ---------------- */
  pBank: function () {
    let h = '<div class="ph"><div class="phic">🎒</div><div class="phtxt"><h2>银行</h2><p>持有 ' + Object.keys(S.bank).length + ' 种物品，总资产约 ' + fmt(UI.bankValue()) + ' 金币。</p></div>' +
      '<div class="phlv"><b>' + fmt(S.gold) + '</b><span>金币</span></div></div>';
    const cats = [['all', '全部'], ['mat', '材料'], ['food', '食物'], ['drink', '饮品'], ['equip', '装备']];
    h += '<div class="cats">' + cats.map(function (c) {
      return '<div class="cat' + (UI.bankCat === c[0] ? ' on' : '') + '" data-act="bankcat" data-a="' + c[0] + '">' + c[1] + '</div>';
    }).join('') + '</div>';
    const list = Object.keys(S.bank).filter(function (id) {
      if (!ITEMS[id]) return false;
      if (UI.bankCat === 'all') return true;
      return ITEMS[id].cat === UI.bankCat;
    }).sort(function (a, b) { return (ITEMS[b].price * S.bank[b]) - (ITEMS[a].price * S.bank[a]); });
    h += '<div class="igrid">';
    list.forEach(function (id) {
      const it = ITEMS[id], n = S.bank[id];
      if (n <= 0) return;
      let extra = '';
      if (id === 'chest_common' || id === 'chest_rare') extra = '<button class="mini gold" data-act="open-chest" data-a="' + id + '">开启</button>';
      h += '<div class="icell" title="' + it.name + '（单价 ' + fmt(it.price) + '）">' +
        '<div class="iic">' + it.icon + '</div><div class="inm2">' + it.name + '</div><div class="iq">×' + fmt(n) + '</div>' +
        '<div class="ibtns"><button class="mini" data-act="sell" data-a="' + id + '" data-b="1">卖1</button>' +
        '<button class="mini" data-act="sellall" data-a="' + id + '">全卖</button>' + extra + '</div></div>';
    });
    h += '</div>';
    return h;
  },
  bankValue: function () {
    let v = 0;
    for (const k in S.bank) if (ITEMS[k]) v += ITEMS[k].price * S.bank[k];
    return v;
  },

  /* ---------------- 专精面板 ---------------- */
  pMastery: function () {
    let h = '<div class="ph"><div class="phic">✦</div><div class="phtxt"><h2>专精</h2><p>每个动作都有独立专精等级；25% 专精经验注入专精池，达到 10/25/50/95% 检查点可获得强力加成。</p></div></div>';
    SKILLS.forEach(function (s) {
      if (s.id === 'combat') return;
      const cap = poolCap(s.id);
      const pct = poolPct(s.id);
      const cp = poolCheckpoint(s.id);
      h += '<div class="mcard"><div class="mh" data-act="skill" data-a="' + s.id + '">' + s.icon + ' <b>' + s.name + '</b>' +
        '<span>总专精 ' + masteryTotal(s.id) + ' / ' + masteryMax(s.id) + '</span></div>';
      h += '<div class="pool"><i style="width:' + (pct * 100).toFixed(1) + '%"></i>' +
        '<u class="c1"></u><u class="c2"></u><u class="c3"></u><u class="c4"></u>' +
        '<span>' + fmt(S.pool[s.id] || 0) + ' / ' + fmt(cap) + '（' + (pct * 100).toFixed(1) + '%）</span></div>';
      h += '<div class="cp">检查点：' + [1, 2, 3, 4].map(function (i) {
        return '<em class="' + (cp >= i ? 'on' : '') + '">' + POOL_BONUS[i].label + '</em>';
      }).join('') + '</div>';
      const acts = ACTIONS[s.id].slice().sort(function (a, b) { return masteryLevel(s.id, b.id) - masteryLevel(s.id, a.id); }).slice(0, 12);
      h += '<div class="mlist">' + acts.map(function (a) {
        const ml = masteryLevel(s.id, a.id);
        const info = lvlInfo((S.mastery[s.id][a.id] || 0), MST_XP);
        return '<div class="mrow"><span class="mn">' + (a.icon || '') + a.name + '</span>' +
          '<span class="mb"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i></span>' +
          '<span class="mv">Lv.' + ml + '</span>' +
          '<button class="mini" data-act="mast-spend" data-a="' + s.id + '" data-b="' + a.id + '">注入</button></div>';
      }).join('') + '</div></div>';
    });
    return h;
  },

  /* ---------------- 市场面板 ---------------- */
  pMarket: function () {
    refreshMarket(false);
    let h = '<div class="ph"><div class="phic">🏪</div><div class="phtxt"><h2>星海交易所</h2><p>玩家订单每 20 分钟刷新一次。也可直接按半价出售银行物品。</p></div>' +
      '<div class="phlv"><button class="mini" data-act="mrefresh">刷新订单</button></div></div>';
    h += '<div class="orders">';
    S.market.orders.forEach(function (o) {
      const it = ITEMS[o.item];
      const price = Math.round(it.price * o.mul);
      h += '<div class="order' + (o.left <= 0 ? ' done' : '') + '">' +
        '<div class="oic">' + it.icon + '</div>' +
        '<div class="omn">' + (o.buy ? '<b class="buy">高价收购</b>' : '<b class="sell2">低价出售</b>') + ' ' + it.name + ' ×' + o.left + '</div>' +
        '<div class="op">单价 ' + fmt(price) + '（' + o.mul.toFixed(2) + '×） · 共 ' + fmt(price * o.left) + '</div>' +
        '<button class="mini" data-act="order" data-a="' + o.id + '">' + (o.buy ? '卖出' : '买入') + '</button></div>';
    });
    h += '</div>';
    h += '<h3 class="sec">快速出售（半价）</h3><div class="alist">';
    const sellable = Object.keys(S.bank).filter(function (id) { return ITEMS[id] && ITEMS[id].cat !== 'equip' && S.bank[id] > 0; })
      .sort(function (a, b) { return ITEMS[b].price * S.bank[b] - ITEMS[a].price * S.bank[a]; }).slice(0, 20);
    sellable.forEach(function (id) {
      h += '<div class="arow"><div class="aic">' + ITEMS[id].icon + '</div><div class="amain"><div class="anm">' + ITEMS[id].name + ' ×' + fmt(S.bank[id]) + '</div>' +
        '<div class="ameta2">单价 ' + fmt(ITEMS[id].price * 0.5) + ' ｜ 合计 ' + fmt(ITEMS[id].price * 0.5 * S.bank[id]) + '</div></div>' +
        '<div class="abtns"><button data-act="sellall" data-a="' + id + '">全卖</button></div></div>';
    });
    h += '</div>';
    return h;
  },

  /* ---------------- 任务面板 ---------------- */
  pTask: function () {
    const left = Math.max(0, S.nextTask - Date.now());
    let h = '<div class="ph"><div class="phic">📜</div><div class="phtxt"><h2>任务板</h2><p>每 ' + (taskInterval() / 3600000) + ' 小时生成新任务，上限 ' + taskSlots() + ' 个。完成任务获得金币与任务代币。</p></div>' +
      '<div class="phlv"><b>' + S.tokens + '</b><span>任务代币</span></div></div>';
    /* taskPoints = 累计完成任务数：不是货币，用来解锁里程碑加成 */
    const TM = taskMilestone();
    h += '<div class="chips"><div class="chip">⏳ 下次任务 ' + fmtTime(left / 1000) + '</div>' +
      '<div class="chip">🎯 已完成任务 ' + TM.points + ' 个（已解锁 ' + TM.unlocked + '/' + NUM.TASK_MILESTONES.length + ' 档）</div></div>';
    h += '<div class="tasks">';
    if (!S.tasks.length) h += '<div class="dim">暂无任务</div>';
    S.tasks.forEach(function (t) {
      const d = TASK_DIFF.filter(function (x) { return x.id === t.diff; })[0];
      const pct = Math.min(1, t.have / t.need);
      const done = t.have >= t.need;
      h += '<div class="task" style="border-left-color:' + d.col + '">' +
        '<div class="tdiff" style="background:' + d.col + '">' + d.name + '</div>' +
        '<div class="tmain"><div class="tt">' + taskText(t) + '</div>' +
        '<div class="xpbar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i><span>' + fmt(t.have) + ' / ' + fmt(t.need) + '</span></div>' +
        '<div class="trw">💰 ' + fmt(t.gold) + ' ｜ 🎟 ' + t.tokens + '</div></div>' +
        '<div class="tbtns">' + (done ? '<button class="mini gold" data-act="task-claim" data-a="' + t.id + '">交付</button>' : '') +
        '<button class="mini" data-act="task-reroll" data-a="' + t.id + '" data-b="gold">重掷(1万)</button>' +
        '<button class="mini" data-act="task-reroll" data-a="' + t.id + '" data-b="bell">重掷(🔔1)</button>' +
        '<button class="mini red" data-act="task-drop" data-a="' + t.id + '">放弃</button></div></div>';
    });
    h += '</div>';
    h += '<h3 class="sec">任务里程碑</h3><div class="shop">';
    NUM.TASK_MILESTONES.forEach(function (m) {
      const got = TM.points >= m.n;
      h += '<div class="shopi' + (got ? '' : ' lock') + '"><b>' + (got ? '✅ ' : '🔒 ') + m.n + ' 个任务</b>' +
        '<p>' + m.desc + (got ? '' : '　还差 ' + (m.n - TM.points) + ' 个') + '</p></div>';
    });
    h += '</div>';
    h += '<h3 class="sec">代币商店</h3><div class="shop">';
    TOKEN_SHOP.forEach(function (it) {
      const cur = S.shop[it.id] || 0;
      const lock = it.need && !S.shop[it.need];
      h += '<div class="shopi' + (lock ? ' lock' : '') + '"><b>' + it.name + '</b><p>' + it.desc + '</p>' +
        '<div class="sbtn"><span>🎟 ' + it.cost + '（' + cur + '/' + it.max + '）</span>' +
        '<button class="mini" data-act="buy-token" data-a="' + it.id + '">购买</button></div></div>';
    });
    h += '</div>';
    h += '<h3 class="sec">牛铃商店（🔔 ' + S.cowbell + '）</h3><div class="shop">';
    BELL_SHOP.forEach(function (it) {
      const cur = S.bell[it.id] || 0;
      h += '<div class="shopi' + (it.disabled ? ' lock' : '') + '"><b>' + it.name + '</b><p>' + it.desc + '</p>' +
        '<div class="sbtn"><span>🔔 ' + it.cost + '（' + cur + '/' + (it.max || 0) + '）</span>' +
        '<button class="mini" data-act="buy-bell" data-a="' + it.id + '">购买</button></div></div>';
    });
    h += '</div>';
    return h;
  },

  /* ---------------- 牧场面板 ---------------- */
  pHouse: function () {
    let h = '<div class="ph"><div class="phic">🏠</div><div class="phtxt"><h2>星海牧场</h2><p>每个房间每级都会为对应战斗素养 +1 级，并提供全局智慧与稀有发现加成。</p></div></div>';
    h += '<div class="houses">';
    HOUSES.forEach(function (hs) {
      const lv = S.houses[hs.id] || 0;
      const c = houseCost(lv);
      const woodId = WOOD[Math.min(7, c.woodTier)][0];
      const foodId = FOOD[Math.min(7, c.foodTier)][0];
      const maxed = lv >= hs.max;
      h += '<div class="house"><div class="hh">' + hs.icon + ' <b>' + hs.name + '</b><span>Lv.' + lv + ' / ' + hs.max + '</span></div>' +
        '<p class="hd">' + hs.desc + '</p>' +
        (maxed ? '<div class="maxed">已满级</div>' :
          '<div class="hc">💰 ' + fmt(c.gold) + ' ｜ ' + ITEMS[woodId].icon + ITEMS[woodId].name + ' ×' + c.wood + ' ｜ ' + ITEMS[foodId].icon + ITEMS[foodId].name + ' ×' + c.food + '</div>' +
          '<button class="mini gold" data-act="house" data-a="' + hs.id + '">升级</button>') +
        '</div>';
    });
    h += '</div>';
    return h;
  },

  /* ---------------- 社交面板 ---------------- */
  pSocial: function () {
    let h = '<div class="ph"><div class="phic">🌐</div><div class="phtxt"><h2>星海在线</h2><p>服务器：' + S.server + ' ｜ 公会加成：经验 +3%、稀有发现 +2%</p></div></div>';
    if (S.guild) {
      h += '<div class="guild">当前公会：<b>' + S.guild + '</b> <button class="mini red" data-act="guild-leave">退出</button></div>';
    } else {
      h += '<h3 class="sec">公会列表</h3><div class="glist">';
      GUILD_NAMES.forEach(function (g, i) {
        h += '<div class="gi"><span>' + g + '</span><em>' + (30 + i * 17) + ' 人</em>' +
          '<button class="mini" data-act="guild-join" data-a="' + g + '">加入</button></div>';
      });
      h += '</div>';
    }
    /* ---- 专属类别动态排行榜 ---- */
    if (!UI.lbCat) UI.lbCat = 'total';
    h += '<h3 class="sec">排行榜</h3><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    LB_CATS.forEach(function (c) {
      const on = UI.lbCat === c.id;
      h += '<span data-act="lbcat" data-a="' + c.id + '" style="cursor:pointer;padding:3px 10px;border:1px solid ' +
        (on ? 'var(--gold)' : '#2b3358') + ';border-radius:12px;font-size:12px;color:' +
        (on ? 'var(--gold)' : 'var(--dim)') + '">' + c.ic + ' ' + c.nm + '</span>';
    });
    h += '</div>';

    const cd = lbCat(UI.lbCat);
    const rows = lbRanking(UI.lbCat);
    let myRank = 0, myRow = null;
    rows.forEach(function (r) { if (r.me) { myRank = r.rank; myRow = r; } });
    h += '<div style="font-size:12px;color:var(--dim);margin-bottom:6px">' + cd.desc +
      ' ｜ 你第 <b style="color:var(--gold)">' + myRank + '</b> / ' + rows.length +
      ' 名，成绩 <b style="color:var(--gold)">' + fmt(myRow ? myRow.val : 0) + (cd.un ? ' ' + cd.un : '') + '</b></div>';
    h += '<div class="lb">';
    rows.forEach(function (r) {
      const medal = r.rank === 1 ? '🥇' : (r.rank === 2 ? '🥈' : (r.rank === 3 ? '🥉' : r.rank));
      h += '<div class="lbr' + (r.me ? ' me' : '') + '" data-act="hero" data-a="' + r.id + '" style="cursor:pointer">' +
        '<span class="rk">' + medal + '</span><span class="rn">' + r.name +
        '<em style="font-style:normal;color:var(--dim);font-size:10px"> ' + (r.title || '') + '</em></span>' +
        '<span class="rl">' + fmt(r.val) + (cd.un ? ' ' + cd.un : '') + '</span>' +
        '<span style="color:var(--dim)">›</span></div>';
    });
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--dim);margin-top:4px">点击任意一行可查看对方的装备、工具与全部技能等级。</div>';
    if (UI.heroId) h += UI.heroBlock(UI.heroId);
    /* 世界频道 */
    h += '<h3 class="sec">世界频道</h3><div class="chat">' +
      (S.chat || []).slice(0, 12).map(function (m) {
        return '<div class="ch"><b>' + m.n + '</b>：' + m.m + '</div>';
      }).join('') + '</div>';
    return h;
  },
  /* ---------- 存档导入（弹层里的输入框不会被主循环重刷） ---------- */
  showBackup: function () {
    if (typeof Backup === 'undefined') return;
    const w = document.getElementById('modalwrap');
    if (!w) return;
    w.innerHTML = '<div class="modal"><h2>💾 导入存档</h2>' +
      '<p class="sub">粘贴之前导出的存档文本。导入会覆盖当前进度 —— 覆盖前会自动为当前进度保存一份快照。</p>' +
      '<textarea id="buin" style="width:100%;height:150px;background:#080d1c;color:#b8c2e0;' +
      'border:1px solid #232c50;border-radius:8px;padding:8px;font-size:11px;box-sizing:border-box;' +
      'word-break:break-all" placeholder="在此粘贴存档文本…"></textarea>' +
      '<div id="buerrmsg" style="color:#f0645f;font-size:12px;min-height:18px"></div>' +
      '<button class="big" id="budo">校验并导入</button> ' +
      '<button class="big" id="buclose">取消</button></div>';
    w.style.display = 'flex';
    document.getElementById('buclose').onclick = function () { w.style.display = 'none'; };
    document.getElementById('budo').onclick = function () {
      const r = Backup.parse(document.getElementById('buin').value || '');
      if (!r.ok) { document.getElementById('buerrmsg').textContent = '⚠ ' + r.msg; return; }
      Backup.apply(r.data);
      w.style.display = 'none';
      UI.dirty = true;
    };
  },

  /* ---------- 隐私政策全文 ---------- */
  showPrivacy: function () {
    if (typeof PRIVACY === 'undefined') return;
    const w = document.getElementById('modalwrap');
    if (!w) return;
    let h = '<div class="modal"><h2>🔒 隐私政策</h2>' +
      '<p class="sub">版本 v' + PRIVACY.ver + ' ｜ 更新于 ' + PRIVACY.updated + '</p>';
    PRIVACY.secs.forEach(function (s) {
      h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 4px">' + s.h + '</h3>';
      s.p.forEach(function (t) {
        h += '<p style="font-size:12px;line-height:1.8;margin:3px 0">' + t + '</p>';
      });
    });
    h += '<button class="big" id="btnpol">我已阅读</button></div>';
    w.innerHTML = h;
    w.style.display = 'flex';
    const b = document.getElementById('btnpol');
    if (b) b.onclick = function () { w.style.display = 'none'; };
  },

  /* ---------- 天赋树 ---------- */
  pTalent: function () {
    if (!window.Talents) return '<div class="card"><p>天赋模块未加载</p></div>';
    const B = '<div class="card"><p style="font-size:12px;line-height:1.8">' +
      '<b>星海天赋树</b>——每层三选一，点数有限，你的取舍就是你的流派。<br>' +
      '点数来源：开局 1 点，之后总等级每 8 级 +1 点、每 40 级再 +1 点。</p></div>';
    return B + Talents.html();
  },

  /* ---------- 玩家档案（内联展开） ---------- */
  heroBlock: function (id) {
    const d = heroOf(id);
    if (!d) return '';
    const me = heroOf('me');
    const esc = function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    let maxSk = 10;
    SKILLS.forEach(function (s) {
      if (s.id === 'combat') return;
      maxSk = Math.max(maxSk, (d.skills[s.id] || 0), (me && me.skills ? (me.skills[s.id] || 0) : 0));
    });

    let h = '<h3 class="sec">' + (d.me ? '🐄' : '👤') + ' ' + esc(d.name) + ' 的档案' +
      '<button class="mini" data-act="heroclose" style="float:right">收起</button></h3>';
    h += '<div style="font-size:12px;color:var(--dim);margin-bottom:8px">' + esc(d.title || '') +
      ' ｜ 公会：' + esc(d.guild || '未加入公会') + '</div>';

    /* 关键数值 */
    h += '<div style="display:flex;gap:14px;font-size:12px;margin-bottom:10px">' +
      '<span>总等级 <b style="color:var(--gold)">' + fmt(d.lvTotal) + '</b></span>' +
      '<span>战斗 <b style="color:var(--gold)">' + (Math.round(d.combatLv * 10) / 10) + '</b></span>' +
      '<span>金币 <b style="color:var(--gold)">' + fmt(d.gold) + '</b></span></div>';

    /* 装备 */
    h += '<div style="font-size:12px;color:var(--gold);margin:8px 0 4px">🛡️ 装备</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
    SLOTS.forEach(function (sl) {
      const it = d.equip[sl.id] ? ITEMS[d.equip[sl.id]] : null;
      const e = d.enh[sl.id] || 0;
      h += '<div style="width:88px;padding:5px;text-align:center;background:#0e1428;border:1px solid #232c50;border-radius:8px' +
        (it ? '' : ';opacity:.45') + '">' +
        '<div style="font-size:18px">' + (it ? it.icon : sl.ic) + (e ? '<span style="font-size:9px;color:var(--gold)">+' + e + '</span>' : '') + '</div>' +
        '<div style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (it ? it.name : sl.name) + '</div>' +
        '<div style="font-size:9px;color:var(--dim)">' + (it ? UI.statText(it) : '空') + '</div></div>';
    });
    h += '</div>';

    /* 工具 */
    const tool = d.equip.tool ? ITEMS[d.equip.tool] : null;
    h += '<div style="font-size:12px;color:var(--gold);margin:10px 0 4px">🛠️ 工具</div>' +
      '<div style="font-size:12px">' + (tool
        ? (tool.icon + ' <b>' + tool.name + '</b>' + (d.enh.tool ? ' +' + d.enh.tool : '') +
          (tool.toolSkill && SKILL_MAP[tool.toolSkill] ? '<span style="color:var(--dim)"> ｜ ' + SKILL_MAP[tool.toolSkill].name + ' 效率 +' + (tool.eff || 0) + '%' +
            (tool.tier != null ? '（第 ' + (tool.tier + 1) + '/7 档）' : '') + '</span>' : ''))
        : '<span style="color:var(--dim)">暂未装备工具</span>') + '</div>';

    /* 技能 */
    h += '<div style="font-size:12px;color:var(--gold);margin:10px 0 4px">📈 全部技能等级</div>';
    SKILLS.forEach(function (s) {
      if (s.id === 'combat') return;
      const lv = d.skills[s.id] || 0;
      const mine = (me && me.skills) ? (me.skills[s.id] || 0) : 0;
      const diff = lv - mine;
      const col = diff > 0 ? '#f26d6d' : (diff < 0 ? '#6ddc9c' : 'var(--dim)');
      h += '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0">' +
        '<span style="width:76px">' + s.icon + ' ' + s.name + '</span>' +
        '<span style="flex:1;height:6px;background:#080d1c;border:1px solid #232c50;border-radius:3px;overflow:hidden">' +
        '<i style="display:block;height:100%;width:' + Math.min(100, lv / maxSk * 100).toFixed(1) + '%;background:linear-gradient(90deg,#8a6b1f,#f2c14e)"></i></span>' +
        '<b style="width:30px;text-align:right;color:var(--gold)">' + lv + '</b>' +
        (d.me ? '' : '<em style="font-style:normal;width:44px;text-align:right;font-size:11px;color:' + col + '">' +
          (diff > 0 ? '+' + diff : (diff < 0 ? diff : '持平')) + '</em>') +
        '</div>';
    });

    /* 战斗素养 */
    if (d.subs) {
      const SUB7 = ['stamina', 'intelligence', 'attack', 'defense', 'melee', 'ranged', 'magic'];
      const NM = { stamina: '体力', intelligence: '智力', attack: '攻击', defense: '防御', melee: '近战', ranged: '远程', magic: '魔法' };
      h += '<div style="font-size:12px;color:var(--gold);margin:10px 0 4px">⚔️ 战斗素养</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      SUB7.forEach(function (k) {
        const v = d.subs[k] || 0, mv = (me && me.subs) ? (me.subs[k] || 0) : 0, df = v - mv;
        h += '<div style="width:88px;text-align:center;padding:4px;background:#0e1428;border:1px solid #232c50;border-radius:8px">' +
          '<div style="font-size:10px;color:var(--dim)">' + NM[k] + '</div>' +
          '<b>' + v + '</b>' +
          (d.me ? '' : '<div style="font-size:10px;color:' + (df > 0 ? '#f26d6d' : (df < 0 ? '#6ddc9c' : 'var(--dim)')) + '">' +
            (df > 0 ? '+' + df : (df < 0 ? df : '持平')) + '</div>') + '</div>';
      });
      h += '</div>';
    }
    return h;
  },

  leaderboard: function (me) {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const lv = Math.round(120 + seed / 233280 * 1400 + i * 55);
      arr.push({ name: NPC_NAMES[i % NPC_NAMES.length], lv: lv });
    }
    arr.push({ name: S.name, lv: me, me: true });
    arr.sort(function (a, b) { return b.lv - a.lv; });
    return arr;
  },

  /* ---------------- 统计面板 ---------------- */
  pStats: function () {
    const B = bonuses();
    let h = '<div class="ph"><div class="phic">📊</div><div class="phtxt"><h2>生涯统计</h2><p>离线结算上限 ' + B.offline + ' 小时（可在牛铃/代币商店提升）。</p></div></div>';
    h += '<div class="sgrid">';
    h += UI.statBox('完成动作', fmt(S.stats.actions));
    h += UI.statBox('击杀怪物', fmt(S.stats.kills));
    h += UI.statBox('战死次数', fmt(S.stats.deaths));
    h += UI.statBox('累计获得金币', fmt(S.stats.earned));
    h += UI.statBox('累计支出金币', fmt(S.stats.spent));
    h += UI.statBox('累计离线时长', fmtTime(S.stats.offline));
    h += UI.statBox('总等级', totalLevel());
    h += UI.statBox('战斗等级', combatLevel().toFixed(1));
    h += UI.statBox('专精总等级', SKILLS.reduce(function (t, s) { return t + (s.id === 'combat' ? 0 : masteryTotal(s.id)); }, 0));
    h += '</div>';
    h += '<h3 class="sec">全局加成</h3><div class="chips">' +
      '<div class="chip">经验 <b>+' + ((B.xp + B.wisdom) * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">专精经验 <b>+' + (B.mxp * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">稀有发现 <b>+' + (B.rare * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">伤害 <b>+' + (B.dmg * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">动作速度 <b>+' + (B.speed * 100).toFixed(1) + '%</b></div>' +
      '<div class="chip">离线上限 <b>' + B.offline + 'h</b></div></div>';
    h += '<h3 class="sec">存档</h3><div class="chips">' +
      '<button class="mini gold" data-act="save">立即保存</button> ' +
      '<button class="mini red" data-act="wipe">清空存档</button></div>';
    h += '<h3 class="sec">全部日志</h3><div class="chat">' + S.log.map(function (l) { return '<div class="ch">' + l.m + '</div>'; }).join('') + '</div>';
    return h;
  },
  statBox: function (n, v) { return '<div class="sbox"><span>' + n + '</span><b>' + v + '</b></div>'; }
});
