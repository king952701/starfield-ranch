/* ============================================================
 *  兼容层 · 面向老旧移动端内核（X5 / U3 / U4 / 低版本 WebView）
 *  - ES5+ 方法兜底（findIndex / includes / Object.assign / closest / rAF）
 *  - localStorage 兜底（无痕模式、file:// 协议）
 *  - 视口高度修正（地址栏 / 虚拟按键 / 刘海屏安全区）
 *  - 300ms 点击延迟与缩放抑制
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. ES6 方法兜底 ---------- */
  if (typeof Object.assign !== 'function') {
    Object.assign = function (target) {
      if (target === null || target === undefined) throw new TypeError('Object.assign target');
      var out = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src === null || src === undefined) continue;
        for (var k in src) {
          if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
        }
      }
      return out;
    };
  }

  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function (fn) {
      for (var i = 0; i < this.length; i++) { if (fn(this[i], i, this)) return i; }
      return -1;
    };
  }
  if (!Array.prototype.filter) {
    Array.prototype.filter = function (fn) {
      var r = []; for (var i = 0; i < this.length; i++) { if (fn(this[i], i, this)) r.push(this[i]); }
      return r;
    };
  }
  if (!Array.prototype.map) {
    Array.prototype.map = function (fn) {
      var r = []; for (var i = 0; i < this.length; i++) r.push(fn(this[i], i, this));
      return r;
    };
  }
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn) {
      for (var i = 0; i < this.length; i++) fn(this[i], i, this);
    };
  }
  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function (fn, init) {
      var i = 0, acc = init;
      if (arguments.length < 2) { acc = this[0]; i = 1; }
      for (; i < this.length; i++) acc = fn(acc, this[i], i, this);
      return acc;
    };
  }
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (v) {
      for (var i = 0; i < this.length; i++) if (this[i] === v) return i;
      return -1;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (v) { return this.indexOf(v) >= 0; };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function (v) { return this.indexOf(v) >= 0; };
  }
  if (!String.prototype.trim) {
    String.prototype.trim = function () { return this.replace(/^\s+|\s+$/g, ''); };
  }
  if (!Object.keys) {
    Object.keys = function (o) {
      var r = []; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r.push(k);
      return r;
    };
  }

  /* ---------- 2. DOM 方法兜底 ---------- */
  /* 简易选择器匹配：本项目只用到 [data-act] 这类属性选择器，
     因此即便内核没有 matchesSelector 也能保证点击委托可用 */
  function matchSimple(el, sel) {
    var m = /^\[([a-zA-Z0-9_-]+)\]$/.exec(sel);
    if (m) return el.hasAttribute ? el.hasAttribute(m[1]) : false;
    if (sel.charAt(0) === '.') {
      return (' ' + (el.className || '') + ' ').indexOf(' ' + sel.substring(1) + ' ') >= 0;
    }
    if (sel.charAt(0) === '#') return el.id === sel.substring(1);
    var tag = sel.toUpperCase();
    return el.tagName === tag;
  }

  var EP = (typeof Element !== 'undefined') ? Element.prototype : null;
  if (EP) {
    if (!EP.matches) {
      EP.matches = EP.webkitMatchesSelector || EP.mozMatchesSelector ||
        EP.msMatchesSelector || EP.oMatchesSelector || null;
    }
    if (!EP.closest) {
      EP.closest = function (sel) {
        var el = this;
        while (el && el.nodeType === 1) {
          var ok = false;
          if (EP.matches) {
            try { ok = EP.matches.call(el, sel); } catch (e) { ok = false; }
          }
          if (!ok) ok = matchSimple(el, sel);
          if (ok) return el;
          el = el.parentElement;
        }
        return null;
      };
    }
    if (!EP.remove) {
      EP.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    }
  }

  /* ---------- 3. requestAnimationFrame / performance.now ---------- */
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (cb) {
      return setTimeout(function () { cb(Date.now()); }, 16);
    };
    window.cancelAnimationFrame = function (id) { clearTimeout(id); };
  }
  if (!window.performance) window.performance = {};
  if (!window.performance.now) {
    var t0 = Date.now();
    window.performance.now = function () { return Date.now() - t0; };
  }

  /* ---------- 4. localStorage 兜底 ---------- */
  var mem = (function () {
    var d = {}, n = 0;
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); n++; },
      removeItem: function (k) { delete d[k]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return n; },
      __memory: true
    };
  })();

  var lsOK = false;
  try {
    window.localStorage.setItem('__t', '1');
    window.localStorage.removeItem('__t');
    lsOK = true;
  } catch (e) { lsOK = false; }

  if (!lsOK) {
    try {
      Object.defineProperty(window, 'localStorage', { value: mem, configurable: true });
    } catch (e2) {
      try { window.localStorage = mem; } catch (e3) { }
    }
  }
  window.__storageMemory = !lsOK;

  /* ---------- 5. 视口高度 / 安全区 ---------- */
  function setVH() {
    var h = window.innerHeight || document.documentElement.clientHeight || 640;
    var el = document.getElementById('app');
    if (el) el.style.height = h + 'px';
    window.MCompat = window.MCompat || {};
    window.MCompat.vh = h;
  }
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', function () { setTimeout(setVH, 350); });

  /* ---------- 6. 缩放 / 选中 / 长按菜单 抑制 ---------- */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, false);
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, false);
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    /* 仅在"非按钮"区域抑制双击缩放，避免影响连续点击排队列 */
    var t = e.target;
    var isBtn = t && t.closest ? t.closest('button,[data-act]') : null;
    if (!isBtn && now - lastTouchEnd < 320) e.preventDefault();
    lastTouchEnd = now;
  }, false);
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    e.preventDefault();
  });

  /* ---------- 8. 特性探测：多背景（用于渐进增强的 Kenney CC0 按钮纹理） ---------- */
  try {
    var probe = document.createElement('div').style;
    probe.backgroundImage = 'url(#), -webkit-linear-gradient(#fff,#000)';
    if (probe.backgroundImage.indexOf(',') > 0) {
      document.documentElement.className += ' multibg';
    }
  } catch (e8) { }
  var ua = (navigator.userAgent || '').toLowerCase();
  var browser = '系统浏览器';
  if (ua.indexOf('micromessenger') >= 0) browser = '社交应用内置';
  else if (ua.indexOf('ucbrowser') >= 0 || ua.indexOf('ubrowser') >= 0) browser = '第三方内核浏览器';
  else if (ua.indexOf('qqbrowser') >= 0 || ua.indexOf('mqqbrowser') >= 0) browser = '第三方内核浏览器';
  else if (ua.indexOf('lenovo') >= 0 || ua.indexOf('lephone') >= 0 || ua.indexOf('zui') >= 0) browser = '厂商内置浏览器';
  else if (ua.indexOf('baidubrowser') >= 0 || ua.indexOf('baiduboxapp') >= 0) browser = '第三方内核浏览器';
  else if (ua.indexOf('quark') >= 0) browser = '第三方内核浏览器';
  else if (ua.indexOf('chrome') >= 0) browser = 'Chromium 内核浏览器';

  var webkitVer = 0;
  var m = /applewebkit\/(\d+)/.exec(ua) || /chrome\/(\d+)/.exec(ua);
  if (m) webkitVer = parseInt(m[1], 10);

  window.MCompat = {
    vh: window.innerHeight || 640,
    safeBottom: 0,
    browser: browser,
    webkit: webkitVer,
    lowEnd: webkitVer > 0 && webkitVer < 537,   /* 过老的内核（Chromium < 55） */
    setVH: setVH
  };

  /* ---------- 8. 启动 ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setVH);
  } else { setVH(); }
})();
