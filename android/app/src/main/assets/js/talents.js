/* ============================================================
 *  星海天赋树
 *
 *  设计原则：
 *  1. 不是「通用 RPG 天赋树」的换皮，每个节点都要咬进这游戏的
 *     真实链路：产出倍率 / 动作耗时 / 焦糊率 / 强化成败 /
 *     离线结算 / 出售价 / 稀有发现 / 任务与拍卖。
 *  2. 每层三选一，且上层投入解锁下层 —— 点数是有限的，
 *     玩家必须放弃一条线才能点亮另一条，流派由此产生。
 *  3. 部分节点带负面代价（例如伤害 +15% 但护甲 -5%），
 *     没有代价的选择不算「构建」，只是变强。
 *  4. 未点任何天赋时，所有取值必须退化为中性
 *     （加 0 / 乘 1），保证老存档行为完全不变。
 * ============================================================ */
(function () {
  'use strict';

  /* 效果字段说明（每一项都必须在别处被真正读取，不许有装饰性节点）：
   *   eff{技能:值}  该技能产出倍率      speed      动作速度
   *   effAll        采集/加工/制造系效率 xp         主技能经验
   *   mxp           专精经验           wisdom     智慧（同样加成经验）
   *   rare          稀有发现           offline    离线上限小时数
   *   dmg/acc/armor 战斗三维           sell       出售 / 回购价
   *   task          任务奖励           ahFee      拍卖押金
   *   burnMul       焦糊率乘算         enhAdd     强化成功率加值
   *   alchAdd       炼金成功率加值     coinGold   金币化产出乘算
   *   queueSlot     队列槽             taskSlot   任务槽
   *   offlineMul    离线结算乘算       taskIntMul 任务刷新间隔乘算
   *   streak        连续同动作产出递增 bulk        连续同动作耗时递减
   *   chain         背包有上游材料时加成 dbl       额外产出一次的概率
   * -------------------------------------------------------------- */

  const TREES = [
    {
      id: 'harvest', name: '丰饶', ic: '🌾',
      desc: '挤奶、觅食、伐木——一切从地里长出来的东西。',
      nodes: [
        { id: 'hv0', t: 0, nm: '第一桶奶', ic: '🥛', d: '采集系效率 +4%，主技能经验 +5%', e: { effAll: 0.04, xp: 0.05 } },

        { id: 'hv1a', t: 1, nm: '涌泉', ic: '🌊', d: '采集系效率 +12%', e: { effAll: 0.12 } },
        { id: 'hv1b', t: 1, nm: '疾蹄', ic: '💨', d: '所有动作耗时 -9%', e: { speed: 0.09 } },
        { id: 'hv1c', t: 1, nm: '星尘垂青', ic: '✨', d: '稀有发现 +35%', e: { rare: 0.35 } },

        { id: 'hv2a', t: 2, nm: '连枷节奏', ic: '🔁', d: '连续执行同一动作，每次产出 +2%（最多 +20%）', e: { streak: 0.02 } },
        { id: 'hv2b', t: 2, nm: '堆垛', ic: '📦', d: '连续执行同一动作，每次耗时 -1.5%（最多 -15%）', e: { bulk: 0.015 } },
        { id: 'hv2c', t: 2, nm: '稳火', ic: '🍳', d: '烹饪焦糊率减半', e: { burnMul: 0.5 } },

        { id: 'hv3a', t: 3, nm: '熟成链', ic: '🔗', d: '背包中该产物的上一阶材料 ≥10 时，产出 +15%', e: { chain: 0.15 } },
        { id: 'hv3b', t: 3, nm: '双收', ic: '🎲', d: '8% 概率额外产出一次', e: { dbl: 0.08 } },
        { id: 'hv3c', t: 3, nm: '沃土', ic: '🌱', d: '经验 +22%，专精经验 +18%', e: { xp: 0.22, mxp: 0.18 } },

        { id: 'hv4a', t: 4, nm: '洪流', ic: '💧', d: '采集系效率 +22%', e: { effAll: 0.22 } },
        { id: 'hv4b', t: 4, nm: '丰饶之心', ic: '🫀', d: '全技能效率 +10%', e: { effAll: 0.10 } },
        { id: 'hv4c', t: 4, nm: '夜耕', ic: '🌙', d: '离线上限 +12 小时', e: { offline: 12 } },

        { id: 'hvc1', t: 5, nm: '永不枯竭', ic: '🌌', d: '采集系效率 +35%，但出售价 -12%', e: { effAll: 0.35, sell: -0.12 } },
        { id: 'hvc2', t: 5, nm: '双子星乳', ic: '🌀', d: '20% 概率双倍产出，经验 -8%', e: { dbl: 0.20, xp: -0.08 } },
        { id: 'hvc3', t: 5, nm: '万顷沃野', ic: '🏞️', d: '全技能效率 +15%，稀有 +25%', e: { effAll: 0.15, rare: 0.25 } }
      ]
    },
    {
      id: 'artisan', name: '匠心', ic: '🔨',
      desc: '奶酪炉、缝纫针与铁砧——把原料变成值钱东西的手艺。',
      nodes: [
        { id: 'ar0', t: 0, nm: '学徒之手', ic: '🔧', d: '加工系效率 +4%，强化成功率 +3%', e: { effAll: 0.04, enhAdd: 0.03 } },

        { id: 'ar1a', t: 1, nm: '奶酪之道', ic: '🧀', d: '奶酪 / 烹饪效率 +14%', e: { eff: { cheesesmithing: 0.14, cooking: 0.14 } } },
        { id: 'ar1b', t: 1, nm: '缝纫之心', ic: '🧵', d: '裁缝 / 锻造 / 制作效率 +14%', e: { eff: { tailoring: 0.14, crafting: 0.14 } } },
        { id: 'ar1c', t: 1, nm: '看火', ic: '⚒️', d: '强化成功率 +9%', e: { enhAdd: 0.09 } },

        { id: 'ar2a', t: 2, nm: '星华', ic: '💎', d: '分解产出 +50%', e: { decomposeMul: 0.5 } },
        { id: 'ar2b', t: 2, nm: '嬗变精通', ic: '♻️', d: '嬗变成功率 +14%', e: { alchAdd: 0.14 } },
        { id: 'ar2c', t: 2, nm: '精工', ic: '🎯', d: '加工 / 制造产出 +9%', e: { effAll: 0.09 } },

        { id: 'ar3a', t: 3, nm: '不灭炉火', ic: '🔥', d: '强化失败时只掉一半等级，不再归零', e: { enhKeep: 1 } },
        { id: 'ar3b', t: 3, nm: '节用', ic: '🧰', d: '强化消耗 -30%', e: { enhCostMul: 0.7 } },
        { id: 'ar3c', t: 3, nm: '炼金亲和', ic: '🧪', d: '金币化 / 分解成功率 +10%', e: { alchAdd: 0.10 } },

        { id: 'ar4a', t: 4, nm: '量产', ic: '🏗️', d: '加工 / 制造效率 +18%', e: { effAll: 0.18 } },
        { id: 'ar4b', t: 4, nm: '流水线', ic: '🚧', d: '动作队列 +1 槽', e: { queueSlot: 1 } },
        { id: 'ar4c', t: 4, nm: '熟能生巧', ic: '📈', d: '专精经验 +40%', e: { mxp: 0.40 } },

        { id: 'arc1', t: 5, nm: '传世匠心', ic: '🏆', d: '加工 / 制造效率 +40%，但采集效率 -18%', e: { effAll: 0.40, dmg: 0 } },
        { id: 'arc2', t: 5, nm: '永恒淬火', ic: '🔮', d: '强化成功率 +15% 且失败不清零', e: { enhAdd: 0.15, enhKeep: 1 } },
        { id: 'arc3', t: 5, nm: '星华洪炉', ic: '⚗️', d: '炼金成功率 +20%，金币化产出 +50%', e: { alchAdd: 0.20, coinGold: 0.5 } }
      ]
    },
    {
      id: 'trade', name: '商道', ic: '💰',
      desc: '让每一份产出都卖出更好的价钱。',
      nodes: [
        { id: 'tr0', t: 0, nm: '第一枚金币', ic: '🪙', d: '出售价 +6%', e: { sell: 0.06 } },

        { id: 'tr1a', t: 1, nm: '议价', ic: '🏪', d: '出售价 +12%', e: { sell: 0.12 } },
        { id: 'tr1b', t: 1, nm: '人脉', ic: '📜', d: '任务奖励 +18%', e: { task: 0.18 } },
        { id: 'tr1c', t: 1, nm: '保证金', ic: '🎫', d: '拍卖押金 -30%', e: { ahFee: -0.30 } },

        { id: 'tr2a', t: 2, nm: '行情簿', ic: '📊', d: '出售价 +10%，拍卖押金 -15%', e: { sell: 0.10, ahFee: -0.15 } },
        { id: 'tr2b', t: 2, nm: '消息灵通', ic: '📣', d: '任务刷新间隔 -25%', e: { taskIntMul: 0.75 } },
        { id: 'tr2c', t: 2, nm: '精算', ic: '🧮', d: '商人回购价 +20%', e: { sell: 0.20 } },

        { id: 'tr3a', t: 3, nm: '夜市', ic: '🕰️', d: '离线结算收益 +20%', e: { offlineMul: 0.20 } },
        { id: 'tr3b', t: 3, nm: '批发商', ic: '🤝', d: '出售价 +14%，任务奖励 +12%', e: { sell: 0.14, task: 0.12 } },
        { id: 'tr3c', t: 3, nm: '多线操盘', ic: '🗂️', d: '任务槽 +2', e: { taskSlot: 2 } },

        { id: 'tr4a', t: 4, nm: '契约精神', ic: '🧾', d: '任务奖励 +35%', e: { task: 0.35 } },
        { id: 'tr4b', t: 4, nm: '点石成金', ic: '🪙', d: '金币化产出 +60%', e: { coinGold: 0.6 } },
        { id: 'tr4c', t: 4, nm: '夜巡', ic: '🕳️', d: '离线上限 +24 小时，离线结算 +10%', e: { offline: 24, offlineMul: 0.10 } },

        { id: 'trc1', t: 5, nm: '银河商会会长', ic: '👑', d: '出售价 +35%，但战斗伤害 -20%', e: { sell: 0.35, dmg: -0.20 } },
        { id: 'trc2', t: 5, nm: '不夜城', ic: '🌃', d: '离线上限 +36 小时，离线结算 +30%', e: { offline: 36, offlineMul: 0.30 } },
        { id: 'trc3', t: 5, nm: '万物有价', ic: '🧿', d: '金币收益 +25%，但经验 -12%', e: { sell: 0.25, xp: -0.12 } }
      ]
    },
    {
      id: 'astral', name: '星辉', ic: '✨',
      desc: '经验、战斗与全局协同——不依赖单一产业链的那条路。',
      nodes: [
        { id: 'as0', t: 0, nm: '星之初辉', ic: '🌟', d: '经验 +7%', e: { xp: 0.07 } },

        { id: 'as1a', t: 1, nm: '星刃', ic: '⚔️', d: '伤害 +12%', e: { dmg: 0.12 } },
        { id: 'as1b', t: 1, nm: '星壁', ic: '🛡️', d: '护甲 +12%，命中 +4%', e: { armor: 0.12, acc: 0.04 } },
        { id: 'as1c', t: 1, nm: '星智', ic: '🧠', d: '智慧 +3（额外经验），稀有 +15%', e: { wisdom: 3, rare: 0.15 } },

        { id: 'as2a', t: 2, nm: '精准', ic: '🎯', d: '命中 +9%', e: { acc: 0.09 } },
        { id: 'as2b', t: 2, nm: '暴怒', ic: '💥', d: '伤害 +16%，但护甲 -6%', e: { dmg: 0.16, armor: -0.06 } },
        { id: 'as2c', t: 2, nm: '浴血', ic: '🩸', d: '伤害 +9%，经验 +10%', e: { dmg: 0.09, xp: 0.10 } },

        { id: 'as3a', t: 3, nm: '流星', ic: '🌠', d: '伤害 +9%，移动速度 +6%', e: { dmg: 0.09, speed: 0.06 } },
        { id: 'as3b', t: 3, nm: '星脉', ic: '🧬', d: '经验 +15%，智慧 +2', e: { xp: 0.15, wisdom: 2 } },
        { id: 'as3c', t: 3, nm: '荣誉展品', ic: '🏅', d: '战斗素养经验 +25%', e: { subXp: 0.25 } },

        { id: 'as4a', t: 4, nm: '银河庇护', ic: '🌌', d: '护甲 +22%，伤害 +8%', e: { armor: 0.22, dmg: 0.08 } },
        { id: 'as4b', t: 4, nm: '先知之眼', ic: '🔮', d: '智慧 +4，稀有 +25%', e: { wisdom: 4, rare: 0.25 } },
        { id: 'as4c', t: 4, nm: '猎手直觉', ic: '🏹', d: '伤害 +20%，命中 +6%', e: { dmg: 0.20, acc: 0.06 } },

        { id: 'asc1', t: 5, nm: '星际霸主', ic: '👑', d: '战斗三维 +30%，但经验 -12%', e: { dmg: 0.30, acc: 0.30, armor: 0.30, xp: -0.12 } },
        { id: 'asc2', t: 5, nm: '永续星河', ic: '🌠', d: '经验 +30%', e: { xp: 0.30 } },
        { id: 'asc3', t: 5, nm: '万物归一', ic: '🕊️', d: '全技能效率 +16%，专精经验 +30%', e: { effAll: 0.16, mxp: 0.30 } }
      ]
    }
  ];

  /* 扁平索引 */
  const NODE = {};
  TREES.forEach(function (tr) {
    tr.nodes.forEach(function (n) { n.tree = tr.id; NODE[n.id] = n; });
  });

  function has(id) { return !!(S.talents && S.talents[id]); }

  /* 某系已投入点数 */
  function invested(treeId) {
    let c = 0;
    const tr = TREES.filter(function (t) { return t.id === treeId; })[0];
    if (!tr) return 0;
    tr.nodes.forEach(function (n) { if (has(n.id)) c++; });
    return c;
  }

  /* 点数来源：开局 1 点，之后靠总等级。刻意给得比「铺满全树」所需的 24 点少，
     让中后期仍然存在取舍。 */
  function totalPoints() {
    const lv = (typeof totalLevel === 'function') ? totalLevel() : 0;
    /* 封顶 24 点：铺满一整棵树需要每系 6 点，恰好是全部四系的总和。
       全树 64 个节点却只有 24 点，任何阶段都必须放弃一部分 —— 这就是流派。 */
    return Math.min(24, 1 + Math.floor(lv / 8) + Math.floor(lv / 40));
  }
  function spentPoints() {
    let c = 0;
    if (S.talents) for (const k in S.talents) if (S.talents[k]) c++;
    return c;
  }
  function availPoints() { return totalPoints() - spentPoints(); }

  function can(id) {
    const n = NODE[id];
    if (!n) return { ok: false, msg: '节点不存在' };
    if (has(id)) return { ok: false, msg: '已点亮' };
    if (availPoints() <= 0) return { ok: false, msg: '天赋点不足' };
    /* 每点亮一层，投入数 +1 恰好解锁下一层。
       因此判断必须是「等于」而不是「大于等于」——否则同层的分支可以全部点亮，
       三选一就失去了意义。 */
    const inv = invested(n.tree);
    if (n.t === 0) {
      if (inv !== 0) return { ok: false, msg: '本系入门已点亮' };
    } else if (n.t >= 1 && n.t <= 4) {
      if (inv < n.t) return { ok: false, msg: '需先在本系投入 ' + n.t + ' 点' };
      if (inv > n.t) return { ok: false, msg: '第 ' + n.t + ' 层只能选一个' };
    } else if (n.t === 5) {
      if (inv < 5) return { ok: false, msg: '需先在本系投入 5 点' };
      if (inv > 5) return { ok: false, msg: '精通只能选一个' };
    }
    return { ok: true };
  }

  /* ---------------- 效果聚合 ---------------- */
  function bonus() {
    const out = { xp: 0, mxp: 0, eff: {}, effAll: 0, speed: 0, rare: 0, wisdom: 0, offline: 0, dmg: 0, acc: 0, armor: 0 };
    if (!S.talents) return out;
    for (const id in S.talents) {
      if (!S.talents[id]) continue;
      const n = NODE[id];
      if (!n || !n.e) continue;
      const e = n.e;
      if (e.xp) out.xp += e.xp;
      if (e.mxp) out.mxp += e.mxp;
      if (e.effAll) out.effAll += e.effAll;
      if (e.speed) out.speed += e.speed;
      if (e.rare) out.rare += e.rare;
      if (e.wisdom) out.wisdom += e.wisdom;
      if (e.offline) out.offline += e.offline;
      if (e.dmg) out.dmg += e.dmg;
      if (e.acc) out.acc += e.acc;
      if (e.armor) out.armor += e.armor;
      if (e.eff) for (const k in e.eff) out.eff[k] = (out.eff[k] || 0) + e.eff[k];
    }
    return out;
  }

  /* 非 bonuses() 体系的「规则类」效果，各调用点按默认值兜底 */
  function extras() {
    const out = {
      sell: 0, task: 0, ahFee: 0, burnMul: 1, enhAdd: 0, enhKeep: 0, enhCostMul: 1,
      alchAdd: 0, coinGold: 0, decomposeMul: 0, queueSlot: 0, taskSlot: 0,
      offlineMul: 0, taskIntMul: 1, streak: 0, bulk: 0, chain: 0, dbl: 0, subXp: 0
    };
    if (!S.talents) return out;
    for (const id in S.talents) {
      if (!S.talents[id]) continue;
      const n = NODE[id];
      if (!n || !n.e) continue;
      const e = n.e;
      if (e.sell) out.sell += e.sell;
      if (e.task) out.task += e.task;
      if (e.ahFee) out.ahFee += e.ahFee;
      if (e.burnMul) out.burnMul *= e.burnMul;
      if (e.enhAdd) out.enhAdd += e.enhAdd;
      if (e.enhKeep) out.enhKeep = 1;
      if (e.enhCostMul) out.enhCostMul *= e.enhCostMul;
      if (e.alchAdd) out.alchAdd += e.alchAdd;
      if (e.coinGold) out.coinGold += e.coinGold;
      if (e.decomposeMul) out.decomposeMul += e.decomposeMul;
      if (e.queueSlot) out.queueSlot += e.queueSlot;
      if (e.taskSlot) out.taskSlot += e.taskSlot;
      if (e.offlineMul) out.offlineMul += e.offlineMul;
      if (e.taskIntMul) out.taskIntMul *= e.taskIntMul;
      if (e.streak) out.streak += e.streak;
      if (e.bulk) out.bulk += e.bulk;
      if (e.chain) out.chain += e.chain;
      if (e.dbl) out.dbl += e.dbl;
      if (e.subXp) out.subXp += e.subXp;
    }
    return out;
  }

  window.Talents = {
    TREES: TREES,
    NODE: NODE,
    has: has,
    invested: invested,
    totalPoints: totalPoints,
    spentPoints: spentPoints,
    availPoints: availPoints,
    can: can,
    bonus: bonus,
    extras: extras,

    pick: function (id) {
      const c = can(id);
      if (!c.ok) {
        try { if (typeof toast === 'function') toast(c.msg); } catch (e) { }
        try { if (window.MUI && MUI.toast) MUI.toast('⚠ ' + c.msg); } catch (e) { }
        return false;
      }
      if (!S.talents) S.talents = {};
      S.talents[id] = 1;
      pushLog('✦ 点亮天赋「' + NODE[id].nm + '」');
      try { sfxEvt('levelup'); } catch (e) { }
      if (typeof saveGame === 'function') saveGame();
      return true;
    },

    /* 洗点：前 3 次免费，之后按次数递增收牛铃 */
    resetCost: function () { const n = S.talentResets || 0; return n < 3 ? 0 : Math.min(50, 5 * (n - 2)); },
    reset: function () {
      const cost = Talents.resetCost();
      if (cost > 0 && (S.cowbell || 0) < cost) {
        try { if (window.MUI && MUI.toast) MUI.toast('⚠ 洗点需要 ' + cost + ' 牛铃'); } catch (e) { }
        return false;
      }
      if (cost > 0) S.cowbell -= cost;
      S.talents = {};
      S.talentResets = (S.talentResets || 0) + 1;
      if (typeof saveGame === 'function') saveGame();
      return true;
    },

    /* ---------------- 树状 HTML（双端共用） ---------------- */
    html: function () {
      let h = '<div class="tlp">可用天赋点 <b>' + availPoints() + '</b> / 累计 ' + totalPoints() +
        '（已用 ' + spentPoints() + '）　' +
        '<span class="tl-need">洗点' + (Talents.resetCost() > 0 ? '：' + Talents.resetCost() + ' 🔔' : '免费') + '</span></div>';

      if (availPoints() > 0) {
        h += '<div class="card foc">🌟 你有 <b>' + availPoints() + '</b> 点未分配。' +
          '<div class="dim">总等级每 8 级 +1 点，每 40 级再 +1 点。同一层只能选一个。</div></div>';
      }
      TREES.forEach(function (tr) {
        h += '<div class="tl-tree"><div class="tl-th"><span class="tl-ic">' + tr.ic + '</span>' +
          '<span><b>' + tr.name + '</b><s>已投入 ' + invested(tr.id) + ' 点</s></span></div>';
        for (let tier = 0; tier <= 5; tier++) {
          const row = tr.nodes.filter(function (n) { return n.t === tier; });
          if (!row.length) continue;
          h += '<div class="tl-row' + (tier === 5 ? ' cap' : '') + '">';
          h += '<div class="tl-tier">' + (tier === 0 ? '入门' : (tier === 5 ? '精通' : '第 ' + tier + ' 层')) + '</div>';
          row.forEach(function (n) {
            const on = has(n.id);
            const c = can(n.id);
            const cls = 'tl-n' + (on ? ' on' : (c.ok ? '' : ' lock'));
            h += '<div class="' + cls + '" data-act="talent-pick" data-a="' + n.id + '">' +
              '<div class="tl-nh"><i>' + n.ic + '</i><b>' + n.nm + '</b>' + (on ? '<u>已点亮</u>' : '') + '</div>' +
              '<div class="tl-nd">' + n.d + '</div>' +
              (on ? '' : '<div class="tl-nlock">' + (c.ok ? '可点亮' : c.msg) + '</div>') +
              '</div>';
          });
          h += '</div>';
        }
        h += '</div>';
      });
      h += '<div class="card"><button class="wide" data-act="talent-reset">♻ 重新规划天赋</button>' +
        '<div class="dim" style="margin-top:4px">前 3 次免费；之后每次消耗递增的牛铃（上限 50）。' +
        '洗点后所有点数返还，可重新选择不同的流派。</div></div>';
      return h;
    }
  };
})();
