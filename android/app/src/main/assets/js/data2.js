/* ============================================================
 *  星海牧场 · 数据层 2（怪物 / 区域 / 技能 / 建筑 / 任务 / 商店 / 社交）
 * ============================================================ */

/* ---------- 战斗技能（自动施放） ---------- */
const ABILITIES = [
  { id: 'cleave', name: '横扫', icon: '🌀', style: 'melee', mp: 12, cd: 6, mult: 1.9, targets: 'all', lvl: 1, desc: '对全体敌人造成 190% 伤害' },
  { id: 'impale', name: '穿刺', icon: '🔱', style: 'melee', mp: 10, cd: 5, mult: 2.2, targets: 1, lvl: 5, desc: '对单体造成 220% 伤害' },
  { id: 'berserk', name: '狂暴', icon: '💢', style: 'melee', mp: 20, cd: 30, buff: { dmg: 0.3, dur: 12 }, targets: 0, lvl: 20, desc: '12 秒内伤害 +30%' },
  { id: 'quickshot', name: '速射', icon: '🏹', style: 'ranged', mp: 10, cd: 4, mult: 1.8, targets: 1, lvl: 1, desc: '对单体造成 180% 伤害' },
  { id: 'rain', name: '箭雨', icon: '🌧️', style: 'ranged', mp: 18, cd: 9, mult: 1.6, targets: 'all', lvl: 10, desc: '对全体敌人造成 160% 伤害' },
  { id: 'precision', name: '精准', icon: '🎯', style: 'ranged', mp: 16, cd: 25, buff: { acc: 0.35, dur: 12 }, targets: 0, lvl: 25, desc: '12 秒内命中 +35%' },
  { id: 'fireball', name: '火球', icon: '🔥', style: 'magic', mp: 12, cd: 5, mult: 2.0, targets: 1, lvl: 1, desc: '对单体造成 200% 火焰伤害' },
  { id: 'icespear', name: '冰矛', icon: '❄️', style: 'magic', mp: 14, cd: 6, mult: 1.85, targets: 1, lvl: 8, desc: '对单体造成 185% 流水伤害' },
  { id: 'storm', name: '星暴', icon: '🌠', style: 'magic', mp: 24, cd: 12, mult: 1.7, targets: 'all', lvl: 30, desc: '对全体敌人造成 170% 伤害' },
  { id: 'toughness', name: '坚韧', icon: '🛡️', style: 'any', mp: 15, cd: 35, buff: { armor: 0.5, dur: 15 }, targets: 0, lvl: 15, desc: '15 秒内护甲 +50%' },
  { id: 'meditate', name: '冥想', icon: '🧘', style: 'any', mp: 0, cd: 40, buff: { regen: 3, dur: 10 }, targets: 0, lvl: 12, desc: '10 秒内每秒回复 3% 内力' }
];

/* ---------- 区域与怪物 ---------- */
const MONSTERS = {};
function mkMob(id, name, ic, z, mul, style, dmgType) {
  const s = Math.pow(2.2, z);
  const o = {
    id: id, name: name, icon: ic, zone: z, style: style || 'slash', dmgType: dmgType || 'physical',
    hp: Math.round(40 * s * (mul.hp || 1)),
    acc: Math.round(30 * Math.pow(1.55, z) * (mul.acc || 1)),
    eva: Math.round(25 * Math.pow(1.5, z) * (mul.eva || 1)),
    armor: Math.round(8 * Math.pow(1.7, z) * (mul.armor || 1)),
    resist: Math.round(6 * Math.pow(1.7, z) * (mul.resist || 1)),
    dmg: Math.round(7 * Math.pow(1.95, z) * (mul.dmg || 1)),
    spd: mul.spd || (3.0 - z * 0.08),
    xp: Math.round(40 * Math.pow(2.5, z) * (mul.xp || 1)),
    pen: Math.round(2 * Math.pow(1.6, z))
  };
  MONSTERS[id] = o;
  return o;
}

