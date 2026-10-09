/* ============================================================
 *  星海牧场 · 手机版启动与主循环
 *  手机特性：渲染节流省电、切后台自动补算离线收益、单手操作
 * ============================================================ */

if (!Combat.healFull) {
  Combat.healFull = function () {
    var P = Combat.stats();
    if (!S.combat) return;
    S.combat.hp = P.maxHp;
    S.combat.mp = P.maxMp;
    MUI.dirty = true;
  };
}

var MGame = {
  last: 0, slowT: 0, chatT: 0, saveT: 0, hiddenAt: 0, running: false,

  boot: function () {
    MUI.init();
    var loaded = loadGame();
    if (!loaded) { MGame.showStart(); return; }

    /* 首次进入：按存档时间补算离线收益 */
    var elapsed = (Date.now() - (S.savedAt || Date.now())) / 1000;
    var res = runOffline(elapsed);
    MGame.startLoop();
    if (res && res.sec > 60) MGame.showOffline(res);
  },

  /* ---------------- 启动页 ---------------- */
  showStart: function () {
    var w = document.getElementById('mmodal');
    var warn = window.__storageMemory
      ? '<div class="warn">⚠ 当前浏览器禁用了本地存储，进度无法保存。<br>请关闭无痕模式，或改用「文件/普通模式」打开。</div>' : '';
    w.innerHTML = '<div class="mbox">' +
      '<h1>🐄 星海牧场</h1>' +
      '<div class="sub">银河放置传说 · 手机版</div>' +
      '<div class="fr"><label>角色名</label><input id="pname" maxlength="10" value="牧牛人"></div>' +
      '<div class="fr"><label>服务器</label><select id="pserver">' +
      ['星海一区', '星海二区', '银河新区', '沐莓小镇'].map(function (s) { return '<option>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="tips">左侧选「技能」→ 用 +1 / +10 / ∞ 排活，或用「置顶队列」「加入队列 #N」安排顺序。<br>' +
      '「战斗」可挂机刷材料装备；「专精」注入池经验获得强力加成。<br>' +
      '关掉页面也会继续生产，回来自动结算离线收益。</div>' + warn +
      '<button class="big" id="btnstart">进入星海</button></div>';
    w.style.display = '-webkit-box';
    w.style.display = 'flex';
    document.getElementById('btnstart').onclick = function () {
      var v = (document.getElementById('pname').value || '').replace(/^\s+|\s+$/g, '');
      S.server = document.getElementById('pserver').value;
      newGame(v || '牧牛人');
      w.style.display = 'none';
      MGame.startLoop();
      MUI.dirty = true;
    };
  },

  /* ---------------- 离线结算 ---------------- */
  showOffline: function (res) {
    var w = document.getElementById('mmodal');
    w.innerHTML = '<div class="mbox">' +
      '<h2>🌙 离线结算</h2>' +
      '<div class="sub">你离开了 ' + fmtTime(res.sec) + '（上限 ' + bonuses().offline + ' 小时）</div>' +
      '<div class="og">' +
      '<div><s>完成动作</s><b>' + fmt(res.acts) + '</b></div>' +
      '<div><s>获得金币</s><b>' + fmt(res.gold) + '</b></div>' +
      '<div><s>战斗</s><b>' + (res.kills ? '继续' : '未开启') + '</b></div>' +
      '</div>' +
      '<button class="big" id="btnok">继续冒险</button></div>';
    w.style.display = '-webkit-box';
    w.style.display = 'flex';
    document.getElementById('btnok').onclick = function () { w.style.display = 'none'; };
  },

  /* ---------------- 循环 ---------------- */
  startLoop: function () {
    S.chat = S.chat || [];
    MGame.running = true;
    MGame.last = (window.performance && performance.now) ? performance.now() : Date.now();
    MGame.hiddenAt = Date.now();
    MUI.dirty = true;
    requestAnimationFrame(MGame.loop);
  },

  loop: function (now) {
    if (!MGame.running) return;
    var t = (typeof now === 'number') ? now : Date.now();
    var dt = (t - MGame.last) / 1000;
    MGame.last = t;
    if (dt > 2) dt = 2;          /* 切后台/卡顿保护 */
    if (dt < 0) dt = 0;

    MGame.step(dt);
    MUI.frame();

    if (UI.dirty) { UI.dirty = false; MUI.dirty = true; }
    if (MUI.dirty && (Date.now() - MUI.lastRender) > 180) {   /* 渲染节流：约 5fps，省电 */
      MUI.dirty = false;
      MUI.render();
    }
    requestAnimationFrame(MGame.loop);
  },

  step: function (dt) {
    tickAction(dt);
    if (S.combat && S.combat.active) Combat.simulate(dt);

    MGame.slowT += dt;
    if (MGame.slowT >= 1) {
      MGame.slowT = 0;
      tickTasks();
      if (window.Tutorial) Tutorial.check();   /* 首启引导：每秒检查目标是否达成 */
      refreshMarket(false);
      ahTick();          /* 拍卖行：竞价与到期结算 */
      MGame.chatT++;
      if (MGame.chatT >= 12) { MGame.chatT = 0; MGame.pushChat(); MUI.dirty = true; }
      MGame.saveT++;
      if (MGame.saveT >= 15) { MGame.saveT = 0; saveGame(); }
    }
  },

  /* 由安卓原生 Activity 调用：切后台 / 回前台 */
  onPause: function () {
    MGame.hiddenAt = Date.now();
    saveGame();
  },
  onResume: function () {
    var el = (Date.now() - (MGame.hiddenAt || Date.now())) / 1000;
    MGame.last = (window.performance && performance.now) ? performance.now() : Date.now();
    if (el > 30) {
      var res = runOffline(el);
      if (res && res.sec > 60) MGame.showOffline(res);
    }
    MGame.hiddenAt = Date.now();
    MUI.dirty = true;
  },

  pushChat: function () {
    var tpl = pick(CHAT_LINES);
    var msg = tpl
      .replace('{zone}', pick(ZONE_DEFS).name)
      .replace('{item}', pick(ITEM_LIST).name)
      .replace('{skill}', pick(SKILLS).name);
    S.chat = S.chat || [];
    S.chat.unshift({ n: pick(NPC_NAMES), m: msg });
    if (S.chat.length > 30) S.chat.length = 30;
  }
};

/* ---------------- 切后台补算（手机核心体验） ---------------- */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) MGame.onPause();
  else MGame.onResume();
}, false);

window.addEventListener('pagehide', function () { saveGame(); });
window.addEventListener('beforeunload', function () { saveGame(); });

window.addEventListener('error', function (e) {
  try {
    if (window.console && console.error) console.error(e.error || e.message);
    MUI.toast('⚠ ' + (e.message || '运行错误'));
  } catch (x) { }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { MGame.boot(); });
} else {
  MGame.boot();
}
