/* ============================================================
 *  星海牧场 · 悬浮聊天（世界频道）
 *
 *  与娱乐面板同一套交互：一个可自由拖拽的小图标，点开面板，面板标题栏也能拖。
 *  独立模块：不改任何现有逻辑，只读/写 S.chat，复用现有 saveGame() / UI.toast()。
 *
 *  兼容老旧移动端内核（X5/U3/U4）：
 *    - 不用 pointer events（只用 mouse + touch）
 *    - 不用 CSS Grid / gap / 变量 / min() / clamp() / inset / :is()
 *    - flex 相关属性全部带 -webkit- 前缀
 *
 *  美术：media/ui/*.svg 来自 Lucide（ISC 协议，免费商用），许可证见
 *        media/ui/LICENSE-lucide.txt；图标加载失败时降级为 emoji。
 *
 *  注意：本模块的按钮一律不使用 data-act，避免被 ui.js / ui-m.js 的事件委托误抓。
 * ============================================================ */
(function () {
  'use strict';

  var ICON = 'media/ui/';
  var LS = 'starfield_chat_ui_v1';

  /* ---------- 样式（独立前缀 chat-，与现有 .chat/.ch 不冲突） ---------- */
  var CSS = [
    '.chat-float{position:fixed;z-index:810;-webkit-user-select:none;user-select:none;}',
    '.chat-btn{position:relative;width:46px;height:46px;border-radius:23px;border:1px solid #b98b2a;',
    '  background:-webkit-radial-gradient(50% 30%,#2a3558,#0e1428);background:radial-gradient(50% 30%,#2a3558,#0e1428);',
    '  text-align:center;line-height:44px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.55);}',
    '.chat-btn:active{-webkit-transform:scale(0.94);transform:scale(0.94);}',
    '.chat-btn img{width:22px;height:22px;vertical-align:middle;}',
    '.chat-btn span{font-size:20px;line-height:44px;}',
    '.chat-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;line-height:16px;',
    '  border-radius:8px;background:#e0483c;color:#fff;font-size:10px;padding:0 4px;',
    '  text-align:center;font-family:Georgia,serif;display:none;}',
    '.chat-pan{width:290px;background:#0e1428;border:1px solid #232c50;border-radius:12px;',
    '  box-shadow:0 8px 26px rgba(0,0,0,0.6);overflow:hidden;}',
    '.chat-hd{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;padding:8px 10px;cursor:move;',
    '  background:-webkit-linear-gradient(#131a35,#0b1020);background:linear-gradient(#131a35,#0b1020);',
    '  border-bottom:1px solid #232c50;}',
    '.chat-hd img{width:14px;height:14px;vertical-align:-2px;margin-right:5px;}',
    '.chat-hd b{font-size:13px;color:#f2c14e;font-weight:700;}',
    '.chat-hd span{font-size:11px;color:#8892b8;margin-left:6px;}',
    '.chat-iw{margin-left:auto;display:-webkit-box;display:-webkit-flex;display:flex;}',
    '.chat-ib{width:24px;height:24px;line-height:22px;text-align:center;border:1px solid #2f3a68;',
    '  background:#111731;border-radius:6px;cursor:pointer;margin-left:4px;}',
    '.chat-ib img{width:12px;height:12px;vertical-align:middle;}',
    '.chat-ib span{font-size:11px;color:#8892b8;}',
    '.chat-bd{max-height:260px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 10px;}',
    '.chat-m{font-size:11px;padding:3px 0;border-bottom:1px dashed #1b2340;color:#dbe2f5;line-height:1.5;}',
    '.chat-m b{color:#8ad8ff;}',
    '.chat-m.me b{color:#f2c14e;}',
    '.chat-none{font-size:11px;color:#8892b8;text-align:center;padding:14px 0;}',
    '.chat-ft{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;padding:8px 10px;border-top:1px solid #232c50;',
    '  background:#0b1020;}',
    '.chat-in{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;height:30px;',
    '  border:1px solid #2f3a68;background:#111731;color:#dbe2f5;border-radius:6px;',
    '  padding:0 8px;font-size:16px;outline:none;}',
    '.chat-go{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;margin-left:6px;height:30px;padding:0 10px;',
    '  border:1px solid #b98b2a;background:#2a3558;color:#f2c14e;border-radius:6px;',
    '  font-size:12px;cursor:pointer;-webkit-flex:0 0 auto;flex:0 0 auto;}',
    '.chat-go:active{background:#1a2138;}',
    '.chat-go img{width:13px;height:13px;margin-right:4px;}',
    '.chat-go span{font-size:12px;}',
    /* 消息里的 [物品链接]：点一下拉起该物品的信息面板 */
    '.chat-lk{color:#8ad8ff;text-decoration:underline;cursor:pointer;}'
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
  function toast(m) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(m); }

  /* 图标：加载失败自动降级成 emoji（alt 就是 emoji，老内核也不至于开天窗） */
  function ico(file, alt, size) {
    var i = document.createElement('img');
    i.setAttribute('src', ICON + file);
    i.setAttribute('alt', alt);
    if (size) { i.style.width = size + 'px'; i.style.height = size + 'px'; }
    i.addEventListener('error', function () {
      var s = el('span', '', alt);
      if (i.parentNode) i.parentNode.replaceChild(s, i);
    }, false);
    return i;
  }

  /* ---------- 拖拽（鼠标 + 触摸，与娱乐面板同一套写法） ---------- */
  function dragify(node, handle, onEnd) {
    var sx = 0, sy = 0, lx = 0, ly = 0, on = false, moved = false;
    function start(x, y) {
      on = true; moved = false; sx = x; sy = y;
      lx = parseFloat(node.style.left) || 0;
      ly = parseFloat(node.style.top) || 0;
    }
    function move(x, y) {
      if (!on) return;
      if (Math.abs(x - sx) > 4 || Math.abs(y - sy) > 4) moved = true;
      put(node, lx + x - sx, ly + y - sy);
    }
    function end() {
      if (!on) return;
      on = false;
      setTimeout(function () { moved = false; }, 30);
      if (onEnd) onEnd();
    }
    handle.addEventListener('mousedown', function (e) { start(e.clientX, e.clientY); }, false);
    document.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); }, false);
    document.addEventListener('mouseup', end, false);
    handle.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0]; if (!t) return;
      start(t.clientX, t.clientY);
    }, false);
    handle.addEventListener('touchmove', function (e) {
      var t = e.touches && e.touches[0]; if (!t) return;
      move(t.clientX, t.clientY);
      if (e.cancelable) e.preventDefault();
    }, false);
    handle.addEventListener('touchend', end, false);
    return { moved: function () { return moved; } };
  }
  function put(node, x, y) {
    node.style.left = clamp(x, 4, Math.max(4, winW() - node.offsetWidth - 4)) + 'px';
    node.style.top = clamp(y, 4, Math.max(4, winH() - node.offsetHeight - 4)) + 'px';
  }

  /* ---------- 状态 ---------- */
  var launch, panel, bodyEl, footEl, inp, badge, dragBtn, dragHd;
  var open = false, collapsed = false, seenTop = null, renderedTop = null, renderedLen = -1;
  var saved = { x: -1, y: -1, open: 0 };

  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function store() {
    saved.x = parseFloat(launch.style.left) || saved.x;
    saved.y = parseFloat(launch.style.top) || saved.y;
    saved.open = open ? 1 : 0;
    try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) { }
  }

  function msgs() { return (typeof S !== 'undefined' && S && S.chat) ? S.chat : []; }
  function unseen() {
    var c = msgs();
    if (!c.length) return 0;
    if (seenTop) { for (var i = 0; i < c.length; i++) if (c[i] === seenTop) return i; }
    return c.length;
  }

  /* 道具名 -> id（聊天里发出的是 [物品名] 链接，要能点开信息面板） */
  function itemLookup() {
    var m = {};
    if (typeof ITEM_LIST === 'undefined') return m;
    for (var i = 0; i < ITEM_LIST.length; i++) {
      if (ITEM_LIST[i] && ITEM_LIST[i].name) m[ITEM_LIST[i].name] = ITEM_LIST[i].id;
    }
    return m;
  }
  /* 把文本里的 [xxx] 渲染成可点链接（逐段建节点，天然免疫 HTML 注入） */
  function linkify(parent, text) {
    var map = itemLookup(), re = /\[([^\[\]]{1,20})\]/g, last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (map[m[1]]) {
        (function (id) {
          var s = el('span', 'chat-lk', '[' + m[1] + ']');
          s.addEventListener('click', function (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (window.ItemInfo && window.ItemInfo.show) window.ItemInfo.show(id);
          }, false);
          parent.appendChild(s);
        })(map[m[1]]);
      } else {
        parent.appendChild(document.createTextNode(m[0]));
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function render(force) {
    var c = msgs();
    if (!force && c.length === renderedLen && c[0] === renderedTop) return;   /* 没新消息就不重绘 */
    renderedLen = c.length; renderedTop = c[0];
    bodyEl.innerHTML = '';
    if (!c.length) { bodyEl.appendChild(el('div', 'chat-none', '频道加载中…')); return; }
    for (var i = 0; i < c.length; i++) {
      var d = el('div', 'chat-m' + (c[i].n === '我' ? ' me' : ''));
      d.appendChild(el('b', '', c[i].n + '：'));
      linkify(d, c[i].m);
      bodyEl.appendChild(d);
    }
  }

  function paintBadge() {
    var n = unseen();
    badge.style.display = (n > 0 && !open) ? 'block' : 'none';
    if (n > 0) badge.innerHTML = '';
    if (n > 0) badge.appendChild(document.createTextNode(n > 99 ? '99+' : String(n)));
  }

  function setOpen(v) {
    open = !!v;
    panel.style.display = open ? '' : 'none';
    if (open) {
      seenTop = msgs()[0] || null;
      render(true);
      /* 面板跟随图标：默认开在图标上方，越界由 put() 夹回视口内 */
      put(panel, (parseFloat(launch.style.left) || 0) - 244,
        (parseFloat(launch.style.top) || 0) - (collapsed ? 44 : 330));
      bodyEl.scrollTop = 0;
    }
    paintBadge();
    store();
  }
  function setCollapsed(v) {
    collapsed = !!v;
    saved.collapsed = collapsed ? 1 : 0;
    bodyEl.style.display = collapsed ? 'none' : '';
    footEl.style.display = collapsed ? 'none' : '';
    store();
  }

  function send() {
    var v = (inp.value || '').replace(/^\s+|\s+$/g, '');
    if (!v) { toast('说点什么再发送吧'); return; }
    if (typeof S === 'undefined' || !S) { toast('存档未就绪'); return; }
    if (v.length > 60) v = v.slice(0, 60);
    S.chat = S.chat || [];
    S.chat.unshift({ n: '我', m: v });          /* 与现有 pushChat 一致：新的在前 */
    if (S.chat.length > 30) S.chat.length = 30;
    if (typeof saveGame === 'function') saveGame();
    inp.value = '';
    seenTop = S.chat[0];
    render(true);
    bodyEl.scrollTop = 0;
  }

  /* ---------- 构建 ---------- */
  function build() {
    var s = load();
    saved.x = (typeof s.x === 'number') ? s.x : -1;
    saved.y = (typeof s.y === 'number') ? s.y : -1;

    launch = el('div', 'chat-float');
    var b = el('div', 'chat-btn');
    b.appendChild(ico('message-circle.svg', '💬', 22));
    badge = el('div', 'chat-badge', '');
    b.appendChild(badge);
    launch.appendChild(b);

    panel = el('div', 'chat-float chat-pan');
    var hd = el('div', 'chat-hd');
    hd.appendChild(ico('globe.svg', '🌐', 14));
    hd.appendChild(el('b', '', '世界频道'));
    hd.appendChild(el('span', '', '可发送'));
    var iw = el('div', 'chat-iw');
    var ibMinus = el('div', 'chat-ib');
    ibMinus.appendChild(ico('minus.svg', '－', 12));
    var ibX = el('div', 'chat-ib');
    ibX.appendChild(ico('x.svg', '✕', 12));
    iw.appendChild(ibMinus); iw.appendChild(ibX);
    hd.appendChild(iw);

    bodyEl = el('div', 'chat-bd');
    footEl = el('div', 'chat-ft');
    inp = document.createElement('input');
    inp.className = 'chat-in';
    inp.type = 'text';
    inp.setAttribute('maxlength', '60');
    inp.setAttribute('placeholder', '说点什么…（回车发送）');
    /* ponytail: 娱乐面板的赛车在 window 上监听 keydown 并对空格/方向键 preventDefault，
       且不判断焦点；这里直接掐断冒泡，保证打字不会被抢走（无需改现有代码） */
    inp.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' || e.keyCode === 13) { send(); if (e.preventDefault) e.preventDefault(); }
    }, false);
    var go = el('div', 'chat-go');
    go.appendChild(ico('send.svg', '➤', 13));
    go.appendChild(el('span', '', '发送'));
    footEl.appendChild(inp); footEl.appendChild(go);

    panel.appendChild(hd); panel.appendChild(bodyEl); panel.appendChild(footEl);
    panel.style.display = 'none';
    document.body.appendChild(launch);
    document.body.appendChild(panel);

    dragBtn = dragify(launch, b, store);
    dragHd = dragify(panel, hd, store);

    b.addEventListener('click', function () { if (!dragBtn.moved()) setOpen(!open); }, false);
    ibMinus.addEventListener('click', function () { setCollapsed(!collapsed); }, false);
    ibX.addEventListener('click', function () { setOpen(false); }, false);
    go.addEventListener('click', send, false);

    /* 默认停在右下角，避开娱乐面板的右上角入口 */
    if (saved.x >= 0 && saved.y >= 0) put(launch, saved.x, saved.y);
    else put(launch, winW() - 56, winH() - 120);

    render(true);
    if (s.open) setOpen(true);
    else { seenTop = msgs()[0] || null; paintBadge(); }
    if (s.collapsed) setCollapsed(true);

    /* ponytail: 用低频轮询跟着 S.chat 走，不去改游戏主循环 */
    setInterval(function () {
      if (open) render(false);
      paintBadge();
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, false);
  else build();
})();