const ZONE_DEFS = [
  { id: 'z0', name: '牧场草原', ic: '🌿', lvl: 1, mobs: [['m0a', '苔藓史莱姆', '🟢', {}], ['m0b', '干草鼠', '🐭', { spd: 2.2 }], ['m0c', '乳牛兽', '🐮', { hp: 1.4 }]], boss: ['b0', '巨角乳牛王', '🐂', { hp: 3, xp: 4 }], loot: ['cream', 'herb'] },
  { id: 'z1', name: '星尘林地', ic: '🌳', lvl: 12, mobs: [['m1a', '星尘蛾', '🦋', { spd: 2.0 }], ['m1b', '苔木人', '🪵', { armor: 1.5 }], ['m1c', '露珠精灵', '💧', { dmgType: 'water' }]], boss: ['b1', '林语者', '🧚', { hp: 3, xp: 4, dmgType: 'nature' }], loot: ['coffee_leaf', 'log'] },
  { id: 'z2', name: '银河湖畔', ic: '🌊', lvl: 26, mobs: [['m2a', '水泡鱼', '🐟', { dmgType: 'water' }], ['m2b', '银鳞蟹', '🦀', { armor: 1.6 }], ['m2c', '潮汐蛙', '🐸', { spd: 2.4 }]], boss: ['b2', '湖心巨鲟', '🐋', { hp: 3, xp: 4, dmgType: 'water' }], loot: ['tea_leaf', 'cotton'] },
  { id: 'z3', name: '火山牧场', ic: '🌋', lvl: 40, mobs: [['m3a', '火焰牛', '🔥', { dmgType: 'fire' }], ['m3b', '熔岩虫', '🐛', { spd: 2.2 }], ['m3c', '灰烬鸟', '🦅', { eva: 1.5 }]], boss: ['b3', '熔岩牛魔', '👹', { hp: 3, xp: 4, dmgType: 'fire' }], loot: ['essence', 'gem'] },
  { id: 'z4', name: '冰原冰窖', ic: '❄️', lvl: 55, mobs: [['m4a', '冰霜牛', '❄️', { dmgType: 'water' }], ['m4b', '霜狼', '🐺', { spd: 2.0 }], ['m4c', '雪怪', '🦍', { hp: 1.5 }]], boss: ['b4', '冰霜牛王', '🐻‍❄️', { hp: 3, xp: 4, dmgType: 'water' }], loot: ['essence', 'gem'] },
  { id: 'z5', name: '幽影谷', ic: '🌑', lvl: 70, mobs: [['m5a', '影蝠', '🦇', { spd: 1.8 }], ['m5b', '腐草精', '👻', { dmgType: 'nature' }], ['m5c', '虚空蛛', '🕷️', { eva: 1.4 }]], boss: ['b5', '幽影牧者', '💀', { hp: 3, xp: 4, dmgType: 'nature' }], loot: ['essence', 'gem'] },
  { id: 'z6', name: '星界回廊', ic: '🌌', lvl: 84, mobs: [['m6a', '星界兽', '🦄', {}], ['m6b', '光棱眼', '👁️', { eva: 1.6 }], ['m6c', '彗星隼', '🦅', { spd: 1.8 }]], boss: ['b6', '星界守望', '🐉', { hp: 3.2, xp: 4, dmgType: 'fire' }], loot: ['gem', 'chest_common'] },
  { id: 'z7', name: '超新星核', ic: '💥', lvl: 95, mobs: [['m7a', '核焰兽', '🔆', { dmgType: 'fire' }], ['m7b', '坍缩体', '🌀', { armor: 1.8 }], ['m7c', '星核巨兽', '🐲', { hp: 1.6 }]], boss: ['b7', '超新星之主', '👑', { hp: 3.5, xp: 4.5, dmgType: 'fire' }], loot: ['chest_rare', 'gem'] }
];

ZONE_DEFS.forEach(function (zd, z) {
  zd.mobs.forEach(function (m) { mkMob(m[0], m[1], m[2], z, m[3] || {}, 'slash', (m[3] || {}).dmgType); });
  const b = zd.boss;
  const bo = mkMob(b[0], b[1], b[2], z, b[3] || {}, 'slash', (b[3] || {}).dmgType);
  bo.boss = true;
  bo.ability = { name: '湮灭冲击', cd: 12, mult: 2.4, mp: 0 };
});

/* ---------- 牧场建筑（Houses） ---------- */
const HOUSES = [
  { id: 'dining', name: '餐厅', icon: '🍽️', sub: 'stamina', desc: '每级：体力 +1、生命回复 +0.03%、智慧 +0.05%、稀有发现 +0.2%', max: 8 },
  { id: 'library', name: '书房', icon: '📚', sub: 'intelligence', desc: '每级：智力 +1、内力回复 +0.03%、智慧 +0.05%、稀有发现 +0.2%', max: 8 },
  { id: 'dojo', name: '道场', icon: '🥋', sub: 'attack', desc: '每级：攻击 +1、攻速 +0.5%、施法速度 +0.5%、智慧 +0.05%', max: 8 },
  { id: 'gym', name: '健身房', icon: '🏋️', sub: 'melee', desc: '每级：近战 +1、智慧 +0.05%、稀有发现 +0.2%', max: 8 },
  { id: 'armory', name: '军械库', icon: '🛡️', sub: 'defense', desc: '每级：防御 +1、智慧 +0.05%、稀有发现 +0.2%', max: 8 },
  { id: 'archery', name: '射箭场', icon: '🎯', sub: 'ranged', desc: '每级：远程 +1、智慧 +0.05%、稀有发现 +0.2%', max: 8 },
  { id: 'mystic', name: '秘法书房', icon: '🔮', sub: 'magic', desc: '每级：魔法 +1、智慧 +0.05%、稀有发现 +0.2%', max: 8 }
];
function houseCost(lv) { // lv: 当前等级(0-7)，返回升到 lv+1 的花费
  return { gold: Math.round(50000 * Math.pow(3.2, lv)), wood: 10 * Math.pow(2, lv), woodTier: lv, food: 5 * Math.pow(2, lv), foodTier: lv };
}

