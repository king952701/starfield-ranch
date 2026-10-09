/* ============================================================
 *  首启引导 · 新人目标感
 *
 *  存档里早就预留了 flags.tutorial，但一直没人读。
 *  这里把它真正用起来：给出一条能走完核心循环的路线，
 *  每步检查是否达成并自动发奖 —— 不弹窗打断，只给一条顶部目标条。
 *
 *  重要：老存档（已经玩过的）不触发引导。
 * ============================================================ */
(function () {
  'use strict';

  /* 当前 tab：手机端记在 MUI，桌面端记在 UI */
  function curTab() {
    try {
      if (window.MUI && window.MUI.tab) return window.MUI.tab;
      if (window.UI && window.UI.tab) return window.UI.tab;
    } catch (e) { }
    return '';
  }
  function queueBusy() {
    return !!(S.action || (S.queue && S.queue.length));
  }

  const STEPS = [
    {
      id: 'act', goal: '安排第一个动作', ic: '▶️', tab: 'skill',
      tip: '到「技能」页挑一个动作，用 +1 / +10 / ∞ 排活。离线也会继续生产。',
      check: function () { return queueBusy(); },
      rw: { gold: 200 }
    },
    {
      id: 'acts', goal: '累计完成 10 次动作', ic: '🔁', tab: 'skill',
      tip: '动作完成等于产出到账。点这个目标条可以随时查看进度。',
      check: function () { return (S.stats && S.stats.actions >= 10); },
      rw: { gold: 500 }
    },
    {
      id: 'bag', goal: '打开「背包」看看产出', ic: '🎒', tab: 'bag',
      tip: '所有材料都堆在背包里，可以直接售出换金币，或留着做装备。',
      /* 手机 tab 叫 bag，桌面 tab 叫 bank，两端都得认 */
      check: function () { const t = curTab(); return t === 'bag' || t === 'bank'; },
      rw: { bell: 2 }
    },
    {
      id: 'level', goal: '把任一技能练到 2 级', ic: '⬆️', tab: 'skill',
      tip: '技能经验靠做动作积累；等级越高解锁越好的配方。',
      check: function () { return totalLevel() > 10; },   /* 初始 10 个生活技能各 1 级 */
      rw: { gold: 500 }
    },
    {
      id: 'social', goal: '到「社交」看看同服对手', ic: '🌐', tab: 'social',
      tip: '排行榜有九个类别，点任意一行能看到对方的装备、工具与全部技能等级。',
      check: function () { return curTab() === 'social'; },
      rw: { bell: 3 }
    }
  ];

  function toast(msg) {
    /* 引导每秒被调用，提示出错绝不能中断主循环，这里全部吞掉 */
    try { if (window.MUI && MUI.toast) MUI.toast(msg); } catch (e) { }
    try { if (window.UI) UI.dirty = true; } catch (e) { }
  }

  const Tutorial = {
    steps: STEPS,

    /* 惰性初始化：老存档自动跳过，不打扰已经在玩的人 */
    ready: function () {
      if (!S.tut) {
        const played = (S.stats && (S.stats.actions > 0 || S.stats.earned > 800)) ||
          (typeof totalLevel === 'function' && totalLevel() > 10);
        S.tut = { step: 0, skip: !!played };
      }
      if (S.tut.step > STEPS.length) S.tut.step = STEPS.length;
      return S.tut;
    },

    cur: function () {
      const t = Tutorial.ready();
      if (t.skip || t.step >= STEPS.length) return null;
      return STEPS[t.step];
    },

    /* 每秒调一次：检查当前目标是否达成 */
    check: function () {
      const st = Tutorial.cur();
      if (!st) return;
      if (!st.check()) return;
      Tutorial.finish(st);
    },

    finish: function (st) {
      const t = Tutorial.ready();
      t.step++;
      if (st.rw && st.rw.gold) addGold(st.rw.gold);
      if (st.rw && st.rw.bell) S.cowbell = (S.cowbell || 0) + st.rw.bell;
      sfxEvt('levelup');
      if (t.step >= STEPS.length) {
        S.flags = S.flags || {};
        S.flags.tutorial = true;      /* 正式点亮那个闲置多年的标记 */
        toast('🎉 引导全部完成，你已经上手了！');
      } else {
        toast('✅ 完成：' + st.goal + ' → 下一个：' + STEPS[t.step].goal);
      }
      if (window.MUI) MUI.dirty = true;
    },

    /* 一键跳过整条引导（玩家不想被打扰时） */
    skipAll: function () {
      const t = Tutorial.ready();
      t.skip = true;
      S.flags = S.flags || {};
      S.flags.tutorial = true;
      toast('已跳过引导，随时可在「关于」重来');
    },

    restart: function () {
      S.tut = { step: 0, skip: false };
      S.flags = S.flags || {};
      S.flags.tutorial = false;
      toast('引导已重新开始');
    },

    /* 顶部目标条 */
    bar: function () {
      const st = Tutorial.cur();
      if (!st) return '';
      const t = Tutorial.ready();
      let prog = 0, ptxt = '';
      if (st.id === 'acts') {
        const n = (S.stats && S.stats.actions) || 0;
        prog = Math.min(1, n / 10);
        ptxt = n + ' / 10';
      } else if (st.id === 'level') {
        const cur = totalLevel() - 10;
        prog = Math.min(1, cur / 1);
        ptxt = cur > 0 ? '已达成' : '0 / 1';
      } else if (st.id === 'act') {
        prog = queueBusy() ? 1 : 0;
        ptxt = queueBusy() ? '已排上' : '待安排';
      } else {
        prog = 0; ptxt = '第 ' + (t.step + 1) + ' / ' + STEPS.length + ' 步';
      }
      return '<div class="tutbar">' +
        '<div class="tut-h"><span class="tut-i">' + st.ic + '</span>' +
        '<b>目标 ' + (t.step + 1) + '/' + STEPS.length + '：' + st.goal + '</b>' +
        '<button class="mini" data-act="tut-goto" data-a="' + (st.tab || 'skill') + '">前往</button>' +
        '<button class="mini" data-act="tut-skip">跳过引导</button></div>' +
        '<div class="tut-t">' + st.tip + '</div>' +
        '<div class="tut-bar"><i style="width:' + (prog * 100).toFixed(1) + '%"></i></div>' +
        '<div class="tut-p">' + ptxt + '</div>' +
        '</div>';
    }
  };

  window.Tutorial = Tutorial;
})();
