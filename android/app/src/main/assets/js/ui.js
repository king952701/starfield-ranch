/* ============================================================
 *  星海牧场 · 界面层
 * ============================================================ */

const UI = {
  dirty: true,
  tab: 'skill',
  skill: 'milking',
  bankCat: 'all',
  bagOpen: false,

  init: function () {
    document.addEventListener('click', UI.onClick);
    document.addEventListener('change', UI.onChange);
    UI.renderTabs();
  },

  /* ---------- 路由 ---------- */
  onClick: function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act, x = el.dataset.a, y = el.dataset.b, z = el.dataset.c;
    switch (a) {
      case 'tab': UI.tab = x; UI.dirty = true; break;
      case 'skill': UI.skill = x; UI.tab = 'skill'; UI.dirty = true; break;
      case 'queue': queueAction(x, y, z === 'inf' ? -1 : parseInt(z || '1', 10)); break;
      case 'clearq': clearQueue(); break;
      case 'qdrop': S.queue.splice(parseInt(x, 10), 1); UI.dirty = true; break;
      case 'combat-start':
        if (!S.combat || !S.combat.active) Combat.start(x); else Combat.stop();
        break;
      case 'combat-stop': Combat.stop(); break;
      case 'heal': Combat.healFull(); break;
      case 'bagadd': UI.bagAdd(x); break;
      case 'bagdel': UI.bagDel(x); break;
      case 'bagtoggle': UI.bagOpen = !UI.bagOpen; UI.dirty = true; break;
      case 'equip': UI.equipItem(x); break;
      case 'unequip': UI.unequip(x); break;
      case 'sell': sellItem(x, parseInt(y || '1', 10)); break;
      case 'sellall': sellItem(x, count(x)); break;
      case 'order': fillOrder(x); break;
      case 'mrefresh': refreshMarket(true); break;
      case 'task-claim': claimTask(x); break;
      case 'task-drop': dropTask(x); break;
      case 'task-reroll': rerollTask(x, y === 'bell'); break;
      case 'buy-token': buyToken(x); break;
      case 'buy-bell': buyBell(x); break;
      case 'house': houseUpgrade(x); break;
      case 'mast-spend': UI.spendMastery(x, y); break;
      case 'bankcat': UI.bankCat = x; UI.dirty = true; break;
      case 'guild-join': UI.joinGuild(x); break;
      case 'guild-leave': S.guild = null; UI.dirty = true; break;
      case 'wipe': if (confirm('确定清空存档并重新开始？')) { wipeSave(); location.reload(); } break;
      case 'save': saveGame(); UI.toast('已保存'); break;
      case 'open-chest': UI.openChest(x); break;
      case 'drink': UI.drink(x); break;
    }
  },
  onChange: function (e) {
    const el = e.target;
    if (el.dataset && el.dataset.sel === 'alch') { S.alchTarget = el.value; UI.dirty = true; }
    if (el.dataset && el.dataset.sel === 'zone') { S.zoneSel = el.value; UI.dirty = true; }
  },

  healFull: null,

  /* ---------- 背包/装备操作 ---------- */
  equipItem: function (id) {
    const it = ITEMS[id];
    if (!it || it.cat !== 'equip') return;
    if (it.lvl && skillLevel(it.recipe ? it.recipe.skill : 'crafting') < it.lvl) {
      UI.toast('需要 ' + SKILL_MAP[it.recipe.skill].name + ' ' + it.lvl + ' 级才能装备');
      return;
    }
    if (count(id) <= 0 && S.equip[it.slot] !== id) { UI.toast('没有该物品'); return; }
    if (count(id) > 0) takeItems({ [id]: 1 });
    const old = S.equip[it.slot];
    if (old) addItem(old, 1);
    delete S.enhance[it.slot];
    S.equip[it.slot] = id;
    UI.dirty = true;
  },
  unequip: function (slot) {
    const id = S.equip[slot];
    if (!id) return;
    addItem(id, 1);
    delete S.equip[slot];
    delete S.enhance[slot];
    UI.dirty = true;
  },
  bagAdd: function (id) {
    if (count(id) <= 0) return;
    if (ITEMS[id].cat !== 'food') { UI.toast('只能放入食物'); return; }
    takeItems({ [id]: 1 });
    S.bag[id] = (S.bag[id] || 0) + 1;
    UI.dirty = true;
  },
  bagDel: function (id) {
    if (!S.bag[id]) return;
    S.bag[id]--;
    if (S.bag[id] <= 0) delete S.bag[id];
    addItem(id, 1);
    UI.dirty = true;
  },
  drink: function (id) {
    if (count(id) <= 0) return;
    const it = ITEMS[id];
    if (it.cat !== 'drink') return;
    takeItems({ [id]: 1 });
    addBuff({ kind: it.buff.kind, dmg: it.buff.dmg || 0, eff: it.buff.eff || 0, dur: it.buff.dur, name: it.name, icon: it.icon });
    UI.toast('饮用 ' + it.name);
  },
  spendMastery: function (skill, actId) {
    const have = S.pool[skill] || 0;
    const need = Math.min(have, Math.max(50, Math.round(MST_XP[Math.min(98, masteryLevel(skill, actId) + 1)] - (S.mastery[skill][actId] || 0))));
    if (have < 10) { UI.toast('专精池经验不足'); return; }
    const use = Math.min(have, need);
    S.pool[skill] = have - use;
    S.mastery[skill][actId] = (S.mastery[skill][actId] || 0) + use;
    UI.dirty = true;
  },
  joinGuild: function (name) {
    S.guild = name;
    S.guildJoinedAt = Date.now();
    pushLog('加入公会「' + name + '」');
    UI.dirty = true;
  },
  openChest: function (id) {
    if (count(id) <= 0) return;
    takeItems({ [id]: 1 });
    const rare = id === 'chest_rare';
    const n = rare ? 5 : 2;
    let msg = [];
    for (let i = 0; i < n; i++) {
      const pool = rare ? ['gem', 'essence', 'nova_bar', 'nova_cloth'] : ['essence', 'gem', 'cheese_bar', 'cotton_cloth'];
      const it = pick(pool);
      addItem(it, Math.round(rnd(1, rare ? 8 : 3)));
      msg.push(ITEMS[it].name);
    }
    addGold(rare ? 50000 : 5000);
    pushLog('开启 ' + ITEMS[id].name + '：' + msg.join('、') + ' 与金币');
    UI.dirty = true;
  },

  toast: function (msg) {
    const w = document.getElementById('toasts');
    if (!w) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    w.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, 1400);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1900);
  },

  /* ---------- 标签 ---------- */
  renderTabs: function () {
    const t = [
      ['skill', '技能', '🧺'], ['combat', '战斗', '⚔️'], ['equip', '装备', '🛡️'],
      ['bank', '银行', '🎒'], ['mastery', '专精', '✦'], ['market', '市场', '🏪'],
      ['task', '任务', '📜'], ['house', '牧场', '🏠'], ['social', '社交', '🌐'], ['stats', '统计', '📊']
    ];
    document.getElementById('tabs').innerHTML = t.map(function (x) {
      return '<div class="tab' + (UI.tab === x[0] ? ' on' : '') + '" data-act="tab" data-a="' + x[0] + '">' + x[2] + '<span>' + x[1] + '</span></div>';
    }).join('');
  },

  /* ---------- 主渲染 ---------- */
  render: function () {
    UI.renderTabs();
    UI.renderTop();
    UI.renderSkills();
    UI.renderChar();
    UI.renderQueue();
    const p = document.getElementById('panel');
    const st = p.scrollTop;
    p.innerHTML = UI.panel();
    p.scrollTop = st;
  },

  renderTop: function () {
    const el = document.getElementById('topstats');
    el.innerHTML =
      '<div class="ts"><i>💰</i><b>' + fmt(S.gold) + '</b></div>' +
      '<div class="ts"><i>🔔</i><b>' + S.cowbell + '</b></div>' +
      '<div class="ts"><i>🎟️</i><b>' + S.tokens + '</b></div>' +
      '<div class="ts"><i>⚔️</i><b>' + combatLevel().toFixed(1) + '</b></div>' +
      '<div class="ts"><i>🎓</i><b>' + totalLevel() + '</b></div>';
  },

  renderSkills: function () {
    const el = document.getElementById('skilllist');
    let h = '';
    SKILLS.forEach(function (s) {
      let lv, info, sub = '';
      if (s.id === 'combat') {
        lv = Math.floor(combatLevel());
        info = { pct: 0 };
        sub = '战等 ' + lv;
      } else {
        info = lvlInfo(S.skills[s.id] || 0);
        lv = info.lvl;
        sub = 'Lv.' + lv;
      }
      h += '<div class="skrow' + (UI.skill === s.id && UI.tab === 'skill' ? ' on' : '') + '" data-act="skill" data-a="' + s.id + '">' +
        '<div class="skic">' + s.icon + '</div>' +
        '<div class="skmid"><div class="sknm">' + s.name + '<span>' + sub + '</span></div>' +
        '<div class="skbar"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i></div></div></div>';
    });
    el.innerHTML = h;

    const lg = document.getElementById('minilog');
    lg.innerHTML = S.log.slice(0, 8).map(function (l) {
      return '<div class="lgline">' + l.m + '</div>';
    }).join('');
  },

  renderChar: function () {
    const P = Combat.stats();
    const c = S.combat;
    const hp = c ? Math.max(0, c.hp) : P.maxHp;
    const mp = c ? Math.max(0, c.mp) : P.maxMp;
    let h = '';
    h += '<div class="ccard">';
    h += '<div class="cname">' + S.name + '<span>' + S.server + '</span></div>';
    h += '<div class="cbar"><i class="hp" style="width:' + (hp / P.maxHp * 100) + '%"></i><span>' + fmt(hp) + ' / ' + fmt(P.maxHp) + '</span></div>';
    h += '<div class="cbar"><i class="mp" style="width:' + (mp / P.maxMp * 100) + '%"></i><span>' + fmt(mp) + ' / ' + fmt(P.maxMp) + '</span></div>';
    h += '<div class="cbuffs">' + activeBuffs().map(function (b) {
      return '<span title="' + (b.name || '') + '">' + (b.icon || '✨') + '</span>';
    }).join('') + '</div>';
    h += '<div class="cstats">';
    h += '<div><span>命中</span><b>' + fmt(P.accuracy) + '</b></div><div><span>闪避</span><b>' + fmt(P.evasion) + '</b></div>';
    h += '<div><span>护甲</span><b>' + fmt(P.armor) + '</b></div><div><span>抗性</span><b>' + fmt(P.resist) + '</b></div>';
    h += '<div><span>最大伤害</span><b>' + fmt(P.maxHit) + '</b></div><div><span>攻速</span><b>' + P.interval.toFixed(2) + 's</b></div>';
    h += '</div>';
    h += '<div class="cslots">';
    SLOTS.forEach(function (sl) {
      const id = S.equip[sl.id];
      const it = id ? ITEMS[id] : null;
      const e = enhLevel(sl.id);
      h += '<div class="cslot" data-act="' + (it ? 'unequip' : '') + '" data-a="' + sl.id + '" title="' + sl.name + (it ? '：' + it.name + (e ? ' +' + e : '') : '：空') + '">' +
        (it ? it.icon : sl.ic) + (e ? '<em>+' + e + '</em>' : '') + '</div>';
    });
    h += '</div></div>';
    document.getElementById('charcard').innerHTML = h;
  },

  renderQueue: function () {
    const el = document.getElementById('queuebar');
    let h = '';
    if (S.action) {
      const a = ACTION_MAP[S.action.skill + ':' + S.action.actId];
      const pct = Math.min(1, S.action.t / S.action.dur);
      h += '<div class="qnow"><div class="qic">' + (a.icon || '⏳') + '</div>' +
        '<div class="qmid"><div>' + a.name + '</div><div class="qbar"><i id="actbar" style="width:' + (pct * 100) + '%"></i></div></div>' +
        '<div class="qtime" id="acttime">' + (S.action.dur - S.action.t).toFixed(1) + 's</div></div>';
    } else {
      h += '<div class="qnow idle">💤 空闲中 —— 在技能面板点击动作加入队列</div>';
    }
    h += '<div class="qlist">';
    S.queue.forEach(function (q, i) {
      const a = ACTION_MAP[q.skill + ':' + q.actId];
      if (!a) return;
      h += '<div class="qitem" title="点击移除">' +
        '<span data-act="qdrop" data-a="' + i + '">' + a.icon + ' ' + a.name + '</span>' +
        '<em>' + (q.n === -1 ? '∞' : '×' + q.n) + '</em></div>';
    });
    h += '</div>';
    if (S.queue.length) h += '<div class="qclear" data-act="clearq">清空队列</div>';
    el.innerHTML = h;
  },

  frame: function () {
    if (S.action) {
      const bar = document.getElementById('actbar');
      const tt = document.getElementById('acttime');
      const pct = Math.min(1, S.action.t / S.action.dur);
      if (bar) bar.style.width = (pct * 100) + '%';
      if (tt) tt.textContent = Math.max(0, S.action.dur - S.action.t).toFixed(1) + 's';
    }
  },

  /* ---------- 面板 ---------- */
  panel: function () {
    switch (UI.tab) {
      case 'skill': return UI.pSkill();
      case 'combat': return UI.pCombat();
      case 'equip': return UI.pEquip();
      case 'bank': return UI.pBank();
      case 'mastery': return UI.pMastery();
      case 'market': return UI.pMarket();
      case 'task': return UI.pTask();
      case 'house': return UI.pHouse();
      case 'social': return UI.pSocial();
      case 'stats': return UI.pStats();
    }
    return '';
  }
};
