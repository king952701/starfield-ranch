/* ============================================================
 *  星海牧场 · 启动与主循环
 * ============================================================ */

Combat.healFull = function () {
  const P = Combat.stats();
  if (!S.combat) return;
  S.combat.hp = P.maxHp;
  S.combat.mp = P.maxMp;
  UI.dirty = true;
};

const Game = {
  last: 0, acc: 0, chatT: 0, saveT: 0, slowT: 0,

  boot: function () {
    UI.init();
    const loaded = loadGame();
    if (!loaded) { Game.showStart(); return; }
    /* 离线结算 */
    const elapsed = (Date.now() - (S.savedAt || Date.now())) / 1000;
    const res = runOffline(elapsed);
    Game.startLoop();
    if (res && res.sec > 60) Game.showOffline(res);
  },

  showStart: function () {
    const w = document.getElementById('modalwrap');
    w.style.display = 'flex';
    w.innerHTML = '<div class="modal start">' +
      '<h1>🐄 星海牧场 · 银河放置传说</h1>' +
      '<p class="sub">原创银河牧场模拟 · 长产业链 × 专精养成</p>' +
      '<div class="frow"><label>角色名</label><input id="pname" maxlength="10" value="牧牛人"></div>' +
      '<div class="frow"><label>服务器</label><select id="pserver">' +
      ['星海一区', '星海二区', '银河新区', '沐莓小镇'].map(function (s) { return '<option>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="tips">玩法：左侧选技能 → 点击动作加入队列 → 离线也会继续生产。<br>战斗可获得材料与装备，用「炼金」与「强化」放大收益。</div>' +
      '<button class="big" id="btnstart">进入星海</button></div>';
    document.getElementById('btnstart').onclick = function () {
      const n = document.getElementById('pname').value.trim() || '牧牛人';
      S.server = document.getElementById('pserver').value;
      newGame(n);
      w.style.display = 'none';
      Game.startLoop();
      UI.dirty = true;
    };
  },

  showOffline: function (res) {
    const w = document.getElementById('modalwrap');
    w.style.display = 'flex';
    let h = '<div class="modal">' +
      '<h2>🌙 离线结算</h2>' +
      '<p class="sub">你离开了 ' + fmtTime(res.sec) + '（上限 ' + bonuses().offline + ' 小时）</p>' +
      '<div class="offgrid">' +
      '<div><span>完成动作</span><b>' + fmt(res.acts) + '</b></div>' +
      '<div><span>获得金币</span><b>' + fmt(res.gold) + '</b></div>' +
      (res.combat ? '<div><span>击杀怪物</span><b>' + fmt(res.kills) + '</b></div>' : '') +
      '</div>';

    if (res.items && res.items.length) {
      h += '<div style="font-size:12px;color:var(--gold);margin:12px 0 5px">🧺 获得的物资' +
        (res.itemKinds > res.items.length
          ? '<span style="color:var(--dim);font-size:10px"> 共 ' + res.itemKinds + ' 种，显示价值最高的 ' + res.items.length + ' 件</span>' : '') +
        '</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      res.items.forEach(function (it) {
        h += '<div style="width:48%;display:flex;align-items:center;gap:6px;padding:4px;background:#0e1428;border:1px solid #232c50;border-radius:8px;box-sizing:border-box">' +
          '<span style="font-size:16px">' + it.icon + '</span>' +
          '<b style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + it.name + '</b>' +
          '<span style="color:#6ddc9c;font-size:11px">×' + fmt(it.n) + '</span></div>';
      });
      h += '</div>';
    }

    if (res.lvups && res.lvups.length) {
      h += '<div style="font-size:12px;color:var(--gold);margin:12px 0 5px">⬆️ 技能升级</div>';
      res.lvups.forEach(function (L) {
        const sk = SKILL_MAP[L.id];
        h += '<div style="display:flex;align-items:center;font-size:12px;padding:2px 0">' +
          '<span style="flex:1">' + (sk ? sk.icon + ' ' + sk.name : L.id) + '</span>' +
          '<span style="color:var(--dim)">' + L.from + '</span>' +
          '<span style="color:var(--dim);margin:0 4px">→</span>' +
          '<b style="color:#6ddc9c">' + L.to + '</b></div>';
      });
    } else {
      const top = [];
      for (const k in (res.xp || {})) top.push({ id: k, v: res.xp[k] });
      top.sort(function (a, b) { return b.v - a.v; });
      if (top.length) {
        h += '<div style="font-size:12px;color:var(--gold);margin:12px 0 5px">📈 累计经验</div>';
        top.slice(0, 3).forEach(function (t) {
          const s2 = SKILL_MAP[t.id];
          h += '<div style="display:flex;font-size:12px;padding:2px 0">' +
            '<span style="flex:1">' + (s2 ? s2.icon + ' ' + s2.name : t.id) + '</span>' +
            '<b style="color:#6ddc9c">+' + fmt(t.v) + '</b></div>';
        });
      }
    }

    h += '<button class="big" id="btnok">继续冒险</button></div>';
    w.innerHTML = h;
    document.getElementById('btnok').onclick = function () { w.style.display = 'none'; };
  },

  startLoop: function () {
    S.chat = S.chat || [];
    Game.last = performance.now();
    requestAnimationFrame(Game.loop);
  },

  loop: function (now) {
    let dt = (now - Game.last) / 1000;
    Game.last = now;
    if (dt > 1) dt = 1;
    Game.step(dt);
    UI.frame();
    if (UI.dirty) { UI.dirty = false; UI.render(); }
    requestAnimationFrame(Game.loop);
  },

  step: function (dt) {
    tickAction(dt);
    if (S.combat && S.combat.active) Combat.simulate(dt);

    Game.slowT += dt;
    if (Game.slowT >= 1) {
      Game.slowT = 0;
      tickTasks();
      refreshMarket(false);
      Game.chatT++;
      if (Game.chatT >= 12) {
        Game.chatT = 0;
        Game.pushChat();
        UI.dirty = true;
      }
      Game.saveT++;
      if (Game.saveT >= 10) { Game.saveT = 0; saveGame(); }
    }
  },

  pushChat: function () {
    const tpl = pick(CHAT_LINES);
    const zone = pick(ZONE_DEFS).name;
    const item = pick(ITEM_LIST).name;
    const skill = pick(SKILLS).name;
    const msg = tpl.replace('{zone}', zone).replace('{item}', item).replace('{skill}', skill);
    S.chat = S.chat || [];
    S.chat.unshift({ n: pick(NPC_NAMES), m: msg });
    if (S.chat.length > 30) S.chat.length = 30;
  }
};

window.addEventListener('error', function (e) {
  try { console.error(e.error || e.message); UI.toast('⚠ ' + (e.message || '运行错误')); } catch (x) { }
});

window.addEventListener('beforeunload', function () { saveGame(); });
document.addEventListener('visibilitychange', function () { if (document.hidden) saveGame(); });
window.addEventListener('DOMContentLoaded', function () { Game.boot(); });
