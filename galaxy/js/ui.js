/* ============================================================
 *  星海牧场 · 界面层
 * ============================================================ */

const UI = {
  dirty: true,
  tab: 'skill',
  skill: 'milking',
  bankCat: 'all',
  bagOpen: false,

  init: function () {
    document.addEventListener('click', UI.onClick);
    document.addEventListener('change', UI.onChange);
    UI.renderTabs();
  },

  /* ---------- 路由 ---------- */
  onClick: function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act, x = el.dataset.a, y = el.dataset.b, z = el.dataset.c;
    switch (a) {
      case 'tab': UI.tab = x; UI.dirty = true; break;
      case 'skill': UI.skill = x; UI.tab = 'skill'; UI.dirty = true; break;
      case 'queue': queueAction(x, y, z === 'inf' ? -1 : parseInt(z || '1', 10)); break;
      case 'clearq': clearQueue(); break;
      case 'qdrop': S.queue.splice(parseInt(x, 10), 1); UI.dirty = true; break;
      case 'qunlock': queueUnlock(); break;
      case 'qpin': { const pi = parseInt(x, 10); if (pi > 0 && S.queue[pi]) { const mv = S.queue.splice(pi, 1)[0]; S.queue.unshift(mv); if (S.action) { S.action = null; tryStart(); } UI.dirty = true; } break; }
      case 'qup': queueMove(parseInt(x, 10), -1); break;
      case 'qdown': queueMove(parseInt(x, 10), 1); break;
      case 'combat-start':
        if (!S.combat || !S.combat.active) Combat.start(x); else Combat.stop();
        break;
      case 'combat-stop': Combat.stop(); break;
      case 'heal': Combat.healFull(); break;
      case 'bagadd': UI.bagAdd(x); break;
      case 'bagdel': UI.bagDel(x); break;
      case 'bagtoggle': UI.bagOpen = !UI.bagOpen; UI.dirty = true; break;
      case 'equip': UI.equipItem(x); break;
      case 'unequip': UI.unequip(x); break;
      case 'sell': sellItem(x, parseInt(y || '1', 10)); break;
      case 'sellall': sellItem(x, count(x)); break;
      case 'order': fillOrder(x); break;
      case 'mrefresh': refreshMarket(true); break;
      case 'task-claim': claimTask(x); break;
      case 'task-drop': dropTask(x); break;
      case 'task-reroll': rerollTask(x, y === 'bell'); break;
      case 'buy-token': buyToken(x); break;
      case 'buy-bell': buyBell(x); break;
      case 'house': houseUpgrade(x); break;
      case 'mast-spend': UI.spendMastery(x, y); break;
      case 'bankcat': UI.bankCat = x; UI.dirty = true; break;
      case 'guild-join': UI.joinGuild(x); break;
      case 'guild-leave': S.guild = null; UI.dirty = true; break;
      case 'lbcat': UI.lbCat = x; UI.dirty = true; break;
    case 'privacy': UI.showPrivacy(); break;
    case 'bu-export': {
      const t = Backup.export();
      if (!t) break;
      if (Backup.copy(t)) { if (UI.toast) UI.toast('✅ 已复制到剪贴板'); }
      else UI.buExpTxt = t;
      UI.dirty = true;
      break;
    }
    case 'bu-show': UI.buExpTxt = UI.buExpTxt ? '' : Backup.export(); UI.dirty = true; break;
    case 'bu-import': UI.showBackup(); break;
    case 'bu-snap': Backup.snapshot('手动'); UI.dirty = true; break;
    case 'bu-restore': UI.buRestoreAsk = x; UI.dirty = true; break;
    case 'bu-restore-cancel': UI.buRestoreAsk = -1; UI.dirty = true; break;
    case 'bu-restore-ok': Backup.restoreSnap(+x); UI.buRestoreAsk = -1; UI.dirty = true; break;
    case 'talent-pick': if (window.Talents) Talents.pick(x); UI.dirty = true; break;
    case 'talent-reset': if (window.Talents) Talents.reset(); UI.dirty = true; break;
    case 'tut-restart': Tutorial.restart(); break;
    case 'tut-skip': Tutorial.skipAll(); break;
    case 'tut-goto': UI.tab = x; UI.dirty = true; break;
      case 'hero': if (x && heroOf(x)) { UI.heroId = x; UI.scrollTop && UI.scrollTop(); UI.dirty = true; } break;
      case 'heroclose': UI.heroId = null; UI.dirty = true; break;
      case 'wipe': if (confirm('确定清空存档并重新开始？')) { wipeSave(); location.reload(); } break;
      case 'save': saveGame(); UI.toast('已保存'); break;
      case 'open-chest': UI.openChest(x); break;
      case 'drink': UI.drink(x); break;
    }
  },
  onChange: function (e) {
    const el = e.target;
    if (el.dataset && el.dataset.sel === 'alch') { S.alchTarget = el.value; UI.dirty = true; }
    if (el.dataset && el.dataset.sel === 'zone') { S.zoneSel = el.value; UI.dirty = true; }
  },

  healFull: null,

  /* ---------- 背包/装备操作 ---------- */
  equipItem: function (id) {
    const it = ITEMS[id];
    if (!it || it.cat !== 'equip') return;
    if (it.lvl && skillLevel(it.recipe ? it.recipe.skill : 'crafting') < it.lvl) {
      UI.toast('需要 ' + SKILL_MAP[it.recipe.skill].name + ' ' + it.lvl + ' 级才能装备');
      return;
    }
    if (count(id) <= 0 && S.equip[it.slot] !== id) { UI.toast('没有该物品'); return; }
    if (count(id) > 0) takeItems({ [id]: 1 });
    const old = S.equip[it.slot];
    if (old) addItem(old, 1);
    delete S.enhance[it.slot];
    S.equip[it.slot] = id;
    UI.dirty = true;
  },
  unequip: function (slot) {
    const id = S.equip[slot];
    if (!id) return;
    addItem(id, 1);
    delete S.equip[slot];
    delete S.enhance[slot];
    UI.dirty = true;
  },
  bagAdd: function (id) {
    if (count(id) <= 0) return;
    if (ITEMS[id].cat !== 'food') { UI.toast('只能放入食物'); return; }
    takeItems({ [id]: 1 });
    S.bag[id] = (S.bag[id] || 0) + 1;
    UI.dirty = true;
  },
  bagDel: function (id) {
    if (!S.bag[id]) return;
    S.bag[id]--;
    if (S.bag[id] <= 0) delete S.bag[id];
    addItem(id, 1);
    UI.dirty = true;
  },
  drink: function (id) {
    if (count(id) <= 0) return;
    const it = ITEMS[id];
    if (it.cat !== 'drink') return;
    takeItems({ [id]: 1 });
    addBuff({ kind: it.buff.kind, dmg: it.buff.dmg || 0, eff: it.buff.eff || 0, dur: it.buff.dur, name: it.name, icon: it.icon });
    UI.toast('饮用 ' + it.name);
  },
  spendMastery: function (skill, actId) {
    const have = S.pool[skill] || 0;
    const need = Math.min(have, Math.max(50, Math.round(MST_XP[Math.min(98, masteryLevel(skill, actId) + 1)] - (S.mastery[skill][actId] || 0))));
    if (have < 10) { UI.toast('专精池经验不足'); return; }
    const use = Math.min(have, need);
    S.pool[skill] = have - use;
    S.mastery[skill][actId] = (S.mastery[skill][actId] || 0) + use;
    UI.dirty = true;
  },
  joinGuild: function (name) {
    S.guild = name;
    S.guildJoinedAt = Date.now();
    pushLog('加入公会「' + name + '」');
    UI.dirty = true;
  },
  openChest: function (id) {
    if (count(id) <= 0) return;
    takeItems({ [id]: 1 });
    const rare = id === 'chest_rare';
    const n = rare ? 5 : 2;
    let msg = [];
    for (let i = 0; i < n; i++) {
      const pool = rare ? ['gem', 'essence', 'nova_bar', 'nova_cloth'] : ['essence', 'gem', 'cheese_bar', 'cotton_cloth'];
      const it = pick(pool);
      addItem(it, Math.round(rnd(1, rare ? 8 : 3)));
      msg.push(ITEMS[it].name);
    }
    addGold(rare ? 50000 : 5000);
    pushLog('开启 ' + ITEMS[id].name + '：' + msg.join('、') + ' 与金币');
    UI.dirty = true;
  },

  toast: function (msg) {
    const w = document.getElementById('toasts');
    if (!w) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    w.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, 1400);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1900);
  },

  /* ---------- 标签 ---------- */
  renderTabs: function () {
    const t = [
      ['skill', '技能', '🧺'], ['combat', '战斗', '⚔️'], ['equip', '装备', '🛡️'],
      ['bank', '银行', '🎒'], ['mastery', '专精', '✦'], ['market', '市场', '🏪'],
      ['task', '任务', '📜'], ['house', '牧场', '🏠'], ['social', '社交', '🌐'], ['talent', '天赋', '🌳'],
      ['stats', '统计', '📊'], ['about', '关于', 'ℹ️']
    ];
    document.getElementById('tabs').innerHTML = t.map(function (x) {
      return '<div class="tab' + (UI.tab === x[0] ? ' on' : '') + '" data-act="tab" data-a="' + x[0] + '">' + x[2] + '<span>' + x[1] + '</span></div>';
    }).join('');
  },

  /* ---------- 主渲染 ---------- */
  render: function () {
    UI.renderTabs();
    UI.renderTop();
    UI.renderSkills();
    UI.renderChar();
    UI.renderQueue();
    const p = document.getElementById('panel');
    const st = p.scrollTop;
    p.innerHTML = UI.panel();
    p.scrollTop = st;
  },

  renderTop: function () {
    const el = document.getElementById('topstats');
    el.innerHTML =
      '<div class="ts"><i>💰</i><b>' + fmt(S.gold) + '</b></div>' +
      '<div class="ts"><i>🔔</i><b>' + S.cowbell + '</b></div>' +
      '<div class="ts"><i>🎟️</i><b>' + S.tokens + '</b></div>' +
      '<div class="ts"><i>⚔️</i><b>' + combatLevel().toFixed(1) + '</b></div>' +
      '<div class="ts"><i>🎓</i><b>' + totalLevel() + '</b></div>';
  },

  renderSkills: function () {
    const el = document.getElementById('skilllist');
    let h = '';
    SKILLS.forEach(function (s) {
      let lv, info, sub = '';
      if (s.id === 'combat') {
        lv = Math.floor(combatLevel());
        info = { pct: 0 };
        sub = '战等 ' + lv;
      } else {
        info = lvlInfo(S.skills[s.id] || 0);
        lv = info.lvl;
        sub = 'Lv.' + lv;
      }
      h += '<div class="skrow' + (UI.skill === s.id && UI.tab === 'skill' ? ' on' : '') + '" data-act="skill" data-a="' + s.id + '">' +
        '<div class="skic">' + s.icon + '</div>' +
        '<div class="skmid"><div class="sknm">' + s.name + '<span>' + sub + '</span></div>' +
        '<div class="skbar"><i style="width:' + (info.pct * 100).toFixed(1) + '%"></i></div></div></div>';
    });
    el.innerHTML = h;

    const lg = document.getElementById('minilog');
    lg.innerHTML = S.log.slice(0, 8).map(function (l) {
      return '<div class="lgline">' + l.m + '</div>';
    }).join('');
  },

  renderChar: function () {
    const P = Combat.stats();
    const c = S.combat;
    const hp = c ? Math.max(0, c.hp) : P.maxHp;
    const mp = c ? Math.max(0, c.mp) : P.maxMp;
    let h = '';
    h += '<div class="ccard">';
    h += '<div class="cname">' + S.name + '<span>' + S.server + '</span></div>';
    h += '<div class="cbar"><i class="hp" style="width:' + (hp / P.maxHp * 100) + '%"></i><span>' + fmt(hp) + ' / ' + fmt(P.maxHp) + '</span></div>';
    h += '<div class="cbar"><i class="mp" style="width:' + (mp / P.maxMp * 100) + '%"></i><span>' + fmt(mp) + ' / ' + fmt(P.maxMp) + '</span></div>';
    h += '<div class="cbuffs">' + activeBuffs().map(function (b) {
      return '<span title="' + (b.name || '') + '">' + (b.icon || '✨') + '</span>';
    }).join('') + '</div>';
    h += '<div class="cstats">';
    h += '<div><span>命中</span><b>' + fmt(P.accuracy) + '</b></div><div><span>闪避</span><b>' + fmt(P.evasion) + '</b></div>';
    h += '<div><span>护甲</span><b>' + fmt(P.armor) + '</b></div><div><span>抗性</span><b>' + fmt(P.resist) + '</b></div>';
    h += '<div><span>最大伤害</span><b>' + fmt(P.maxHit) + '</b></div><div><span>攻速</span><b>' + P.interval.toFixed(2) + 's</b></div>';
    h += '</div>';
    h += '<div class="cslots">';
    SLOTS.forEach(function (sl) {
      const id = S.equip[sl.id];
      const it = id ? ITEMS[id] : null;
      const e = enhLevel(sl.id);
      h += '<div class="cslot" data-act="' + (it ? 'unequip' : '') + '" data-a="' + sl.id + '" title="' + sl.name + (it ? '：' + it.name + (e ? ' +' + e : '') : '：空') + '">' +
        (it ? it.icon : sl.ic) + (e ? '<em>+' + e + '</em>' : '') + '</div>';
    });
    h += '</div></div>';
    document.getElementById('charcard').innerHTML = h;
  },

  renderQueue: function () {
    const el = document.getElementById('queuebar');
    let h = '';
    if (S.action) {
      const a = ACTION_MAP[S.action.skill + ':' + S.action.actId];
      const pct = Math.min(1, S.action.t / S.action.dur);
      h += '<div class="qnow"><div class="qic">' + (a.icon || '⏳') + '</div>' +
        '<div class="qmid"><div>' + a.name + '</div><div class="qbar"><i id="actbar" style="width:' + (pct * 100) + '%"></i></div></div>' +
        '<div class="qtime" id="acttime">' + (S.action.dur - S.action.t).toFixed(1) + 's</div></div>';
    } else {
      h += '<div class="qnow idle">💤 空闲中 —— 在技能面板点击动作加入队列</div>';
    }
    h += '<div class="qlist">';
    S.queue.forEach(function (q, i) {
      const a = ACTION_MAP[q.skill + ':' + q.actId];
      if (!a) return;
      h += '<div class="qitem" title="点击移除">' +
        '<span data-act="qdrop" data-a="' + i + '">' + a.icon + ' ' + a.name + '</span>' +
        '<em>' + (q.n === -1 ? '∞' : '×' + q.n) + '</em></div>';
    });
    h += '</div>';
    const nx = queueNextSlot();
    h += '<div class="qcap">队列 ' + S.queue.length + ' / ' + queueSlots() + '</div>';
    if (nx) {
      let lackTxt = S.gold < nx.cost.gold ? '（金币不足）' : '';
      for (const k in nx.cost.items) {
        if (ITEMS[k] && count(k) < nx.cost.items[k]) lackTxt = '（材料不足）';
      }
      h += '<div class="qunlock" data-act="qunlock">🔓 解锁第 ' + nx.slot + ' 格 · 💰' +
        fmt(nx.cost.gold) + lackTxt + '</div>';
    }
    if (S.queue.length) h += '<div class="qclear" data-act="clearq">清空队列</div>';
    el.innerHTML = h;
  },

  frame: function () {
    if (S.action) {
      const bar = document.getElementById('actbar');
      const tt = document.getElementById('acttime');
      const pct = Math.min(1, S.action.t / S.action.dur);
      if (bar) bar.style.width = (pct * 100) + '%';
      if (tt) tt.textContent = Math.max(0, S.action.dur - S.action.t).toFixed(1) + 's';
    }
  },

  /* ---------- 面板 ---------- */
  panel: function () {
    const body = UI.panelBody();
    /* 顶部引导目标条：模块缺失时静默为空 */
    try { return ((window.Tutorial ? Tutorial.bar() : '') + body); } catch (e) { return body; }
  },
  panelBody: function () {
    switch (UI.tab) {
      case 'skill': return UI.pSkill();
      case 'combat': return UI.pCombat();
      case 'equip': return UI.pEquip();
      case 'bank': return UI.pBank();
      case 'mastery': return UI.pMastery();
      case 'market': return UI.pMarket();
      case 'task': return UI.pTask();
      case 'house': return UI.pHouse();
      case 'social': return UI.pSocial();
      case 'stats': return UI.pStats();
      case 'talent': return UI.pTalent();
      case 'about': return UI.pAbout();
    }
    return '';
  },

  /* ---------- 关于 / 美术资源致谢 ---------- */
  pAbout: function () {
    let h = '<div class="ph"><div class="phic">ℹ️</div><div class="phtxt">' +
      '<h2>关于星海牧场</h2><p>🐄 银河牧场放置养成 · 单机离线可玩</p></div></div>';
    h += '<p style="font-size:12px;line-height:1.8;margin-bottom:12px">' +
      '《星海牧场》是一款以「养殖 → 加工 → 制造 → 交易」长产业链为核心的放置养成游戏。' +
      '全部代码、数值设计与文本内容均为本项目原创撰写，未使用任何游戏引擎或第三方游戏素材。</p>';

    const rows = [
      ['界面', '全部由 CSS 手绘完成（渐变、边框与圆角），未使用任何背景贴图。'],
      ['图标', '全部为 Unicode 表情字符（Emoji），以文字形式排入界面，不含图片文件，由<b>设备系统字体</b>现场渲染；Android 设备上通常来自 <b>Noto Emoji</b> 系列。'],
      ['字体', '使用系统默认字体栈，项目内未打包任何字体文件。'],
      ['音乐', '不含持续播放的背景音乐；升级与成就时的短旋律为 CC0 授权的 jingle。'],
      ['Unicode 与 Emoji', '字符编码遵循 Unicode 标准；字形设计与版权归各自的字体项目及 Unicode 联盟所有。'],
      ['Noto Emoji', 'Google 发布，字体部分采用 SIL Open Font License 1.1，图形部分采用 CC BY 4.0 授权。'],
      ['技术栈', 'HTML + CSS + 原生 JavaScript，未接入任何统计、广告或支付 SDK。'],
      ['隐私', '游戏进度仅保存在本机浏览器，不上传、不联网，不会收集任何个人信息。']
    ];
    h += '<h3 style="font-size:13px;color:var(--gold);margin:10px 0 6px">🎨 美术资源致谢</h3>';
    h += '<div style="font-size:12px;line-height:1.9">' + rows.slice(0, 4).map(function (r) {
      return '<div><b style="color:var(--gold)">' + r[0] + '</b>：' + r[1] + '</div>';
    }).join('') + '</div>';
    h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">📜 第三方许可与声明</h3>';
    h += '<div style="font-size:12px;line-height:1.9">' + rows.slice(4).map(function (r) {
      return '<div><b style="color:var(--gold)">' + r[0] + '</b>：' + r[1] + '</div>';
    }).join('') + '</div>';
    if (typeof CREDITS !== 'undefined' && CREDITS.length) {
      h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">📦 第三方素材署名</h3>';
      h += '<div style="font-size:12px;line-height:1.8">';
      CREDITS.forEach(function (cd) {
        h += '<div style="padding:5px 0;border-bottom:1px solid #1a2138">' +
          '<div><b>' + cd.pkg + '</b> <span style="color:var(--dim)">[' + cd.lic + ']</span></div>' +
          '<div style="color:var(--dim)">' + cd.use + '</div>' +
          '<div style="color:var(--dim);font-size:11px">作者：' + cd.author + '　来源：' + cd.url + '</div>' +
          '</div>';
      });
      h += '<div style="color:var(--dim);font-size:11px;margin-top:6px">' +
        '以上素材均为 Creative Commons CC0 1.0（公有领域奉献），允许个人、教育与商业用途；' +
        '署名非强制，本项目主动列出以示尊重。完整许可原文见 media/THIRD-PARTY-LICENSES.txt。</div>';
      h += '</div>';
    }
    if (window.Tutorial) {
      const tS = Tutorial.ready();
      const stTxt = tS.skip ? '已跳过' : (tS.step >= Tutorial.steps.length ? '已全部完成' : ('进行中 ' + tS.step + '/' + Tutorial.steps.length));
      h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">🎯 新人引导</h3>';
      h += '<p style="font-size:12px">状态：' + stTxt + '　' +
        '<button class="mini" data-act="tut-restart">重来一次</button> ' +
        '<button class="mini" data-act="tut-skip">跳过</button></p>';
    }
    if (window.Backup) {
      const nm = String(S.name || '').replace(/[<>&]/g, '');
      const kB = Math.max(1, Math.round(Backup.exportSize() / 1024));
      h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">💾 存档备份</h3>';
      h += '<p style="font-size:12px;line-height:1.8">当前进度：' + nm + ' ｜ 总等级 <b style="color:var(--gold)">' +
        totalLevel() + '</b> ｜ ' + fmt(S.gold) + ' 金币（导出约 ' + kB + ' KB）<br>' +
        '<button class="mini" data-act="bu-export" style="margin-top:6px">复制到剪贴板</button> ' +
        '<button class="mini" data-act="bu-show">' + (UI.buExpTxt ? '收起文本' : '显示为文本') + '</button> ' +
        '<button class="mini" data-act="bu-import">从文本导入</button> ' +
        '<button class="mini" data-act="bu-snap">立即备份一份</button></p>';
      if (UI.buExpTxt) {
        h += '<textarea readonly style="width:100%;height:120px;background:#080d1c;color:#b8c2e0;' +
          'border:1px solid #232c50;border-radius:8px;padding:8px;font-size:11px;box-sizing:border-box;' +
          'word-break:break-all">' + String(UI.buExpTxt).replace(/</g, '&lt;') + '</textarea>';
      }
      const snaps = Backup.listSnaps();
      h += '<p style="font-size:12px;line-height:1.8;margin-top:6px">本机快照：' +
        (snaps.length ? '' : '暂无（快照保存在应用内，卸载会一并清除）') + '</p>';
      snaps.forEach(function (sp) {
        const nm2 = String(sp.nm || '').replace(/[<>&]/g, '');
        h += '<p style="font-size:12px">' + Backup.fmtDays(sp.t) + ' ｜ ' + nm2 + ' 等级' + sp.lv +
          (sp.tag ? '（' + sp.tag + '）' : '') + '　' +
          (UI.buRestoreAsk === sp.i
            ? '<button class="mini" data-act="bu-restore-ok" data-a="' + sp.i + '">确认回滚</button>' +
            '<button class="mini" data-act="bu-restore-cancel">取消</button>'
            : '<button class="mini" data-act="bu-restore" data-a="' + sp.i + '">回滚到此</button>') +
          '</p>';
      });
      h += '<p style="font-size:11px;color:var(--dim)">卸载或清除应用数据会删除全部进度，' +
        '导出文本是唯一可跨设备迁移的方式；若开启了系统云备份，进度也可能随备份保存（见隐私政策第 4 条）。</p>';
    }
    if (typeof PRIVACY !== 'undefined') {
      h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">🔒 隐私政策</h3>';
      h += '<p style="font-size:12px;line-height:1.8">v' + PRIVACY.ver + '（更新于 ' + PRIVACY.updated + '）　' +
        '<span data-act="privacy" style="cursor:pointer;color:var(--gold);text-decoration:underline">阅读完整政策</span>' +
        '<br>纯离线单机：不联网、不收集、不上传个人信息。</p>';
    }
    h += '<h3 style="font-size:13px;color:var(--gold);margin:12px 0 6px">⚖️ 原创声明</h3>';
    h += '<p style="font-size:12px;line-height:1.8">' +
      '本作的人物设定、物品名称、技能与战斗数值、任务与世界频道文本均为独立创作。' +
      '若您认为本作内容侵犯了您的合法权益，烦请通过发布页面留言与我们联系并提供权属证明，' +
      '我们会在核实后第一时间处理。</p>';
    h += '<p style="text-align:center;color:var(--dim);font-size:12px;margin-top:14px">' +
      '🌌 感谢每一位来到星海牧场的牧牛人<br>愿你的仓库堆满银河奶，强化一路 +10</p>';
    return h;
  }
};
