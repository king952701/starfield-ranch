/* ============================================================
 *  星海牧场 · 资源/道具信息面板（点击弹出）
 *
 *  触发：点击（主）/ 长按 3 秒（辅） —— 长按不再是唯一入口。
 *  识别：属性 -> 队列·动作映射 -> 文字最长名匹配，三层兜底，
 *        所有界面（背包/拍卖/技能/队列/日志…）自动生效，无需接线。
 *
 *  面板两种形态：
 *    · 自己的（持有 > 0 或正装备）：完整操作台
 *    · 不是自己的：只显示信息，不给任何操作按钮
 *
 *  操作：
 *    上架拍卖行 → 复用 skills.js 的 ahPost()（押金/校验/日志都由它负责）
 *    发送链接到聊天 → 把 [物品名] 追加进聊天输入框末尾，光标留在外面，可继续打字
 *    锁定/解锁 → S.lock[id]，锁住后禁止上架与回收（误卖保护）
 *    商人回收 N 个 → 数量可手输，复用 vendorSell()
 *    材料类 → 制作：列出 recipesUsing() 找到的配方，点一下排进工作队列
 *
 *  兼容老安卓内核：不用 pointer events / CSS Grid / 变量，带 -webkit- 前缀，ES5。
 *  注意：本模块不使用 data-act，避免被 ui.js / ui-m.js 的全局委托误抓。
 * ============================================================ */
