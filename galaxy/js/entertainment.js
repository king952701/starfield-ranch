/* ============================================================
 *  星海牧场 · 娱乐面板（挂机解闷小游戏）
 *  独立模块：不改动任何现有逻辑，只复用现有的 addGold() / UI.toast()
 *  兼容老旧移动端内核（X5/U3/U4）：
 *    - 不用 pointer events（只用 mouse + touch）
 *    - 不用 CSS Grid / gap / 变量 / min() / clamp() / inset / :is()
 *    - flex 相关属性全部带 -webkit- 前缀
 *  注意：本模块的按钮一律不使用 data-act，避免被 ui.js / ui-m.js 的事件委托误抓。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 样式（独立前缀 ent-，避免和现有样式冲突） ---------- */
  var CSS = [
    '.ent-float{position:fixed;z-index:800;-webkit-user-select:none;user-select:none;}',
    '.ent-btn{width:46px;height:46px;border-radius:23px;border:1px solid #b98b2a;',
    '  background:-webkit-radial-gradient(50% 30%,#2a3558,#0e1428);background:radial-gradient(50% 30%,#2a3558,#0e1428);',
    '  color:#f2c14e;font-size:20px;line-height:44px;text-align:center;cursor:pointer;',
    '  box-shadow:0 2px 10px rgba(0,0,0,0.55);}',
    '.ent-btn:active{-webkit-transform:scale(0.94);transform:scale(0.94);}',
    '.ent-pan{width:290px;background:#0e1428;border:1px solid #232c50;border-radius:12px;',
    '  box-shadow:0 8px 26px rgba(0,0,0,0.6);overflow:hidden;}',
    '.ent-hd{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;padding:8px 10px;cursor:move;',
    '  background:-webkit-linear-gradient(#131a35,#0b1020);background:linear-gradient(#131a35,#0b1020);',
    '  border-bottom:1px solid #232c50;}',
    '.ent-hd b{font-size:13px;color:#f2c14e;font-weight:700;}',
    '.ent-hd span{font-size:11px;color:#8892b8;margin-left:6px;}',
    '.ent-x{margin-left:auto;width:24px;height:24px;line-height:22px;text-align:center;',
    '  border:1px solid #2f3a68;background:#111731;color:#8892b8;border-radius:6px;',
    '  font-size:14px;cursor:pointer;-webkit-flex:0 0 auto;flex:0 0 auto;}',
    '.ent-bd{padding:10px;}',
    '.ent-item{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;padding:9px 8px;border-bottom:1px solid #1a2140;cursor:pointer;}',
    '.ent-item:active{background:#151c34;}',
    '.ent-item i{font-style:normal;font-size:20px;width:30px;-webkit-flex:0 0 auto;flex:0 0 auto;}',
    '.ent-item div{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;}',
    '.ent-item em{display:block;font-style:normal;font-size:13px;color:#dbe2f5;}',
    '.ent-item small{display:block;font-size:11px;color:#8892b8;}',
    '.ent-item.soon{cursor:default;}',
    '.ent-item.soon em{color:#7b86ad;}',
    '.ent-b{border:1px solid #2f3a68;background:#111731;color:#dbe2f5;border-radius:8px;',
    '  padding:6px 10px;font-size:12px;cursor:pointer;margin:0 6px 6px 0;}',
    '.ent-b:active{background:#1a2138;}',
    '.ent-b.on{border-color:#f2c14e;color:#f2c14e;}',
    '.ent-b:disabled{opacity:0.4;cursor:default;}',
    '.ent-cv{display:block;margin:0 auto;background:#070a14;border:1px solid #232c50;',
    '  border-radius:8px;touch-action:none;}',
    '.ent-tip{font-size:11px;color:#8892b8;line-height:1.6;}',
    '.ent-res{background:#111731;border:1px solid #2f3a68;border-radius:8px;padding:8px 10px;',
    '  font-size:12px;color:#dbe2f5;margin-bottom:8px;}',
    '.ent-row{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;',
    '  flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;}',
    '.ent-bal{color:#f2c14e;font-family:Georgia,serif;}'
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
  function btn(label, fn, cls) {
    var b = el('button', 'ent-b' + (cls ? ' ' + cls : ''), label);
    if (fn) b.addEventListener('click', fn, false);
    return b;
  }
  /* ponytail: 直接用现有的 toast，不自己实现一套气泡 */
  function toast(m) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(m); }

  /* ---------- 拖拽（同时支持鼠标与触摸，返回是否在拖拽中） ---------- */
  function dragify(node, handle) {
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
    function end() { on = false; setTimeout(function () { moved = false; }, 30); }
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

  /* ---------- 通用 Canvas 容器（赛车 / 老虎机共用） ---------- */
  function mkCanvas(host, w, h) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.className = 'ent-cv';
    host.appendChild(cv);
    /* ponytail: 不做 devicePixelRatio 缩放适配，清晰度够用，省一段 craft 代码 */
    return { cv: cv, ctx: cv.getContext('2d') };
  }
  /* 通用渲染循环：返回 stop()，关面板时必须调用 */
  function loop(fn) {
    var alive = true, id = 0, last = 0;
    function step(t) {
      if (!alive) return;
      var dt = last ? Math.min(50, t - last) : 16;   /* 防止切后台回来后跳帧 */
      last = t;
      fn(dt);
      if (alive) id = requestAnimationFrame(step);
    }
    id = requestAnimationFrame(step);
    return function () { alive = false; if (id) cancelAnimationFrame(id); };
  }

  /* ============================================================
   *  游戏 1：极速牧场（竖屏滚动 2D 赛车）
   * ============================================================ */
  var RACE = { W: 268, H: 330, FIN: 2000, SPEED: 190, VIEW: 300, CHARS: ['#f0645f', '#5b8dd6', '#5fd08a', '#f0a13b', '#a86ff0', '#4fbf7a', '#f2c14e'] };

  function earn(n) { if (typeof addGold === 'function') addGold(n); }

  function racer(host) {
    var c = mkCanvas(host, RACE.W, RACE.H), g = c.ctx;
    var W = RACE.W, H = RACE.H, RL = W / 2 - 79, RR = W / 2 + 79;   /* 路面左右边界 */
    var py = H - 62;
    var me, ais, stuff, coins, boxes, stop, keys, hud;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function reset() {
      me = { x: W / 2, d: 0, nitro: 0, cool: 0, stun: 0, item: 0, n: 0, unlocked: false, done: false };
      coins = 0; boxes = 0;
      ais = []; stuff = [];
      for (var i = 0; i < 7; i++) {
        /* ponytail: AI 速度略低于玩家基础速度，让「稳住不出草地」本身就能赢；玩家犯错才会掉名次 */
        ais.push({ x: RL + 18 + i * 19, d: 0, sp: RACE.SPEED * rnd(0.90, 1.02), stun: 0, c: RACE.CHARS[i], n: i + 1, done: false });
      }
      /* 金市与道具箱沿赛道随机分布：一次性生成，不随时间 spawn，省掉生成逻辑 */
      for (var d = 90; d < RACE.FIN - 50; d += rnd(28, 62)) {
        stuff.push({ d: d, x: rnd(RL + 16, RR - 16), t: 'coin', got: false });
      }
      for (var k = 150; k < RACE.FIN - 60; k += rnd(170, 240)) {
        stuff.push({ d: k, x: rnd(RL + 16, RR - 16), t: 'box', got: false });
      }
    }

    function rank() {
      var ahead = 0;
      for (var i = 0; i < ais.length; i++) if (ais[i].d > me.d) ahead++;
      return ahead + 1;
    }

    function useNitro() {
      if (!me.unlocked || me.cool > 0) return;
      me.nitro = 1500; me.cool = 4500;
    }
    function useItem() {
      if (!me.item) return;
      me.item = 0;
      var live = [];
      for (var i = 0; i < ais.length; i++) if (!ais[i].done) live.push(ais[i]);
      /* ponytail: 只打随机一个对手（含身后的），不做瞄准 / 选择目标 UI */
      if (live.length) live[Math.floor(Math.random() * live.length)].stun = 2000;
    }

    function finish(place) {
      stop && stop();
      me.done = true;
      var reward = [150, 80, 40][place - 1] || 0;
      if (reward) earn(reward);
      hud.className = 'ent-res';
      hud.innerHTML = '';
      var t = place === 1 ? '🏆 第 1 名！' : '第 ' + place + ' 名 / 8';
      hud.appendChild(document.createTextNode(t + '　💰 +' + reward + '　金币 ' + coins + '　道具 ' + boxes));
      rowEnd.style.display = '';
      toast(place === 1 ? '🏆 夺冠！奖励 ' + reward + ' 金币' : '完赛，奖励 ' + reward + ' 金币');
    }

    /* ponytail: 完赛后复用同一个「再来一局」行，不重复 append，避免按钮越堆越多 */
    function restart() {
      if (stop) { stop(); stop = null; }
      rowEnd.style.display = 'none';
      hud.className = 'ent-tip';
      hud.innerHTML = '';
      reset();
      stop = tick();
    }

    function tick() {
      return loop(function (dt) {
        if (me.done) return;
        var sec = dt / 1000;
        if (keys.left) me.x -= 230 * sec;
        if (keys.right) me.x += 230 * sec;
        me.x = clamp(me.x, RL - 30, RR + 30);
        var off = me.x < RL || me.x > RR;
        if (me.nitro > 0) me.nitro -= dt;
        if (me.cool > 0) me.cool -= dt;
        if (me.stun > 0) me.stun -= dt;
        var sp = RACE.SPEED;
        if (off) sp *= 0.5;              /* 压草地掉速：这是唯一的开车惩罚，不额外做障碍物 */
        if (me.nitro > 0) sp *= 1.9;
        if (me.stun > 0) sp *= 0.45;
        me.d += sp * sec;

        for (var i = 0; i < ais.length; i++) {
          var a = ais[i];
          if (a.done) continue;
          if (a.stun > 0) a.stun -= dt;
          a.d += a.sp * (a.stun > 0 ? 0.45 : 1) * sec;
          if (a.d >= RACE.FIN) a.done = true;
        }
        for (var j = 0; j < stuff.length; j++) {
          var s = stuff[j];
          if (s.got || Math.abs(s.d - me.d) > 16) continue;
          if (Math.abs(s.x - me.x) > 15) continue;
          s.got = true;
          if (s.t === 'coin') { coins++; if (coins >= 10) me.unlocked = true; }
          else { me.item = 1; boxes++; }
        }
        if (me.d >= RACE.FIN) { me.done = true; finish(rank()); return; }
        draw();
      });
    }

    function draw() {
      var i;
      g.fillStyle = '#10251a'; g.fillRect(0, 0, W, H);          /* 草地 */
      g.fillStyle = '#1a2138'; g.fillRect(RL, 0, RR - RL, H);   /* 路面 */

      /* 滚动参照物：每 40 单位一道路缘 + 中线虚线，靠它体现速度 */
      var base = Math.floor(me.d / 40) * 40;
      for (i = 0; i < 9; i++) {
        var wd = base + i * 40, y = py - (wd - me.d) / RACE.VIEW * (H - 70);
        if (y < -20 || y > H) continue;
        var alt = (wd / 40) % 2;
        g.fillStyle = alt ? '#f0645f' : '#e8eaf5';
        g.fillRect(RL - 5, y, 5, 12); g.fillRect(RR, y, 5, 12);
        g.fillStyle = '#4a5688';
        g.fillRect(W / 2 - 2, y, 4, 14);
      }
      /* 终点线 */
      if (RACE.FIN - me.d < RACE.VIEW) {
        var fy = py - (RACE.FIN - me.d) / RACE.VIEW * (H - 70);
        for (i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#0b1020' : '#f8f9ff';
          g.fillRect(RL + i * ((RR - RL) / 8), fy, (RR - RL) / 8, 8);
        }
      }
      /* 金币 / 道具箱 */
      for (i = 0; i < stuff.length; i++) {
        var s = stuff[i];
        if (s.got) continue;
        var dd = s.d - me.d;
        if (dd < -20 || dd > RACE.VIEW) continue;
        var y2 = py - dd / RACE.VIEW * (H - 70);
        if (s.t === 'coin') {
          g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(s.x, y2, 6, 0, 6.283); g.fill();
        } else {
          g.fillStyle = '#a86ff0'; g.fillRect(s.x - 7, y2 - 7, 14, 14);
          g.fillStyle = '#0b1020'; g.fillText('?', s.x - 3, y2 + 4);
        }
      }
      /* 对手车（只在视野内的才画） */
      for (i = 0; i < ais.length; i++) {
        var a = ais[i], ad = a.d - me.d;
        if (ad < -30 || ad > RACE.VIEW) continue;
        var ay = py - ad / RACE.VIEW * (H - 70);
        g.fillStyle = a.c; g.fillRect(a.x - 11, ay - 9, 22, 18);
        g.fillStyle = '#0b1020'; g.font = '10px sans-serif';
        g.fillText(String(a.n), a.x - 3, ay + 4);
      }
      /* 玩家车 */
      g.fillStyle = me.nitro > 0 ? '#f2c14e' : '#f8f9ff';
      g.fillRect(me.x - 11, py - 10, 22, 20);
      g.fillStyle = '#0b1020'; g.fillText('我', me.x - 7, py + 4);

      /* HUD */
      g.fillStyle = 'rgba(7,10,20,0.72)'; g.fillRect(0, 0, W, 34);
      g.font = '11px sans-serif'; g.fillStyle = '#dbe2f5';
      g.fillText('💰' + coins + '  ' + (me.unlocked ? (me.cool > 0 ? '⚡冷却' : '⚡就绪') : '⚡需10币') + '  🎁' + me.item, 8, 14);
      g.fillStyle = '#f2c14e';
      g.fillText('第 ' + rank() + ' / 8', 8, 28);
      g.fillStyle = '#8892b8';
      g.fillText(Math.floor(me.d / RACE.FIN * 100) + '%', W - 44, 28);
      g.fillStyle = '#232c50'; g.fillRect(W - 40, 20, 32, 6);
      g.fillStyle = '#f2c14e'; g.fillRect(W - 40, 20, 32 * clamp(me.d / RACE.FIN, 0, 1), 6);
    }

    /* 控制：键盘 + 触屏按钮 */
    keys = { left: false, right: false };
    hud = el('div', 'ent-tip', '');
    host.appendChild(hud);

    var rowA = el('div', 'ent-row');
    rowA.appendChild(btn('◀', null));
    rowA.appendChild(btn('▶', null));
    rowA.appendChild(btn('⚡氮气', useNitro));
    rowA.appendChild(btn('🎁扔道具', useItem));
    host.appendChild(rowA);

    var rowEnd = el('div', 'ent-row');
    rowEnd.style.display = 'none';
    rowEnd.appendChild(btn('再来一局', restart));
    host.appendChild(rowEnd);

    /* ponytail: 触屏方向键用 press/release 长按控制，不引入虚拟摇杆 */
    var lb = rowA.children[0], rb = rowA.children[1];
    function hold(node, key) {
      var down = function (e) { keys[key] = true; if (e.cancelable) e.preventDefault(); };
      var up = function () { keys[key] = false; };
      node.addEventListener('mousedown', down, false);
      node.addEventListener('mouseup', up, false);
      node.addEventListener('mouseleave', up, false);
      node.addEventListener('touchstart', down, false);
      node.addEventListener('touchend', up, false);
      node.addEventListener('touchcancel', up, false);
    }
    hold(lb, 'left'); hold(rb, 'right');

    function onKey(e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
      else if (k === ' ') { useNitro(); e.preventDefault(); }
      else if (k === 'j' || k === 'J') { useItem(); }
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    }
    window.addEventListener('keydown', onKey, false);
    window.addEventListener('keyup', onKeyUp, false);

    reset();
    stop = tick();

    return {
      help: '← → 或 A D 移动，空格氮气（吃满 10 金币解锁），J 扔道具。别压出路面，会掉速。',
      destroy: function () {
        if (stop) stop();
        window.removeEventListener('keydown', onKey, false);
        window.removeEventListener('keyup', onKeyUp, false);
      }
    };
  }

  /* ============================================================
   *  游戏 2：幸运滚轮（老虎机）
   * ============================================================ */
  var SLOTS = { SYMS: ['🍒', '🍉', '🔔', '⭐', '💎', '🐄'], BETS: [10, 50, 100], PAY3: 10, PAY2: 2 };

  function slots(host) {
    var bet = SLOTS.BETS[0], busy = false, timer = null;
    var bal, res, g, W = 250, H = 96;

    var cv = mkCanvas(host, W, H);
    g = cv.ctx;

    function drawCell(i, s) {
      var x = 6 + i * 80, w = 74, y = 8, h = 78;
      g.fillStyle = '#111731'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#2f3a68'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.font = '34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#dbe2f5';
      g.fillText(s, x + w / 2, y + h / 2);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }

    function paint(arr) { for (var i = 0; i < 3; i++) drawCell(i, arr[i]); }

    function myGold() { return typeof S !== 'undefined' ? S.gold : 0; }
    function refresh() { bal.innerHTML = '💰 <b class="ent-bal">' + myGold() + '</b>'; }

    function settle(a, b, c) {
      var win = 0, txt;
      if (a === b && b === c) { win = bet * SLOTS.PAY3; txt = '🎉 三连！中 ' + win + ' 金币'; }
      else if (a === b || b === c || a === c) { win = bet * SLOTS.PAY2; txt = '✨ 两个一样，中 ' + win + ' 金币'; }
      else txt = '没中，再试试';
      if (win > 0) { if (typeof addGold === 'function') addGold(win); toast(txt); }
      res.innerHTML = txt;
      refresh();
      busy = false;
    }

    function spin() {
      if (busy) return;
      if (myGold() < bet) { toast('金币不足'); res.innerHTML = '金币不足，先去挂机赚点'; return; }
      if (typeof addGold === 'function') addGold(-bet);
      refresh();
      busy = true;
      res.innerHTML = '滚轮转动中…';
      var out = [
        SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)],
        SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)],
        SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)]
      ];
      /* ponytail: 只有随机切换图案，不做滚动 / 减速缓动 */
      var frames = 0;
      timer = setInterval(function () {
        frames++;
        if (frames >= 10) {
          clearInterval(timer); timer = null;
          paint(out);
          settle(out[0], out[1], out[2]);
          return;
        }
        paint([
          SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)],
          SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)],
          SLOTS.SYMS[Math.floor(Math.random() * SLOTS.SYMS.length)]
        ]);
      }, 60);
    }

    bal = el('div', 'ent-tip'); host.appendChild(bal);
    res = el('div', 'ent-res', '选好金币，点开始'); host.appendChild(res);

    var rowBet = el('div', 'ent-row'); host.appendChild(rowBet);
    var betBtns = SLOTS.BETS.map(function (b) {
      var bt = btn('押 ' + b, function () {
        bet = b;
        for (var i = 0; i < betBtns.length; i++) betBtns[i].className = 'ent-b';
        bt.className = 'ent-b on';
      });
      rowBet.appendChild(bt);
      return bt;
    });
    betBtns[0].className = 'ent-b on';

    var rowGo = el('div', 'ent-row'); host.appendChild(rowGo);
    rowGo.appendChild(btn('🎰 开始', spin));
    rowGo.appendChild(el('span', 'ent-tip', '三连 ×' + SLOTS.PAY3 + '　两个一样 ×' + SLOTS.PAY2));

    paint(['🍒', '🍉', '🐄']);
    refresh();
    /* 余额随挂机收入变化，1 秒同步一次；关掉即停 */
    var sync = setInterval(refresh, 1000);

    return {
      help: '押注后点开始，三个图案随机停下：三连赔 ' + SLOTS.PAY3 + ' 倍，两个一样赔 ' + SLOTS.PAY2 + ' 倍。',
      destroy: function () { if (timer) clearInterval(timer); clearInterval(sync); }
    };
  }

  /* ============================================================
   *  面板框架
   * ============================================================ */
  var GAMES = [
    { id: 'racer', ic: '🏎', nm: '极速牧场', ds: '捡金币 · 氮气 · 砸道具 · 8 车竞速', open: racer },
    { id: 'slots', ic: '🎰', nm: '幸运滚轮', ds: '押金币，三连大奖', open: slots },
    { id: 'link', ic: '🧩', nm: '连连看 PK', ds: '敬请期待', soon: true },
    { id: 'gomoku', ic: '⚫', nm: '五子棋 PK', ds: '敬请期待', soon: true },
    { id: 'ddz', ic: '🃏', nm: '斗地主', ds: '敬请期待', soon: true }
  ];

  var launch = el('div', 'ent-float ent-btn', '🎮');
  var panel = el('div', 'ent-float ent-pan');
  var hd = el('div', 'ent-hd');
  hd.appendChild(el('b', null, '娱乐'));
  hd.appendChild(el('span', null, '挂机解闷'));
  var xBtn = el('button', 'ent-x', '×');
  hd.appendChild(xBtn);
  panel.appendChild(hd);
  var body = el('div', 'ent-bd');
  panel.appendChild(body);

  var open = false, cur = null;

  function stopGame() {
    if (cur && cur.destroy) cur.destroy();
    cur = null;
  }

  function showList() {
    stopGame();
    body.innerHTML = '';
    for (var i = 0; i < GAMES.length; i++) {
      (function (gm) {
        var it = el('div', 'ent-item' + (gm.soon ? ' soon' : ''));
        it.appendChild(el('i', null, gm.ic));
        var d = el('div');
        d.appendChild(el('em', null, gm.nm));
        d.appendChild(el('small', null, gm.ds));
        it.appendChild(d);
        if (gm.soon) it.appendChild(el('span', 'ent-tip', '🚧'));
        it.addEventListener('click', function () {
          if (gm.soon) { toast('敬请期待：' + gm.nm); return; }
          showGame(gm);
        }, false);
        body.appendChild(it);
      })(GAMES[i]);
    }
  }

  function showGame(gm) {
    stopGame();
    body.innerHTML = '';
    var top = el('div', 'ent-row');
    var back = btn('← 返回', showList);
    top.appendChild(back);
    top.appendChild(el('b', null, gm.ic + ' ' + gm.nm));
    body.appendChild(top);

    var stage = el('div');
    body.appendChild(stage);
    var game = gm.open(stage);
    cur = game;

    var foot = el('div', 'ent-row');
    foot.style.marginTop = '8px';
    foot.appendChild(el('small', 'ent-tip', game.help || ''));
    body.appendChild(foot);
  }

  function toggle(force) {
    open = (force == null) ? !open : !!force;
    panel.style.display = open ? 'block' : 'none';
    if (open) showList();
    else stopGame();
    put(panel, parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0);
  }

  var dragL = dragify(launch, launch);
  var dragP = dragify(panel, hd);
  launch.addEventListener('click', function () {
    if (dragL.moved()) return;   /* 拖过就不算点 */
    toggle();
  }, false);
  xBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggle(false);
  }, false);
  window.addEventListener('resize', function () {
    put(launch, parseFloat(launch.style.left) || 0, parseFloat(launch.style.top) || 0);
    put(panel, parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0);
  }, false);

  document.body.appendChild(launch);
  document.body.appendChild(panel);
  /* ponytail: 默认位置让开手机版 46px 高的顶部资源条，不挡金币；想挪到哪随拖拽 */
  put(launch, winW() - 56, 52);
  put(panel, winW() - 296, 106);
  panel.style.display = 'none';

  /* 对外只暴露一个入口，方便以后其它面板调用 */
  window.ENT = { open: function () { toggle(true); }, close: function () { toggle(false); }, games: GAMES };
})();
