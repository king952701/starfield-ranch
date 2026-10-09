/* ============================================================
 *  存档备份 / 迁移
 *
 *  目标：卸载或清数据时不至于血本无归，同时不申请任何系统权限
 *  （写 SD 卡需要存储权限，会让我们承诺的「零权限」失效）。
 *
 *  因此方案是：
 *    1) 导出成一段文本，用户自行粘贴到备忘录 / 云端笔记；
 *    2) localStorage 内滚动快照，防手滑覆盖与存档损坏。
 *
 *  两个真实风险必须处理：
 *    - 粘贴不全 / 串入无关内容 → 污染 S 导致整页崩溃 → 用校验和拦截
 *    - 导入会覆盖当前进度且不可撤销 → 覆盖前强制先快照
 * ============================================================ */
(function () {
  'use strict';

  const SAVE_KEY = 'starfield_ranch_v1';        /* 必须与 core.js 保持一致 */
  const SNAP_KEYS = ['starfield_ranch_snap_a', 'starfield_ranch_snap_b', 'starfield_ranch_snap_c'];
  const MAGIC = 'XHMC-SAVE';
  const VER = 1;
  const MAX_SNAP = 400 * 1024;                  /* 单份快照上限，防止撑爆配额 */

  function sum32(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }

  function hasLS() {
    try { return !!(window.localStorage); } catch (e) { return false; }
  }
  function lGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  function toast(msg) {
    try { if (window.MUI && MUI.toast) MUI.toast(msg); } catch (e) { }
    try { if (window.UI) UI.dirty = true; } catch (e) { }
    try { if (window.MUI) MUI.dirty = true; } catch (e) { }
  }

  const Backup = {
    MAGIC: MAGIC,
    snapKeys: SNAP_KEYS,

    /* ---------------- 导出 ---------------- */
    export: function () {
      let body = '';
      let pkg = null;
      try {
        body = JSON.stringify(S);
        pkg = { app: MAGIC, v: VER, t: Date.now(), sum: sum32(body), s: S };
        return JSON.stringify(pkg);
      } catch (e) {
        return '';
      }
    },

    /* 导出体积，便于提示用户 */
    exportSize: function () {
      const t = Backup.export();
      return t ? t.length : 0;
    },

    /* ---------------- 解析（不写入，只校验） ---------------- */
    parse: function (txt) {
      const raw = String(txt == null ? '' : txt).replace(/^\s+|\s+$/g, '');
      if (!raw) return { ok: false, msg: '请先粘贴存档文本' };

      let o = null;
      try { o = JSON.parse(raw); } catch (e) {
        return { ok: false, msg: '不是有效的文本格式，可能是复制时被截断了' };
      }
      if (!o || typeof o !== 'object') return { ok: false, msg: '内容无法识别' };
      if (o.app !== MAGIC) return { ok: false, msg: '这不是星海牧场的存档文本' };
      if (o.v > VER) return { ok: false, msg: '该存档来自更高版本，请更新游戏后再导入' };
      if (!o.s || typeof o.s !== 'object') return { ok: false, msg: '存档内容缺失' };

      /* 结构校验：缺了这些字段，游戏启动后会到处崩溃 */
      const need = ['skills', 'bank', 'gold', 'name'];
      for (let i = 0; i < need.length; i++) {
        if (o.s[need[i]] === undefined) return { ok: false, msg: '存档缺少必要字段：' + need[i] };
      }

      /* 校验和：拦截复制不全的情况 */
      if (o.sum) {
        try {
          if (sum32(JSON.stringify(o.s)) !== o.sum) {
            return { ok: false, msg: '内容不完整（校验不符），请重新完整复制后再试' };
          }
        } catch (e) {
          return { ok: false, msg: '存档内容无法解析' };
        }
      }
      return { ok: true, data: o.s, t: o.t || 0 };
    },

    /* ---------------- 写入（覆盖当前进度） ---------------- */
    apply: function (data) {
      try {
        Backup.snapshot('导入前自动备份');      /* 覆盖前先留退路 */
        Object.keys(data).forEach(function (k) { S[k] = data[k]; });
        S.savedAt = Date.now();
        if (!S.equip) S.equip = {};
        if (!S.enhance) S.enhance = {};
        if (!S.stats) S.stats = { kills: 0, deaths: 0, actions: 0, earned: 0, spent: 0, crafted: 0, offline: 0 };
        if (!S.market) S.market = { orders: [], refresh: 0, history: [] };
        if (!S.ah) S.ah = { listings: [], seq: 1, refresh: 0 };
        if (typeof saveGame === 'function') saveGame();
        toast('✅ 已导入存档：' + (S.name || '未命名'));
        return true;
      } catch (e) {
        toast('⚠ 导入失败：' + (e.message || '未知错误'));
        return false;
      }
    },

    /* ---------------- 复制到剪贴板 ---------------- */
    copy: function (txt) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt);
          return true;
        }
      } catch (e) { }
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange ? ta.setSelectionRange(0, txt.length) : null;
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    },

    /* ---------------- 本地滚动快照 ---------------- */
    snapshot: function (tag) {
      if (!hasLS()) return false;
      let cur = '';
      try { cur = JSON.stringify(S); } catch (e) { return false; }
      if (cur.length > MAX_SNAP) return false;

      /* 已满则先把最老的一份（末尾）丢掉，再整体后移 */
      try { if (lGet(SNAP_KEYS[SNAP_KEYS.length - 1])) lDel(SNAP_KEYS[SNAP_KEYS.length - 1]); } catch (e) { }
      for (let i = SNAP_KEYS.length - 1; i > 0; i--) {
        const prev = lGet(SNAP_KEYS[i - 1]);
        if (prev) lSet(SNAP_KEYS[i], prev); else lDel(SNAP_KEYS[i]);
      }
      const meta = { app: MAGIC, v: VER, t: Date.now(), tag: tag || '', lv: (typeof totalLevel === 'function' ? totalLevel() : 0), nm: S.name || '' };
      const okop = lSet(SNAP_KEYS[0], JSON.stringify({ meta: meta, s: cur }));
      return okop;
    },

    /* 列出快照（新的在前） */
    listSnaps: function () {
      const out = [];
      for (let i = 0; i < SNAP_KEYS.length; i++) {
        const raw = lGet(SNAP_KEYS[i]);
        if (!raw) continue;
        try {
          const o = JSON.parse(raw);
          if (o && o.s) {
            out.push({
              i: i, t: (o.meta && o.meta.t) || 0, tag: (o.meta && o.meta.tag) || '',
              lv: (o.meta && o.meta.lv) || 0, nm: (o.meta && o.meta.nm) || '',
              raw: raw
            });
          }
        } catch (e) { }
      }
      out.sort(function (a, b) { return b.t - a.t; });
      return out;
    },

    restoreSnap: function (idx) {
      const list = Backup.listSnaps();
      let pick = null;
      for (let k = 0; k < list.length; k++) if (list[k].i === idx) pick = list[k];
      if (!pick) return false;
      let o = null;
      try { o = JSON.parse(pick.raw); } catch (e) { return false; }
      if (!o || !o.s) return false;
      try { o.s = JSON.parse(o.s); } catch (e) { return false; }
      return Backup.apply(o.s);
    },

    /* 每日首次启动做一次快照；同一天不重复 */
    dailySnapshot: function () {
      if (!hasLS()) return false;
      const day = new Date().toDateString();
      if (lGet('starfield_ranch_snapday') === day) return false;
      const okop = Backup.snapshot('自动');
      if (okop) lSet('starfield_ranch_snapday', day);
      return okop;
    },

    fmtDays: function (ts) {
      if (!ts) return '未知时间';
      const sec = Math.floor((Date.now() - ts) / 1000);
      if (sec < 60) return '刚刚';
      if (sec < 3600) return Math.floor(sec / 60) + ' 分钟前';
      if (sec < 86400) return Math.floor(sec / 3600) + ' 小时前';
      return Math.floor(sec / 86400) + ' 天前';
    }
  };

  window.Backup = Backup;
})();