(function () {
  'use strict';

  var HOLD = 3000;     /* 长按 3 秒（辅助触发） */
  var LIFE = 10000;    /* 10 秒无操作后渐隐消失 */
  var FADE = 500;

  var CSS = [
    '.ii-card{position:fixed;z-index:820;width:262px;padding:10px 12px 12px;border-radius:12px;',
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
    '  -webkit-align-items:center;align-items:center;padding-right:28px;}',
    '.ii-ic{font-size:26px;-webkit-flex:0 0 auto;flex:0 0 auto;margin-right:8px;}',
    '.ii-nm{font-size:14px;font-weight:700;color:#111731;}',
    '.ii-sub{font-size:10px;color:#5b6782;}',
    '.ii-rw{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:4px;font-size:11px;}',
    '.ii-k{width:46px;-webkit-flex:0 0 auto;flex:0 0 auto;color:#5b6782;}',
    '.ii-v{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;color:#1b2138;',
    '  word-break:break-all;}',
    '.ii-hr{height:1px;background:#aab5c9;margin:8px 0 6px;}',
    '.ii-btns{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;',
    '  flex-wrap:wrap;}',
    '.ii-b{border:1px solid #6b7794;background:#e7ecf4;color:#1b2138;border-radius:7px;',
    '  font-size:11px;padding:5px 8px;margin:3px 4px 0 0;cursor:pointer;}',
    '.ii-b:active{background:#cdd6e6;}',
    '.ii-b.gold{border-color:#b98b2a;background:#2a3558;color:#f2c14e;}',
    '.ii-b.red{border-color:#b8352b;background:#e0483c;color:#fff;}',
    '.ii-sell{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;',
    '  -webkit-align-items:center;align-items:center;margin-top:5px;}',
    '.ii-n{border:1px solid #6b7794;background:#fff;color:#1b2138;border-radius:6px;',
    '  width:66px;height:26px;padding:0 6px;font-size:16px;margin-right:5px;outline:none;}',
    '.ii-note{font-size:10px;color:#5b6782;margin-top:6px;}',
    '.ii-dim{font-size:11px;color:#5b6782;margin-top:6px;}'
  ].join('');
  var stl = document.createElement('style');
  stl.appendChild(document.createTextNode(CSS));
  document.head.appendChild(stl);

  /* ---------- 工具 ---------- */
  function winW() { return window.innerWidth || document.documentElement.clientWidth || 320; }
  function winH() { return window.innerHeight || document.documentElement.clientHeight || 480; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.appendChild(document.createTextNode(String(txt)));
    return n;
  }
  /* core.js 里 fmt 是函数声明，会挂在 window 上 */
  function num(v) { return (typeof window.fmt === 'function') ? window.fmt(v) : String(v); }
  function toast(m) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(m); }
  function owned(id) {
    /* ponytail: 背包是 S.bank（core.js 的 count() 读的就是它），不是 S.bag（那是战斗背包） */
    if (typeof S === 'undefined' || !S) return 0;
    if (typeof count === 'function') return count(id) || 0;
    return (S.bank && S.bank[id]) || 0;
  }
  function equipped(id) {
    if (typeof S === 'undefined' || !S || !S.equip) return false;
    for (var s in S.equip) if (S.equip[s] === id) return true;
    return false;
  }
  function locked(id) {
    return (typeof S !== 'undefined' && S && S.lock && S.lock[id]) ? true : false;
  }
  function lockToggle(id) {
    if (typeof S === 'undefined' || !S) return false;
    if (!S.lock) S.lock = {};          /* 老存档没有这个字段 */
    if (S.lock[id]) delete S.lock[id]; else S.lock[id] = 1;
    if (typeof saveGame === 'function') saveGame();
    return locked(id);
  }
  function save() { if (typeof saveGame === 'function') saveGame(); }

  /* ---------- 数据索引 ---------- */
  var NAMES = [], SRC = {}, NAME2ID = {};
  function buildIndex() {
    NAMES = []; SRC = {}; NAME2ID = {};
    if (typeof ITEM_LIST === 'undefined') return;
    var arr = ITEM_LIST.slice();
    arr.sort(function (a, b) { return (b.name || '').length - (a.name || '').length; });
    for (var i = 0; i < arr.length; i++) {
      if (!arr[i] || !arr[i].name) continue;
      NAMES.push(arr[i]);
      NAME2ID[arr[i].name] = arr[i].id;
    }
    if (typeof ACTION_MAP === 'undefined') return;
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
  function byName(n) { return NAME2ID[n] || null; }

  var CAT = { mat: '材料', food: '食物', drink: '饮品', equip: '装备', tool: '工具' };

  /* 材料能参与的制作配方 */
  function recipesOf(id) {
    if (typeof recipesUsing !== 'function') return [];
    var rs = recipesUsing(id) || [], out = [];
    for (var i = 0; i < rs.length && out.length < 3; i++) {
      var a = rs[i] && rs[i].act;
      if (!a) continue;
      var pid = null;
      if (a.out) for (var k in a.out) { pid = k; break; }
      if (!pid) continue;
      out.push({
        skill: rs[i].skill, actId: a.id,
        need: (a.in && a.in[id]) || 0,
        makes: pid,
        name: (typeof ITEMS !== 'undefined' && ITEMS[pid]) ? ITEMS[pid].name : pid
      });
    }
    return out;
  }

  /* ---------- DOM 反查道具 id ---------- */
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
    for (var i = 0; i < NAMES.length; i++) if (t.indexOf(NAMES[i].name) >= 0) return NAMES[i].id;
    return null;
  }
  function actionOut(n, key) {
    var a = ACTION_MAP[key];
    if (!a) return null;
    if (a.out) for (var o in a.out) return o;
    if (a.rare) for (var r in a.rare) return r;
    return null;
  }
  function actionItem(n) {
    if (!n || !n.getAttribute || typeof ACTION_MAP === 'undefined') return null;
    var s = n.getAttribute('data-a'), b = n.getAttribute('data-b');
    if (!s || !b) return null;
    return actionOut(n, s + ':' + b);
  }
  function queueItem(n) {
    if (!n || typeof S === 'undefined' || !S.queue || typeof ACTION_MAP === 'undefined') return null;
    var cls = n.className ? String(n.className) : '';
    if (cls.indexOf('qrow') < 0 && cls.indexOf('qitem') < 0) return null;
    var p = n.parentNode, idx = -1, c = 0;
    if (!p || !p.children) return null;
    for (var i = 0; i < p.children.length; i++) {
      if (p.children[i] === n) { idx = c; break; }
      var cc = p.children[i].className ? String(p.children[i].className) : '';
      if (cc.indexOf('qrow') >= 0 || cc.indexOf('qitem') >= 0) c++;
    }
    var q = S.queue[idx];
    if (!q) return null;
    return actionOut(n, q.skill + ':' + q.actId);
  }
  function runningItem(n) {
    if (!n || typeof S === 'undefined' || !S.action || typeof ACTION_MAP === 'undefined') return null;
    var cls = n.className ? String(n.className) : '';
    if (cls.indexOf('mq-row') < 0 && cls.indexOf('qnow') < 0) return null;
    return actionOut(n, S.action.skill + ':' + S.action.actId);
  }
  function resolve(node) {
    var n = node, i;
    for (i = 0; n && i < 5; i++) {
      if (n.nodeName === 'INPUT' || n.nodeName === 'TEXTAREA' || n.nodeName === 'SELECT') return null;
      /* 不在其它悬浮模块自己的界面上乱弹（聊天里的链接走显式调用，不经过这里） */
      if (n.className && /chat-|ent-|rs-bar|ii-card/.test(String(n.className))) return null;
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
  var card = null, lifeT = 0, killT = 0, curId = null;

  function kill() {
    if (!card) return;
    var c = card; card = null;
    clearTimeout(lifeT); clearTimeout(killT);
    c.className = 'ii-card out';
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, FADE + 60);
  }
  /* ponytail: 有操作按钮/输入框时，10 秒自动隐藏会很碍手。
     折中：只要卡内有任何交互（点击/触摸/输入），就重新计时，只在真正闲置时淡出。 */
  function tick() {
    clearTimeout(lifeT); clearTimeout(killT);
    lifeT = setTimeout(function () {
      if (!card) return;
      card.className = 'ii-card out';
      killT = setTimeout(function () { if (card && card.parentNode) card.parentNode.removeChild(card); card = null; }, FADE + 60);
    }, LIFE);
  }

  function mkBtn(label, cls, fn) {
    var b = el('div', 'ii-b' + (cls ? ' ' + cls : ''), label);
    b.addEventListener('click', function (e) {
      if (e.stopPropagation) e.stopPropagation();
      tick(); fn();
    }, false);
    b.addEventListener('touchstart', function (e) { if (e.stopPropagation) e.stopPropagation(); tick(); }, false);
    return b;
  }
  function row(k, v) {
    var r = el('div', 'ii-rw');
    r.appendChild(el('div', 'ii-k', k));
    r.appendChild(el('div', 'ii-v', v));
    return r;
  }

  /* ---------- 具体操作 ---------- */
  function doAH(id) {
    if (locked(id)) { toast('已锁定，先解锁再上架'); return; }
    if (typeof ahPost !== 'function') { toast('拍卖行暂不可用'); return; }
    var it = ITEMS[id];
    var ok = ahPost(id, 1, Math.max(1, Math.round(it.price * 0.8)), Math.round(it.price * 1.5), 'short');
    if (ok) { toast('已上架 1 个「' + it.name + '」'); save(); show(id); }
  }
  function doVendor(id, nRaw) {
    if (locked(id)) { toast('已锁定，先解锁再回收'); return; }
    if (typeof vendorSell !== 'function') { toast('商人暂不可用'); return; }
    var have = owned(id);
    var n = Math.min(Math.round(nRaw || 0) || 0, have);
    if (n <= 0) { toast(have > 0 ? '请输入 1~' + have + ' 之间的数量' : '没有可回收的数量'); return; }
    var g = vendorSell(id, n);
    toast('已回收 ' + n + ' 个，+' + num(g || 0) + ' 金币');
    save(); show(id);
  }
  function doLock(id) {
    var on = lockToggle(id);
    toast(on ? '已锁定「' + ITEMS[id].name + '」（不可上架/回收）' : '已解锁「' + ITEMS[id].name + '」');
    show(id);
  }
  /* 发送链接到聊天：追加到输入框末尾，光标留在外面，用户可继续打字 */
  function doLink(id) {
    var it = ITEMS[id];
    var token = '[' + it.name + ']';
    var inp = document.querySelector ? document.querySelector('.chat-in') : null;
    if (!inp) { toast('聊天面板尚未加载'); return; }
    inp.value = (inp.value || '') + token;
    try {
      inp.focus();
      if (inp.setSelectionRange) inp.setSelectionRange(inp.value.length, inp.value.length);
    } catch (e) { }
    /* 面板没开就顺手打开，保证看得见自己发出去的东西 */
    var pan = document.querySelector ? document.querySelector('.chat-pan') : null;
    if (pan && pan.style.display === 'none') {
      var btn = document.querySelector ? document.querySelector('.chat-btn') : null;
      if (btn && btn.click) btn.click();
    }
    toast('已插入聊天：' + token + '（可继续输入）');
    tick();
  }
  function doCraft(r, name) {
    if (typeof queueAction !== 'function') { toast('队列暂不可用'); return; }
    queueAction(r.skill, r.actId, 1);
    toast('已排入队列：' + name);
    save();
  }

  /* ---------- 渲染 ---------- */
  function show(id, x, y) {
    if (typeof ITEMS === 'undefined' || !ITEMS[id]) return;
    buildIndex();
    var it = ITEMS[id];
    var have = owned(id), isEq = equipped(id), mine = have > 0 || isEq;
    var old = card ? { x: parseFloat(card.style.left), y: parseFloat(card.style.top) } : null;
    if (card && card.parentNode) card.parentNode.removeChild(card);
    clearTimeout(lifeT); clearTimeout(killT);
    card = null; curId = id;

    var c = el('div', 'ii-card');
    var xb = el('div', 'ii-x', '✕');
    xb.addEventListener('click', function (e) { if (e.stopPropagation) e.stopPropagation(); kill(); }, false);
    c.appendChild(xb);

    var hd = el('div', 'ii-hd');
    hd.appendChild(el('div', 'ii-ic', it.icon || '📦'));
    var hb = el('div');
    hb.appendChild(el('div', 'ii-nm', it.name + (locked(id) ? ' 🔒' : '')));
    var qual = '';
    if (typeof qualityOf === 'function' && typeof qualityName === 'function') qual = ' ｜ ' + qualityName(qualityOf(id));
    hb.appendChild(el('div', 'ii-sub', (CAT[it.cat] || '材料') + qual + (isEq ? ' ｜ 装备中' : '')));
    hd.appendChild(hb);
    c.appendChild(hd);
    c.appendChild(el('div', 'ii-hr'));

    c.appendChild(row('类别', CAT[it.cat] || '材料'));
    if (it.tier != null) c.appendChild(row('品阶', '第 ' + (it.tier + 1) + ' 阶'));
    c.appendChild(row('基准价', num(it.price) + ' 金币'));
    if (typeof buyback === 'function') c.appendChild(row('商人回购', num(buyback(id)) + ' / 个'));
    c.appendChild(row('持有', String(have) + (isEq ? '（装备中）' : '')));
    if (it.heal) c.appendChild(row('食用', '生命 +' + num(it.heal) + (it.mana ? ' ｜ 内力 +' + num(it.mana) : '')));
    if (it.buff) {
      c.appendChild(row('饮用', (it.buff.kind === 'combat' ? '战斗伤害 +' : '采集效率 +') +
        Math.round((it.buff.dmg || it.buff.eff || 0) * 100) + '% ｜ ' + Math.round(it.buff.dur) + ' 秒'));
    }
    if (it.cat === 'equip' && it.st) {
      var sg = [];
      for (var sk in it.st) sg.push(sk + ' ' + num(it.st[sk]));
      if (sg.length) c.appendChild(row('属性', sg.join(' ｜ ')));
    }
    if (SRC[id] && SRC[id].length) c.appendChild(row('产出途径', SRC[id].join('、')));

    /* ---- 操作区：只有自己的东西才给按钮 ---- */
    if (!mine) {
      c.appendChild(el('div', 'ii-hr'));
      c.appendChild(el('div', 'ii-dim', '未持有该' + (CAT[it.cat] || '道具') + ' —— 仅查看信息'));
    } else {
      c.appendChild(el('div', 'ii-hr'));
      var bs = el('div', 'ii-btns');
      bs.appendChild(mkBtn('🏷 上架拍卖行', 'gold', function () { doAH(id); }));
      bs.appendChild(mkBtn('💬 发送到聊天', '', function () { doLink(id); }));
      bs.appendChild(mkBtn(locked(id) ? '🔒 解锁' : '🔓 锁定', locked(id) ? 'gold' : '', function () { doLock(id); }));
      /* 材料类才给「制作」 */
      if (it.cat === 'mat') {
        var rs = recipesOf(id);
        if (rs.length) {
          for (var i = 0; i < rs.length; i++) {
            (function (r) {
              bs.appendChild(mkBtn('🛠 制作' + r.name + '（需' + r.need + '）', '', function () {
                doCraft(r, r.name);
              }));
            })(rs[i]);
          }
        }
      }
      c.appendChild(bs);

      /* 商人回收：数量手输 */
      var sl = el('div', 'ii-sell');
      var inp = document.createElement('input');
      inp.className = 'ii-n';
      inp.type = 'number';
      inp.setAttribute('min', '1');
      inp.setAttribute('max', String(have));
      inp.value = String(have);
      inp.addEventListener('click', function (e) { if (e.stopPropagation) e.stopPropagation(); tick(); }, false);
      inp.addEventListener('keydown', function (e) { if (e.stopPropagation) e.stopPropagation(); tick(); }, false);
      inp.addEventListener('touchstart', function (e) { if (e.stopPropagation) e.stopPropagation(); tick(); }, false);
      sl.appendChild(inp);
      sl.appendChild(mkBtn('商人回收', 'red', function () { doVendor(id, parseFloat(inp.value)); }));
      c.appendChild(sl);
      c.appendChild(el('div', 'ii-note', '最多 ' + have + ' 个' +
        (locked(id) ? ' ｜ 已锁定，回收/上架已停用' : ' ｜ 闲置 10 秒自动淡出')));
    }

    document.body.appendChild(c);
    card = c;
    var h = c.offsetHeight || 220;
    var px = (x != null) ? x : (old ? old.x + 10 : winW() / 2);
    var py = (y != null) ? y : (old ? old.y : winH() / 2);
    c.style.left = clamp(px - 100, 8, Math.max(8, winW() - 274)) + 'px';
    c.style.top = clamp(py + 14, 8, Math.max(8, winH() - h - 8)) + 'px';
    tick();
    return true;
  }

  /* ---------- 输入 ---------- */
  var lpT = 0, lpX = 0, lpY = 0, lpFired = false, lpId = null;

  function lpStart(node, x, y) {
    lpId = resolve(node);
    if (!lpId) return;
    lpX = x; lpY = y; lpFired = false;
    clearTimeout(lpT);
    lpT = setTimeout(function () { lpT = 0; lpFired = true; show(lpId, lpX, lpY); }, HOLD);
  }
  function lpMove(x, y) {
    if (!lpT) return;
    if (Math.abs(x - lpX) > 10 || Math.abs(y - lpY) > 10) { clearTimeout(lpT); lpT = 0; }
  }
  function lpEnd() {
    clearTimeout(lpT); lpT = 0;
    if (lpFired) setTimeout(function () { lpFired = false; }, 400);
  }

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
  document.addEventListener('mousedown', function (e) {
    if (e.button != null && e.button !== 0) return;
    lpStart(e.target, e.clientX, e.clientY);
  }, false);
  document.addEventListener('mousemove', function (e) { lpMove(e.clientX, e.clientY); }, false);
  document.addEventListener('mouseup', lpEnd, false);

  /* 点击弹出（主入口）：带 data-act 的按钮交给原有逻辑，不抢它的活 */
  document.addEventListener('click', function (e) {
    if (lpFired) { lpFired = false; if (e.stopPropagation) e.stopPropagation(); if (e.preventDefault) e.preventDefault(); return; }
    var id = resolve(e.target);
    if (!id) return;
    if (hasAct(e.target)) return;
    show(id, e.clientX || 0, e.clientY || 0);
  }, false);

  document.addEventListener('contextmenu', function (e) {
    if (lpFired && e.preventDefault) e.preventDefault();
  }, false);

  buildIndex();

  /* 给聊天模块用：点击消息里的 [物品链接] 时显式拉起面板 */
  window.ItemInfo = {
    show: function (id) { return show(id); },
    idOfName: byName,
    close: kill
  };
})();
