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
  { id: 'icespear', name: '冰矛', icon: '❄️', style: 'magic', mp: 14, cd: 6, mult: 1.85, targets: 1, lvl: 8, desc: '对单体造成 185% 冰霜伤害' },
  { id: 'storm', name: '星暴', icon: '🌠', style: 'magic', mp: 24, cd: 12, mult: 1.7, targets: 'all', lvl: 30, desc: '对全体敌人造成 170% 伤害' },
  { id: 'toughness', name: '坚韧', icon: '🛡️', style: 'any', mp: 15, cd: 35, buff: { armor: 0.5, dur: 15 }, targets: 0, lvl: 15, desc: '15 秒内护甲 +50%' },
  { id: 'meditate', name: '冥想', icon: '🧘', style: 'any', mp: 0, cd: 40, buff: { regen: 3, dur: 10 }, targets: 0, lvl: 12, desc: '10 秒内每秒回复 3% 内力' }
];

/* ---------- 区域与怪物 ---------- */
const MONSTERS = {};
function mkMob(id, name, ic, z, mul, style, dmgType) {
  /* 全部系数取自 balance.js；dmg 与 pen 的增长必须跟得上玩家护甲的成长
     （装备属性按 TIER_SCALE 2.4 倍/档增长），否则后期战斗零风险。 */
  const o = {
    id: id, name: name, icon: ic, zone: z, style: style || 'slash', dmgType: dmgType || 'physical',
    hp: Math.round(NUM.MOB_HP_BASE * Math.pow(NUM.MOB_HP_GROWTH, z) * (mul.hp || 1)),
    acc: Math.round(NUM.MOB_ACC_BASE * Math.pow(NUM.MOB_ACC_GROWTH, z) * (mul.acc || 1)),
    eva: Math.round(NUM.MOB_EVA_BASE * Math.pow(NUM.MOB_EVA_GROWTH, z) * (mul.eva || 1)),
    armor: Math.round(NUM.MOB_ARMOR_BASE * Math.pow(NUM.MOB_ARMOR_GROWTH, z) * (mul.armor || 1)),
    resist: Math.round(NUM.MOB_RESIST_BASE * Math.pow(NUM.MOB_ARMOR_GROWTH, z) * (mul.resist || 1)),
    dmg: Math.round(NUM.MOB_DMG_BASE * Math.pow(NUM.MOB_DMG_GROWTH, z) * (mul.dmg || 1)),
    spd: mul.spd || (3.0 - z * 0.08),
    xp: Math.round(NUM.MOB_XP_BASE * Math.pow(NUM.MOB_XP_GROWTH, z) * (mul.xp || 1)),
    pen: Math.round(NUM.MOB_PEN_BASE * Math.pow(NUM.MOB_PEN_GROWTH, z))
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
  bo.dmg = Math.round(bo.dmg * NUM.BOSS_DMG_MUL);   /* Boss 不能只是血厚 */
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
  /* 金币增长原为 3.2^lv：7 间全满需 1.75e9，与后期产出严重脱节（最后 2~3 级是死墙）。
     改用 2.4^lv 后全满约 2.75e8，落在「后期稳定产出 × 数十小时」的可达区间。 */
  return {
    gold: Math.round(NUM.RANCH_GOLD_BASE * Math.pow(NUM.RANCH_GOLD_GROWTH, lv)),
    wood: NUM.RANCH_WOOD_BASE * Math.pow(NUM.RANCH_MAT_GROWTH, lv), woodTier: lv,
    food: NUM.RANCH_FOOD_BASE * Math.pow(NUM.RANCH_MAT_GROWTH, lv), foodTier: lv
  };
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
  { id: 't_cd1', name: '任务冷却 -1 小时 Ⅰ', cost: 100, max: 1, desc: '任务生成间隔 8h → 7h' },
  { id: 't_cd2', name: '任务冷却 -1 小时 Ⅱ', cost: 200, max: 1, desc: '任务生成间隔 7h → 6h', need: 't_cd1' },
  { id: 't_cd3', name: '任务冷却 -1 小时 Ⅲ', cost: 400, max: 1, desc: '任务生成间隔 6h → 5h', need: 't_cd2' },
  { id: 't_cd4', name: '任务冷却 -1 小时 Ⅳ', cost: 800, max: 1, desc: '任务生成间隔 5h → 4h', need: 't_cd3' },
  { id: 't_slot', name: '+1 任务栏位', cost: 250, max: 6, desc: '任务板上限 +1（基础 6）' },
  { id: 't_off1', name: '离线时长 +6 小时 Ⅰ', cost: 300, max: 1, desc: '离线结算上限 24h → 30h' },
  { id: 't_off2', name: '离线时长 +6 小时 Ⅱ', cost: 700, max: 1, desc: '离线结算上限 30h → 36h', need: 't_off1' },
  { id: 't_rate', name: '任务奖励 +25%', cost: 500, max: 4, desc: '任务金币与代币奖励 +25%' },
  { id: 't_dmg', name: '任务徽章 · 伤害', cost: 600, max: 5, desc: '全局伤害 +4%' },
  { id: 't_spd', name: '任务徽章 · 速度', cost: 600, max: 5, desc: '全局动作速度 +4%' }
];

/* ---------- 牛铃商店 ---------- */
const BELL_SHOP = [
  { id: 'b_dlv', name: '牛铃补给箱 ×5', cost: 0, kind: 'pack', desc: '暂未开放，敬请期待', disabled: true },
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

/* ============================================================
 *  第三方素材署名表
 *  全部来自 Kenney（www.kenney.nl），Creative Commons CC0 1.0。
 *  CC0 不强制署名，但项目主动列出来源以示尊重。
 *  若日后加入 CC BY 素材，必须在 author 后注明原名并保留 lic/url。
 * ============================================================ */
const CREDITS = [
  {
    pkg: 'UI Pack (2.0)', use: '按钮底图、进度条槽、勾选/叉/星标图标',
    author: 'Kenney Vleugels（Kenney.nl）', lic: 'CC0 1.0',
    url: 'https://kenney.nl/assets/ui-pack'
  },
  {
    pkg: 'Interface Sounds (1.0)', use: '界面点击、切页、确认、错误提示音',
    author: 'Kenney（Kenney.nl）', lic: 'CC0 1.0',
    url: 'https://kenney.nl/assets/interface-sounds'
  },
  {
    pkg: 'Impact Sounds (1.0)', use: '采集、制造、出售、战斗命中、升级铃',
    author: 'Kenney（Kenney.nl）', lic: 'CC0 1.0',
    url: 'https://kenney.nl/assets/impact-sounds'
  },
  {
    pkg: 'Sci-Fi Sounds (1.0)', use: '面板开启/关闭、护盾、科幻氛围音',
    author: 'Kenney（Kenney.nl）', lic: 'CC0 1.0',
    url: 'https://kenney.nl/assets/sci-fi-sounds'
  },
  {
    pkg: 'Music Jingles', use: '技能升级与成就达成的旋律',
    author: 'Kenney Vleugels（Kenney.nl）', lic: 'CC0 1.0',
    url: 'https://kenney.nl/assets/music-jingles'
  }
];

/* ============================================================
 *  隐私政策正文
 *  两端（手机 / 桌面）共用同一份数据，避免文案漂移。
 *  每一条都必须与应用的真实行为严格对应，不可套模板。
 * ============================================================ */
const PRIVACY = {
  ver: '1.0',
  updated: '2026-10-09',
  secs: [
    {
      h: '📌 一句话总结',
      p: ['《星海牧场》是一款纯离线单机游戏：不联网、不收集、不上传你的任何个人信息。']
    },
    {
      h: '1. 我们收集哪些信息',
      p: ['我们不收集任何信息。应用内没有账号注册，没有登录，也不需要填写手机号、邮箱等任何资料。',
        '游戏过程中产生的全部数据（技能等级、物品、金币、装备、角色昵称等）都只保存在你自己的设备上。']
    },
    {
      h: '2. 会不会联网传输数据',
      p: ['不会。应用不具备网络访问权限，游戏本体与全部美术、音效资源均打包在安装文件内部，运行时不向任何服务器发起请求。',
        '离线结算、排行榜与同服对手均由本地算法即时推算，不涉及与其他玩家的数据交换。']
    },
    {
      h: '3. 存档存在哪里',
      p: ['游戏进度保存在本应用的应用私有数据区（浏览器本地存储）中，其他应用无法读取。',
        '卸载应用或清除应用数据时，进度会一并删除，且无法通过我们找回 —— 请在重装前留意是否需要自行备份。']
    },
    {
      h: '4. 什么情况下数据会离开设备',
      p: ['唯一可能的情况：你的安卓系统开启了云备份（例如 Google 备份或手机厂商提供的云服务）。此时本应用的私有数据可能被包含进系统备份并上传到你本人的云账户。',
        '这一行为由系统备份机制完成，我们无法读取、也无法控制其中的内容。若你希望游戏进度完全不离开本机，请在设备的系统设置中关闭应用数据备份。']
    },
    {
      h: '5. 第三方服务',
      p: ['本应用未集成广告 SDK、统计分析 SDK、崩溃上报、支付渠道或任何社交分享组件。',
        '应用内置的音效与界面贴图来自 Kenney（CC0 1.0 公共领域贡献），字体符号部分使用 Noto Emoji；这些素材以文件形式内置于安装包中，运行时不会向素材作者或任何第三方发送数据。相关授权与署名可在游戏内「关于」页查看。']
    },
    {
      h: '6. 权限说明',
      p: ['本应用未申请任何安卓系统权限：不读取通讯录、位置、相册、通讯状态和通话记录，也不尝试获取设备标识符。']
    },
    {
      h: '7. 儿童隐私',
      p: ['本游戏不含任何针对儿童定向收集行为，也没有年龄限制内容，不限定使用年龄段。由于我们本来就不收集任何数据，因此不存在儿童个人信息的采集、使用或披露问题。']
    },
    {
      h: '8. 政策更新',
      p: ['若未来版本的收集或传输行为发生变化，我们会先更新本页内容，并在版本号旁标注更新日期。继续使用即视为知悉更新后的条款。']
    },
    {
      h: '9. 联系我们',
      p: ['如对本政策有疑问，可通过本应用在应用商店页面上的开发者联系方式与我们取得联系。']
    }
  ]
};

/* ---------- 排行榜 NPC ---------- */
const NPC_NAMES = ['奶牛大魔王', '星尘小笼包', '奶酪游侠', '银河摆渡人', '沐莓奶茶', '奥术老张', '彩虹牛牛', '虚空摸鱼王', '超新星咸鱼', '挤奶工小李', '苔藓史莱姆', '牛铃收藏家', '铁斧阿强', '钓鱼佬老王', '星海第一牧'];
