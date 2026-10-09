/* ============================================================
 * resplit.js —— 统一「可拖拽分隔条」（全界面 / 四端一致）
 *
 * 四端：PC 网页(index.html) / 手机网页(m.html) / 安卓 WebView / 平板(默认走手机版)
 *
 * 复用方式：一个组件 RS.add(cfg) 描述一处分区，界面只写配置，不复制代码。
 * 布局改造方式：只写 CSS 变量（--rs-*），不改原有 CSS 文件、不改原有布局规则。
 *
 * 设计约束（与现有项目约定对齐）：
 *   - 控件不用 data-act（现有 ui.js/ui-m.js 是 data-act 全局委托，用了会被误抓）
 *   - 手机版 m.css 刻意避开 Grid/CSS 变量差异：这里注入的 CSS 全部带 -webkit- 前缀
 *   - ES5 写法（var / function），兼容老安卓 WebView
 * ============================================================ */
(function () {
  'use strict';

  var NS = 'starfield_ranch_ui_v1';      /* 存档兜底 key（S.ui 不可用时） */
  var items = [];
  var drag = null;
  var rafId = 0;
  var pendingVal = 0;
  var rules = [];
  var IN = { top: 0, right: 0, bottom: 0, left: 0 };   /* 安全区 */

  function $(sel) { return document.querySelector(sel); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function coarse() { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }

  /* ---------- 样式：默认几乎不可见，悬停/聚焦/拖拽才高亮 ---------- */
  function baseCSS() {
    var h = coarse() ? 48 : 8;   /* ponytail: 热区按输入方式给，触摸 48（≥44pt/48dp），鼠标 8 */
    rules.push(
      '#rs-safe{position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}'
    );
    rules.push('.rs-bar{position:absolute;z-index:600;background:transparent;-webkit-tap-highlight-color:transparent;' +
      'touch-action:none;-ms-touch-action:none}');
    rules.push('.rs-bar.rs-x{cursor:col-resize}.rs-bar.rs-y{cursor:row-resize}');
    rules.push('.rs-line{position:absolute;background:rgba(255,255,255,.07);border-radius:2px;' +
      '-webkit-transition:background .12s,box-shadow .12s;transition:background .12s,box-shadow .12s}');
    rules.push('.rs-x>.rs-line{left:50%;top:0;bottom:0;width:2px;margin-left:-1px}');
    rules.push('.rs-y>.rs-line{top:50%;left:0;right:0;height:2px;margin-top:-1px}');
    /* 触摸端没有 hover：常显一条更明显的浅线作为「可拖」提示 */
    rules.push('@media (hover:none){.rs-line{background:rgba(255,255,255,.18)}}');
    rules.push('.rs-bar:hover>.rs-line,.rs-bar:focus>.rs-line,.rs-bar.on>.rs-line{' +
      'background:#f2c14e;box-shadow:0 0 6px rgba(242,193,78,.55)}');
    rules.push('.rs-grip{position:absolute;left:50%;top:50%;display:none;-webkit-transform:translate(-50%,-50%);' +
      'transform:translate(-50%,-50%);font-size:9px;line-height:1;color:#f2c14e;background:#0d132a;' +
      'border:1px solid #2f3a68;border-radius:6px;padding:2px 3px;white-space:nowrap;font-style:normal}');
    rules.push('.rs-bar:hover>.rs-grip,.rs-bar:focus>.rs-grip,.rs-bar.on>.rs-grip{display:block}');
    rules.push('.rs-bar:focus{outline:2px solid #f2c14e;outline-offset:-2px}');
    /* 拖拽期间禁掉过渡，避免面板动画和指针插值打架造成抖动 */
    rules.push('html.rs-drag #app *,html.rs-drag #mmain *{-webkit-transition:none!important;transition:none!important}');
    rules.push('html.rs-drag{-webkit-user-select:none;user-select:none}');
    return h;
  }

  function flushCSS() {
    var st = document.createElement('style');
    st.id = 'rs-style';
    st.setAttribute('type', 'text/css');
    st.appendChild(document.createTextNode(rules.join('\n')));
    document.head.appendChild(st);
  }

  /* ---------- 安全区（刘海 / 灵动岛 / 手势条 / 挖孔） ---------- */
  function measureInsets() {
    var d = document.getElementById('rs-safe');
    if (!d) {
      d = document.createElement('div');
      d.id = 'rs-safe';
      d.setAttribute('aria-hidden', 'true');
      document.body.appendChild(d);
    }
    var s = window.getComputedStyle(d);
    IN.top = parseFloat(s.paddingTop) || 0;
    IN.right = parseFloat(s.paddingRight) || 0;
    IN.bottom = parseFloat(s.paddingBottom) || 0;
    IN.left = parseFloat(s.paddingLeft) || 0;
  }

  /* ---------- 存储：优先挂进 S.ui（跟着存档导出/导入走，即四端同步） ---------- */
  function bag() {
    if (typeof S !== 'undefined' && S) {
      if (!S.ui) S.ui = {};
      return S.ui;
    }
    try { return JSON.parse(localStorage.getItem(NS)) || {}; } catch (e) { return {}; }
  }
  function readSaved(key, dft) {
    var v = bag()[key];
    return (typeof v === 'number' && isFinite(v)) ? v : dft;
  }
  function save(it) {
    var b = bag();
    b[it.cfg.key] = it.size;
    try { localStorage.setItem(NS, JSON.stringify(b)); } catch (e) { }
    if (typeof S !== 'undefined' && S && typeof saveGame === 'function') {
      try { saveGame(); } catch (e) { }   /* ponytail: 只在松手/键盘结束时存，拖拽过程不写盘 */
    }
  }

  /* ---------- 边界：最小/最大 + 另一侧最小 + 安全区 ---------- */
  function otherOf(it) {
    var v = it.cfg.other || 0;
    if (it.cfg.sibling) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].cfg.key === it.cfg.sibling) v += items[i].size;
      }
    }
    return v;
  }
  function bounds(it) {
    var c = it.cfg, cont = it.container;
    var cs = it.axis === 'x' ? cont.clientWidth : cont.clientHeight;
    var usable = cs - (c.pad || 0) - (c.gaps || 0) - otherOf(it) - (c.tailMin || 0);
    if (it.axis === 'y') usable -= (IN.top + IN.bottom);
    else usable -= (IN.left + IN.right);
    var min = c.min || 40;
    if (c.topSafe) min = Math.max(min, IN.top);        /* 顶栏不能小于刘海高度，否则内容被吃掉 */
    if (c.bottomSafe) min = Math.max(min, IN.bottom);  /* 底栏同理，避开手势条 */
    var max = Math.min(c.max || 600, usable);
    if (max < min) max = min;
    return { min: Math.round(min), max: Math.round(max) };
  }

  function place(it) {
    var p = it.pane, c = it.cfg, h = it.hot;
    var edge, ge = (c.gapEdge || 0) * (it.grow > 0 ? 1 : -1);
    if (it.axis === 'x') {
      edge = (it.grow > 0) ? (p.offsetLeft + p.offsetWidth) : p.offsetLeft;
      it.bar.style.left = Math.round(edge + ge - h / 2) + 'px';
      it.bar.style.top = p.offsetTop + 'px';
      it.bar.style.height = p.offsetHeight + 'px';
      it.bar.style.width = h + 'px';
    } else {
      edge = (it.grow > 0) ? (p.offsetTop + p.offsetHeight) : p.offsetTop;
      it.bar.style.top = Math.round(edge + ge - h / 2) + 'px';
      it.bar.style.left = p.offsetLeft + 'px';
      it.bar.style.width = p.offsetWidth + 'px';
      it.bar.style.height = h + 'px';
    }
  }

  function apply(it, v) {
    var b = bounds(it);
    it.size = clamp(Math.round(v), b.min, b.max);
    it.container.style.setProperty(it.cfg.varName, it.size + 'px');
    place(it);
    it.bar.setAttribute('aria-valuemin', b.min);
    it.bar.setAttribute('aria-valuemax', b.max);
    it.bar.setAttribute('aria-valuenow', it.size);
  }

  function tick() {
    rafId = 0;
    if (!drag) return;
    apply(drag.it, pendingVal);
  }

  /* ---------- 输入：优先 Pointer Events（鼠标/触摸/手写笔一套），老 WebView 退化为 mouse+touch ---------- */
  function bindDrag(bar, it) {
    var useP = !!window.PointerEvent;

    function down(x, y, id, ev) {
      if (ev && ev.button != null && ev.button !== 0) return;
      drag = { it: it, start: it.axis === 'x' ? x : y, base: it.size, id: id };
      bar.className = bar.className + ' on';
      document.documentElement.className = document.documentElement.className + ' rs-drag';
      if (ev && ev.preventDefault) ev.preventDefault();
      if (useP && bar.setPointerCapture) { try { bar.setPointerCapture(id); } catch (e) { } }
    }
    function move(x, y) {
      if (!drag || drag.it !== it) return;
      pendingVal = drag.base + ((it.axis === 'x' ? x : y) - drag.start) * it.grow;
      if (!rafId) rafId = requestAnimationFrame(tick);   /* ponytail: 每帧最多一次重排，不阻塞主循环 */
    }
    function up() {
      if (!drag || drag.it !== it) return;
      drag = null;
      bar.className = bar.className.replace(/\bon\b/, '');
      document.documentElement.className = document.documentElement.className.replace(/\brs-drag\b/, '');
      save(it);
    }

    if (useP) {
      bar.addEventListener('pointerdown', function (e) { down(e.clientX, e.clientY, e.pointerId, e); }, false);
      bar.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); }, false);
      bar.addEventListener('pointerup', up, false);
      bar.addEventListener('pointercancel', up, false);
      bar.addEventListener('lostpointercapture', up, false);
    } else {
      bar.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY, 0, e); }, false);
      bar.addEventListener('touchstart', function (e) {
        var t = e.touches && e.touches[0]; if (!t) return;
        down(t.clientX, t.clientY, 0, e);
      }, false);
      window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); }, false);
      window.addEventListener('mouseup', up, false);
      window.addEventListener('touchmove', function (e) {
        var t = e.touches && e.touches[0]; if (!t) return;
        move(t.clientX, t.clientY);
      }, false);
      window.addEventListener('touchend', up, false);
      window.addEventListener('touchcancel', up, false);
    }

    /* 键盘：方向键 / Shift 加速 / Home·End 到边界（手柄可复用 RS.nudge 映射） */
    bar.addEventListener('keydown', function (e) {
      var k = e.key || '';
      var step = e.shiftKey ? 32 : 8, d = 0, b = null;
      if (it.axis === 'x') {
        if (k === 'ArrowLeft') d = -step; else if (k === 'ArrowRight') d = step;
      } else {
        if (k === 'ArrowUp') d = -step; else if (k === 'ArrowDown') d = step;
      }
      if (k === 'Home') { b = bounds(it); apply(it, b.min); e.preventDefault(); save(it); return; }
      if (k === 'End') { b = bounds(it); apply(it, b.max); e.preventDefault(); save(it); return; }
      if (!d) return;
      e.preventDefault();
      apply(it, it.size + d * it.grow);
      save(it);
    }, false);
  }

  /* ---------- 注册一处分区 ---------- */
  function add(cfg) {
    var c = cfg.container ? $(cfg.container) : null;
    var p = cfg.pane ? $(cfg.pane) : null;
    if (!c || !p) return null;               /* 该端没有这个分区 → 静默跳过，不报错 */
    if (window.getComputedStyle(c).position === 'static') c.style.position = 'relative';

    var it = {
      cfg: cfg, container: c, pane: p,
      axis: cfg.axis === 'y' ? 'y' : 'x',
      grow: cfg.grow === -1 ? -1 : 1,
      hot: cfg.hot || baseHot,
      size: 0, bar: null, line: null
    };

    if (cfg.grid) c.className = c.className + ' rs-grid';
    if (cfg.pane && !p.className.match(/\brs-pane\b/)) p.className = p.className + ' rs-pane';

    /* 手机版：分区本身是 flex item，靠 CSS 变量改 flex-basis */
    if (cfg.flex) {
      var v = cfg.varName, d0 = cfg.base + 'px';
      var decl = '-webkit-flex:0 0 var(' + v + ',' + d0 + ');flex:0 0 var(' + v + ',' + d0 + ');';
      decl += (it.axis === 'x' ? 'width:' : 'height:') + 'var(' + v + ',' + d0 + ')';
      rules.push(cfg.pane + '.rs-pane{' + decl + '}');
    }

    var bar = document.createElement('div');
    bar.className = 'rs-bar rs-' + it.axis;
    bar.setAttribute('role', 'separator');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-orientation', it.axis === 'x' ? 'vertical' : 'horizontal');
    bar.setAttribute('aria-label', cfg.label || '调整面板大小');
    var ln = document.createElement('i'); ln.className = 'rs-line';
    var gp = document.createElement('i'); gp.className = 'rs-grip';
    gp.appendChild(document.createTextNode(it.axis === 'x' ? '◀▶' : '▲▼'));
    bar.appendChild(ln); bar.appendChild(gp);
    c.appendChild(bar);
    it.bar = bar;

    bindDrag(bar, it);
    items.push(it);
    apply(it, readSaved(cfg.key, cfg.base));
    return it;
  }

  function reflow() {
    measureInsets();
    for (var i = 0; i < items.length; i++) {
      apply(items[i], items[i].size);   /* 重新夹取：窗口变小/横竖屏切换/平板分屏后不会溢出 */
    }
  }

  /* ---------- 对外 API ---------- */
  function byKey(k) {
    for (var i = 0; i < items.length; i++) if (items[i].cfg.key === k) return items[i];
    return null;
  }
  window.RS = {
    add: add,
    reflow: reflow,
    reload: function () {
      for (var i = 0; i < items.length; i++) apply(items[i], readSaved(items[i].cfg.key, items[i].cfg.base));
    },
    nudge: function (key, d) { var it = byKey(key); if (it) { apply(it, it.size + d * it.grow); save(it); } },
    set: function (key, v) { var it = byKey(key); if (it) { apply(it, v); save(it); } },
    reset: function (key) { var it = byKey(key); if (it) { apply(it, it.cfg.base); save(it); } },
    sizes: function () { var o = {}; for (var i = 0; i < items.length; i++) o[items[i].cfg.key] = items[i].size; return o; },
    insets: function () { return IN; }
  };

  /* ---------- 各端分区清单（新增界面 = 这里加一行，不复制代码） ---------- */
  var baseHot = baseCSS();

  function boot() {
    measureInsets();
    var desk = !!document.getElementById('left') && !!document.getElementById('app');
    var mob = !!document.getElementById('mmain');

    if (desk) {
      /* ponytail: 桌面 #app 是 Grid，这里只覆盖 grid-template 的变量版本，默认值与原有像素完全一致 */
      rules.push('#app.rs-grid{grid-template-columns:var(--rs-left,210px) minmax(0,1fr) var(--rs-right,268px);' +
        'grid-template-rows:52px minmax(0,1fr) var(--rs-bottom,96px)}');
      add({
        key: 'desk.left', axis: 'x', grid: true, container: '#app', pane: '#left',
        varName: '--rs-left', base: 210, min: 150, max: 420,
        pad: 16, gaps: 16, sibling: 'desk.right', tailMin: 340, gapEdge: 4,
        label: '调整技能侧栏宽度'
      });
      add({
        key: 'desk.right', axis: 'x', grow: -1, container: '#app', pane: '#right',
        varName: '--rs-right', base: 268, min: 180, max: 460,
        pad: 16, gaps: 16, sibling: 'desk.left', tailMin: 340, gapEdge: 4,
        label: '调整角色侧栏宽度'
      });
      add({
        key: 'desk.bottom', axis: 'y', grow: -1, container: '#app', pane: '#bottom',
        varName: '--rs-bottom', base: 96, min: 64, max: 260,
        pad: 16, gaps: 16, other: 52, tailMin: 200, bottomSafe: true, gapEdge: 4,
        label: '调整底部队列栏高度'
      });
    }

    if (mob) {
      add({
        key: 'm.res', axis: 'y', flex: true, container: '#mmain', pane: '#mres',
        varName: '--rs-mres', base: 46, min: 40, max: 120,
        sibling: 'm.queue', tailMin: 200, topSafe: true,
        label: '调整顶部资源条高度'
      });
      add({
        key: 'm.queue', axis: 'y', flex: true, container: '#mmain', pane: '#mqueue',
        varName: '--rs-mqueue', base: 30, min: 24, max: 110,
        sibling: 'm.res', tailMin: 200,
        label: '调整队列条高度'
      });
    }

    flushCSS();
    /* 顺序：先注入样式再应用，避免首帧跳变 */
    for (var i = 0; i < items.length; i++) place(items[i]);
  }

  window.addEventListener('resize', reflow, false);
  window.addEventListener('orientationchange', function () { setTimeout(reflow, 250); }, false);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', reflow, false);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, false);
  else boot();
})();
