/* ============================================================
 *  星海牧场 · 资源/道具信息卡（长按或点击弹出）
 *
 *  修的问题：手机版「工作队列」里点采集物没有任何反馈。
 *  做法：全局事件委托 —— 不管哪个界面、哪个分区渲染出来的资源/道具，
 *        长按 3 秒 或 点击，都能弹出对应的银色信息卡。
 *
 *  解析道具的方式（由近及远，取第一个命中的祖先，最多 5 层）：
 *    1) 元素上的 data-item / data-id / data-a / data-b 若能查到 ITEMS
 *    2) 元素的文字里是否含某个道具名（先长后短，避免「木」抢了「星铁木」）
 *    3) 队列行 / 技能动作：走 ACTION_MAP 的 out / rare 找产出物
 *
 *  兼容老旧安卓内核：不用 pointer events、不用 CSS Grid/变量，flex 与
 *  transition 都带 -webkit- 前缀；ES5 写法。
 *  注意：本模块不使用 data-act，避免被 ui.js / ui-m.js 的全局委托误抓。
 * ============================================================ */
(function () {
  'use strict';

  var HOLD = 3000;     /* 长按 3 秒 */
  var LIFE = 10000;    /* 10 秒后渐隐消失 */
  var FADE = 500;      /* 渐隐时长 */

  /* ---------- 样式：卡片式银色 ---------- */
  var CSS = [
    '.ii-card{position:fixed;z-index:820;width:228px;padding:10px 12px;border-radius:12px;',
    '  background:-webkit-linear-gradient(160deg,#f4f7fb 0%,#ccd5e3 45%,#98a4bb 100%);',
    '  background:linear-gradient(160deg,#f4f7fb 0%,#ccd5e3 45%,#98a4bb 100%);',
    '  border:1px solid #eef2f8;color:#1b2138;opacity:1;',
    '  -webkit-box-shadow:0 10px 28px rgba(0,0,0,0.55);box-shadow:0 10px 28px rgba(0,0,0,0.55);',
    '  -webkit-transition:opacity ' + FADE + 'ms ease;transition:opacity ' + FADE + 'ms ease;',
    '  -webkit-user-select:none;user-select:none;}',
    '.ii-card.out{opacity:0;}',
    '.ii-x{position:absolute;top:6px;right:6px;width:22px;height:22px;line-height:20px;',
    '  text-align:center;border-radius:11px;background:#e0483c;color:#fff;font-size:13px;',
    '  cursor:pointer;border:1px solid #b8352b;}',
    '.ii-x:active{-webkit-transform:scale(0.9);transform:scale(0.9);}',
    '.ii-hd{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;padding-right:26px;}',
    '.ii-ic{font-size:24px;-webkit-flex:0 0 auto;flex:0 0 auto;margin-right:8px;}',
    '.ii-nm{font-size:14px;font-weight:700;color:#111731;}',
    '.ii-sub{font-size:10px;color:#5b6782;}',
    '.ii-rw{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:5px;font-size:11px;}',
    '.ii-k{width:42px;-webkit-flex:0 0 auto;flex:0 0 auto;color:#5b6782;}',
    '.ii-v{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;color:#1b2138;',
    '  word-break:break-all;}',
    '.ii-hr{height:1px;background:#aab5c9;margin:7px 0 2px;}'
  ].join('');
  var st = document.createElement('style');
  st.appendChild(document.createTextNode(CSS));
  document.head.appendChild(st);

  /* ---------- 小工具 ---------- */
  function winW() { return window.innerWidth || document.documentElement.clientWidth || 320; }
  function winH() { return window.innerHeight || document.documentElement.clientHeight || 480; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.appendChild(document.createTextNode(String(txt)));
    return n;
  }
  /* ponytail: 直接复用游戏自己的 fmt()（core.js 里是函数声明，会挂在 window 上） */
  function num(v) { return (typeof window.fmt === 'function') ? window.fmt(v) : String(v); }

  /* ---------- 数据：道具名索引（长的优先，避免短名抢命中） ---------- */
  var NAMES = [];
  var SRC = {};    /* 道具 id -> 产出它的动作名 */
  function buildIndex() {
    NAMES = [];
    if (typeof ITEM_LIST !== 'undefined') {
      var arr = ITEM_LIST.slice();
      arr.sort(function (a, b) { return (b.name || '').length - (a.name || '').length; });
      for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].name) NAMES.push(arr[i]);
    }
    SRC = {};
    if (typeof ACTION_MAP !== 'undefined') {
      for (var k in ACTION_MAP) {
        var a = ACTION_MAP[k];
        if (!a || a.kind === 'enhance' || a.kind === 'coinify' || a.kind === 'decompose' || a.kind === 'transmute') continue;
        var pool = {};
        if (a.out) for (var o in a.out) pool[o] = 1;
        if (a.rare) for (var r in a.rare) pool[r] = 1;
        for (var p in pool) {
          if (!SRC[p]) SRC[p] = [];
          if (SRC[p].length < 2) SRC[p].push(a.name);
        }
      }
    }
  }

  var CAT = { mat: '材料', food: '食物', drink: '饮品', equip: '装备', tool: '工具' };

  function infoOf(id) {
    if (typeof ITEMS === 'undefined' || !ITEMS[id]) return null;
    var it = ITEMS[id], rows = [];
    rows.push(['类别', CAT[it.cat] || '材料']);
    if (it.tier != null) rows.push(['品阶', '第 ' + (it.tier + 1) + ' 阶']);
    rows.push(['单价', num(it.price) + ' 金币']);
    var own = (typeof S !== 'undefined' && S && S.bag) ? (S.bag[id] || 0) : 0;
    rows.push(['持有', String(own)]);
    if (it.heal) rows.push(['食用', '生命 +' + num(it.heal) + (it.mana ? ' ｜ 内力 +' + num(it.mana) : '')]);
    if (it.buff) {
      rows.push(['饮用', (it.buff.kind === 'combat' ? '战斗伤害 +' : '采集效率 +') +
        Math.round((it.buff.dmg || it.buff.eff || 0) * 100) + '% ｜ ' + Math.round(it.buff.dur) + ' 秒']);
    }
    if (it.cat === 'equip' && it.st) {
      var s = [];
      for (var k in it.st) s.push(k + ' ' + num(it.st[k]));
      if (s.length) rows.push(['属性', s.join(' ｜ ')]);
    }
    if (SRC[id] && SRC[id].length) rows.push(['来源', SRC[id].join('、')]);
    return { icon: it.icon || '📦', name: it.name, rows: rows };
  }

  /* ---------- 从 DOM 反查道具 id ---------- */
  function attrItem(n) {
    if (!n || !n.getAttribute) return null;
    var keys = ['data-item', 'data-id', 'data-a', 'data-b', 'data-i'];
    for (var i = 0; i < keys.length; i++) {
      var v = n.getAttribute(keys[i]);
      if (v && typeof ITEMS !== 'undefined' && ITEMS[v]) return v;
    }
    return null;
  }
  function textItem(n) {
    if (!n) return null;
    var t = (n.textContent != null) ? n.textContent : (n.innerText || '');
    if (!t) return null;
    for (var i = 0; i < NAMES.length; i++) {
      if (t.indexOf(NAMES[i].name) >= 0) return NAMES[i].id;
    }
    return null;
  }
  /* 技能动作按钮（data-act="queue" 等：data-a=技能 data-b=动作）的产出物 */
  function actionItem(n) {
    if (!n || !n.getAttribute || typeof ACTION_MAP === 'undefined') return null;
    var a = n.getAttribute('data-a'), b = n.getAttribute('data-b');
    if (!a || !b) return null;
    var act = ACTION_MAP[a + ':' + b];
    if (!act) return null;
    if (act.out) for (var o in act.out) return o;
    if (act.rare) for (var r in act.rare) return r;
    return null;
  }
  /* 队列行：靠同级里的序号定位 S.queue[i]（手机端 qrow / 桌面端 qitem） */
  function queueItem(n) {
    if (!n || typeof S === 'undefined' || !S.queue) return null;
    var cls = n.className ? String(n.className) : '';
    if (cls.indexOf('qrow') < 0 && cls.indexOf('qitem') < 0) return null;
    var p = n.parentNode, idx = -1, c = 0;
    if (!p || !p.children) return null;
    for (var i = 0; i < p.children.length; i++) {
      var ch = p.children[i];
      if (ch === n) { idx = c; break; }
      var cc = ch.className ? String(ch.className) : '';
      if (cc.indexOf('qrow') >= 0 || cc.indexOf('qitem') >= 0) c++;
    }
    var q = S.queue[idx];
    if (!q || typeof ACTION_MAP === 'undefined') return null;
    var act = ACTION_MAP[q.skill + ':' + q.actId];
    if (!act) return null;
    if (act.out) for (var o in act.out) return o;
    if (act.rare) for (var r in act.rare) return r;
    return null;
  }
  /* 顶部队列条：正在执行的动作 */
  function runningItem(n) {
    if (!n || typeof S === 'undefined' || !S.action || typeof ACTION_MAP === 'undefined') return null;
    var cls = n.className ? String(n.className) : '';
    if (cls.indexOf('mq-row') < 0 && cls.indexOf('qnow') < 0) return null;
    var act = ACTION_MAP[S.action.skill + ':' + S.action.actId];
    if (!act) return null;
    if (act.out) for (var o in act.out) return o;
    if (act.rare) for (var r in act.rare) return r;
    return null;
  }

  function resolve(node) {
    var n = node, i;
    for (i = 0; n && i < 5; i++) {
      if (n.nodeName === 'INPUT' || n.nodeName === 'TEXTAREA' || n.nodeName === 'SELECT') return null;
      /* 跳过其它悬浮模块自己的界面，别在它们身上弹卡 */
      if (n.className && /chat-|ent-|rs-bar/.test(String(n.className))) return null;
      var id = attrItem(n) || queueItem(n) || runningItem(n) || actionItem(n) || textItem(n);
      if (id) return id;
      n = n.parentNode;
    }
    return null;
  }
  function hasAct(node) {
    var n = node;
    for (var i = 0; n && i < 4; i++) {
      if (n.getAttribute && n.getAttribute('data-act')) return true;
      n = n.parentNode;
    }
    return false;
  }

  /* ---------- 面板 ---------- */
  var card = null, lifeT = 0, killT = 0;

  function closeCard() {
    if (!card) return;
    var c = card; card = null;
    clearTimeout(lifeT); clearTimeout(killT);
    c.className = 'ii-card out';
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, FADE + 60);
  }

  function show(id, x, y) {
    var d = infoOf(id);
    if (!d) return;
    closeCard();
    buildIndex();   /* 道具表是静态的，重复建索引成本极低，但能覆盖动态新增 */

    var c = el('div', 'ii-card');
    var xb = el('div', 'ii-x', '✕');
    xb.addEventListener('click', function (e) {
      if (e.stopPropagation) e.stopPropagation();
      closeCard();
    }, false);
    c.appendChild(xb);

    var hd = el('div', 'ii-hd');
    hd.appendChild(el('div', 'ii-ic', d.icon));
    var box = el('div');
    box.appendChild(el('div', 'ii-nm', d.name));
    box.appendChild(el('div', 'ii-sub', '资源 / 道具信息'));
    hd.appendChild(box);
    c.appendChild(hd);
    c.appendChild(el('div', 'ii-hr'));

    for (var i = 0; i < d.rows.length; i++) {
      var r = el('div', 'ii-rw');
      r.appendChild(el('div', 'ii-k', d.rows[i][0]));
      r.appendChild(el('div', 'ii-v', d.rows[i][1]));
      c.appendChild(r);
    }

    document.body.appendChild(c);
    card = c;
    var h = c.offsetHeight || 170;
    c.style.left = clamp((x == null ? winW() / 2 : x) - 114, 8, Math.max(8, winW() - 236)) + 'px';
    c.style.top = clamp((y == null ? winH() / 2 : y) + 16, 8, Math.max(8, winH() - h - 8)) + 'px';

    /* ponytail: 10 秒后渐隐消失；点 X 立刻关 */
    lifeT = setTimeout(function () {
      if (!card) return;
      card.className = 'ii-card out';
      killT = setTimeout(function () { if (card && card.parentNode) card.parentNode.removeChild(card); card = null; }, FADE + 60);
    }, LIFE);
  }

  /* ---------- 输入：长按 3 秒 + 点击 ---------- */
  var lpT = 0, lpX = 0, lpY = 0, lpFired = false, lpId = null;

  function lpStart(node, x, y) {
    lpId = resolve(node);
    if (!lpId) return;
    lpX = x; lpY = y; lpFired = false;
    clearTimeout(lpT);
    lpT = setTimeout(function () {
      lpT = 0; lpFired = true;
      show(lpId, lpX, lpY);
    }, HOLD);
  }
  function lpMove(x, y) {
    if (!lpT) return;
    if (Math.abs(x - lpX) > 10 || Math.abs(y - lpY) > 10) { clearTimeout(lpT); lpT = 0; }
  }
  function lpEnd() {
    clearTimeout(lpT); lpT = 0;
    /* 长按弹过之后，紧接着的那次 click 要吃掉，避免又弹一次/误触发原有按钮 */
    if (lpFired) setTimeout(function () { lpFired = false; }, 400);
  }

  /* 触摸（手机 / 平板 / 安卓 WebView） */
  document.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0]; if (!t) return;
    lpStart(t.target, t.clientX, t.clientY);
  }, false);
  document.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0]; if (!t) return;
    lpMove(t.clientX, t.clientY);
  }, false);
  document.addEventListener('touchend', lpEnd, false);
  document.addEventListener('touchcancel', lpEnd, false);

  /* 鼠标（PC：点击同样直出，长按 3 秒也支持，行为与手机一致） */
  document.addEventListener('mousedown', function (e) {
    if (e.button != null && e.button !== 0) return;
    lpStart(e.target, e.clientX, e.clientY);
  }, false);
  document.addEventListener('mousemove', function (e) { lpMove(e.clientX, e.clientY); }, false);
  document.addEventListener('mouseup', lpEnd, false);

  /* 点击：除了本身带 data-act 的按钮（它们有各自的功能，不能被抢），
     其余地方点到资源/道具就直出信息卡 —— 工作队列点采集物正是走这条路 */
  document.addEventListener('click', function (e) {
    if (lpFired) { lpFired = false; if (e.stopPropagation) e.stopPropagation(); if (e.preventDefault) e.preventDefault(); return; }
    var id = resolve(e.target);
    if (!id) return;
    if (hasAct(e.target)) return;
    show(id, (e.clientX || 0), (e.clientY || 0));
  }, false);

  /* 长按后系统弹的上下文菜单（复制/保存图片）会打断体验 */
  document.addEventListener('contextmenu', function (e) {
    if (lpFired && e.preventDefault) e.preventDefault();
  }, false);

  buildIndex();
})();
