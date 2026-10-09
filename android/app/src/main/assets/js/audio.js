/* ============================================================
 *  音效引擎 · 星海牧场
 *  - 全部素材来自 Kenney（CC0 1.0），见 media/THIRD-PARTY-LICENSES.txt
 *  - 面向老 WebView：只用 HTML5 Audio，不用 Web Audio API
 *  - 懒加载 + 元素池：512MB 老机也不会一次性解码 24 个音轨
 *  - 移动端必须由用户手势解锁，首次触摸时静默解锁一次
 * ============================================================ */
(function (window, document) {
  'use strict';

  var SFX = {
    on: true,
    vol: 0.55,
    path: 'media/sfx/',
    pool: {},
    unlocked: false,
    failed: {},

    /* 音效名 -> 文件（全部 Kenney CC0） */
    FILES: {
      click: 'ui_click.ogg', tab: 'ui_tab.ogg', select: 'ui_select.ogg',
      ok: 'ui_ok.ogg', err: 'ui_err.ogg', panel: 'ui_panel.ogg',
      coin: 'ui_coin.ogg', toggle: 'ui_toggle.ogg',
      gather: 'act_gather.ogg', wood: 'act_wood.ogg', craft: 'act_craft.ogg',
      soft: 'act_soft.ogg', levelup: 'lvl_up.ogg', equip: 'equip.ogg',
      sell: 'sell.ogg', hit: 'hit.ogg', crit: 'crit.ogg',
      open: 'sf_open.ogg', close: 'sf_close.ogg', low: 'sf_low.ogg',
      shield: 'sf_shield.ogg', laser: 'sf_laser.ogg',
      up: 'jingle_upgrade.ogg', gain: 'jingle_gain.ogg'
    },

    el: function (src) {
      var a = document.createElement('audio');
      a.src = src;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      return a;
    },

    /* 移动端音频必须由用户手势触发，第一次触摸/点击时解锁 */
    unlock: function () {
      if (SFX.unlocked) return;
      SFX.unlocked = true;
      try {
        /* 播一个极短的一次性空音频把声道打开 */
        SFX.playRaw(SFX.path + SFX.FILES.click, 0.0001);
      } catch (e) { }
    },

    /* 核心：懒创建 + 复用，播不了就静默失败（绝不抛错打断游戏） */
    playRaw: function (src, vol) {
      try {
        var a = SFX.pool[src];
        if (!a) {
          if (SFX.failed[src]) return;
          a = SFX.el(src);
          SFX.pool[src] = a;
          SFX.poolN++;
        }
        try { a.volume = (vol == null ? SFX.vol : vol); } catch (e2) { }
        if (a.readyState === 4 || a.currentTime > 0) {
          try { a.currentTime = 0; } catch (e3) { }
        }
        var p = a.play();
        if (p && p.catch) p.catch(function () { });
      } catch (e) {
        SFX.failed[src] = 1;
      }
    },

    poolN: 0,
    play: function (name, vol) {
      if (!SFX.on) return;
      if (!SFX.unlocked) return;          /* 还没解锁就别浪费解码 */
      var f = SFX.FILES[name];
      if (!f) return;
      /* 老机保护：驻留音轨超过 12 条就不再新建 */
      if (MCompatLow && SFX.poolN > 12 && !SFX.pool[SFX.path + f]) return;
      SFX.playRaw(SFX.path + f, vol);
    },

    setOn: function (v) {
      SFX.on = !!v;
      try {
        if (window.localStorage) localStorage.setItem('sr_sfx', SFX.on ? '1' : '0');
      } catch (e) { }
      if (!SFX.on) {
        try {
          for (var k in SFX.pool) { SFX.pool[k].pause(); }
        } catch (e2) { }
      }
    },

    load: function () {
      try {
        var v = localStorage.getItem('sr_sfx');
        if (v === '0') SFX.on = false;
        var g = localStorage.getItem('sr_vol');
        if (g != null && g !== '') SFX.vol = Math.max(0, Math.min(1, parseFloat(g)));
      } catch (e) { }
    },

    setVol: function (v) {
      SFX.vol = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('sr_vol', String(SFX.vol)); } catch (e) { }
    },

    bind: function () {
      var go = function () { SFX.unlock(); };
      document.addEventListener('touchstart', go, false);
      document.addEventListener('mousedown', go, false);
      document.addEventListener('keydown', go, false);
    }
  };

  var MCompatLow = !!(window.MCompat && window.MCompat.lowEnd);

  SFX.load();
  SFX.bind();

  window.SFX = SFX;
  window.sfx = function (n, v) { SFX.play(n, v); };

  /* 全局按钮点击音：统一在事件委托里放一个轻量钩子 */
  document.addEventListener('click', function (e) {
    var el = e.target;
    var guard = 0;
    while (el && el !== document.body && guard < 6) {
      if (el.getAttribute && el.getAttribute('data-act')) {
        SFX.play('click');
        return;
      }
      el = el.parentNode;
      guard++;
    }
  }, false);

})(window, document);