/* ---------- 任务板 ---------- */
const TASK_KINDS = [
  { id: 'gather', name: '采集', icon: '🧺', desc: '采集指定物品' },
  { id: 'artisan', name: '制作', icon: '🔨', desc: '制作指定物品' },
  { id: 'combat', name: '讨伐', icon: '⚔️', desc: '击败指定区域的怪物' }
];
const TASK_DIFF = [
  { id: 1, name: '简单', mul: 1.0, col: '#5fd08a' },
  { id: 2, name: '普通', mul: 1.6, col: '#4fa8f0' },
  { id: 3, name: '困难', mul: 2.4, col: '#a86ff0' },
  { id: 4, name: '精英', mul: 3.6, col: '#f0a13b' },
  { id: 5, name: '传说', mul: 5.5, col: '#f0645f' }
];

/* ---------- 代币商店 ---------- */
const TOKEN_SHOP = [
  { id: 't_cd1', name: '任务冷却 -1 小时', cost: 100, max: 1, desc: '任务生成间隔 8h → 7h' },
  { id: 't_cd2', name: '任务冷却 -1 小时', cost: 200, max: 1, desc: '任务生成间隔 7h → 6h', need: 't_cd1' },
  { id: 't_cd3', name: '任务冷却 -1 小时', cost: 400, max: 1, desc: '任务生成间隔 6h → 5h', need: 't_cd2' },
  { id: 't_cd4', name: '任务冷却 -1 小时', cost: 800, max: 1, desc: '任务生成间隔 5h → 4h', need: 't_cd3' },
  { id: 't_slot', name: '+1 任务栏位', cost: 250, max: 6, desc: '任务板上限 +1（基础 6）' },
  { id: 't_off1', name: '离线时长 +6 小时', cost: 300, max: 1, desc: '离线结算上限 24h → 30h' },
  { id: 't_off2', name: '离线时长 +6 小时', cost: 700, max: 1, desc: '离线结算上限 30h → 36h', need: 't_off1' },
  { id: 't_rate', name: '任务奖励 +25%', cost: 500, max: 4, desc: '任务金币与代币奖励 +25%' },
  { id: 't_dmg', name: '任务徽章 · 伤害', cost: 600, max: 5, desc: '全局伤害 +4%' },
  { id: 't_spd', name: '任务徽章 · 速度', cost: 600, max: 5, desc: '全局动作速度 +4%' }
];

/* ---------- 牛铃商店 ---------- */
const BELL_SHOP = [
  { id: 'b_bell5', name: '牛铃 ×5', cost: 0, kind: 'pack', desc: '（示例：充值入口）', disabled: true },
  { id: 'b_offline', name: '离线时长 +12 小时', cost: 3, max: 2, desc: '离线结算上限 +12 小时' },
  { id: 'b_xp', name: '全局经验 +10%', cost: 5, max: 5, desc: '所有技能经验 +10%' },
  { id: 'b_rare', name: '稀有发现 +5%', cost: 4, max: 5, desc: '所有稀有掉落几率 +5%' },
  { id: 'b_slot', name: '背包扩容 +20 格', cost: 2, max: 10, desc: '战斗背包栏位 +20' },
  { id: 'b_pool', name: '专精池上限 +25%', cost: 6, max: 3, desc: '所有专精池容量 +25%' }
];

/* ---------- 公会 ---------- */
const GUILD_NAMES = ['银河牧牛人', '星尘挤奶工', '奶酪圣殿', '超新星远征队', '虚空茶话会', '彩虹牛骑士团', '沐莓甜品铺', '奥术木匠行'];

/* ---------- 世界频道语料 ---------- */
const CHAT_LINES = [
  '有人带新手打 {zone} 吗？组队经验加成很香～',
  '刚在 {zone} 出了 {item}，运气爆棚！',
  '求问 {skill} 怎么冲级最快？',
  '市场 {item} 涨价了，囤货的赚麻了',
  '专精池 95% 检查点真的强，效率直接起飞',
  '{zone} 的 BOSS 有点硬，建议先强化装备',
  '收 {item} 大量，价格好说，私聊',
  '离线 24 小时回来，{skill} 直接升了 8 级',
  '奶酪锻造做彩虹套真的很费牛奶…',
  '炼金嬗变又失败了，心态崩了 😭',
  '公会招人，要求总等级 300+',
  '强化 +10 成功了！感谢附魔手套'
];

/* ---------- 排行榜 NPC ---------- */
const NPC_NAMES = ['奶牛大魔王', '星尘小笼包', '奶酪超人', '银河摆渡人', '沐莓奶茶', '奥术老张', '彩虹牛牛', '虚空摸鱼王', '超新星咸鱼', '挤奶工小李', '苔藓史莱姆', '牛铃收藏家', '铁斧阿强', '钓鱼佬老王', '星海第一奶'];
