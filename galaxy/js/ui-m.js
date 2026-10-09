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
  /* 物品信息 */
  infoId: null,          /* 当前打开的物品信息面板 */
  hoverId: null,         /* 长按悬停中的物品 */
  suppressClick: false,  /* 长按后抑制紧随的 click */
  /* 背包 */
  bankCat: 'all',
  bankQ: -1,             /* 品质筛选：-1 = 全部 */
  /* 导航 */
  navOpen: false,        /* 左侧导航是否展开为真列表（收纳时只显示图标） */
  /* 配方跳转 */
  focusAct: null, focusActName: null, focusSkillName: null,
  /* 拍卖行 */
  ahTab: 'browse',       /* browse | mine | post */
  ahQ: '',
  ahSort: 'time',
  ahNew: { item: null, qty: 1, start: 0, buyout: 0, dur: 'short' },
  ahItem: null,          /* 行情趋势选中的物品 */
  ahDays: 7,             /* 行情周期天数 */

  TABS: [
    ['skill', '技能', '🧺'], ['queue', '队列', '⏳'], ['combat', '战斗', '⚔️'], ['bag', '背包', '🎒'],
    ['equip', '装备', '🛡️'], ['mastery', '专精', '✦'], ['task', '任务', '📜'],
    ['market', '拍卖', '🏪'], ['vendor', '商人', '💱'], ['house', '牧场', '🏠'],
    ['social', '社交', '🌐'], ['ach', '成就', '🏆'], ['stats', '统计', '📊'],
    ['about', '关于', 'ℹ️']
  ],
  /* 成就面板 */
  achCat: 'all',
  achFilter: 'doing',   /* doing | ready | done | all */
  achQ: '',
  /* 排行榜 */
  lbCat: 'total',
  heroId: null,
  /* 存档备份 */
  buImpOpen: false,
  buImpTxt: '',
  buExpTxt: '',
  buErr: '',
  buPending: null,
  buRestoreAsk: -1,

  init: function () {
    document.addEventListener('click', MUI.onClick, false);
    document.addEventListener('change', MUI.onChange, false);
    MUI.bindPress();
    if (window.MCompat && window.MCompat.lowEnd) {
      document.body.className = 'lowend';
    }
  },

  /* ---------------- 长按 / 点击 ----------------
   * 长按 3 秒：在手指附近弹出「悬停信息浮层」
   * 直接点击：弹出完整信息面板（带功能按钮）
   */
  bindPress: function () {
    var timer = null, fired = false, sx = 0, sy = 0, curId = null;
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function hit(t) {
      if (!t || !t.closest) return null;
      if (t.closest('button')) return null;       /* 按钮上不触发长按 */
      return t.closest('[data-item]');
    }
    function start(x, y, el) {
      var id = el.getAttribute('data-item');
      if (!id || !ITEMS[id]) return;
      curId = id; fired = false; sx = x; sy = y;
      stop();
      timer = setTimeout(function () {
        timer = null; fired = true;
        MUI.showHover(curId, sx, sy);
      }, 3000);
    }
    function end() {
      stop();
      MUI.hideHover();
      if (fired) {
        MUI.suppressClick = true;
        setTimeout(function () { MUI.suppressClick = false; }, 400);
      }
      fired = false;
    }
    /* 触屏 */
    document.addEventListener('touchstart', function (e) {
      var el = hit(e.target);
      if (!el) return;
      var ts = e.touches && e.touches[0];
      start(ts ? ts.clientX : 0, ts ? ts.clientY : 0, el);
    }, false);
    document.addEventListener('touchmove', function (e) {
      var ts = e.touches && e.touches[0];
      if (!ts) return;
      if (Math.abs(ts.clientX - sx) > 12 || Math.abs(ts.clientY - sy) > 12) stop();
    }, false);
    document.addEventListener('touchend', end, false);
    document.addEventListener('touchcancel', end, false);
    /* 鼠标（电脑预览 / 部分内核） */
    document.addEventListener('mousedown', function (e) {
      var el = hit(e.target);
      if (!el) return;
      start(e.clientX || 0, e.clientY || 0, el);
    }, false);
    document.addEventListener('mousemove', function (e) {
      if (Math.abs((e.clientX || 0) - sx) > 12 || Math.abs((e.clientY || 0) - sy) > 12) stop();
    }, false);
    document.addEventListener('mouseup', end, false);
    document.addEventListener('mouseleave', end, false);
  },

  showHover: function (id, x, y) {
    var w = document.getElementById('mhov');
    if (!w || !ITEMS[id]) return;
    MUI.hoverId = id;
    w.innerHTML = MUI.itemTipHTML(id);
    w.style.display = 'block';
    var vw = window.innerWidth || 320, vh = window.innerHeight || 480;
    var wd = w.offsetWidth || 210, ht = w.offsetHeight || 130;
    var left = x - wd / 2;
    if (left < 6) left = 6;
    if (left + wd > vw - 6) left = Math.max(6, vw - wd - 6);
    var top = y - ht - 16;
    if (top < 6) top = y + 24;
    if (top + ht > vh - 6) top = Math.max(6, vh - ht - 6);
    w.style.left = left + 'px';
    w.style.top = top + 'px';
  },
  hideHover: function () {
    MUI.hoverId = null;
    var w = document.getElementById('mhov');
    if (w) w.style.display = 'none';
  },

  /* 物品说明文字（ITEM 没有 desc 字段，这里按类别生成） */
  itemDesc: function (it) {
    var d = [];
    if (it.cat === 'equip') {
      var slot = null;
      for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === it.slot) slot = SLOTS[i];
      d.push('装备部位：' + (slot ? slot.name : (it.slot || '—')));
      if (it.lvl) d.push('需要 ' + SKILL_MAP[it.recipe ? it.recipe.skill : 'crafting'].name + ' ' + it.lvl + ' 级');
      if (it.toolSkill) d.push('可作为「' + SKILL_MAP[it.toolSkill].name + '」工具，提供技能效率');
      if (it.enhanceSpeed) d.push('强化速度 +' + it.enhanceSpeed + '%');
      d.push('强化每级 +8% 属性，最高 +10');
    } else if (it.cat === 'food') {
      d.push('战斗食物：放进战斗背包后血量不足时自动食用');
      d.push('也可挂到拍卖行出售');
    } else if (it.cat === 'drink') {
      if (it.buff) {
        var bn = { eff: '效率', dmg: '伤害', xp: '经验', speed: '速度', rare: '稀有', wisdom: '智慧' };
        d.push('饮用后获得增益：' + (bn[it.buff.kind] || it.buff.kind) +
          (it.buff.kind === 'eff' || it.buff.kind === 'xp' ? ' +' + (it.buff.eff * 100).toFixed(0) + '%' : '') +
          '，持续 ' + fmtTime(it.buff.dur));
      } else d.push('饮品：饮用后获得临时增益');
    } else if (it.id === 'chest_common' || it.id === 'chest_rare') {
      d.push('宝箱：开启后获得随机材料与金币');
    } else {
      d.push('材料：用于加工、烹饪与装备制作');
      var used = MUI.itemUses(it.id);
      if (used.length) d.push('可用于：' + used.slice(0, 4).join('、'));
    }
    return d.join('<br>');
  },
  itemUses: function (id) {
    var out = [];
    for (var sk in ACTIONS) {
      var list = ACTIONS[sk];
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (a.in && a.in[id]) { out.push(a.name); break; }
      }
      if (out.length > 6) break;
    }
    return out;
  },
  itemTipHTML: function (id) {
    var it = ITEMS[id];
    if (!it) return '';
    var h = '<div class="tip-h"><span class="tip-i">' + it.icon + '</span><b>' + it.name + '</b></div>';
    h += '<div class="tip-c">' + MUI.catName(it.cat) + ' ｜ 基准价 ' + fmt(it.price) + '</div>';
    if (it.cat === 'equip') h += '<div class="tip-s">' + MUI.statText(it) + '</div>';
    if (it.eff) {
      var e = [];
      for (var k in it.eff) if (SKILL_MAP[k]) e.push(SKILL_MAP[k].name + ' +' + it.eff[k] + '%');
      if (e.length) h += '<div class="tip-s">' + e.join('、') + '</div>';
    }
    h += '<div class="tip-d">' + MUI.itemDesc(it) + '</div>';
    h += '<div class="tip-f">持有 ' + fmt(count(id)) + ' ｜ 长按结束即关闭</div>';
    return h;
  },
  catName: function (c) {
    var m = { mat: '材料', food: '食物', drink: '饮品', equip: '装备', tool: '工具', chest: '宝箱' };
    return m[c] || c;
  },

  /* 点击弹出的完整信息面板（带功能按钮） */
  openItem: function (id) {
    if (!ITEMS[id]) return;
    MUI.infoId = id;
    MUI.renderModal();
    sfxEvt('open');      /* 星舰舱门感（Kenney Sci-Fi Sounds, CC0） */
  },
  closeModal: function () { MUI.infoId = null; MUI.renderModal(); sfxEvt('close'); },
  renderModal: function () {
    var w = document.getElementById('mmodal');
    if (!w) return;
    if (!MUI.infoId) { w.innerHTML = ''; w.style.display = 'none'; return; }
    w.style.display = 'block';
    w.innerHTML = '<div class="mmask" data-act="modal-close"></div>' +
      '<div class="mbox">' + MUI.itemPanelHTML(MUI.infoId) + '</div>';
  },
  itemPanelHTML: function (id) {
    var it = ITEMS[id];
    if (!it) return '';
    var owned = count(id);
    var equipped = false, slotId = null;
    for (var s in S.equip) if (S.equip[s] === id) { equipped = true; slotId = s; }
    var h = '<div class="mp-h"><span class="mp-i">' + it.icon + '</span>' +
      '<div class="mp-t"><b>' + it.name + '</b>' +
      '<div class="mp-c">' + MUI.catName(it.cat) + ' ｜ 基准价 ' + fmt(it.price) + ' ｜ 持有 <b>' + fmt(owned) + '</b></div>' +
      '</div><button class="mini mp-x" data-act="modal-close">✕</button></div>';

    /* 品质与回购价 */
    var qq = qualityOf(id);
    h += '<div class="mp-sec mp-quality"><div class="mp-lb">品质</div><div class="mp-v">' +
      '<b class="qbadge" style="background:' + qualityCol(qq) + '">' + qualityName(qq) + '</b>' +
      ' 商人回购 <b>' + fmt(buyback(id)) + '</b>/个 ｜ 基准价 ' + fmt(it.price) + '</div></div>';

    if (it.cat === 'equip') {
      h += '<div class="mp-sec"><div class="mp-lb">属性</div><div class="mp-v">' + MUI.statText(it) + '</div></div>';
      if (it.eff) {
        var e2 = [];
        for (var k2 in it.eff) if (SKILL_MAP[k2]) e2.push(SKILL_MAP[k2].name + ' +' + it.eff[k2] + '%');
        if (e2.length) h += '<div class="mp-sec"><div class="mp-lb">技能效率</div><div class="mp-v">' + e2.join('、') + '</div></div>';
      }
      if (equipped) h += '<div class="mp-sec"><div class="mp-lb">强化</div><div class="mp-v">当前 +' + (S.enhance[slotId] || 0) + ' / +10</div></div>';
    }
    h += '<div class="mp-sec"><div class="mp-lb">说明</div><div class="mp-v dim">' + MUI.itemDesc(it) + '</div></div>';

    /* 功能按钮 */
    h += '<div class="mp-btns">';
    if (it.cat === 'equip') {
      if (equipped) h += '<button class="red" data-act="unequip" data-a="' + slotId + '">卸下</button>';
      else if (owned > 0) h += '<button class="gold" data-act="equip" data-a="' + id + '">装备</button>';
      if (equipped) h += '<button data-act="item-gotoenh">去强化</button>';
      if (owned > 0) {
        h += '<button data-act="item-ah" data-a="' + id + '">挂拍卖行</button>';
        h += '<button data-act="vsellall" data-a="' + id + '">卖给商人 ' + fmt(buyback(id) * owned) + '</button>';
        h += '<button class="red" data-act="sell" data-a="' + id + '" data-b="1">卖 1 个</button>';
      }
    } else if (it.id === 'chest_common' || it.id === 'chest_rare') {
      if (owned > 0) h += '<button class="gold" data-act="open-chest" data-a="' + id + '">开启宝箱</button>';
    } else {
      if (it.cat === 'food' && owned > 0) {
        var inBag = S.bag[id] || 0;
        h += '<button class="gold" data-act="bagadd" data-a="' + id + '">放入战斗背包</button>';
        if (inBag > 0) h += '<button data-act="bagdel" data-a="' + id + '">从背包取出</button>';
      }
      if (it.cat === 'drink' && owned > 0) h += '<button class="gold" data-act="drink" data-a="' + id + '">饮用</button>';
      /* 材料/道具：跳到它的制作配方 */
      var rc = recipesUsing(id);
      if (rc.length) {
        h += '<button class="gold" data-act="item-craft" data-a="' + id + '">🛠 制作（' + rc.length + '）</button>';
      }
      if (owned > 0) {
        h += '<button data-act="item-ah" data-a="' + id + '">挂拍卖行</button>';
        h += '<button data-act="vsellall" data-a="' + id + '">卖给商人 ' + fmt(buyback(id) * owned) + '</button>';
        h += '<button data-act="sell" data-a="' + id + '" data-b="1">卖 1 个</button>';
        h += '<button class="red" data-act="sellall" data-a="' + id + '">全部卖出</button>';
      } else {
        h += '<div class="dim">暂无持有，可在拍卖行求购</div>';
      }
    }
    h += '</div>';
    return h;
  },

  /* ---------------- 事件 ---------------- */
  onClick: function (e) {
    if (MUI.suppressClick) return;          /* 长按刚结束，忽略这次 click */
    var el = e.target;
    if (!el || !el.closest) return;
    var b = el.closest('[data-act]');
    if (!b) {
      /* 没有功能按钮 → 点在物品上，打开信息面板 */
      var ib = el.closest('[data-item]');
      if (ib) MUI.openItem(ib.getAttribute('data-item'));
      return;
    }
    var a = b.getAttribute('data-act');
    var x = b.getAttribute('data-a');
    var y = b.getAttribute('data-b');
    var z = b.getAttribute('data-c');
    if (a === 'tab') { MUI.tab = x; MUI.dirty = true; MUI.scrollTop(); sfxEvt('tab'); }
    else if (a === 'skill') { MUI.skill = x; MUI.tab = 'skill'; MUI.dirty = true; MUI.scrollTop(); }
    else if (a === 'queue') { queueAction(x, y, z === 'inf' ? -1 : parseInt(z || '1', 10)); }
    else if (a === 'clearq') { clearQueue(); }
    else if (a === 'qdrop') { S.queue.splice(parseInt(x, 10), 1); MUI.dirty = true; }
    /* ---- 工作队列增强 ---- */
    else if (a === 'qjump') { MUI.tab = 'queue'; MUI.dirty = true; MUI.scrollTop(); }
    else if (a === 'qtop') { queueTop(x, y, 1); }
    else if (a === 'qins') {
      var qsel = document.getElementById('qpos_' + x + '_' + y);
      queueInsert(x, y, 1, qsel ? parseInt(qsel.value, 10) : 1);
    }
    else if (a === 'qpin') {          /* 队列面板里把第 i 项提到最前 */
      var pi = parseInt(x, 10);
      if (pi > 0 && S.queue[pi]) {
        var mv = S.queue.splice(pi, 1)[0];
        S.queue.unshift(mv);
        if (S.action) { S.action = null; tryStart(); }
        MUI.dirty = true;
        MUI.toast('已提到第 1 格');
      } else { MUI.toast('已经在最前面了'); }
    }
    else if (a === 'qup') { queueMove(parseInt(x, 10), -1); }
    else if (a === 'qdown') { queueMove(parseInt(x, 10), 1); }
    else if (a === 'qunlock') { queueUnlock(); }
    /* ---- 成就 ---- */
    else if (a === 'achclaim') { claimAch(x); }
    else if (a === 'achclaimall') { claimAllAch(); }
    else if (a === 'achcat') { MUI.achCat = x; MUI.dirty = true; }
    else if (a === 'achfilter') { MUI.achFilter = x; MUI.dirty = true; }
    else if (a === 'achsearch') {
      var bx = document.getElementById('achbox');
      MUI.achQ = bx ? (bx.value || '') : '';
      if (MUI.achQ && MUI.achFilter === 'doing') MUI.achFilter = 'all';
      MUI.dirty = true;
    }
    else if (a === 'achqclear') { MUI.achQ = ''; MUI.dirty = true; }
    /* ---- 音效设置 ---- */
    else if (a === 'sfx-toggle') {
      if (window.SFX) { window.SFX.setOn(!window.SFX.on); MUI.dirty = true; }
    }
    else if (a === 'sfx-test') { if (window.SFX) window.SFX.play(x); }
    /* ---- 排行榜 / 玩家档案 ---- */
    /* ---- 首启引导 ---- */
    else if (a === 'tut-goto') { MUI.tab = x; MUI.dirty = true; }
    else if (a === 'tut-skip') { if (window.Tutorial) Tutorial.skipAll(); }
    else if (a === 'tut-restart') { if (window.Tutorial) Tutorial.restart(); }
    else if (a === 'privacy') { MUI.showPrivacy(); }
    /* ---- 存档备份 ---- */
    else if (a === 'bu-export') {
      if (!window.Backup) return;
      var bt = Backup.export();
      if (!bt) { MUI.toast('⚠ 导出失败，请重试'); }
      else if (Backup.copy(bt)) { MUI.toast('✅ 已复制到剪贴板，请粘贴到备忘录保存'); }
      else { MUI.buExpTxt = bt; MUI.toast('请手动全选复制'); }
      MUI.dirty = true;
    }
    else if (a === 'bu-export-show') {
      if (!window.Backup) return;
      MUI.buExpTxt = MUI.buExpTxt ? '' : Backup.export();
      MUI.dirty = true;
    }
    else if (a === 'bu-import-open') { MUI.buImpOpen = !MUI.buImpOpen; MUI.buPending = null; MUI.buErr = ''; MUI.dirty = true; }
    else if (a === 'bu-import-check') {
      if (!window.Backup) return;
      var br = Backup.parse(MUI.buImpTxt || '');
      if (!br.ok) { MUI.buErr = br.msg; MUI.toast('⚠ ' + br.msg); MUI.dirty = true; return; }
      var blv = 0;
      SKILLS.forEach(function (bsk) {
        if (bsk.id === 'combat') return;
        blv += skillLevel((br.data.skills && br.data.skills[bsk.id]) || 0);
      });
      MUI.buPending = { data: br.data, t: br.t, nm: br.data.name, lv: blv };
      MUI.buErr = '';
      MUI.dirty = true;
      MUI.toast('校验通过，确认后导入');
    }
    else if (a === 'bu-import-ok') {
      if (MUI.buPending && MUI.buPending.data) Backup.apply(MUI.buPending.data);
      MUI.buPending = null; MUI.buImpOpen = false; MUI.buImpTxt = ''; MUI.buErr = '';
      MUI.dirty = true;
    }
    else if (a === 'bu-import-cancel') { MUI.buPending = null; MUI.dirty = true; }
    else if (a === 'bu-snap') { if (window.Backup) Backup.snapshot('手动'); MUI.dirty = true; }
    else if (a === 'bu-restore') { MUI.buRestoreAsk = parseInt(x, 10); MUI.dirty = true; }
    else if (a === 'bu-restore-cancel') { MUI.buRestoreAsk = -1; MUI.dirty = true; }
    else if (a === 'bu-restore-ok') {
      if (window.Backup) Backup.restoreSnap(parseInt(x, 10));
      MUI.buRestoreAsk = -1;
      MUI.dirty = true;
    }
    else if (a === 'lbcat') { MUI.lbCat = x; MUI.dirty = true; }
    else if (a === 'hero') { if (x && heroOf(x)) { MUI.heroId = x; sfxEvt('open'); MUI.renderHero(); } }
    else if (a === 'heroclose') { MUI.heroId = null; sfxEvt('close'); MUI.renderHero(); }
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
    /* ---- 物品信息面板 ---- */
    else if (a === 'modal-close') { MUI.closeModal(); }
    else if (a === 'item-gotoenh') {
      MUI.closeModal(); MUI.skill = 'enhancing'; MUI.tab = 'skill'; MUI.dirty = true; MUI.scrollTop();
    }
    else if (a === 'item-ah') { MUI.pickForAh(x); }
    /* ---- 拍卖行 ---- */
    else if (a === 'ahtab') { MUI.ahTab = x; MUI.dirty = true; MUI.scrollTop(); }
    else if (a === 'ah-pick') { MUI.pickForAh(x); }
    else if (a === 'ah-dur') { MUI.ahNew.dur = x; MUI.dirty = true; }
    else if (a === 'ah-post') {
      var n = MUI.ahNew;
      if (!n.item) { MUI.toast('先选择要拍卖的物品'); return; }
      if (ahPost(n.item, MUI.ahQty(), n.start, n.buyout, n.dur)) {
        MUI.ahTab = 'mine'; MUI.ahNew = { item: null, qty: 1, start: 0, buyout: 0, dur: 'short' };
      }
      MUI.dirty = true; MUI.scrollTop();
    }
    else if (a === 'ah-bid') { ahBid(x); }
    else if (a === 'ah-buyout') { ahBuyout(x); }
    else if (a === 'ah-cancel') { ahCancel(x); }
    else if (a === 'ah-clear') {
      var keep = [];
      for (var li = 0; li < S.ah.listings.length; li++) {
        var L = S.ah.listings[li];
        if (!(L.mine && L.done)) keep.push(L);
      }
      S.ah.listings = keep; MUI.dirty = true;
    }
    else if (a === 'ah-refresh') { ahRefresh(true); }
    /* ---- 行情趋势 ---- */
    else if (a === 'ah-item') { MUI.ahItem = x; MUI.dirty = true; }
    else if (a === 'ah-days') { MUI.ahDays = parseInt(x, 10) || 7; MUI.dirty = true; }
    /* ---- 制作跳转 ---- */
    else if (a === 'item-craft') { MUI.gotoRecipe(x); }
    else if (a === 'focus-clear') { MUI.focusAct = null; MUI.dirty = true; }
    /* ---- NPC 商人 ---- */
    else if (a === 'vsell') { vendorSell(x, parseInt(y || '1', 10)); }
    else if (a === 'vsellall') { vendorSell(x, count(x)); }
    else if (a === 'vsellq') {
      var rq = vendorSellQuality(parseInt(x, 10));
      MUI.toast(rq.qty ? ('回购 ' + rq.kinds + ' 种 / ' + fmt(rq.qty) + ' 件，+' + fmt(rq.gold) + ' 金币') : '没有该品质物资');
    }
    else if (a === 'vsell-all') {
      var ra = vendorSellAll();
      MUI.toast(ra.qty ? ('回购 ' + ra.kinds + ' 种 / ' + fmt(ra.qty) + ' 件，+' + fmt(ra.gold) + ' 金币') : '背包是空的');
    }
    /* ---- 导航收纳 ---- */
    else if (a === 'nav-toggle') {
      MUI.navOpen = !MUI.navOpen;
      var nv = document.getElementById('mtab');
      if (nv) { nv.className = MUI.navOpen ? 'open' : ''; }
      MUI.dirty = true;   /* 重绘以更新箭头文字 */
    }
    else if (a === 'wipe') {
      if (window.confirm('确定清空存档并重新开始？')) { wipeSave(); location.reload(); }
    }
  },

  onChange: function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var s = el.getAttribute('data-sel');
    if (!s) return;
    var v;
    if (s === 'alch') { S.alchTarget = el.value; MUI.dirty = true; }
    else if (s === 'bagq') { MUI.bankQ = parseInt(el.value, 10); if (isNaN(MUI.bankQ)) MUI.bankQ = -1; MUI.dirty = true; }
    else if (s === 'ah-item') { MUI.ahItem = el.value; MUI.dirty = true; }
    else if (s === 'ach-q') { MUI.achQ = el.value || ''; MUI.dirty = true; }
    else if (s === 'bu-text') { MUI.buImpTxt = el.value || ''; MUI.dirty = true; }
    else if (s === 'sfx-vol') {
      if (window.SFX) { window.SFX.setVol(parseInt(el.value, 10) / 100); MUI.dirty = true; }
    }
    else if (s === 'ah-q') { MUI.ahQ = el.value || ''; MUI.dirty = true; }
    else if (s === 'ah-sort') { MUI.ahSort = el.value; MUI.dirty = true; }
    else if (s === 'ah-qty') {
      v = parseInt(el.value || '1', 10);
      MUI.ahNew.qty = (isNaN(v) || v < 1) ? 1 : v;
      MUI.dirty = true;
    }
    else if (s === 'ah-start') {
      v = parseInt(el.value || '1', 10);
      MUI.ahNew.start = (isNaN(v) || v < 1) ? 1 : v;
      MUI.dirty = true;
    }
    else if (s === 'ah-buy') {
      v = parseInt(el.value || '0', 10);
      MUI.ahNew.buyout = (isNaN(v) || v < 0) ? 0 : v;
      MUI.dirty = true;
    }
    else if (s === 'ah-dur') { MUI.ahNew.dur = el.value; MUI.dirty = true; }
  },

  scrollTop: function () {
    var b = document.getElementById('mbody');
    if (b) b.scrollTop = 0;
  },

  /* ---------------- 通用操作 ---------------- */
  /* 从物品面板跳到该物品的制作配方 */
  gotoRecipe: function (id) {
    var rc = recipesUsing(id);
    if (!rc.length) { MUI.toast('这个材料当前没有可用的制作配方'); return; }
    var r = rc[0];
    MUI.closeModal();
    MUI.tab = 'skill';
    MUI.skill = r.skill;
    MUI.focusAct = r.act.id;
    MUI.focusActName = r.act.name;
    MUI.focusSkillName = SKILL_MAP[r.skill].name;
    MUI.dirty = true;
    MUI.scrollTop();
    MUI.toast(rc.length > 1 ? ('跳到配方「' + r.act.name + '」（共 ' + rc.length + ' 个配方）') : ('跳到配方「' + r.act.name + '」'));
  },

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
    if (MUI.tab === 'market' && MUI.ahTab === 'browse') MUI.drawTrend();
    if (MUI.infoId) MUI.renderModal();   /* 信息面板打开时同步刷新 */
    MUI.lastRender = Date.now();
  },

  /* 顶部引导目标条（模块缺失时静默为空，不影响主流程） */
  tutorialBar: function () {
    try { if (window.Tutorial) return Tutorial.bar(); } catch (e) { }
    return '';
  },

  /* 隐私政策全文弹层 */
  showPrivacy: function () {
    if (typeof PRIVACY === 'undefined') return;
    var w = document.getElementById('mmodal');
    if (!w) return;
    var h = '<div class="mbox"><h2>🔒 隐私政策</h2>' +
      '<div class="sub">版本 v' + PRIVACY.ver + ' ｜ 更新于 ' + PRIVACY.updated + '</div><div class="pol">';
    for (var i = 0; i < PRIVACY.secs.length; i++) {
      var s = PRIVACY.secs[i];
      h += '<div class="pol-h">' + s.h + '</div>';
      for (var j = 0; j < s.p.length; j++) h += '<p>' + s.p[j] + '</p>';
    }
    h += '</div><button class="big" id="btnpol">我已阅读</button></div>';
    w.innerHTML = h;
    w.style.display = '-webkit-box';
    w.style.display = 'flex';
    var b = document.getElementById('btnpol');
    if (b) b.onclick = function () { w.style.display = 'none'; };
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
    /* 收纳标志在最上方 */
    var h = '<div class="nav-toggle" data-act="nav-toggle"><i>' + (MUI.navOpen ? '◀' : '▶') + '</i>' +
      (MUI.navOpen ? '收起' : '展开') + '</div>';
    for (var i = 0; i < MUI.TABS.length; i++) {
      var t = MUI.TABS[i];
      h += '<div class="mtab-i' + (MUI.tab === t[0] ? ' on' : '') + '" data-act="tab" data-a="' + t[0] + '">' +
        '<i>' + t[2] + '</i><s>' + t[1] + '</s></div>';
    }
    document.getElementById('mtab').innerHTML = h;
  },

  /* 顶部常驻紧凑队列条（点击整条进入队列面板） */
  renderQueue: function () {
    var used = S.queue.length, cap = queueSlots();
    var h = '<div class="mq-row" data-act="qjump">';
    if (S.action) {
      var a = ACTION_MAP[S.action.skill + ':' + S.action.actId];
      var pct = Math.min(1, S.action.t / S.action.dur);
      h += '<span class="mq-ic">' + (a.icon || '⏳') + '</span>';
      h += '<span class="mq-mid"><div class="mq-nm">' + a.name + '</div>' +
        '<div class="mq-bar"><i id="mbar" style="width:' + (pct * 100).toFixed(1) + '%"></i></div></span>';
      h += '<span class="mq-t" id="mtime">' + (S.action.dur - S.action.t).toFixed(1) + 's</span>';
    } else {
      h += '<span class="mq-ic">💤</span>';
      h += '<span class="mq-mid"><div class="mq-idle">空闲中 · 点此管理队列</div></span>';
    }
    h += '<span class="mq-cap' + (used >= cap ? ' full' : '') + '">' + used + '/' + cap + '</span>';
    h += '</div>';
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
    return MUI.tutorialBar() + MUI.panelBody();
  },
  panelBody: function () {
    var t = MUI.tab;
    if (t === 'skill') return MUI.pSkill();
    if (t === 'queue') return MUI.pQueue();
    if (t === 'combat') return MUI.pCombat();
    if (t === 'bag') return MUI.pBag();
    if (t === 'equip') return MUI.pEquip();
    if (t === 'mastery') return MUI.pMastery();
    if (t === 'task') return MUI.pTask();
    if (t === 'market') return MUI.pMarket();
    if (t === 'vendor') return MUI.pVendor();
    if (t === 'house') return MUI.pHouse();
    if (t === 'social') return MUI.pSocial();
    if (t === 'ach') return MUI.pAch();
    if (t === 'about') return MUI.pAbout();
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

    /* 从物品面板「制作」跳过来的目标配方提示 */
    if (MUI.focusAct) {
      var fa = null;
      for (var fi = 0; fi < all.length; fi++) { if (all[fi].id === MUI.focusAct) { fa = all[fi]; break; } }
      if (fa) {
        h += '<div class="card foc">🎯 <b>目标配方：</b>' + (fa.icon || '') + fa.name +
          '<div class="dim" style="margin-top:3px">已高亮，点右侧「生产」排队即可</div>' +
          '<button class="mini" style="margin-top:6px" data-act="focus-clear">取消高亮</button></div>';
      } else {
        var fname = MUI.focusActName || MUI.focusAct;
        h += '<div class="card foc">🎯 目标配方「' + fname + '」不在本技能下，' +
          '请切到 <b>' + (MUI.focusSkillName || '对应技能') + '</b>' +
          '<button class="mini" style="margin-top:6px" data-act="focus-clear">取消</button></div>';
      }
    }

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
    var h = '<div class="arow act' + (ok ? '' : ' lk') + (MUI.focusAct === a.id ? ' foc' : '') + '"><div class="rowflex">';
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
      '</div>';
    /* 置顶 / 加入指定队列格 */
    h += '<div class="ab4">' +
      '<button class="mini pin" data-act="qtop" data-a="' + sk + '" data-b="' + a.id + '">⤒ 置顶队列</button>' +
      '<span class="qjoin">' +
      '<select class="qsel" id="qpos_' + sk + '_' + a.id + '">' + MUI.queueOpts() + '</select>' +
      '<button class="mini" data-act="qins" data-a="' + sk + '" data-b="' + a.id + '">加入</button>' +
      '</span></div></div>';
    return h;
  },
  /* 队列格下拉框：默认选中下一个空格 */
  queueOpts: function () {
    var cap = queueSlots(), used = S.queue.length;
    var sel = used + 1;
    if (sel > cap) sel = cap;
    var o = '';
    for (var i = 1; i <= cap; i++) {
      o += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
        (i === 1 ? '队列 #1（优先）' : '队列 #' + i) + '</option>';
    }
    return o;
  },

  /* -------- 关于 / 美术资源致谢 -------- */
  pAbout: function () {
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">ℹ️</span><span><div class="nm">关于星海牧场</div>' +
      '<div class="ds">🐄 银河牧场放置养成 · 单机离线可玩</div></span></div>' +
      '<div class="mp-v">《星海牧场》是一款以「养殖 → 加工 → 制造 → 交易」长产业链为核心的放置养成游戏。' +
      '全部代码、数值设计与文本内容均为本项目原创撰写，未使用任何游戏引擎或第三方游戏素材。</div></div>';

    /* ---- 隐私政策 ---- */
    if (typeof PRIVACY !== 'undefined') {
      h += '<div class="hd"><h3>🔒 隐私政策</h3></div><div class="card">' +
        '<div class="abt"><b>版本</b><span>v' + PRIVACY.ver + '（更新于 ' + PRIVACY.updated + '）</span></div>' +
        '<div class="abt"><b>要点</b><span>纯离线单机，不联网、不收集、不上传个人信息</span></div>' +
        '<div style="margin-top:6px"><button class="mini gold" data-act="privacy">阅读完整政策</button></div>' +
        '</div>';
    }

    /* ---- 存档备份 / 迁移 ---- */
    if (window.Backup) {
      var kB = Math.max(1, Math.round(Backup.exportSize() / 1024));
      h += '<div class="hd"><h3>💾 存档备份</h3></div><div class="card">';
      h += '<div class="abt"><b>当前进度</b><span>' + MUI.esc(S.name || '') + ' ｜ 总等级 ' + totalLevel() +
        ' ｜ ' + fmt(S.gold) + ' 金币（导出约 ' + kB + ' KB）</span></div>';

      /* 导出 */
      h += '<div class="abt"><b>导出</b><span>' +
        '<button class="mini gold" data-act="bu-export">复制到剪贴板</button> ' +
        '<button class="mini" data-act="bu-export-show">' + (MUI.buExpTxt ? '收起文本' : '显示为文本') + '</button>' +
        '</span></div>';
      if (MUI.buExpTxt) {
        h += '<textarea class="bu-txt" readonly>' + MUI.esc(MUI.buExpTxt) + '</textarea>' +
          '<div class="dim" style="font-size:10px">手动全选后复制，粘贴到备忘录或云端笔记保存。</div>';
      }

      /* 导入 */
      h += '<div class="abt"><b>导入</b><span>' +
        '<button class="mini" data-act="bu-import-open">' + (MUI.buImpOpen ? '收起' : '从文本导入') + '</button></span></div>';
      if (MUI.buImpOpen) {
        h += '<textarea class="bu-txt" data-sel="bu-text" placeholder="在此粘贴之前导出的存档文本…">' +
          MUI.esc(MUI.buImpTxt || '') + '</textarea>' +
          '<button class="mini gold" data-act="bu-import-check">校验并导入</button>';
        if (MUI.buErr) h += '<div class="dim" style="font-size:10px;color:#f0645f">⚠ ' + MUI.esc(MUI.buErr) + '</div>';
      }
      /* 导入前必须预览确认 —— 覆盖是不可撤销操作 */
      if (MUI.buPending) {
        h += '<div class="card" style="border-color:#b98b2a;margin-top:6px">' +
          '<div class="abt"><b>存档来自</b><span>' + MUI.esc(MUI.buPending.nm || '未命名') + ' ｜ 总等级 ' + MUI.buPending.lv + '</span></div>' +
          '<div class="abt"><b>保存时间</b><span>' + Backup.fmtDays(MUI.buPending.t) + '</span></div>' +
          '<div class="dim" style="font-size:10px;color:#f0645f">导入会覆盖当前进度；覆盖前会自动为当前进度保存一份快照。</div>' +
          '<button class="mini gold" data-act="bu-import-ok">确认覆盖</button> ' +
          '<button class="mini" data-act="bu-import-cancel">取消</button></div>';
      }

      /* 本机滚动快照 */
      var snaps = Backup.listSnaps();
      h += '<div class="abt"><b>本机快照</b><span>' +
        '<button class="mini" data-act="bu-snap">立即备份一份</button></span></div>';
      if (!snaps.length) {
        h += '<div class="dim" style="font-size:10px">暂无快照。快照存在应用内部，卸载会一并清除。</div>';
      } else {
        for (var si = 0; si < snaps.length; si++) {
          var sp = snaps[si];
          h += '<div class="abt"><b>' + Backup.fmtDays(sp.t) + '</b><span>' +
            MUI.esc(sp.nm || '') + ' 等级' + sp.lv + (sp.tag ? '（' + MUI.esc(sp.tag) + '）' : '') + '　' +
            (MUI.buRestoreAsk === sp.i
              ? '<button class="mini red" data-act="bu-restore-ok" data-a="' + sp.i + '">确认回滚</button>' +
              '<button class="mini" data-act="bu-restore-cancel">取消</button>'
              : '<button class="mini" data-act="bu-restore" data-a="' + sp.i + '">回滚到此</button>') +
            '</span></div>';
        }
      }
      h += '<div class="dim" style="font-size:10px;margin-top:4px">' +
        '卸载或清除应用数据会删除全部进度，导出文本是唯一能跨设备迁移的方式；' +
        '若开启了系统云备份，进度也可能随备份一并保存（见上方隐私政策第 4 条）。</div>';
      h += '</div>';
    }

    /* ---- 新人引导 ---- */
    if (window.Tutorial) {
      var tSt = Tutorial.ready();
      var stTxt = tSt.skip ? '已跳过' : (tSt.step >= Tutorial.steps.length ? '已全部完成' : ('进行中 ' + tSt.step + '/' + Tutorial.steps.length));
      h += '<div class="hd"><h3>🎯 新人引导</h3></div><div class="card">' +
        '<div class="abt"><b>状态</b><span>' + stTxt + '</span></div>' +
        '<div class="abt"><b>操作</b><span>' +
        '<button class="mini" data-act="tut-restart">重来一次</button> ' +
        '<button class="mini" data-act="tut-skip">跳过</button></span></div>' +
        '<div class="dim" style="font-size:10px;margin-top:4px">引导会以顶部目标条的形式出现，达成后自动发奖，不打断游玩。</div>' +
        '</div>';
    }

    /* ---- 音效设置 ---- */
    var hasSFX = !!window.SFX;
    h += '<div class="hd"><h3>🔊 音效</h3></div><div class="card">';
    if (!hasSFX) {
      h += '<div class="dim">当前环境未加载音效模块。</div>';
    } else {
      var sOn = window.SFX.on;
      h += '<div class="abt"><b>总开关</b><span>' +
        '<button class="mini ' + (sOn ? 'gold' : '') + '" data-act="sfx-toggle">' +
        (sOn ? '🔊 已开启（点此关闭）' : '🔇 已关闭（点此开启）') + '</button></span></div>';
      h += '<div class="abt"><b>音量</b><span>' +
        '<span class="volsl"><input type="range" min="0" max="100" value="' +
        Math.round(window.SFX.vol * 100) + '" data-sel="sfx-vol"></span>' +
        '<b>' + Math.round(window.SFX.vol * 100) + '%</b></span></div>';
      h += '<div class="abt"><b>试听</b><span>' +
        '<button class="mini" data-act="sfx-test" data-a="click">点击音</button> ' +
        '<button class="mini" data-act="sfx-test" data-a="gather">采集</button> ' +
        '<button class="mini" data-act="sfx-test" data-a="levelup">升级铃</button> ' +
        '<button class="mini" data-act="sfx-test" data-a="up">旋律</button></span></div>';
      h += '<div class="dim" style="margin-top:4px">音效会在你第一次触摸屏幕后自动解锁（移动端浏览器的限制），' +
        '并随进度自动记忆。</div>';
    }
    h += '</div>';

    h += '<div class="hd"><h3>🎨 美术资源致谢</h3></div><div class="card">';
    h += '<div class="abt"><b>界面</b><span>由 CSS 绘制为主（渐变、边框与圆角），' +
      '并叠加少量 CC0 按钮底图与图标。</span></div>';
    h += '<div class="abt"><b>图标</b><span>主体为 Unicode 表情字符（Emoji），' +
      '以文字形式排入界面，由<b>设备系统字体</b>现场渲染。' +
      'Android 设备上通常来自 <b>Noto Emoji</b> 系列。</span></div>';
    h += '<div class="abt"><b>字体</b><span>使用系统默认字体栈，项目内未打包任何字体文件。</span></div>';
    h += '<div class="abt"><b>音乐</b><span>不含持续播放的背景音乐；' +
      '升级与成就时的短旋律为 CC0 授权的 jingle。</span></div>';
    h += '</div>';

    /* ---- CC0 署名表 ---- */
    h += '<div class="hd"><h3>📦 第三方素材署名</h3></div><div class="card">';
    if (typeof CREDITS === 'undefined' || !CREDITS.length) {
      h += '<div class="dim">暂无第三方素材。</div>';
    } else {
      for (var ci = 0; ci < CREDITS.length; ci++) {
        var cd = CREDITS[ci];
        h += '<div class="cred"><div class="cred-t">' + cd.pkg + '<em>' + cd.lic + '</em></div>' +
          '<div class="cred-u">' + cd.use + '</div>' +
          '<div class="cred-a">作者：' + cd.author + '　来源：' + cd.url + '</div></div>';
      }
      h += '<div class="dim" style="margin-top:6px">' +
        '以上素材均为 Creative Commons CC0 1.0（公有领域奉献），允许个人、教育与商业用途；' +
        '署名非强制，本项目主动列出以示尊重。完整许可原文见 media/THIRD-PARTY-LICENSES.txt。</div>';
    }
    h += '</div>';

    h += '<div class="hd"><h3>📜 技术与许可声明</h3></div><div class="card">';
    h += '<div class="abt"><b>Unicode 与 Emoji</b><span>字符编码遵循 Unicode 标准；' +
      '字形设计与版权归各自的字体项目及 Unicode 联盟所有。</span></div>';
    h += '<div class="abt"><b>Noto Emoji</b><span>Google 发布，' +
      '字体部分采用 SIL Open Font License 1.1，图形部分采用 CC BY 4.0 授权。</span></div>';
    h += '<div class="abt"><b>技术栈</b><span>HTML + CSS + 原生 JavaScript，' +
      '通过 WebView 封装为安卓应用，未接入任何统计、广告或支付 SDK。</span></div>';
    h += '<div class="abt"><b>隐私</b><span>游戏进度仅保存在本机，' +
      '不上传、不联网，不会收集任何个人信息。</span></div>';
    h += '</div>';

    h += '<div class="hd"><h3>⚖️ 原创声明</h3></div><div class="card">' +
      '<div class="mp-v">本作的人物设定、物品名称、技能与战斗数值、任务与世界频道文本均为独立创作。' +
      '若您认为本作内容侵犯了您的合法权益，烦请通过发布页面留言与我们联系并提供权属证明，' +
      '我们会在核实后第一时间处理。</div></div>';

    h += '<div class="card dim" style="text-align:center">🌌 感谢每一位来到星海牧场的牧牛人<br>' +
      '愿你的仓库堆满银河奶，强化一路 +10</div>';
    return h;
  },

  /* -------- 成就殿堂 -------- */
  pAch: function () {
    var i, it, id, lv, prog, goal, ready, doneAll;
    var sm = achSummary();
    var h = '';

    /* ---- 概览 ---- */
    h += '<div class="card"><div class="skhd">' +
      '<span class="ic">🏆</span><span><div class="nm">成就殿堂</div>' +
      '<div class="ds">' + sm.kinds + ' 件物品各有成就链 ｜ 已领 ' + sm.claimed + '/' + sm.total +
      ' 档 ｜ 全达成 ' + sm.allDone + ' 件</div></span>' +
      '<span class="lv">' + sm.ready + '<em>待领</em></span></div>';
    if (sm.ready) {
      h += '<button class="wide gold" data-act="achclaimall">🎁 一键领取全部 ' + sm.ready + ' 项奖励</button>';
    } else {
      h += '<div class="dim" style="font-size:11px">达标的成就这里会出现一键领取按钮；' +
        '想看还没动过的物品，把筛选切到「全部物品」。</div>';
    }
    h += '</div>';

    /* ---- 分类 ---- */
    h += '<div class="bagnav">';
    for (i = 0; i < BAG_CATS.length; i++) {
      var c = BAG_CATS[i];
      h += '<div class="bagt' + (MUI.achCat === c.id ? ' on' : '') + '" data-act="achcat" data-a="' + c.id + '">' +
        '<i>' + c.ic + '</i><s>' + c.name + '</s></div>';
    }
    h += '</div>';

    /* ---- 搜索 + 筛选 ---- */
    h += '<div class="ahsrch">' +
      '<input id="achbox" class="inp" type="text" placeholder="输入物品名…" value="' + MUI.esc(MUI.achQ) + '">' +
      '<button class="mini" data-act="achsearch">搜索</button>' +
      '<button class="mini" data-act="achqclear">✕</button>' +
      '</div>';
    var fl = [['doing', '进行中'], ['ready', '待领取'], ['done', '已全达成'], ['all', '全部物品']];
    h += '<div class="chips2">';
    for (i = 0; i < fl.length; i++) {
      h += '<span class="chip' + (MUI.achFilter === fl[i][0] ? ' on' : '') + '" data-act="achfilter" data-a="' +
        fl[i][0] + '">' + fl[i][1] + '</span>';
    }
    h += '</div>';

    /* ---- 收集列表 ---- */
    var list = [];
    for (i = 0; i < ITEM_LIST.length; i++) {
      it = ITEM_LIST[i]; id = it.id;
      if (MUI.achCat !== 'all' && bagCatOf(id) !== MUI.achCat) continue;
      if (MUI.achQ && it.name.indexOf(MUI.achQ) < 0) continue;
      lv = achCur(id);
      prog = achProg(id);
      ready = achCanClaim(id);
      doneAll = lv < 0;
      if (MUI.achFilter === 'ready' && !ready) continue;
      if (MUI.achFilter === 'done' && !doneAll) continue;
      if (MUI.achFilter === 'doing' && (ready || doneAll || prog <= 0)) continue;
      if (MUI.achFilter === 'all' && prog <= 0 && doneAll) continue;
      goal = doneAll ? achGoal(id, achMaxStage(id) - 1) : achGoal(id, lv);
      list.push({
        it: it, lv: lv, prog: prog, goal: goal, ready: ready, doneAll: doneAll,
        pct: Math.min(1, prog / goal)
      });
    }
    list.sort(function (a2, b2) {
      if (a2.ready !== b2.ready) return a2.ready ? -1 : 1;
      if (a2.doneAll !== b2.doneAll) return a2.doneAll ? 1 : -1;
      if (b2.pct !== a2.pct) return b2.pct - a2.pct;
      return a2.goal - b2.goal;
    });

    h += '<div class="hd"><h3>成就清单（' + list.length + ' 项）</h3></div>';
    if (!list.length) {
      h += '<div class="card dim">没有符合条件的成就 —— 换个分类或筛选试试。' +
        (sm.ready ? ('（有 <b>' + sm.ready + '</b> 项已达标待领取，切到「待领取」或回到概览点一键领取）') : '') +
        '</div>';
      return h;
    }
    var show = Math.min(list.length, 120);
    for (i = 0; i < show; i++) {
      var r = list[i];
      var rw = achReward(r.it.id, r.doneAll ? achMaxStage(r.it.id) - 1 : r.lv);
      var stageTxt = r.doneAll ? ('全 ' + achMaxStage(r.it.id) + ' 档达成') :
        ('第 ' + (r.lv + 1) + '/' + achMaxStage(r.it.id) + ' 档');
      h += '<div class="achrow' + (r.ready ? ' ready' : '') + (r.doneAll ? ' done' : '') + '">' +
        '<span class="achi" data-item="' + r.it.id + '">' + (r.it.icon || '📦') + '</span>' +
        '<span class="achm">' +
        '<div class="acht">' + r.it.name + '<em>' + stageTxt + '</em></div>' +
        '<div class="achbar"><i style="width:' + (r.pct * 100).toFixed(1) + '%"></i></div>' +
        '<div class="achg">' + fmt(r.prog) + ' / ' + fmt(r.goal) + ' 件' +
        '<span class="dim"> ｜ 奖励 ' + achRewardText(rw) + '</span></div>' +
        '</span>' +
        '<span class="achb">' +
        (r.ready ? '<button class="mini gold" data-act="achclaim" data-a="' + r.it.id + '">领取</button>'
          : (r.doneAll ? '<b class="ok">✓</b>' : '<span class="dim">' + (r.pct * 100).toFixed(0) + '%</span>')) +
        '</span></div>';
    }
    if (show < list.length) {
      h += '<div class="card dim">还有 ' + (list.length - show) + ' 项未展示 —— 用搜索或分类缩小范围。</div>';
    }
    return h;
  },
  esc: function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /* -------- 工作队列面板 -------- */
  pQueue: function () {
    var i, cap = queueSlots(), used = S.queue.length;
    var h = '';

    /* 概览 */
    h += '<div class="card"><div class="skhd">' +
      '<span class="ic">⏳</span><span><div class="nm">工作队列</div>' +
      '<div class="ds">当前占用 ' + used + ' / ' + cap + ' 格 · 上限 ' + Q_SLOT_MAX + ' 格</div></span>' +
      '<span class="lv">' + (S.action ? '运行中' : '空闲') + '</span></div>';

    /* 槽位指示灯 */
    h += '<div class="qslots">';
    for (i = 1; i <= Q_SLOT_MAX; i++) {
      var cls = i <= used ? 'full' : (i <= cap ? 'open' : 'lock');
      h += '<i class="qs ' + cls + '">' + i + '</i>';
    }
    h += '</div>';

    if (S.action) {
      var ac = ACTION_MAP[S.action.skill + ':' + S.action.actId];
      if (ac) {
        var pc = Math.min(1, S.action.t / S.action.dur);
        h += '<div class="qmnow">正在执行：<b>' + ac.icon + ac.name + '</b>　剩余 ' +
          (S.action.dur - S.action.t).toFixed(1) + 's' +
          '<div class="mq-bar"><i style="width:' + (pc * 100).toFixed(1) + '%"></i></div></div>';
      }
    }
    h += '<div style="margin-top:6px"><button class="mini red" data-act="clearq">清空队列</button></div>';
    h += '</div>';

    /* 队列明细 */
    h += '<div class="hd"><h3>队列明细（第 1 格优先执行）</h3></div>';
    if (!S.queue.length) {
      h += '<div class="card dim">队列是空的 —— 到「技能」面板点 +1 / 置顶 / 加入队列排活。</div>';
    }
    for (i = 0; i < S.queue.length; i++) {
      var q = S.queue[i];
      var qa = ACTION_MAP[q.skill + ':' + q.actId];
      if (!qa) continue;
      h += '<div class="ahrow qrow">' +
        '<span class="ahic">' + (qa.icon || '⏳') + '</span>' +
        '<span class="ahmid"><div class="ahn"><b class="qb2">#' + (i + 1) + '</b> ' + qa.name +
        '<em>' + (q.n === -1 ? '∞ 连续' : '×' + q.n) + '</em></div>' +
        '<div class="ahp">' + SKILL_MAP[q.skill].name + ' ｜ 单次 ' + actionTime(q.skill, qa).toFixed(1) + 's ｜ ★' + fmt(qa.xp) + '</div></span>' +
        '<span class="ahbt">' +
        (i > 0 ? '<button class="mini" data-act="qup" data-a="' + i + '">↑</button>' : '') +
        (i < S.queue.length - 1 ? '<button class="mini" data-act="qdown" data-a="' + i + '">↓</button>' : '') +
        (i > 0 ? '<button class="mini" data-act="qpin" data-a="' + i + '">置顶</button>' : '') +
        '<button class="mini red" data-act="qdrop" data-a="' + i + '">✕</button>' +
        '</span></div>';
    }

    /* 扩充槽位 */
    var nx = queueNextSlot();
    h += '<div class="hd"><h3>扩充队列槽位</h3></div><div class="card">';
    if (!nx) {
      h += '<div class="dim">已解锁到上限 ' + Q_SLOT_MAX + ' 格。</div>';
    } else {
      var lackAll = S.gold < nx.cost.gold;
      for (var kk in nx.cost.items) {
        if (!ITEMS[kk]) continue;
        if (count(kk) < nx.cost.items[kk]) lackAll = true;
      }
      h += '<div>解锁<b>第 ' + nx.slot + ' 格</b>需要：</div>';
      h += '<div class="chips2"><span class="chip' + (S.gold < nx.cost.gold ? ' lack' : '') + '">💰金币 <b>' +
        fmt(nx.cost.gold) + '</b>（持有 ' + fmt(S.gold) + '）</span>';
      for (var k2 in nx.cost.items) {
        if (!ITEMS[k2]) continue;
        var hv = count(k2), nd = nx.cost.items[k2];
        h += '<span class="chip' + (hv < nd ? ' lack' : '') + '">' + ITEMS[k2].icon + ITEMS[k2].name +
          ' <b>' + fmt(hv) + '/' + fmt(nd) + '</b></span>';
      }
      h += '</div>';
      h += '<button class="wide ' + (lackAll ? '' : 'gold') + '" data-act="qunlock">' +
        (lackAll ? '材料不足，无法解锁' : '解锁第 ' + nx.slot + ' 格') + '</button>';
    }
    h += '<div class="dim" style="margin-top:6px">槽位越多越省手：离线挂机和长链条生产都需要更多格子。' +
      '解锁消耗金币与物资，是过剩产出的主要去处。</div>';
    h += '</div>';
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
    /* ---- 概览 ---- */
    var kinds = 0, qty = 0, vendor = 0;
    for (var bk in S.bank) {
      if (!ITEMS[bk] || S.bank[bk] <= 0) continue;
      kinds++; qty += S.bank[bk];
      vendor += buyback(bk) * S.bank[bk];
    }
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🎒</span><span><div class="nm">银行</div>' +
      '<div class="ds">' + kinds + ' 种 · ' + fmt(qty) + ' 件 · 估值 ' + fmt(MUI.bankValue()) + '</div></span>' +
      '<span class="lv">' + fmt(S.gold) + '<em>金币</em></span></div>' +
      '<div class="chips"><span class="chip">👤 商人回购可得 <b>' + fmt(vendor) + '</b></span>' +
      '<button class="mini" data-act="vsell-all" style="float:right">一键回购全部</button></div></div>';

    /* ---- 分类模块（全部在前） ---- */
    h += '<div class="bagnav">';
    for (var i = 0; i < BAG_CATS.length; i++) {
      var c = BAG_CATS[i];
      var cnt = 0;
      for (var c2 in S.bank) {
        if (ITEMS[c2] && S.bank[c2] > 0 && (c.id === 'all' || bagCatOf(c2) === c.id)) cnt++;
      }
      h += '<div class="bagt' + (MUI.bankCat === c.id ? ' on' : '') + '" data-act="bankcat" data-a="' + c.id + '">' +
        '<i>' + c.ic + '</i><s>' + c.name + '</s><em>' + cnt + '</em></div>';
    }
    h += '</div>';

    /* ---- 品质筛选 ---- */
    h += '<div class="ahsrch"><select class="inp" data-sel="bagq">';
    h += '<option value="-1"' + (MUI.bankQ === -1 ? ' selected' : '') + '>全部品质</option>';
    for (var qi = 0; qi < QUALITY.length; qi++) {
      h += '<option value="' + qi + '"' + (MUI.bankQ === qi ? ' selected' : '') + '>' +
        qualityName(qi) + '（回购 ' + QUALITY[qi].buy + '/个）</option>';
    }
    h += '</select></div>';

    /* ---- 物品列表（分类 + 品质双重过滤） ---- */
    var ids = Object.keys(S.bank).filter(function (id) {
      if (!ITEMS[id] || S.bank[id] <= 0) return false;
      if (MUI.bankCat !== 'all' && bagCatOf(id) !== MUI.bankCat) return false;
      if (MUI.bankQ >= 0 && qualityOf(id) !== MUI.bankQ) return false;
      return true;
    }).sort(function (a, b2) {
      var qa = qualityOf(a), qb = qualityOf(b2);
      if (qa !== qb) return qb - qa;
      return ITEMS[b2].price * S.bank[b2] - ITEMS[a].price * S.bank[a];
    });

    if (!ids.length) {
      h += '<div class="card dim">该分类下没有符合条件的物品</div>';
      return h;
    }
    h += '<div class="hd"><h3>' + MUI.bagCatName() + '（' + ids.length + ' 种）</h3></div>';
    h += '<div class="igrid">';
    for (var j = 0; j < ids.length; j++) {
      var it = ITEMS[ids[j]], n = S.bank[ids[j]];
      var q = qualityOf(ids[j]);
      h += '<div class="icell" data-item="' + ids[j] + '" style="border-color:' + qualityCol(q) + '">' +
        '<em class="qbar" style="background:' + qualityCol(q) + '"></em>' +
        '<div class="ii">' + it.icon + '</div>' +
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
  bagCatName: function () {
    for (var i = 0; i < BAG_CATS.length; i++) if (BAG_CATS[i].id === MUI.bankCat) return BAG_CATS[i].name;
    return '全部';
  },

  /* -------- NPC 商人回购 -------- */
  pVendor: function () {
    var st = bankQualityStats();
    var total = 0, tq = 0;
    for (var i = 0; i < st.length; i++) { total += st[i].gold; tq += st[i].qty; }

    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">👤</span><span><div class="nm">杂货商 · 麦老伯</div>' +
      '<div class="ds">以固定品质价即时回购各类物资，价格远低于拍卖行，但立刻到账</div></span>' +
      '<span class="lv">' + fmt(S.gold) + '<em>金币</em></span></div>' +
      '<div class="tips dim">回购是金币回收的主渠道：承担较大的价格折让，用来抑制后期物资堆积导致的通货膨胀。想卖高价请挂拍卖行。</div></div>';

    h += '<div class="hd"><h3>按品质一键回购</h3></div>';
    var any = false;
    for (var q = QUALITY.length - 1; q >= 0; q--) {
      var s = st[q];
      if (!s.qty) continue;
      any = true;
      h += '<div class="ahrow"><span class="ahic">' + MUI.qualitySample(q) + '</span>' +
        '<span class="ahmid"><div class="ahn"><b class="qbadge" style="background:' + qualityCol(q) + '">' + qualityName(q) + '</b>' +
        '<em>×' + fmt(s.qty) + '</em></div>' +
        '<div class="ahp">' + s.kinds + ' 种 ｜ 单价 ' + QUALITY[q].buy + ' ｜ 合计 ' + fmt(s.gold) + '</div></span>' +
        '<span class="ahbt"><button class="gold" data-act="vsellq" data-a="' + q + '">回购</button></span></div>';
    }
    if (!any) h += '<div class="card dim">背包里没有可回购的物资</div>';

    h += '<div style="padding:8px 0"><button class="wide gold" data-act="vsell-all">💱 回购全部物资（' + fmt(tq) + ' 件 → ' + fmt(total) + ' 金币）</button></div>';

    h += '<div class="hd"><h3>NPC 回购价目表</h3></div><div class="card">';
    for (var k = 0; k < QUALITY.length; k++) {
      h += '<div class="vrow"><b class="qbadge" style="background:' + qualityCol(k) + '">' + qualityName(k) + '</b>' +
        '<span class="dim">T' + (k + 1) + '</span><span class="vp">' + fmt(QUALITY[k].buy) + ' 金币/个</span></div>';
    }
    h += '<div class="dim" style="margin-top:6px">品级由物品 tier 决定；回购价刻意压低，' +
      '鼓励玩家通过拍卖行互通有无，同时把过剩产出转化为稳定的低价金币来源。</div></div>';
    return h;
  },
  qualitySample: function (q) {
    for (var k in S.bank) {
      if (ITEMS[k] && S.bank[k] > 0 && qualityOf(k) === q) return ITEMS[k].icon;
    }
    return '📦';
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
      h += '<div class="eqc"' + (it ? ' data-item="' + id + '"' : '') + '><div class="es">' + (it ? it.icon : sl.ic) + (e ? '<em>+' + e + '</em>' : '') + '</div>' +
        '<div class="en">' + (it ? it.name : '—') + '</div>' +
        '<div class="et">' + (it ? MUI.statText(it) : '<span class="dim">' + sl.name + '</span>') + '</div>' +
        (it ? '<button class="red" data-act="unequip" data-a="' + sl.id + '">卸下</button>' : '') + '</div>';
    }
    h += '</div>';

    var owned = ITEM_LIST.filter(function (i2) { return i2.cat === 'equip' && count(i2.id) > 0; });
    h += '<div class="hd"><h3>背包中的装备（' + owned.length + '）</h3></div>';
    for (var j = 0; j < owned.length; j++) {
      var o = owned[j];
      h += '<div class="arow"><div class="ai" data-item="' + o.id + '">' + o.icon + '</div><div class="am" data-item="' + o.id + '">' +
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
      '<span class="ic">✦</span><span><div class="nm">专精</div>' +
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

  /* -------- 拍卖行 -------- */
  pMarket: function () {
    ahRefresh(false);
    var mine = 0;
    for (var m = 0; m < S.ah.listings.length; m++) {
      if (S.ah.listings[m].mine && !S.ah.listings[m].done) mine++;
    }
    var h = '<div class="card"><div class="skhd">' +
      '<span class="ic">🏪</span><span><div class="nm">星海拍卖行</div>' +
      '<div class="ds">竞标至少加价 5% · 成交退押金，流拍退物品</div></span>' +
      '<span class="lv">' + fmt(S.gold) + '<em>金币</em></span></div>' +
      '<div class="chips"><span class="chip">在拍 <b>' + mine + '</b></span>' +
      '<span class="chip">持有 <b>' + fmt(S.gold) + '</b></span></div></div>';

    h += '<div class="chips">' +
      '<span class="chip' + (MUI.ahTab === 'browse' ? ' on' : '') + '" data-act="ahtab" data-a="browse">🔍 浏览竞拍</span>' +
      '<span class="chip' + (MUI.ahTab === 'mine' ? ' on' : '') + '" data-act="ahtab" data-a="mine">📦 我的拍卖</span>' +
      '<span class="chip' + (MUI.ahTab === 'post' ? ' on' : '') + '" data-act="ahtab" data-a="post">📤 上架物品</span>' +
      '</div>';

    if (MUI.ahTab === 'browse') h += MUI.ahTrend() + MUI.ahBrowse();
    else if (MUI.ahTab === 'mine') h += MUI.ahMine();
    else h += MUI.ahPostPage();
    return h;
  },

  /* -------- 行情趋势区 -------- */
  ahTrend: function () {
    var i, id, seen = {}, pool = [];
    for (id in S.bank) { if (ITEMS[id] && S.bank[id] > 0 && !seen[id]) { seen[id] = 1; pool.push(id); } }
    var lst = (S.ah && S.ah.listings) ? S.ah.listings : [];
    for (i = 0; i < lst.length; i++) {
      id = lst[i].item;
      if (ITEMS[id] && !seen[id]) { seen[id] = 1; pool.push(id); }
    }
    if (!pool.length) { for (i = 0; i < ITEM_LIST.length && i < 40; i++) pool.push(ITEM_LIST[i].id); }
    if (!MUI.ahItem || !ITEMS[MUI.ahItem]) MUI.ahItem = pool[0];
    var cur = MUI.ahItem;
    var series = priceSeries(cur, MUI.ahDays);
    MUI._trend = series;

    var prices = [];
    for (i = 0; i < series.length; i++) prices.push(series[i].p);
    var mn = Math.min.apply(null, prices), mx = Math.max.apply(null, prices);
    var first = series[0].p, last = series[series.length - 1].p;
    var dlt = first > 0 ? Math.round((last - first) / first * 1000) / 10 : 0;

    var h = '<div class="card"><div class="hd"><h3>📈 行情价趋势</h3></div>';
    h += '<div class="ahsrch"><select class="inp" data-sel="ah-item">';
    for (i = 0; i < pool.length && i < 60; i++) {
      h += '<option value="' + pool[i] + '"' + (pool[i] === cur ? ' selected' : '') + '>' +
        ITEMS[pool[i]].icon + ' ' + ITEMS[pool[i]].name + '</option>';
    }
    h += '</select></div>';
    var days = [3, 7, 15, 30, 90, 180, 365];
    h += '<div class="chips2">';
    for (i = 0; i < days.length; i++) {
      h += '<span class="chip' + (MUI.ahDays === days[i] ? ' on' : '') + '" data-act="ah-days" data-a="' + days[i] + '">' + days[i] + '天</span>';
    }
    h += '</div>';
    h += '<div class="trend-wrap"><canvas id="trend"></canvas></div>';
    h += '<div class="chips2">' +
      '<span class="chip">最高 <b>' + fmt(mx) + '</b></span>' +
      '<span class="chip">最低 <b>' + fmt(mn) + '</b></span>' +
      '<span class="chip">现价 <b>' + fmt(last) + '</b></span>' +
      '<span class="chip">' + (dlt >= 0 ? '↑涨' : '↓跌') + ' <b>' + Math.abs(dlt) + '%</b></span>' +
      '</div>';
    h += '<div class="dim" style="padding:4px 8px 0">X 轴＝价格 · Y 轴＝日期（自上而下由远及近）</div>';
    h += '</div>';
    return h;
  },

  drawTrend: function () {
    var cv = document.getElementById('trend');
    if (!cv || typeof cv.getContext !== 'function') return;
    var pts = MUI._trend;
    var wrap = cv.parentNode;
    var w = wrap.clientWidth || 260;
    var hh = 190;
    var dpr = window.devicePixelRatio || 1;
    if (dpr > 2) dpr = 2;
    if (w < 60) w = 260;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(hh * dpr);
    cv.style.width = w + 'px';
    cv.style.height = hh + 'px';
    var g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    if (!pts || pts.length < 2) return;

    var i, prices = [];
    for (i = 0; i < pts.length; i++) prices.push(pts[i].p);
    var mn = Math.min.apply(null, prices), mx = Math.max.apply(null, prices);
    if (mx - mn < 1) mx = mn + 1;
    var padL = 38, padR = 50, padT = 10, padB = 18;
    var iw = w - padL - padR, ih = hh - padT - padB;
    if (iw < 10) iw = 10;
    function X(p) { return padL + (p - mn) / (mx - mn) * iw; }
    function Y(k) { return padT + (k / (pts.length - 1)) * ih; }

    /* 横向网格 */
    g.strokeStyle = '#232c50'; g.lineWidth = 1;
    for (i = 0; i <= 3; i++) {
      var gy = padT + ih * i / 3;
      g.beginPath(); g.moveTo(padL, gy); g.lineTo(w - padR, gy); g.stroke();
    }
    /* 面积 */
    g.beginPath();
    g.moveTo(padL, padT);
    for (i = 0; i < pts.length; i++) g.lineTo(X(pts[i].p), Y(i));
    g.lineTo(padL, Y(pts.length - 1));
    g.closePath();
    g.fillStyle = 'rgba(242,193,78,.13)';
    g.fill();
    /* 折线 */
    g.beginPath();
    for (i = 0; i < pts.length; i++) {
      var xx = X(pts[i].p), yy = Y(i);
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.strokeStyle = '#f2c14e'; g.lineWidth = 1.8; g.stroke();
    /* 当前点 */
    var n = pts.length - 1;
    g.beginPath(); g.arc(X(pts[n].p), Y(n), 3.2, 0, 6.2832);
    g.fillStyle = '#f2c14e'; g.fill();

    /* 日期（左） */
    g.font = '10px sans-serif';
    g.textAlign = 'right';
    g.fillStyle = '#6b7599';
    var marks = [0, Math.floor(n / 2), n];
    for (i = 0; i < 3; i++) {
      if (marks[i] < 0 || marks[i] > n) continue;
      g.fillText(dayLabel(pts[marks[i]].day), padL - 5, Y(marks[i]) + 3);
    }
    /* 价格（右） */
    g.textAlign = 'left';
    g.fillStyle = '#8892b8';
    g.fillText(fmt(mx), w - padR + 5, padT + 8);
    g.fillText(fmt(mn), w - padR + 5, padT + ih - 1);
    g.fillStyle = '#f2c14e';
    g.fillText(fmt(pts[n].p), X(pts[n].p) + 6, Y(n) + 3);
    /* 轴说明 */
    g.textAlign = 'center';
    g.fillStyle = '#4b5578';
    g.fillText('价格 →', padL + iw / 2, hh - 4);
  },

  pickForAh: function (id) {
    if (!ITEMS[id]) return;
    if (count(id) <= 0) { MUI.toast('你没有这个物品'); return; }
    var s = ahSuggest(id);
    MUI.ahNew = { item: id, qty: 1, start: s, buyout: Math.round(s * 1.5), dur: MUI.ahNew.dur || 'short' };
    MUI.tab = 'market'; MUI.ahTab = 'post';
    MUI.closeModal(); MUI.dirty = true; MUI.scrollTop();
  },
  ahQty: function () {
    var n = MUI.ahNew;
    var max = count(n.item) || 1;
    var q = Math.round(n.qty) || 1;
    if (q < 1) q = 1;
    if (q > max) q = max;
    return q;
  },

  ahBrowse: function () {
    var h = '<div class="card"><div class="ahsrch">' +
      '<input class="inp" type="text" data-sel="ah-q" value="' + MUI.ahQ + '" placeholder="搜索物品名称…">' +
      '</div><div class="ahsrch">' +
      '<select class="inp sel" data-sel="ah-sort">' +
      '<option value="time"' + (MUI.ahSort === 'time' ? ' selected' : '') + '>按剩余时间</option>' +
      '<option value="unit"' + (MUI.ahSort === 'unit' ? ' selected' : '') + '>按单价低→高</option>' +
      '<option value="total"' + (MUI.ahSort === 'total' ? ' selected' : '') + '>按总价低→高</option>' +
      '</select>' +
      '<button class="mini" data-act="ah-refresh">刷新拍品</button>' +
      '</div></div>';

    var list = [];
    for (var i = 0; i < S.ah.listings.length; i++) {
      var l = S.ah.listings[i];
      if (l.done || l.mine) continue;
      if (!ITEMS[l.item]) continue;
      if (MUI.ahQ && ITEMS[l.item].name.indexOf(MUI.ahQ) < 0) continue;
      list.push(l);
    }
    var cur = function (x) { return x.bid > 0 ? x.bid : x.start; };
    if (MUI.ahSort === 'time') list.sort(function (a, b) { return a.end - b.end; });
    else if (MUI.ahSort === 'unit') list.sort(function (a, b) { return cur(a) - cur(b); });
    else list.sort(function (a, b) { return cur(a) * a.qty - cur(b) * b.qty; });

    if (!list.length) {
      h += '<div class="card dim">没有匹配的拍品</div>';
      return h;
    }
    for (var j = 0; j < list.length; j++) {
      var L = list[j], it = ITEMS[L.item];
      var mb = ahMinBid(L);
      var left = Math.max(0, (L.end - Date.now()) / 1000);
      h += '<div class="ahrow' + (L.bidder === 'me' ? ' lead' : '') + '">' +
        '<span class="ahic" data-item="' + it.id + '">' + it.icon + '</span>' +
        '<span class="ahmid"><div class="ahn">' + it.name + '<em>×' + L.qty + '</em></div>' +
        '<div class="ahs">卖主 ' + L.seller + ' ｜ 剩余 ' + fmtTime(left) + '</div>' +
        '<div class="ahp">' +
        (L.bid > 0 ? '当前 ' + fmt(L.bid) + '/个' : '起拍 ' + fmt(L.start) + '/个') +
        (L.buyout ? ' ｜ 一口价 ' + fmt(L.buyout) + '/个' : '') +
        (L.bidder === 'me' ? ' ｜ <b class="win">你领先</b>' : '') +
        '</div></span>' +
        '<span class="ahbt">' +
        '<button class="gold" data-act="ah-bid" data-a="' + L.id + '">竞标 ' + fmt(mb) + '</button>' +
        (L.buyout ? '<button data-act="ah-buyout" data-a="' + L.id + '">一口价 ' + fmt(L.buyout * L.qty) + '</button>' : '') +
        '</span></div>';
    }
    h += '<div class="dim" style="padding:6px 10px">长按物品图标 3 秒可查看详细信息</div>';
    return h;
  },

  ahMine: function () {
    var mine = [];
    for (var i = 0; i < S.ah.listings.length; i++) if (S.ah.listings[i].mine) mine.push(S.ah.listings[i]);
    if (!mine.length) {
      return '<div class="card dim">你还没有上架任何物品。点「上架物品」开始拍卖。</div>';
    }
    var h = '';
    for (var j = 0; j < mine.length; j++) {
      var L = mine[j], it = ITEMS[L.item];
      if (!it) continue;
      var st, cls = '';
      if (L.done) {
        if (L.result === 'sold') { st = '✅ 成交 ' + fmt(L.bid * L.qty) + ' 金币'; cls = 'ok'; }
        else if (L.result === 'expired') { st = '⏳ 流拍，物品已退回'; }
        else { st = '✖ 已取消'; }
      } else {
        st = (L.bid > 0 ? '当前出价 ' + fmt(L.bid) + '/个（' + L.bidder + '）' : '暂无出价') +
          ' ｜ 剩余 ' + fmtTime(Math.max(0, (L.end - Date.now()) / 1000));
      }
      h += '<div class="ahrow ' + cls + '">' +
        '<span class="ahic" data-item="' + it.id + '">' + it.icon + '</span>' +
        '<span class="ahmid"><div class="ahn">' + it.name + '<em>×' + L.qty + '</em></div>' +
        '<div class="ahp">' + st + '</div>' +
        '<div class="ahs">起拍 ' + fmt(L.start) + ' ｜ 押金 ' + fmt(L.deposit) + '</div></span>' +
        '<span class="ahbt">' +
        (L.done ? '' : '<button class="red" data-act="ah-cancel" data-a="' + L.id + '">取消</button>') +
        '</span></div>';
    }
    h += '<div style="padding:8px"><button class="wide" data-act="ah-clear">清除已结束记录</button></div>';
    return h;
  },

  ahPostPage: function () {
    var n = MUI.ahNew;
    var h = '<div class="card"><div class="hd"><h3>① 选择要拍卖的物品</h3></div>';
    var ids = [];
    for (var k in S.bank) if (ITEMS[k] && S.bank[k] > 0) ids.push(k);
    ids.sort(function (a, b) { return ITEMS[b].price * S.bank[b] - ITEMS[a].price * S.bank[a]; });
    if (!ids.length) {
      h += '<div class="dim">银行里没有可拍卖的物品</div></div>';
      return h;
    }
    h += '<div class="igrid">';
    for (var i = 0; i < ids.length && i < 40; i++) {
      var id = ids[i], it = ITEMS[id];
      h += '<div class="icell' + (n.item === id ? ' on' : '') + '" data-act="ah-pick" data-a="' + id + '" data-item="' + id + '">' +
        '<div class="ii">' + it.icon + '</div><div class="in">' + it.name + '</div>' +
        '<div class="iq">×' + fmt(S.bank[id]) + '</div></div>';
    }
    h += '</div>';
    h += '<div class="ahs" style="padding:4px 8px">长按格子 3 秒看物品详情，点一下选中</div></div>';

    if (n.item && ITEMS[n.item]) {
      var it2 = ITEMS[n.item];
      var q = MUI.ahQty();
      var dur = ahDur(n.dur);
      var dep = ahDeposit(n.item, q, dur.mul);
      h += '<div class="card"><div class="hd"><h3>② 设置拍卖条件</h3></div>';
      h += '<div class="ahform">';
      h += '<div class="ahf"><span>物品</span><b>' + it2.icon + ' ' + it2.name + '</b></div>';
      h += '<div class="ahf"><span>数量</span><input class="inp" type="number" min="1" max="' + count(n.item) + '" data-sel="ah-qty" value="' + q + '"></div>';
      h += '<div class="ahf"><span>起始单价</span><input class="inp" type="number" min="1" data-sel="ah-start" value="' + n.start + '"></div>';
      h += '<div class="ahf"><span>一口价单价</span><input class="inp" type="number" min="0" data-sel="ah-buy" value="' + n.buyout + '"></div>';
      h += '<div class="ahf"><span>拍卖时长</span><span class="chips2">';
      for (var d = 0; d < AH_DURS.length; d++) {
        var dd = AH_DURS[d];
        h += '<span class="chip' + (n.dur === dd.id ? ' on' : '') + '" data-act="ah-dur" data-a="' + dd.id + '">' +
          dd.name + ' ' + dd.hours + 'h</span>';
      }
      h += '</span></div>';
      h += '<div class="ahdep">押金 <b>' + fmt(dep) + '</b> 金币（成交退还，流拍不退）｜ 总计 ' +
        fmt((n.buyout > 0 ? n.buyout : n.start) * q) + ' 金币</div>';
      h += '<button class="wide gold" data-act="ah-post">📤 上架拍卖</button>';
      h += '</div></div>';
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

    /* ---- 专属类别动态排行榜 ---- */
    var cats = LB_CATS;
    h += '<div class="hd"><h3>排行榜</h3></div>';
    h += '<div class="lbtabs">';
    for (var ct = 0; ct < cats.length; ct++) {
      h += '<span class="lbtab' + (MUI.lbCat === cats[ct].id ? ' on' : '') + '" data-act="lbcat" data-a="' +
        cats[ct].id + '"><i>' + cats[ct].ic + '</i><s>' + cats[ct].nm + '</s></span>';
    }
    h += '</div>';

    var cd = lbCat(MUI.lbCat);
    var rows = lbRanking(MUI.lbCat);
    var myRank = 0, mine = null;
    for (var mj = 0; mj < rows.length; mj++) if (rows[mj].me) { myRank = rows[mj].rank; mine = rows[mj]; }
    var total = cd.id === 'total' ? totalLevel() : (mine ? mine.val : cd.p());

    h += '<div class="card lbh">' +
      '<div class="lbh-t">' + cd.ic + ' ' + cd.nm + '榜 <em>第 ' + myRank + ' / ' + rows.length + ' 名</em></div>' +
      '<div class="lbh-d">' + cd.desc + ' ｜ 你的成绩 <b>' + fmt(total) + (cd.un ? ' ' + cd.un : '') + '</b></div>' +
      '<div class="lbh-d dim">名次按你的实时数据即时重算，点任一行可查看对方档案。</div>' +
      '</div>';

    h += '<div class="card lbrows">';
    for (var j = 0; j < rows.length; j++) {
      var rw = rows[j];
      var medal = rw.rank === 1 ? '🥇' : (rw.rank === 2 ? '🥈' : (rw.rank === 3 ? '🥉' : rw.rank));
      h += '<div class="lbrow' + (rw.me ? ' me' : '') + (rw.rank <= 3 ? ' top' : '') + '" data-act="hero" data-a="' + rw.id + '">' +
        '<span class="lbrk">' + medal + '</span>' +
        '<span class="lbav">' + (rw.me ? '🐄' : '👤') + '</span>' +
        '<span class="lbwho"><b>' + MUI.esc(rw.name) + '</b>' +
        '<em>' + MUI.esc(rw.title || '') + (rw.guild ? ' · ' + MUI.esc(rw.guild) : '') + '</em></span>' +
        '<span class="lbval">' + fmt(rw.val) + (cd.un ? '<i>' + cd.un + '</i>' : '') + '</span>' +
        '<span class="lbgo">›</span></div>';
    }
    h += '</div>';
    h += '<div class="dim" style="font-size:10px;padding:0 10px 6px">' +
      '点击任意一行可查看对方的装备、工具与全部技能等级。</div>';

    h += '<div class="hd"><h3>世界频道</h3></div><div class="card chat">';
    var ch = S.chat || [];
    if (!ch.length) h += '<div class="dim">频道加载中…</div>';
    for (var k = 0; k < Math.min(12, ch.length); k++) {
      h += '<div class="c"><b>' + ch[k].n + '</b>：' + ch[k].m + '</div>';
    }
    h += '</div>';
    return h;
  },
  /* ============================================================
   *  玩家档案 · 独立全屏面板
   *  展示对方（或自己）的装备、工具与全部技能等级。
   * ============================================================ */
  renderHero: function () {
    var w = document.getElementById('mhero');
    if (!w) return;
    if (!MUI.heroId) { w.innerHTML = ''; w.style.display = 'none'; return; }
    var d = heroOf(MUI.heroId);
    if (!d) { w.innerHTML = ''; w.style.display = 'none'; MUI.heroId = null; return; }

    /* 参照分数线：与自己对比才有意义 */
    var me = heroOf('me');
    var maxSk = 1, i, k;
    for (i = 0; i < SKILLS.length; i++) {
      if (SKILLS[i].id === 'combat') continue;
      maxSk = Math.max(maxSk, d.skills[SKILLS[i].id] || 0, (me && me.skills[SKILLS[i].id]) || 0);
    }
    maxSk = Math.max(maxSk, 10);

    var h = '<div class="hero-in">';

    /* ---- 抬头 ---- */
    h += '<div class="hero-top"><button class="hero-back" data-act="heroclose">‹ 返回</button>' +
      '<b>' + MUI.esc(d.name) + '</b><span>' + (d.me ? '（你自己的档案）' : '离线模拟对手') + '</span></div>';

    /* ---- 名片 ---- */
    h += '<div class="hero-card">' +
      '<div class="hero-av">' + (d.me ? '🐄' : '👤') + '</div>' +
      '<div class="hero-meta"><div class="hero-nm">' + MUI.esc(d.name) + '</div>' +
      '<div class="hero-tl">' + MUI.esc(d.title || '') + '</div>' +
      '<div class="hero-gl">公会：' + MUI.esc(d.guild || '未加入公会') + '</div>' +
      (d.me ? '' : ('<div class="hero-gl dim">' + (d.online ? '🟢 在线' : '⚪ 离线') + ' ｜ 入服 ' + d.days + ' 天</div>')) +
      '</div>' +
      '<div class="hero-kpi"><div><s>总等级</s><b>' + fmt(d.lvTotal) + '</b></div>' +
      '<div><s>战斗</s><b>' + (Math.round(d.combatLv * 10) / 10) + '</b></div>' +
      '<div><s>金币</s><b>' + fmt(d.gold) + '</b></div></div>' +
      '</div>';

    /* ---- 装备 ---- */
    var eq = [], empty = [];
    for (i = 0; i < SLOTS.length; i++) {
      var sl = SLOTS[i], id = d.equip[sl.id];
      var it = id ? ITEMS[id] : null;
      var card = '<div class="hc' + (it ? '' : ' empty') + '">' +
        '<div class="hci">' + (it ? it.icon : sl.ic) + (d.enh[sl.id] ? '<em>+' + d.enh[sl.id] + '</em>' : '') + '</div>' +
        '<div class="hcn">' + (it ? it.name : sl.name) + '</div>' +
        '<div class="hcs">' + (it ? MUI.statText(it) : '<span class="dim">空</span>') + '</div></div>';
      if (it) eq.push(card); else empty.push(card);
    }
    h += '<div class="hero-sec"><h3>🛡️ 装备（' + eq.length + '/' + SLOTS.length + '）</h3><div class="hero-grid">' +
      eq.join('') + empty.join('') + '</div></div>';

    /* ---- 工具 ---- */
    var toolId = d.equip['tool'], tool = toolId ? ITEMS[toolId] : null;
    h += '<div class="hero-sec"><h3>🛠️ 工具</h3>';
    if (tool) {
      var effTxt = '';
      if (tool.toolSkill && SKILL_MAP[tool.toolSkill]) effTxt = SKILL_MAP[tool.toolSkill].name + ' 效率 +' + (tool.eff || 0) + '%';
      var eqTool = me && me.equip ? ITEMS[me.equip['tool']] : null;
      h += '<div class="hero-tool">' +
        '<div class="hti">' + tool.icon + (d.enh['tool'] ? '<em>+' + d.enh['tool'] + '</em>' : '') + '</div>' +
        '<div class="htn"><b>' + tool.name + '</b><span class="dim"> ｜ ' + (tool.lvl ? '需要等级 ' + tool.lvl : '') + '</span>' +
        '<div class="dim">' + (effTxt || '') + (effTxt && tool.tier != null ? '（第 ' + (tool.tier + 1) + '/7 档）' : '') + '</div>' +
        (d.me ? '' : (eqTool ? ('<div class="dim">你的是：' + eqTool.name + '</div>') : '<div class="dim">你还没有装备工具</div>')) +
        '</div></div>';
    } else {
      h += '<div class="card dim">暂未装备工具。</div>';
    }
    h += '</div>';

    /* ---- 全部技能等级 ---- */
    h += '<div class="hero-sec"><h3>📈 全部技能等级</h3><div class="hero-sk">';
    for (i = 0; i < SKILLS.length; i++) {
      var s = SKILLS[i];
      if (s.id === 'combat') continue;
      var lv = d.skills[s.id] || 0;
      var mine = (me && me.skills[s.id]) || 0;
      var diff = lv - mine;
      var pct = Math.min(100, lv / maxSk * 100);
      h += '<div class="hsk"><s>' + s.icon + ' ' + s.name + '</s>' +
        '<span class="hskbar"><i style="width:' + pct.toFixed(1) + '%"></i></span>' +
        '<b>' + lv + '</b>' +
        (d.me ? '' : '<em class="' + (diff > 0 ? 'up' : (diff < 0 ? 'dn' : '')) + '">' +
          (diff > 0 ? '+' + diff : (diff < 0 ? diff : '持平')) + '</em>') +
        '</div>';
    }
    h += '</div></div>';

    /* ---- 战斗素养 ---- */
    var SUB7 = ['stamina', 'intelligence', 'attack', 'defense', 'melee', 'ranged', 'magic'];
    var SUB7NM = { stamina: '体力', intelligence: '智力', attack: '攻击', defense: '防御', melee: '近战', ranged: '远程', magic: '魔法' };
    if (d.subs) {
      h += '<div class="hero-sec"><h3>⚔️ 战斗素养</h3><div class="hero-subs">';
      for (k = 0; k < SUB7.length; k++) {
        var sv = d.subs[SUB7[k]] || 0;
        var mv = (me && me.subs && me.subs[SUB7[k]]) || 0;
        var df2 = sv - mv;
        h += '<div class="hsub"><s>' + SUB7NM[SUB7[k]] + '</s><b>' + sv + '</b>' +
          (d.me ? '' : '<em class="' + (df2 > 0 ? 'up' : (df2 < 0 ? 'dn' : '')) + '">' +
            (df2 > 0 ? '+' + df2 : (df2 < 0 ? df2 : '持平')) + '</em>') + '</div>';
      }
      h += '</div></div>';
    }

    if (!d.me) {
      h += '<div class="hero-sec"><button class="wide gold" data-act="heroclose">返回排行榜</button></div>';
    }
    h += '</div>';

    w.innerHTML = h;
    w.style.display = 'block';
    w.scrollTop = 0;
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
