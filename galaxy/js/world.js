/* ============================================================
 *  离线世界 · 其他牧牛人
 *
 *  本作为单机离线玩法，服务器上的其他玩家由本地模拟生成。
 *  核心要求：同一个 NPC 的数据必须随时查看都一致 ——
 *  否则榜上看到的名次和点进去看到的能力会对不上。
 *  因此全部数据由固定种子推导，构建一次后缓存。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 确定性伪随机 ---------- */
  function hash32(x) {
    x = x | 0;
    x = (x ^ 61) ^ (x >>> 16);
    x = x + (x << 3);
    x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d);
    x = x ^ (x >>> 15);
    return x >>> 0;
  }
  function rnd(seed, salt) {
    return hash32(Math.imul(seed, 2654435761) ^ Math.imul(salt, 40503)) / 4294967296;
  }
  function pickOne(arr, r) {
    if (!arr || !arr.length) return null;
    var i = Math.floor(r * arr.length) % arr.length;
    return arr[i] || arr[0];
  }

  /* ---------- 人设：决定 NPC 的技能倾向 ---------- */
  var ARCH = [
    { nm: '均衡发展', w: {} },
    { nm: '采集达人', w: { milking: 1.5, foraging: 1.5, woodcutting: 1.5 } },
    { nm: '工艺大师', w: { cheesesmithing: 1.5, crafting: 1.5, tailoring: 1.5 } },
    { nm: '星海厨神', w: { cooking: 1.9, brewing: 1.9 } },
    { nm: '秘术之徒', w: { alchemy: 1.9, enhancing: 1.9 } },
    { nm: '无畏战士', w: { combat: 1.7 } },
    { nm: '后勤管家', w: { cooking: 1.3, foraging: 1.2, alchemy: 1.2 } },
    { nm: '急速射手', w: { combat: 1.4, tailoring: 1.2 } }
  ];

  /* ---------- 装备池索引：[slot][tier] -> [item] ---------- */
  var POOL = null;
  function pool() {
    if (POOL) return POOL;
    POOL = {};
    var L = (typeof ITEM_LIST !== 'undefined') ? ITEM_LIST : [];
    for (var i = 0; i < L.length; i++) {
      var it = L[i];
      if (it.cat !== 'equip' || !it.slot) continue;
      var t = (it.tier == null ? 0 : it.tier);
      if (!POOL[it.slot]) POOL[it.slot] = {};
      if (!POOL[it.slot][t]) POOL[it.slot][t] = [];
      POOL[it.slot][t].push(it);
    }
    return POOL;
  }

  /* 按 slot + 目标 tier 挑一件；prefer 用于锁定同一条装备线，保持外观统一 */
  function pick(slot, tier, seed, salt, prefer) {
    var P = pool()[slot];
    if (!P) return null;
    var cand = null, t;
    /* 先从目标档往下找最近的，找不到再往上找 */
    for (t = tier; t >= 0 && !cand; t--) {
      if (P[t] && P[t].length) cand = P[t];
    }
    if (!cand) {
      for (t = tier + 1; t <= 8 && !cand; t++) {
        if (P[t] && P[t].length) cand = P[t];
      }
    }
    if (!cand) return null;
    if (prefer) {
      var f = [];
      for (var k = 0; k < cand.length; k++) {
        if (cand[k].line === prefer || cand[k].toolSkill === prefer) f.push(cand[k]);
      }
      if (f.length) cand = f;   /* 过滤失败就用原池，绝不返回空 */
    }
    return pickOne(cand, rnd(seed, salt));
  }

  var TOOL_SKILLS = ['milking', 'foraging', 'woodcutting', 'cheesesmithing', 'crafting', 'tailoring', 'cooking', 'brewing'];

  /* ---------- 生成一名 NPC ----------
   * 强度按名次线性铺开，底部留你说的"新手同期弱对手"，
   * 否则新手打开榜单会发现九个榜全部垫底，毫无爬升感。
   */
  function buildNpc(i, n) {
    var base = (n > 1) ? (i / (n - 1)) : 1;
    var pw = 0.01 + base * 0.93 + (rnd(i, 101) - 0.5) * 0.06;
    pw = Math.max(0.01, Math.min(0.99, pw));
    var arch = ARCH[i % ARCH.length];

    /* 技能等级 —— 上限 99，与 core.js 的 LVL_XP 表一致 */
    var CAP = 99;
    var sk = {}, k, s;
    for (k = 0; k < SKILLS.length; k++) {
      s = SKILLS[k];
      var w = (arch.w && arch.w[s.id]) || 1;
      var spread = 0.62 + rnd(i, 200 + k) * 0.85;
      sk[s.id] = Math.max(1, Math.min(CAP, Math.round(1 + pw * (CAP - 1) * w * spread * 0.82)));
    }

    /* 战斗素养（7 项） */
    var SUB7 = ['stamina', 'intelligence', 'attack', 'defense', 'melee', 'ranged', 'magic'];
    var subs = {};
    for (k = 0; k < SUB7.length; k++) {
      subs[SUB7[k]] = Math.max(1, Math.min(CAP, Math.round(1 + pw * (CAP - 1) * (0.55 + rnd(i, 310 + k) * 0.95))));
    }
    /* 战斗等级必须与 core.js 的 combatLevel() 同口径：
     * 0.1 ×（体力+智力+攻击+防御+五项最高）+ 0.5 × 五项最高 */
    var max5 = Math.max(subs.attack, subs.defense, subs.melee, subs.ranged, subs.magic);
    var combatLv = 0.1 * (subs.stamina + subs.intelligence + subs.attack + subs.defense + max5) + 0.5 * max5;

    /* 总等级：与 core.js 的 totalLevel() 口径一致（非战斗技能之和 + 战斗等级） */
    var lvTotal = combatLv;
    for (k = 0; k < SKILLS.length; k++) {
      if (SKILLS[k].id !== 'combat') lvTotal += sk[SKILLS[k].id];
    }

    /* 装备：风格统一（同一条护甲线 + 匹配的武器线） */
    var styles = ['plate', 'ranged', 'magic'];
    var style = styles[Math.floor(rnd(i, 401) * 3) % 3];
    var wepLine = style === 'plate' ? 'sword' : (style === 'ranged' ? 'bow' : 'fire_staff');
    var make = Math.max(sk.cheesesmithing || 1, sk.tailoring || 1, sk.crafting || 1);
    var armorT = Math.max(0, Math.min(6, Math.floor(make / 16)));
    var jewelT = Math.max(0, Math.min(6, Math.floor((sk.crafting || 1) / 16)));
    var enhSkill = Math.max(1, sk.enhancing || 1);

    /* 工具：取其最强的生产技能对应的那把 */
    var bestT = null, bestV = -1;
    for (k = 0; k < TOOL_SKILLS.length; k++) {
      var tv = sk[TOOL_SKILLS[k]] || 0;
      if (tv > bestV) { bestV = tv; bestT = TOOL_SKILLS[k]; }
    }

    var equip = {}, enh = {};
    for (k = 0; k < SLOTS.length; k++) {
      var slId = SLOTS[k].id, item = null;
      if (slId === 'tool') {
        item = pick('tool', Math.max(0, Math.min(6, Math.floor(bestV / 15))), i, 500 + k, bestT);
      } else if (slId === 'weapon') {
        item = pick('weapon', armorT, i, 600 + k, wepLine);
      } else if (slId === 'ring' || slId === 'neck') {
        item = pick(slId, jewelT, i, 700 + k, 'jewel');
      } else if (slId === 'cape' || slId === 'offhand') {
        /* 披风与副手是稀罕件，只有中后期玩家才戴 */
        if (rnd(i, 800 + k) < 0.32 + pw * 0.45) item = pick(slId, armorT, i, 900 + k, null);
      } else {
        item = pick(slId, armorT, i, 1000 + k, style);
      }
      if (item) {
        equip[slId] = item.id;
        enh[slId] = Math.floor(rnd(i, 1100 + k) * Math.min(10, enhSkill / 9));
      }
    }

    var guilds = (typeof GUILD_NAMES !== 'undefined') ? GUILD_NAMES : [];
    return {
      id: 'npc' + i,
      name: NPC_NAMES[i % NPC_NAMES.length],
      title: arch.nm,
      guild: guilds.length ? guilds[Math.floor(rnd(i, 1501) * guilds.length) % guilds.length] : '',
      pw: pw,
      skills: sk,
      subs: subs,
      combatLv: combatLv,
      lvTotal: lvTotal,
      gold: Math.round((600 + pw * pw * 3800000) * (0.5 + rnd(i, 1201))),
      mastery: Math.round(pw * pw * 1500 * (0.4 + rnd(i, 1301) * 1.2)),
      ach: Math.round(pw * 190 * (0.5 + rnd(i, 1401))),
      equip: equip,
      enh: enh,
      online: rnd(i, 1601) < 0.45,
      days: 1 + Math.floor(rnd(i, 1701) * 400)
    };
  }

  /* ---------- 世界缓存 ---------- */
  var World = {
    list: null,
    ready: function () {
      if (World.list) return World.list;
      World.list = [];
      var n = Math.min(14, (typeof NPC_NAMES !== 'undefined') ? NPC_NAMES.length : 14);
      for (var i = 0; i < n; i++) World.list.push(buildNpc(i, n));
      return World.list;
    },
    get: function (id) {
      var L = World.ready();
      for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
      return null;
    }
  };

  /* ---------- 排行榜类别 ----------
   * 每类的取值口径对玩家和 NPC 必须一致，否则榜单没有意义。
   */
  var CATS = [
    { id: 'total', nm: '总等级', ic: '🏅', un: '', desc: '全部生活技能等级之和 + 战斗等级',
      p: function () { return totalLevel(); }, n: function (o) { return o.lvTotal; } },
    { id: 'combat', nm: '战斗力', ic: '⚔️', un: '', desc: '战斗素养主导的战力评分',
      p: function () { return combatLevel(); }, n: function (o) { return o.combatLv; } },
    { id: 'gold', nm: '财富', ic: '💰', un: '金', desc: '当前持有金币',
      p: function () { return Math.floor(S.gold || 0); }, n: function (o) { return o.gold; } },
    { id: 'gather', nm: '采集', ic: '🧺', un: '', desc: '挤奶 + 觅食 + 伐木',
      p: function () { return skillLevel('milking') + skillLevel('foraging') + skillLevel('woodcutting'); },
      n: function (o) { return o.skills.milking + o.skills.foraging + o.skills.woodcutting; } },
    { id: 'artisan', nm: '工匠', ic: '🔨', un: '', desc: '奶酪锻造 + 手工艺 + 裁缝',
      p: function () { return skillLevel('cheesesmithing') + skillLevel('crafting') + skillLevel('tailoring'); },
      n: function (o) { return o.skills.cheesesmithing + o.skills.crafting + o.skills.tailoring; } },
    { id: 'culinary', nm: '厨艺', ic: '🍳', un: '', desc: '烹饪 + 酿造',
      p: function () { return skillLevel('cooking') + skillLevel('brewing'); },
      n: function (o) { return o.skills.cooking + o.skills.brewing; } },
    { id: 'arcane', nm: '秘术', ic: '⚗️', un: '', desc: '炼金 + 强化',
      p: function () { return skillLevel('alchemy') + skillLevel('enhancing'); },
      n: function (o) { return o.skills.alchemy + o.skills.enhancing; } },
    { id: 'mastery', nm: '专精', ic: '✦', un: '', desc: '全部动作的专精等级总和',
      p: function () {
        var t = 0;
        for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id !== 'combat') t += masteryTotal(SKILLS[i].id);
        return t;
      }, n: function (o) { return o.mastery; } },
    { id: 'ach', nm: '成就', ic: '🏆', un: '档', desc: '已领取的成就档数',
      p: function () {
        try { return achSummary().claimed; } catch (e) { return 0; }
      }, n: function (o) { return o.ach; } }
  ];

  function cat(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i];
    return CATS[0];
  }

  /* 当前榜：玩家与 NPC 混排，返回带名次的数组 */
  function ranking(catId) {
    var c = cat(catId), L = World.ready(), rows = [], i;
    for (i = 0; i < L.length; i++) {
      rows.push({ id: L[i].id, name: L[i].name, title: L[i].title, guild: L[i].guild, val: c.n(L[i]), me: false, npc: L[i] });
    }
    rows.push({ id: 'me', name: S.name || '你', title: '就是你自己', guild: S.guild || '', val: c.p(), me: true, npc: null });
    rows.sort(function (a, b) { return b.val - a.val; });
    for (i = 0; i < rows.length; i++) rows[i].rank = i + 1;
    return rows;
  }

  /* ---------- 详情页所需的完整档案 ---------- */
  function heroOf(id) {
    if (id === 'me') {
      var skills = {}, subs = {}, equip = {}, enh = {}, i;
      /* 老存档可能缺这些字段，逐个兜底避免整页崩掉 */
      var myEq = (S && S.equip) ? S.equip : {};
      for (i = 0; i < SKILLS.length; i++) skills[SKILLS[i].id] = skillLevel(SKILLS[i].id);
      var SUB7 = ['stamina', 'intelligence', 'attack', 'defense', 'melee', 'ranged', 'magic'];
      for (i = 0; i < SUB7.length; i++) subs[SUB7[i]] = subLevel(SUB7[i]);
      for (i = 0; i < SLOTS.length; i++) equip[SLOTS[i].id] = myEq[SLOTS[i].id] || null;
      for (i = 0; i < SLOTS.length; i++) enh[SLOTS[i].id] = enhLevel(SLOTS[i].id);
      return {
        id: 'me', name: S.name || '你', title: '星海牧场的经营者', guild: S.guild || '未加入公会',
        skills: skills, subs: subs, equip: equip, enh: enh,
        combatLv: combatLevel(), lvTotal: totalLevel(),
        gold: Math.floor(S.gold || 0), me: true
      };
    }
    var n = World.get(id);
    if (!n) return null;
    return {
      id: n.id, name: n.name, title: n.title, guild: n.guild || '未加入公会',
      skills: n.skills, subs: n.subs, equip: n.equip, enh: n.enh,
      combatLv: n.combatLv, lvTotal: n.lvTotal, gold: n.gold,
      online: n.online, days: n.days, me: false
    };
  }

  window.World = World;
  window.LB_CATS = CATS;
  window.lbCat = cat;
  window.lbRanking = ranking;
  window.heroOf = heroOf;
})();
