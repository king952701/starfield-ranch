/* ============================================================
 * 全局数值常量表 —— 单一数值来源
 * 所有可调数值集中在这里；业务代码只引用常量，不再写裸魔法数。
 * 对应 Story TR-foundation-001，取值依据 docs/balance-analysis-2026-10.md
 * ============================================================ */
var NUM = {
  /* ---- 时间 / 离线 ---- */
  OFFLINE_MIN_SEC: 30,          /* 离线不足 30 秒不结算 */
  OFFLINE_MAX_ACTS: 300000,     /* 防死循环上限（原 20000 会截断收益） */
  OFFLINE_BUDGET_MS: 1200,      /* 离线快进的时间预算，超出后按已结算部分的平均值外推 */
  COMBAT_OFFLINE_CAP_SEC: 4 * 3600,
  COMBAT_OFFLINE_STEP: 1.0,
  ACTION_MIN_SEC: 0.3,          /* 动作耗时下限 */

  /* ---- 产出效率（Story TR-output-002）---- */
  EFF_MASTERY_MAIN: 0.0025,     /* 当前动作专精：每级 +0.25%（满级 ≈ +25%） */
  EFF_MASTERY_SUM: 0.00002,     /* 该技能专精总和：每级 +0.002%（手工艺全满 ≈ +23%） */
  EFF_CAP: 0.60,                /* 效率上限 +60%（原无上限，手工艺可达 +467%） */

  /* ---- 概率上限（Story TR-output-003）---- */
  RARE_CAP: 0.95,
  CHANCE_CAP: 0.95,
  ALCH_CAP: 0.9,

  /* ---- 经济 ---- */
  SELL_RATIO: 0.5,              /* 直接出售折扣 */
  GOLDIFY_MUL: 1.6,             /* 金币化倍率 */
  DEATH_GOLD_LOSS: 0.02,        /* 死亡罚金 */
  REROLL_GOLD: 10000,           /* 重掷任务 */
  REROLL_BELL: 1,
  VENDOR_AUTO_RATIO: 0.8,       /* 回购价/市价 ≥ 此值才计入「一键回购」 */
  RANCH_GOLD_BASE: 50000,
  RANCH_GOLD_GROWTH: 2.4,       /* 原 3.2：全满 1.75e9 → 现 ≈275M */
  RANCH_WOOD_BASE: 10,
  RANCH_FOOD_BASE: 5,
  RANCH_MAT_GROWTH: 2,

  /* ---- 战斗（Story TR-combat-002）---- */
  CRIT_BASE: 0.05,              /* 裸装暴击 */
  CRIT_SOFT_MAX: 0.75,          /* 暴击软上限的可达增量 */
  CRIT_SOFT_K: 2,               /* 软上限陡度 */
  MITIGATION_MIN_D: -100,       /* 穿甲超过防御时最多放大 2 倍 */
  ARMOR_SOFT_KNEE: 3000,        /* 护甲收益衰减拐点：等效护甲 = d / (1 + d/3000) */
  AUTO_EAT_HP: 0.4,             /* HP 低于 40% 自动进食 */

  /* ---- 怪物曲线（Story TR-combat-004）---- */
  MOB_HP_BASE: 40,      MOB_HP_GROWTH: 2.2,
  MOB_ACC_BASE: 30,     MOB_ACC_GROWTH: 1.55,
  MOB_EVA_BASE: 25,     MOB_EVA_GROWTH: 1.5,
  MOB_ARMOR_BASE: 8,    MOB_ARMOR_GROWTH: 1.7,
  MOB_RESIST_BASE: 6,
  MOB_DMG_BASE: 7,      MOB_DMG_GROWTH: 2.6,   /* 原 1.95：后期伤害被护甲压到个位数 */
  MOB_PEN_BASE: 2,      MOB_PEN_GROWTH: 1.7,   /* 原 1.6：穿甲跟不上护甲成长 */
  MOB_XP_BASE: 40,      MOB_XP_GROWTH: 2.5,
  BOSS_DMG_MUL: 1.5,    /* Boss 额外伤害倍率 */

  /* ---- 装备属性量纲（Story TR-combat-001）---- */
  RING_RARE: 0.0008,            /* 原 0.004：t6 +144% → +29% */
  AMULET_WISDOM: 0.0008,        /* 原 0.003：t6 经验×2 → +29% */
  CRIT_PER_SCALE: 0.0008,       /* 原 0.012：恒 90% → 满配 ≈38% */

  /* ---- 专精 ---- */
  POOL_INJECT: 0.25,            /* 专精经验注入池的比例 */
  MASTERY_XP_BASE: 25,

  /* ---- 上限 ---- */
  LOG_MAX: 60,
  CHAT_MAX: 30,
  COMBAT_LOG_MAX: 40
};

/* 概率钳制：统一上限，避免满配后恒等于 100% 或出现负值 */
function clampChance(x, cap) {
  const c = (cap == null) ? NUM.CHANCE_CAP : cap;
  if (!(x > 0)) return 0;
  return Math.min(c, x);
}

/* 软上限：0 → 0，越大越接近 max，永不越过 max */
function softCap(x, max, k) {
  const m = (max == null) ? NUM.CRIT_SOFT_MAX : max;
  const kk = (k == null) ? NUM.CRIT_SOFT_K : k;
  if (!(x > 0)) return 0;
  return m * (1 - Math.exp(-kk * x));
}

/* 暴击率：裸装 CRIT_BASE，装备词缀经软上限收敛（不再恒等于 0.9） */
function critChanceOf(critStat, hitBonus) {
  return clampChance(NUM.CRIT_BASE + softCap(critStat || 0) + (hitBonus || 0), 0.95);
}
