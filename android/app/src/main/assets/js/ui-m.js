/* ============================================================
 *  星海牧场 · 手机版界面层（MUI）
 *  规则：ES5 风格，兼容 UC / QQ(X5) / 联想 等移动端内核
 * ============================================================ */

var MUI = {
  dirty: true,
  tab: 'skill',
  skill: 'milking',
  bankCat: 'all',
  bagOpen: false,
  lastRender: 0,

  TABS: [
    ['skill', '技能', '🧺'], ['combat', '战斗', '⚔️'], ['bag', '背包', '🎒'],
    ['equip', '装备', '🛡️'], ['mastery', '专精', '✦'], ['task', '任务', '📜'],
    ['market', '市场', '🏪'], ['house', '牧场', '🏠'], ['social', '社交', '🌐'],
    ['stats', '统计', '📊']
  ],

  init: function () {
    document.addEventListener('click', MUI.onClick, false);
    document.addEventListener('change', MUI.onChange, false);
    if (window.MCompat && window.MCompat.lowEnd) {
      document.body.className = 'lowend';
    }
  },

  /* ---------------- 事件 ---------------- */
  onClick: function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var b = el.closest('[data-act]');
    if (!b) return;
    var a = b.getAttribute('data-act');
    var x = b.getAttribute('data-a');
    var y = b.getAttribute('data-b');
    var z = b.getAttribute('data-c');
    if (a === 'tab') { MUI.tab = x; MUI.dirty = true; MUI.scrollTop(); }
    else if (a === 'skill') { MUI.skill = x; MUI.tab = 'skill'; MUI.dirty = true; MUI.scrollTop(); }
    else if (a === 'queue') { queueAction(x, y, z === 'inf' ? -1 : parseInt(z || '1', 10)); }
    else if (a === 'clearq') { clearQueue(); }
    else if (a === 'qdrop') { S.queue.splice(parseInt(x, 10), 1); MUI.dirty = true; }
    else if (a === 'combat-start') { if (!S.combat || !S.combat.active) Combat.start(x); else Combat.stop(); }
    else if (a === 'combat-stop') { Combat.stop(); }
    else if (a === 'heal') { Combat.healFull(); }
    else if (a === 'bagadd') { MUI.bagAdd(x); }
    else if (a === 'bagdel') { MUI.bagDel(x); }
    else if (a === 'bagtoggle') { MUI.bagOpen = !MUI.bagOpen; MUI.dirty = true; }
    else if (a === 'equip') { MUI.equipItem(x); }
    else if (a === 'unequip') { MUI.unequip(x); }
    else if (a === 'sell') { sellItem(x, parseInt(y || '1', 10)); }
    else if (a === 'sellall') { sellItem(x, count(x)); }
    else if (a === 'order') { fillOrder(x); }
    else if (a === 'mrefresh') { refreshMarket(true); }
    else if (a === 'task-claim') { claimTask(x); }
    else if (a === 'task-drop') { dropTask(x); }
    else if (a === 'task-reroll') { rerollTask(x, y === 'bell'); }
    else if (a === 'buy-token') { buyToken(x); }
    else if (a === 'buy-bell') { buyBell(x); }
    else if (a === 'house') { houseUpgrade(x); }
    else if (a === 'mast-spend') { MUI.spendMastery(x, y); }
    else if (a === 'bankcat') { MUI.bankCat = x; MUI.dirty = true; }
    else if (a === 'guild-join') { MUI.joinGuild(x); }
    else if (a === 'guild-leave') { S.guild = null; MUI.dirty = true; }
    else if (a === 'open-chest') { MUI.openChest(x); }
    else if (a === 'drink') { MUI.drink(x); }
    else if (a === 'save') { saveGame(); MUI.toast('已保存'); }
    else if (a === 'wipe') {
      if (window.confirm('确定清空存档并重新开始？')) { wipeSave(); location.reload(); }
    }
  },

  onChange: function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var s = el.getAttribute('data-sel');
    if (s === 'alch') { S.alchTarget = el.value; MUI.dirty = true; }
  },

  scrollTop: function () {
    var b = document.getElementById('mbody');
    if (b) b.scrollTop = 0;
  },

  /* ---------------- 通用操作 ---------------- */
  equipItem: function (id) {
    var it = ITEMS[id];
    if (!it || it.cat !== 'equip') return;
    var need = it.recipe ? it.recipe.skill : 'crafting';
    if (it.lvl && skillLevel(need) < it.lvl) {
      MUI.toast('需要 ' + SKILL_MAP[need].name + ' ' + it.lvl + ' 级');
      return;
    }
    if (count(id) <= 0 && S.equip[it.slot] !== id) { MUI.toast('没有该物品'); return; }
    if (count(id) > 0) takeItems(mkObj(id, 1));
    var old = S.equip[it.slot];
    if (old) addItem(old, 1);
    delete S.enhance[it.slot];
    S.equip[it.slot] = id;
    MUI.dirty = true;
  },
  unequip: function (slot) {
    var id = S.equip[slot];
    if (!id) return;
    addItem(id, 1);
    delete S.equip[slot];
    delete S.enhance[slot];
    MUI.dirty = true;
  },
  bagAdd: function (id) {
    if (count(id) <= 0) return;
    if (ITEMS[id].cat !== 'food') { MUI.toast('只能放入食物'); return; }
    takeItems(mkObj(id, 1));
    S.bag[id] = (S.bag[id] || 0) + 1;
    MUI.dirty = true;
  },
  bagDel: function (id) {
    if (!S.bag[id]) return;
    S.bag[id]--;
    if (S.bag[id] <= 0) delete S.bag[id];
    addItem(id, 1);
    MUI.dirty = true;
  },
  drink: function (id) {
    if (count(id) <= 0) return;
    var it = ITEMS[id];
    if (it.cat !== 'drink') return;
    takeItems(mkObj(id, 1));
    addBuff({
      kind: it.buff.kind, dmg: it.buff.dmg || 0, eff: it.buff.eff || 0,
      dur: it.buff.dur, name: it.name, icon: it.icon
    });
    MUI.toast('饮用 ' + it.name);
  },
  spendMastery: function (skill, actId) {
    var have = S.pool[skill] || 0;
    if (have < 10) { MUI.toast('专精池经验不足'); return; }
    var ml = masteryLevel(skill, actId);
    var target = MST_XP[Math.min(98, ml + 1)];
    var use = Math.min(have, Math.max(50, target - (S.mastery[skill][actId] || 0)));
    S.pool[skill] = have - use;
    S.mastery[skill][actId] = (S.mastery[skill][actId] || 0) + use;
    MUI.dirty = true;
  },
  joinGuild: function (name) {
    S.guild = name;
    S.guildJoinedAt = Date.now();
    pushLog('加入公会「' + name + '」');
    MUI.dirty = true;
  },
  openChest: function (id) {
    if (count(id) <= 0) return;
    takeItems(mkObj(id, 1));
    var rare = (id === 'chest_rare');
    var n = rare ? 5 : 2;
    var got = [];
    for (var i = 0; i < n; i++) {
      var pool = rare ? ['gem', 'essence', 'nova_bar', 'nova_cloth'] : ['essence', 'gem', 'cheese_bar', 'cotton_cloth'];
      var it = pick(pool);
      addItem(it, Math.round(rnd(1, rare ? 8 : 3)));
      got.push(ITEMS[it].name);
    }
    addGold(rare ? 50000 : 5000);
    pushLog('开启 ' + ITEMS[id].name + '：' + got.join('、'));
    MUI.dirty = true;
  },

  toast: function (msg) {
    var w = document.getElementById('mtoast');
    if (!w) return;
    var d = document.createElement('div');
    d.className = 't';
    d.innerHTML = msg;
    w.appendChild(d);
    while (w.childNodes.length > 3) w.removeChild(w.firstChild);
    setTimeout(function () { d.className = 't out'; }, 1400);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1900);
  },

  /* ---------------- 渲染 ---------------- */
  render: function () {
    MUI.renderRes();
    MUI.renderTabs();
    MUI.renderQueue();
    var b = document.getElementById('mbody');
    var st = b.scrollTop;
    b.innerHTML = MUI.panel();
    b.scrollTop = st;
    MUI.lastRender = Date.now();
  },

  renderRes: function () {
    var h = '<span class="mres-logo">🐄</span>';
    h += '<span class="mres-i">💰<b>' + fmt(S.gold) + '</b></span>';
    h += '<span class="mres-i">🔔<b>' + S.cowbell + '</b></span>';
    h += '<span class="mres-i">🎟<b>' + S.tokens + '</b></span>';
    h += '<span class="mres-i">⚔<b>' + combatLevel().toFixed(1) + '</b></span>';
    h += '<span class="mres-i">🎓<b>' + totalLevel() + '</b></span>';
    h += '<button class="mini gold savebtn" data-act="save">保存</button>';
    document.getElementById('mres').innerHTML = h;
  },

  renderTabs: function () {
    var h = '';
    for (var i = 0; i < MUI.TABS.length; i++) {
      var t = MUI.TABS[i];
      h += '<div class="mtab-i' + (MUI.tab === t[0] ? ' on' : '') + '" data-act="tab" data-a="' + t[0] + '">' +
        '<i>' + t[2] + '</i>' + t[1] + '</div>';
    }
    document.getElementById('mtab').innerHTML = h;
  },

  renderQueue: function () {
    var h = '';
    if (S.action) {
      var a = ACTION_MAP[S.action.skill + ':' + S.action.actId];
      var pct = Math.min(1, S.action.t / S.action.dur);
      h += '<span class="mq-ic">' + (a.icon || '⏳') + '</span>';
      h += '<span class="mq-mid"><div class="mq-nm">' + a.name + '</div>' +
        '<div class="mq-bar"><i id="mbar" style="width:' + (pct * 100).toFixed(1) + '%"></i></div>' +
        '<div class="mq-sub">队列 ' + S.queue.length + ' 项</div></span>';
      h += '<span class="mq-t" id="mtime">' + (S.action.dur - S.action.t).toFixed(1) + 's</span>';
      if (S.queue.length) h += '<button class="mini red" data-act="clearq" style="margin-left:8px">清</button>';
    } else {
      h += '<span class="mq-idle">💤 空闲中 —— 去「技能」选个动作开始生产</span>';
    }
    document.getElementById('mqueue').innerHTML = h;
  },

  frame: function () {
    if (S.action) {
      var bar = document.getElementById('mbar');
      var tt = document.getElementById('mtime');
      var pct = Math.min(1, S.action.t / S.action.dur);
      if (bar) bar.style.width = (pct * 100).toFixed(1) + '%';
      if (tt) tt.innerHTML = Math.max(0, S.action.dur - S.action.t).toFixed(1) + 's';
    }
  },

  /* ---------------- 面板 ---------------- */
  panel: function () {
    var t = MUI.tab;
    if (t === 'skill') return MUI.pSkill();
    if (t === 'combat') return MUI.pCombat();
    if (t === 'bag') return MUI.pBag();
    if (t === 'equip') return MUI.pEquip();
    if (t === 'mastery') return MUI.pMastery();
    if (t === 'task') return MUI.pTask();
    if (t === 'market') return MUI.pMarket();
    if (t === 'house') return MUI.pHouse();
    if (t === 'social') return MUI.pSocial();
    if (t === 'stats') return MUI.pStats();
    return '';
  },

  skillChips: function () {
    var h = '<div class="chips">';
    for (var i = 0; i < SKILLS.length; i++) {
      var s = SKILLS[i];
      if (s.id === 'combat') continue;
      h += '<span class="chip' + (MUI.skill === s.id ? ' on' : '') + '" data-act="skill" data-a="' + s.id + '">' +
        s.icon + ' ' + s.name + ' <b>' + skillLevel(s.id) + '</b></span>';
    }
    h += '</div>';
    return h;
  },

  /* -------- 技能 -------- */
  pSkill: function () {
    var sk = MUI.skill;
    var sd = SKILL_MAP[sk];
    var info = lvlInfo(S.skills[sk] || 0);
    var lvl = info.lvl;
    var eff = efficiency(sk);
    var tool = S.equip.tool ? ITEMS[S.equip.tool] : null;
    var toolOk = tool && tool.toolSkill === sk;
    var h = MUI.skillChips();

    h += '<div class="card"><div class="skhd">' +
      '<span class="ic">' + sd.icon + '</span>' +
      '<span><div class="nm">' + sd.name + '</div><div class="ds">' + sd.desc + '</div></span>' +
      '<span class="lv">' + lvl + '<em>/99</em></span></div>';
    h += '<div class="bar"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i>' +
      '<span>' + fmt(info.cur) + ' / ' + fmt(info.need) + ' XP</span></div>';
    h += '<div class="chips">' +
      '<span class="chip">⚡效率 <b>+' + (eff * 100).toFixed(1) + '%</b></span>' +
      '<span class="chip">⏱速度 <b>×' + actionSpeedMul().toFixed(2) + '</b></span>' +
      '<span class="chip">✦专精 <b>' + masteryTotal(sk) + '</b></span>' +
      '<span class="chip">' + (toolOk ? '🛠' + tool.name + ' <b>+' + tool.eff[sk] + '%</b>' : '🛠无对应工具') + '</span>' +
      '</div></div>';

    if (sk === 'alchemy') {
      var mats = ITEM_LIST.filter(function (i) { return i.cat === 'mat' && count(i.id) > 0; });
      h += '<div class="card"><div class="hd"><h3>转化目标</h3></div>' +
        '<select data-sel="alch" style="width:100%;background:#0d132a;color:#dbe2f5;border:1px solid #232c50;border-radius:7px;padding:9px 10px;font-size:14px">' +
        mats.map(function (m) {
          return '<option value="' + m.id + '"' + (S.alchTarget === m.id ? ' selected' : '') + '>' +
            m.icon + ' ' + m.name + '（持有 ' + count(m.id) + '）</option>';
        }).join('') + '</select></div>';
    }

    var all = ACTIONS[sk];
    var basic = all.filter(function (a) { return !a.makeItem; });
    h += '<div class="hd"><h3>' + (sk === 'cheesesmithing' ? '熔炼配方' : (sk === 'tailoring' ? '织造配方' : '可学动作')) + '</h3></div>';
    for (var i = 0; i < basic.length; i++) h += MUI.actionRow(sk, basic[i], lvl);

    var eq = all.filter(function (a) {
      return a.makeItem && a.lvl <= lvl + 15;
    }).sort(function (x, y) { return y.lvl - x.lvl; }).slice(0, 18);
    if (eq.length) {
      h += '<div class="hd"><h3>可制作装备（按等级排序）</h3></div>';
      for (var j = 0; j < eq.length; j++) h += MUI.actionRow(sk, eq[j], lvl);
    }
    return h;
  },

  actionRow: function (sk, a, lvl) {
    var ok = lvl >= a.lvl;
    var ml = masteryLevel(sk, a.id);
    var t = actionTime(sk, a);
    var h = '<div class="arow act' + (ok ? '' : ' lk') + '"><div class="rowflex">';
    h += '<div class="ai">' + (a.icon || '⏳') + (ml > 0 ? '<em>' + ml + '</em>' : '') + '</div>';
    h += '<div class="am"><div class="an">' + a.name + (ok ? '' : '<i class="lk">🔒' + a.lvl + '级</i>') + '</div>';
    var m2 = '';
    if (a.in) {
      var ks = Object.keys(a.in);
      for (var i = 0; i < ks.length; i++) {
        var k = ks[i];
        m2 += '<span class="in">' + ITEMS[k].icon + ITEMS[k].name + '×' + a.in[k] +
          (count(k) < a.in[k] ? '<b class="lack">缺</b>' : '') + '</span> ';
      }
    }
    if (a.out) {
      var os = Object.keys(a.out);
      m2 += '<span class="out">→ ';
      for (var j = 0; j < os.length; j++) m2 += ITEMS[os[j]].icon + ITEMS[os[j]].name + '×' + a.out[os[j]] + ' ';
      m2 += '</span>';
    }
    if (a.kind === 'coinify') m2 += '<span class="out">→ 💰' + (S.alchTarget ? fmt(ITEMS[S.alchTarget].price * 1.6) : '?') + '</span>';
    if (a.kind === 'decompose') m2 += '<span class="out">→ 💎星精华</span>';
    if (a.kind === 'transmute') {
      var nx = S.alchTarget ? nextTierItem(S.alchTarget) : null;
      m2 += '<span class="out">→ ' + (nx ? ITEMS[nx].icon + ITEMS[nx].name : '?') + '</span>';
    }
    if (a.kind === 'enhance') {
      m2 += S.equip[a.slot]
        ? '<span class="out">' + ITEMS[S.equip[a.slot]].name + ' +' + enhLevel(a.slot) + '→+' + (enhLevel(a.slot) + 1) + '（💎' + enhanceCost(enhLevel(a.slot)) + '）</span>'
        : '<span class="out">该部位为空</span>';
    }
    if (m2) h += '<div class="am2">' + m2 + '</div>';
    h += '<div class="am3">⏱' + t.toFixed(1) + 's ｜ ★' + fmt(a.xp) + 'XP ｜ ' + MUI.reqShort(sk, a) + '</div>';
    h += '</div></div>';
    h += '<div class="ab3">' +
      '<button data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="1">+1</button>' +
      '<button data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="10">+10</button>' +
      '<button class="gold" data-act="queue" data-a="' + sk + '" data-b="' + a.id + '" data-c="inf">∞ 连续</button>' +
      '</div></div>';
    return h;
  },

  reqShort: function (sk, a) {
    if (a.kind === 'enhance') {
      var cur = S.equip[a.slot] ? enhLevel(a.slot) : 0;
      var ch = Math.min(0.95, 0.55 + skillLevel('enhancing') * 0.008 + masteryLevel(sk, a.id) * 0.003 - cur * 0.05);
      return '成功 ' + (ch * 100).toFixed(0) + '%';
    }
    if (a.kind === 'coinify' || a.kind === 'decompose' || a.kind === 'transmute') {
      var base = a.kind === 'transmute' ? 0.35 : (a.kind === 'coinify' ? 0.40 : 0.45);
      var c2 = Math.min(0.95, base + skillLevel('alchemy') * 0.004 + masteryLevel(sk, a.id) * 0.003);
      return '成功 ' + (c2 * 100).toFixed(0) + '%';
    }
    if (a.kind === 'cook') {
      var burn = Math.max(0, 0.22 - masteryLevel(sk, a.id) * 0.0022 - skillLevel(sk) * 0.0012 - efficiency(sk) * 0.15);
      return '失败 ' + (burn * 100).toFixed(1) + '%';
    }
    return '额外 +' + (efficiency(sk) * 100).toFixed(0) + '%';
  },

  /* -------- 战斗 -------- */
  pCombat: function () {
    var P = Combat.stats();
    var c = S.combat;
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">⚔️</span><span><div class="nm">战斗历练</div>' +
      '<div class="ds">选择区域自动挂机战斗</div></span>' +
      '<span class="lv">' + combatLevel().toFixed(1) + '<em>战等</em></span></div>';

    if (c && c.active) {
      h += '<div class="bar hp" style="margin-top:8px"><i style="width:' + Math.max(0, c.hp / P.maxHp * 100) + '%"></i><span>' + fmt(c.hp) + '/' + fmt(P.maxHp) + '</span></div>';
      h += '<div class="bar mp"><i style="width:' + Math.max(0, c.mp / P.maxMp * 100) + '%"></i><span>' + fmt(c.mp) + '/' + fmt(P.maxMp) + '</span></div>';
    }
    h += '</div>';

    h += '<div class="card"><div class="hd" style="margin:0 0 6px 0"><h3>战斗素养</h3></div><div class="subs7">';
    for (var i = 0; i < COMBAT_SUBS.length; i++) {
      var s = COMBAT_SUBS[i];
      var inf = lvlInfo(S.subs[s.id] || 0);
      h += '<div class="s7"><i>' + s.icon + '</i><s>' + s.name + '</s><b>' + subLevel(s.id) + '</b>' +
        '<div class="mb8"><i style="width:' + (inf.pct * 100).toFixed(1) + '%"></i></div></div>';
    }
    h += '</div></div>';

    h += '<div class="hd"><h3>区域</h3></div><div class="zones">';
    for (var z = 0; z < ZONE_DEFS.length; z++) {
      var zd = ZONE_DEFS[z];
      var can = combatLevel() >= zd.lvl * 0.6;
      var on = c && c.active && c.zone === zd.id;
      h += '<div class="zone' + (on ? ' on' : '') + (can ? '' : ' lk') + '" data-act="combat-start" data-a="' + zd.id + '">' +
        '<div class="zi">' + zd.ic + '</div><div class="zn">' + zd.name + '</div>' +
        '<div class="zl">战等 ' + zd.lvl + '</div>' +
        '<div class="zb">' + (on ? '战斗中·点此停止' : (can ? '前往' : '过弱')) + '</div></div>';
    }
    h += '</div>';

    if (c && c.mob) {
      var m = MONSTERS[c.mob.id];
      var zn = ZONE_DEFS.filter(function (x) { return x.id === c.zone; })[0].name;
      h += '<div class="hd"><h3>当前战斗 · ' + zn + '（击杀 ' + c.kills + '）</h3></div>';
      h += '<div class="card"><div class="rowflex">' +
        '<span class="mobc">' + m.icon + '</span>' +
        '<span><div class="mobn">' + m.name + (m.boss ? ' 👑' : '') + '</div>' +
        '<div class="mobm">命中 ' + fmt(m.acc) + ' ｜ 闪避 ' + fmt(m.eva) + ' ｜ 护甲 ' + fmt(m.armor) + ' ｜ 伤害 ' + fmt(m.dmg) + '</div></span></div>' +
        '<div class="bar mob"><i style="width:' + Math.max(0, c.mob.hp / c.mob.maxHp * 100) + '%"></i><span>' +
        fmt(Math.max(0, c.mob.hp)) + ' / ' + fmt(c.mob.maxHp) + '</span></div>';
      h += '<div class="cds">';
      for (var k = 0; k < ABILITIES.length; k++) {
        var ab = ABILITIES[k];
        if (ab.style !== 'any' && ab.style !== P.style) continue;
        var cd = (c.cd && c.cd[ab.id]) || 0;
        h += '<span class="cd' + (cd > 0 ? ' cool' : '') + '">' + ab.icon + '<em>' + (cd > 0 ? cd.toFixed(0) + 's' : '✔') + '</em></span>';
      }
      h += '</div>';
      h += '<button class="wide mini" data-act="heal" style="margin-top:8px">💚 回满生命/内力</button>';
      h += '</div>';
    }

    h += '<div class="hd"><h3>战斗背包</h3><span class="r"><button class="mini" data-act="bagtoggle">' + (MUI.bagOpen ? '收起' : '管理') + '</button></span></div>';
    h += '<div class="card">';
    var bagKeys = Object.keys(S.bag);
    if (bagKeys.length) {
      for (var b = 0; b < bagKeys.length; b++) {
        h += '<button class="mini" data-act="bagdel" data-a="' + bagKeys[b] + '" style="margin:0 5px 5px 0">' +
          ITEMS[bagKeys[b]].icon + ITEMS[bagKeys[b]].name + ' ×' + S.bag[bagKeys[b]] + '</button>';
      }
    } else {
      h += '<div class="dim">背包为空 —— 放入食物后生命低于 40% 会自动食用</div>';
    }
    h += '</div>';

    if (MUI.bagOpen) {
      var foods = ITEM_LIST.filter(function (i) { return i.cat === 'food' && count(i.id) > 0; });
      h += '<div class="hd"><h3>放入食物</h3></div>';
      for (var f = 0; f < foods.length; f++) {
        var fd = foods[f];
        h += '<div class="arow"><div class="ai">' + fd.icon + '</div><div class="am">' +
          '<div class="an">' + fd.name + '</div>' +
          '<div class="am3">恢复 ' + fd.heal + ' 生命' + (fd.mana ? '、' + fd.mana + ' 内力' : '') + ' ｜ 持有 ' + count(fd.id) + '</div></div>' +
          '<div class="ab"><button data-act="bagadd" data-a="' + fd.id + '">放入</button></div></div>';
      }
      var dr = ITEM_LIST.filter(function (i) { return i.cat === 'drink' && count(i.id) > 0; });
      h += '<div class="hd"><h3>饮品（增益）</h3></div>';
      for (var d = 0; d < dr.length; d++) {
        var dk = dr[d];
        h += '<div class="arow"><div class="ai">' + dk.icon + '</div><div class="am">' +
          '<div class="an">' + dk.name + '</div>' +
          '<div class="am3">' + (dk.buff.kind === 'combat' ? '战斗伤害 +' + Math.round(dk.buff.dmg * 100) + '%' : '采集效率 +' + Math.round(dk.buff.eff * 100) + '%') +
          ' ｜ ' + Math.round(dk.buff.dur) + '秒</div></div>' +
          '<div class="ab"><button class="gold" data-act="drink" data-a="' + dk.id + '">饮用</button></div></div>';
      }
    }

    if (c && c.log.length) {
      h += '<div class="hd"><h3>战斗日志</h3></div><div class="card clog">';
      for (var L = 0; L < Math.min(14, c.log.length); L++) {
        h += '<div class="cl ' + c.log[L].c + '">' + c.log[L].m + '</div>';
      }
      h += '</div>';
    }
    return h;
  },

  /* -------- 背包 -------- */
  pBag: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🎒</span><span><div class="nm">银行</div>' +
      '<div class="ds">' + Object.keys(S.bank).length + ' 种物品 · 估值 ' + fmt(MUI.bankValue()) + '</div></span>' +
      '<span class="lv">' + fmt(S.gold) + '<em>金币</em></span></div></div>';

    var cats = [['all', '全部'], ['mat', '材料'], ['food', '食物'], ['drink', '饮品'], ['equip', '装备']];
    h += '<div class="chips">';
    for (var i = 0; i < cats.length; i++) {
      h += '<span class="chip' + (MUI.bankCat === cats[i][0] ? ' on' : '') + '" data-act="bankcat" data-a="' + cats[i][0] + '">' + cats[i][1] + '</span>';
    }
    h += '</div>';

    var ids = Object.keys(S.bank).filter(function (id) {
      if (!ITEMS[id] || S.bank[id] <= 0) return false;
      return MUI.bankCat === 'all' ? true : (ITEMS[id].cat === MUI.bankCat);
    }).sort(function (a, b) { return ITEMS[b].price * S.bank[b] - ITEMS[a].price * S.bank[a]; });

    h += '<div class="igrid">';
    for (var j = 0; j < ids.length; j++) {
      var it = ITEMS[ids[j]], n = S.bank[ids[j]];
      h += '<div class="icell"><div class="ii">' + it.icon + '</div>' +
        '<div class="in">' + it.name + '</div><div class="iq">×' + fmt(n) + '</div>';
      if (ids[j] === 'chest_common' || ids[j] === 'chest_rare') {
        h += '<button class="gold" data-act="open-chest" data-a="' + ids[j] + '">开启</button>';
      } else {
        h += '<button data-act="sellall" data-a="' + ids[j] + '">卖出</button>';
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  },
  bankValue: function () {
    var v = 0;
    for (var k in S.bank) if (ITEMS[k]) v += ITEMS[k].price * S.bank[k];
    return v;
  },

  /* -------- 装备 -------- */
  pEquip: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🛡️</span><span><div class="nm">装备与强化</div>' +
      '<div class="ds">点击背包中的装备即可穿戴；强化每级 +8% 属性</div></span></div></div>';

    h += '<div class="hd"><h3>已装备</h3></div><div class="eqg">';
    for (var i = 0; i < SLOTS.length; i++) {
      var sl = SLOTS[i], id = S.equip[sl.id];
      var it = id ? ITEMS[id] : null;
      var e = enhLevel(sl.id);
      h += '<div class="eqc"><div class="es">' + (it ? it.icon : sl.ic) + (e ? '<em>+' + e + '</em>' : '') + '</div>' +
        '<div class="en">' + (it ? it.name : '—') + '</div>' +
        '<div class="et">' + (it ? MUI.statText(it) : '<span class="dim">' + sl.name + '</span>') + '</div>' +
        (it ? '<button class="red" data-act="unequip" data-a="' + sl.id + '">卸下</button>' : '') + '</div>';
    }
    h += '</div>';

    var owned = ITEM_LIST.filter(function (i2) { return i2.cat === 'equip' && count(i2.id) > 0; });
    h += '<div class="hd"><h3>背包中的装备（' + owned.length + '）</h3></div>';
    for (var j = 0; j < owned.length; j++) {
      var o = owned[j];
      h += '<div class="arow"><div class="ai">' + o.icon + '</div><div class="am">' +
        '<div class="an">' + o.name + (o.lvl ? '<i class="lk">' + SKILL_MAP[o.recipe.skill].name + ' ' + o.lvl + '级</i>' : '') + '</div>' +
        '<div class="am3">' + MUI.statText(o) +
        (o.eff ? ' ｜ ' + Object.keys(o.eff).map(function (k) { return SKILL_MAP[k].name + '+' + o.eff[k] + '%'; }).join('、') : '') +
        '</div></div><div class="ab"><button data-act="equip" data-a="' + o.id + '">装备</button></div></div>';
    }
    return h;
  },
  statText: function (it) {
    var names = {
      armor: '护甲', eva: '闪避', hp: '生命', mp: '内力', acc: '命中',
      meleeDmg: '近战', rangedDmg: '远程', magicDmg: '魔法',
      resist: '抗性', crit: '暴击', wisdom: '智慧', rareFind: '稀有', amplify: '增伤'
    };
    var out = [];
    for (var k in it.st) {
      if (k === 'spd' || !names[k]) continue;
      var v = it.st[k];
      out.push(names[k] + '+' + (v < 1 ? (v * 100).toFixed(1) + '%' : fmt(v)));
    }
    return out.join(' ') || '—';
  },

  /* -------- 专精 -------- */
  pMastery: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">✦</span><span><div class="nm">专精 Mastery</div>' +
      '<div class="ds">25% 专精经验注入专精池，10/25/50/95% 触发强力加成</div></span></div></div>';
    h += MUI.skillChips();

    var sk = MUI.skill;
    var cap = poolCap(sk);
    var pct = poolPct(sk);
    var cp = poolCheckpoint(sk);
    h += '<div class="mcard"><div style="font-size:13px">' + SKILL_MAP[sk].icon + ' <b style="color:#f2c14e">' + SKILL_MAP[sk].name +
      '</b><span style="float:right;color:#8892b8;font-size:11px">总专精 ' + masteryTotal(sk) + '/' + masteryMax(sk) + '</span></div>';
    h += '<div class="bar pool"><i style="width:' + (pct * 100).toFixed(1) + '%"></i>' +
      '<span>' + fmt(S.pool[sk] || 0) + ' / ' + fmt(cap) + '（' + (pct * 100).toFixed(1) + '%）</span></div>';
    h += '<div class="cps">';
    for (var i = 1; i <= 4; i++) {
      h += '<em class="' + (cp >= i ? 'on' : '') + '">' + POOL_BONUS[i].label + '</em>';
    }
    h += '</div></div>';

    var acts = ACTIONS[sk].slice().sort(function (a, b) {
      return masteryLevel(sk, b.id) - masteryLevel(sk, a.id);
    }).slice(0, 16);
    h += '<div class="hd"><h3>专精等级（可注入池经验）</h3></div><div class="card">';
    for (var j = 0; j < acts.length; j++) {
      var a = acts[j];
      var ml = masteryLevel(sk, a.id);
      var inf = lvlInfo(S.mastery[sk][a.id] || 0, MST_XP);
      h += '<div class="mrow"><span class="mn">' + (a.icon || '') + a.name + '</span>' +
        '<span class="mb"><i style="width:' + (inf.pct * 100).toFixed(1) + '%"></i></span>' +
        '<span class="mv">' + ml + '</span>' +
        '<button class="mini gold" data-act="mast-spend" data-a="' + sk + '" data-b="' + a.id + '">注入</button></div>';
    }
    h += '</div>';
    return h;
  },

  /* -------- 任务 -------- */
  pTask: function () {
    var left = Math.max(0, S.nextTask - Date.now());
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">📜</span><span><div class="nm">任务板</div>' +
      '<div class="ds">每 ' + (taskInterval() / 3600000) + ' 小时生成，上限 ' + taskSlots() + ' 个</div></span>' +
      '<span class="lv">' + S.tokens + '<em>代币</em></span></div>' +
      '<div class="chips"><span class="chip">⏳下次 <b>' + fmtTime(left / 1000) + '</b></span>' +
      '<span class="chip">🎯任务点 <b>' + S.taskPoints + '</b></span></div></div>';

    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      var d = TASK_DIFF.filter(function (x) { return x.id === t.diff; })[0];
      var done = t.have >= t.need;
      h += '<div class="task" style="border-left-color:' + d.col + '">' +
        '<span class="tf" style="background:' + d.col + '">' + d.name + '</span>' +
        '<div class="tt">' + taskText(t) + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(1, t.have / t.need) * 100 + '%"></i><span>' + fmt(t.have) + ' / ' + fmt(t.need) + '</span></div>' +
        '<div class="tr">💰' + fmt(t.gold) + ' ｜ 🎟' + t.tokens + '</div>' +
        '<div class="tb">' +
        (done ? '<button class="gold" data-act="task-claim" data-a="' + t.id + '">交付</button>' : '') +
        '<button class="mini" data-act="task-reroll" data-a="' + t.id + '" data-b="gold">重掷(1万)</button>' +
        '<button class="mini" data-act="task-reroll" data-a="' + t.id + '" data-b="bell">重掷(🔔1)</button>' +
        '<button class="mini red" data-act="task-drop" data-a="' + t.id + '">放弃</button>' +
        '</div></div>';
    }
    if (!S.tasks.length) h += '<div class="card dim">暂无任务，等待生成…</div>';

    h += '<div class="hd"><h3>代币商店</h3></div><div class="shop">';
    for (var k = 0; k < TOKEN_SHOP.length; k++) {
      var it = TOKEN_SHOP[k];
      var cur = S.shop[it.id] || 0;
      var lock = it.need && !S.shop[it.need];
      h += '<div class="si' + (lock ? ' lk' : '') + '"><b>' + it.name + '</b><p>' + it.desc + '</p>' +
        '<div class="sl">🎟' + it.cost + '（' + cur + '/' + it.max + '）</div>' +
        '<button class="mini gold" data-act="buy-token" data-a="' + it.id + '">购买</button></div>';
    }
    h += '</div>';

    h += '<div class="hd"><h3>牛铃商店（🔔' + S.cowbell + '）</h3></div><div class="shop">';
    for (var b = 0; b < BELL_SHOP.length; b++) {
      var bi = BELL_SHOP[b];
      var bc = S.bell[bi.id] || 0;
      h += '<div class="si' + (bi.disabled ? ' lk' : '') + '"><b>' + bi.name + '</b><p>' + bi.desc + '</p>' +
        '<div class="sl">🔔' + bi.cost + '（' + bc + '/' + (bi.max || 0) + '）</div>' +
        '<button class="mini gold" data-act="buy-bell" data-a="' + bi.id + '">购买</button></div>';
    }
    h += '</div>';
    return h;
  },

  /* -------- 市场 -------- */
  pMarket: function () {
    refreshMarket(false);
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🏪</span><span><div class="nm">星海交易所</div>' +
      '<div class="ds">订单每 20 分钟刷新</div></span>' +
      '<span class="r"><button class="mini" data-act="mrefresh">刷新</button></span></div></div>';

    for (var i = 0; i < S.market.orders.length; i++) {
      var o = S.market.orders[i];
      var it = ITEMS[o.item];
      var price = Math.round(it.price * o.mul);
      h += '<div class="arow"><div class="ai">' + it.icon + '</div><div class="am">' +
        '<div class="an">' + (o.buy ? '<span class="out">高价收购</span> ' : '<span class="in">低价出售</span> ') + it.name + '</div>' +
        '<div class="am3">×' + o.left + ' ｜ 单价 ' + fmt(price) + '（' + o.mul.toFixed(2) + '×）｜ 共 ' + fmt(price * o.left) + '</div>' +
        '</div><div class="ab"><button class="' + (o.buy ? 'gold' : '') + '" data-act="order" data-a="' + o.id + '">' +
        (o.buy ? '卖出' : '买入') + '</button></div></div>';
    }

    var sellable = Object.keys(S.bank).filter(function (id) {
      return ITEMS[id] && ITEMS[id].cat !== 'equip' && S.bank[id] > 0;
    }).sort(function (a, b2) { return ITEMS[b2].price * S.bank[b2] - ITEMS[a].price * S.bank[a]; }).slice(0, 20);

    h += '<div class="hd"><h3>快速出售（半价）</h3></div>';
    for (var j = 0; j < sellable.length; j++) {
      var sid = sellable[j];
      h += '<div class="arow"><div class="ai">' + ITEMS[sid].icon + '</div><div class="am">' +
        '<div class="an">' + ITEMS[sid].name + ' ×' + fmt(S.bank[sid]) + '</div>' +
        '<div class="am3">合计 ' + fmt(ITEMS[sid].price * 0.5 * S.bank[sid]) + ' 金币</div></div>' +
        '<div class="ab"><button data-act="sellall" data-a="' + sid + '">卖出</button></div></div>';
    }
    return h;
  },

  /* -------- 牧场 -------- */
  pHouse: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🏠</span><span><div class="nm">星海牧场</div>' +
      '<div class="ds">每级为对应战斗素养 +1，并提供智慧与稀有发现</div></span></div></div>';
    for (var i = 0; i < HOUSES.length; i++) {
      var hs = HOUSES[i];
      var lv = S.houses[hs.id] || 0;
      h += '<div class="house"><div class="hh">' + hs.icon + ' ' + hs.name + '<span>Lv.' + lv + '/' + hs.max + '</span></div>' +
        '<p>' + hs.desc + '</p>';
      if (lv >= hs.max) {
        h += '<div class="dim">已满级</div>';
      } else {
        var c = houseCost(lv);
        var wid = WOOD[Math.min(7, c.woodTier)][0];
        var fid = FOOD[Math.min(7, c.foodTier)][0];
        h += '<div class="hc">💰' + fmt(c.gold) + ' ｜ ' + ITEMS[wid].icon + ITEMS[wid].name + '×' + c.wood +
          ' ｜ ' + ITEMS[fid].icon + ITEMS[fid].name + '×' + c.food + '</div>' +
          '<button class="gold wide" data-act="house" data-a="' + hs.id + '">升级</button>';
      }
      h += '</div>';
    }
    return h;
  },

  /* -------- 社交 -------- */
  pSocial: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🌐</span><span><div class="nm">星海在线</div>' +
      '<div class="ds">' + S.server + ' ｜ 公会加成：经验+3%、稀有+2%</div></span></div></div>';

    if (S.guild) {
      h += '<div class="card">当前公会：<b style="color:#f2c14e">' + S.guild + '</b>' +
        '<button class="mini red" style="float:right" data-act="guild-leave">退出</button></div>';
    } else {
      h += '<div class="hd"><h3>公会列表</h3></div><div class="card">';
      for (var i = 0; i < GUILD_NAMES.length; i++) {
        h += '<div class="gi">' + GUILD_NAMES[i] + '<em>' + (30 + i * 17) + ' 人</em>' +
          '<button class="mini" style="float:right" data-act="guild-join" data-a="' + GUILD_NAMES[i] + '">加入</button></div>';
      }
      h += '</div>';
    }

    var lb = MUI.leaderboard(totalLevel());
    h += '<div class="hd"><h3>总等级排行</h3></div><div class="card lb">';
    for (var j = 0; j < lb.length; j++) {
      h += '<div class="r' + (lb[j].me ? ' me' : '') + '"><span class="k">' + (j + 1) + '</span>' +
        lb[j].name + '<span class="v">' + lb[j].lv + '</span></div>';
    }
    h += '</div>';

    h += '<div class="hd"><h3>世界频道</h3></div><div class="card chat">';
    var ch = S.chat || [];
    if (!ch.length) h += '<div class="dim">频道加载中…</div>';
    for (var k = 0; k < Math.min(12, ch.length); k++) {
      h += '<div class="c"><b>' + ch[k].n + '</b>：' + ch[k].m + '</div>';
    }
    h += '</div>';
    return h;
  },
  leaderboard: function (me) {
    var arr = [];
    for (var i = 0; i < 14; i++) {
      var seed = (i * 9301 + 49297) % 233280;
      arr.push({ name: NPC_NAMES[i % NPC_NAMES.length], lv: Math.round(120 + seed / 233280 * 1400 + i * 55), me: false });
    }
    arr.push({ name: S.name, lv: me, me: true });
    arr.sort(function (a, b) { return b.lv - a.lv; });
    return arr;
  },

  /* -------- 统计 -------- */
  pStats: function () {
    var B = bonuses();
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">📊</span><span><div class="nm">生涯统计</div>' +
      '<div class="ds">离线结算上限 ' + B.offline + ' 小时</div></span></div></div>';

    var boxes = [
      ['完成动作', fmt(S.stats.actions)], ['击杀怪物', fmt(S.stats.kills)],
      ['战死次数', fmt(S.stats.deaths)], ['累计金币', fmt(S.stats.earned)],
      ['离线时长', fmtTime(S.stats.offline)], ['总等级', totalLevel()],
      ['战斗等级', combatLevel().toFixed(1)], ['专精总等级', SKILLS.reduce(function (t, s) { return t + (s.id === 'combat' ? 0 : masteryTotal(s.id)); }, 0)]
    ];
    h += '<div class="sg">';
    for (var i = 0; i < boxes.length; i++) {
      h += '<div class="sb"><s>' + boxes[i][0] + '</s><b>' + boxes[i][1] + '</b></div>';
    }
    h += '</div>';

    h += '<div class="hd"><h3>全局加成</h3></div><div class="card"><div class="chips">' +
      '<span class="chip">经验 <b>+' + ((B.xp + B.wisdom) * 100).toFixed(1) + '%</b></span>' +
      '<span class="chip">专精经验 <b>+' + (B.mxp * 100).toFixed(1) + '%</b></span>' +
      '<span class="chip">稀有发现 <b>+' + (B.rare * 100).toFixed(1) + '%</b></span>' +
      '<span class="chip">伤害 <b>+' + (B.dmg * 100).toFixed(1) + '%</b></span>' +
      '<span class="chip">速度 <b>+' + (B.speed * 100).toFixed(1) + '%</b></span></div></div>';

    h += '<div class="hd"><h3>设备</h3></div><div class="card">' +
      '<div class="dim">浏览器：' + (window.MCompat ? window.MCompat.browser : '未知') +
      ' ｜ 内核版本：' + (window.MCompat && window.MCompat.webkit ? window.MCompat.webkit : '未知') + '</div>' +
      '<div class="dim">存储：' + (window.__storageMemory ? '⚠ 临时存储（关闭页面将丢失进度，建议用普通模式打开）' : '✔ localStorage 正常') + '</div>' +
      '<a href="index.html?nomobile=1" style="display:block;margin-top:8px;font-size:12px;color:#8ad8ff">切换到电脑版 →</a>' +
      '<button class="wide gold" data-act="save" style="margin-top:8px">立即保存</button>' +
      '<button class="wide red" data-act="wipe" style="margin-top:8px">清空存档</button></div>';

    h += '<div class="hd"><h3>日志</h3></div><div class="card chat">';
    for (var j = 0; j < S.log.length; j++) h += '<div class="c">' + S.log[j].m + '</div>';
    h += '</div>';
    return h;
  }
};

/* ---------- 供逻辑层使用的轻量 UI 桩（core/skills 会调用 UI.toast / UI.dirty） ---------- */
var UI = {
  dirty: true,
  toast: function (m) { MUI.toast(m); }
};

/* ---------- 小工具 ---------- */
function mkObj(k, v) { var o = {}; o[k] = v; return o; }
