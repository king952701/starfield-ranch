/* ============================================================
 *  星海牧场 · 数据层（物品 / 技能 / 动作）
 *  题材与数值体系均为本项目原创设计。
 * ============================================================ */

const RARITY = ['普通', '优良', '精良', '稀有', '史诗', '传说', '神话', '永恒'];
const RCOL = ['#9aa3b2', '#5fd08a', '#4fa8f0', '#a86ff0', '#f0a13b', '#f0645f', '#5fe6d0', '#ffd257'];
const LVL_REQ = [1, 10, 20, 32, 45, 60, 76, 92];
const TIER_LVL = [1, 15, 30, 45, 60, 75, 90];
const TIER_SCALE = [1, 3.2, 9, 24, 60, 150, 360];
const MASTERY_CAP = 99;

function pbase(base, t) { return Math.max(1, Math.round(base * Math.pow(2.15, t))); }

/* ---------- 物品表 ---------- */
const ITEMS = {};
const ITEM_LIST = [];
function def(o) { o.icon = o.icon || '📦'; o.price = o.price || 1; ITEMS[o.id] = o; ITEM_LIST.push(o); return o; }

function addFamily(arr, base, cat, extra) {
  arr.forEach(function (m, i) {
    const o = { id: m[0], name: m[1], icon: m[2], cat: cat, tier: i, price: pbase(base, i) };
    if (extra) extra(o, i);
    def(o);
  });
}

const MILK = [
  ['milk', '牛奶', '🥛'], ['goat_milk', '山羊奶', '🍼'], ['sheep_milk', '绵羊奶', '🥣'],
  ['stardust_milk', '星尘奶', '✨'], ['comet_milk', '彗星奶', '☄️'], ['galaxy_milk', '银河奶', '🌌'],
  ['void_milk', '虚空奶', '🕳️'], ['nova_milk', '超新星奶', '💥']
];
addFamily(MILK, 5, 'mat');

const BERRY = [
  ['blueberry', '蓝莓', '🫐'], ['blackberry', '黑莓', '🍇'], ['strawberry', '草莓', '🍓'],
  ['mulberry', '桑葚', '🍒'], ['mooberry', '沐莓', '🍑'], ['marsberry', '火星莓', '🥭'],
  ['starberry', '星莓', '🍍'], ['voidberry', '虚空莓', '🥝']
];
addFamily(BERRY, 6, 'mat');

const WOOD = [
  ['log', '原木', '🪵'], ['birch_log', '桦木', '🌲'], ['cedar_log', '雪松', '🌳'],
  ['purpleheart_log', '紫心木', '🎋'], ['ginkgo_log', '银杏木', '🍁'], ['redwood_log', '红木', '🍂'],
  ['starwood_log', '星铁木', '🪓'], ['arcane_log', '奥术木', '🪄']
];
addFamily(WOOD, 7, 'mat');

const BAR = [
  ['cheese_bar', '奶酪锭', '🧈'], ['curd_bar', '凝乳锭', '🥛'], ['cheddar_bar', '切达锭', '🧆'],
  ['gouda_bar', '豪达锭', '🥨'], ['brie_bar', '布里锭', '🧀'], ['galaxy_bar', '银河锭', '🌌'],
  ['void_bar', '虚空锭', '🕳️'], ['nova_bar', '新星锭', '💫']
];
addFamily(BAR, 24, 'mat');

const FIBER = [
  ['cotton', '棉花', '☁️'], ['linen', '亚麻', '🌾'], ['bamboo', '竹纤维', '🎍'],
  ['silk', '蚕丝', '🧵'], ['starweave', '星缕', '🪡'], ['arcanecloth', '秘法丝', '🔮'],
  ['voidsilk', '虚空绢', '🌑'], ['novasilk', '新星绸', '🌟']
];
addFamily(FIBER, 9, 'mat');

const CLOTH = [
  ['cotton_cloth', '棉布', '🧶'], ['linen_cloth', '亚麻布', '👕'], ['bamboo_cloth', '竹布', '🎋'],
  ['silk_cloth', '丝绸', '👘'], ['starweave_cloth', '星缕布', '🌠'], ['arcane_cloth', '秘法缎', '🔮'],
  ['void_cloth', '虚空绢', '🌑'], ['nova_cloth', '新星绸', '✨']
];
addFamily(CLOTH, 32, 'mat');

def({ id: 'cream', name: '奶油', icon: '🧈', cat: 'mat', price: 14 });
def({ id: 'herb', name: '草药', icon: '🌿', cat: 'mat', price: 16 });
def({ id: 'tea_leaf', name: '茶叶', icon: '🍃', cat: 'mat', price: 30 });
def({ id: 'coffee_leaf', name: '咖啡叶', icon: '🍂', cat: 'mat', price: 26 });
def({ id: 'essence', name: '星精华', icon: '💎', cat: 'mat', price: 90 });
def({ id: 'gem', name: '星辉宝石', icon: '💠', cat: 'mat', price: 260 });
def({ id: 'chest_common', name: '陨石宝箱', icon: '📦', cat: 'mat', price: 500 });
def({ id: 'chest_rare', name: '星海秘藏', icon: '🎁', cat: 'mat', price: 4000 });

const FOOD = [
  ['cupcake', '纸杯蛋糕', '🧁'], ['donut', '甜甜圈', '🍩'], ['cake', '蛋糕', '🍰'],
  ['yogurt', '酸奶', '🥣'], ['gummy', '软糖', '🍬'], ['pie', '派', '🥧'],
  ['pudding', '布丁', '🍮'], ['feast', '星海盛宴', '🍱']
];
addFamily(FOOD, 30, 'food', function (o, i) {
  o.heal = Math.round(30 * Math.pow(2.2, i));
  o.mana = i >= 3 ? Math.round(o.heal * 0.6) : 0;
});

const COFFEE = [
  ['coffee0', '咖啡', '☕'], ['coffee1', '浓咖啡', '☕'], ['coffee2', '摩卡', '🥤'],
  ['coffee3', '拿铁', '🥛'], ['coffee4', '星尘咖啡', '✨'], ['coffee5', '银河咖啡', '🌌'],
  ['coffee6', '虚空咖啡', '🕳️'], ['coffee7', '超新星咖啡', '💥']
];
addFamily(COFFEE, 40, 'drink', function (o, i) {
  o.buff = { kind: 'combat', dmg: 0.05 + 0.03 * i, dur: 300 + 60 * i };
});

const TEA = [
  ['tea0', '绿茶', '🍵'], ['tea1', '红茶', '🍵'], ['tea2', '花茶', '🌸'],
  ['tea3', '草药茶', '🌿'], ['tea4', '星尘茶', '✨'], ['tea5', '银河茶', '🌌'],
  ['tea6', '虚空茶', '🕳️'], ['tea7', '超新星茶', '💥']
];
addFamily(TEA, 40, 'drink', function (o, i) {
  o.buff = { kind: 'skill', eff: 0.05 + 0.03 * i, dur: 300 + 60 * i };
});

/* ---------- 技能定义 ---------- */
const SKILLS = [
  { id: 'milking', name: '挤奶', icon: '🐄', cat: 'gather', desc: '从星海牧场的奶牛身上获取各类牛奶。' },
  { id: 'foraging', name: '觅食', icon: '🧺', cat: 'gather', desc: '在草场上采集莓果、纤维与咖啡叶。' },
  { id: 'woodcutting', name: '伐木', icon: '🪓', cat: 'gather', desc: '砍伐星海林木获得木材。' },
  { id: 'cheesesmithing', name: '奶酪锻造', icon: '🧀', cat: 'artisan', desc: '把牛奶硬化成奶酪锭，锻造近战武器与板甲。' },
  { id: 'crafting', name: '手工艺', icon: '🔨', cat: 'artisan', desc: '制作工具、珠宝与特殊装备。' },
  { id: 'tailoring', name: '裁缝', icon: '🧵', cat: 'artisan', desc: '把纤维织成布料，缝制远程与魔法护甲。' },
  { id: 'cooking', name: '烹饪', icon: '🍳', cat: 'culinary', desc: '把莓果与牛奶做成恢复体力/内力的食物。' },
  { id: 'brewing', name: '酿造', icon: '🍵', cat: 'culinary', desc: '冲泡咖啡与茶，为战斗与采集提供增益。' },
  { id: 'alchemy', name: '炼金', icon: '⚗️', cat: 'chance', desc: '把物品转化为金币、精华或更高阶材料。' },
  { id: 'enhancing', name: '强化', icon: '✨', cat: 'chance', desc: '消耗星精华强化装备，失败会退阶。' },
  { id: 'combat', name: '战斗', icon: '⚔️', cat: 'combat', desc: '与星海怪物交战，历练七项战斗素养。' }
];
const SKILL_MAP = {};
SKILLS.forEach(function (s) { SKILL_MAP[s.id] = s; });

const COMBAT_SUBS = [
  { id: 'stamina', name: '体力', icon: '❤️', desc: '每级 +10 最大生命' },
  { id: 'intelligence', name: '智力', icon: '💙', desc: '每级 +10 最大内力' },
  { id: 'attack', name: '攻击', icon: '🎯', desc: '提升命中、攻速与施法速度' },
  { id: 'defense', name: '防御', icon: '🛡️', desc: '提升闪避、护甲与抗性' },
  { id: 'melee', name: '近战', icon: '🗡️', desc: '提升近战伤害' },
  { id: 'ranged', name: '远程', icon: '🏹', desc: '提升远程伤害' },
  { id: 'magic', name: '魔法', icon: '🔮', desc: '提升魔法伤害' }
];

/* ---------- 工具 ---------- */
const TOOLS = {
  milking: ['木桶', '铜桶', '铁桶', '银桶', '金桶', '星尘桶', '银河桶'],
  foraging: ['草篮', '藤篮', '柳条篮', '铁皮篮', '银丝篮', '星尘篮', '银河篮'],
  woodcutting: ['石斧', '铜斧', '铁斧', '钢斧', '秘银斧', '星尘斧', '银河斧'],
  cheesesmithing: ['木锤', '铜锤', '铁锤', '钢锤', '秘银锤', '星尘锤', '银河锤'],
  crafting: ['木钳', '铜钳', '铁钳', '钢钳', '秘银钳', '星尘钳', '银河钳'],
  tailoring: ['骨针', '铜针', '铁针', '钢针', '秘银针', '星尘针', '银河针'],
  cooking: ['石刀', '铜刀', '铁刀', '钢刀', '秘银刀', '星尘刀', '银河刀'],
  brewing: ['陶壶', '铜壶', '铁壶', '钢壶', '秘银壶', '星尘壶', '银河壶']
};
const TOOL_ICON = {
  milking: '🪣', foraging: '🧺', woodcutting: '🪓', cheesesmithing: '🔨',
  crafting: '🛠️', tailoring: '🪡', cooking: '🔪', brewing: '🫖'
};
const TOOL_EFF = [3, 6, 10, 15, 22, 32, 45];

/* ---------- 装备 ---------- */
const SLOTS = [
  { id: 'head', name: '头部', ic: '🪖' }, { id: 'neck', name: '项链', ic: '📿' },
  { id: 'cape', name: '披风', ic: '🧣' }, { id: 'body', name: '身体', ic: '🛡️' },
  { id: 'legs', name: '腿部', ic: '👖' }, { id: 'feet', name: '靴', ic: '🥾' },
  { id: 'hands', name: '手套', ic: '🧤' }, { id: 'weapon', name: '主手', ic: '🗡️' },
  { id: 'offhand', name: '副手', ic: '🪬' }, { id: 'ring', name: '戒指', ic: '💍' },
  { id: 'tool', name: '工具', ic: '🛠️' }
];
const SLOT_MAP = {};
SLOTS.forEach(function (s) { SLOT_MAP[s.id] = s; });

const ARMOR_LINES = {
  plate: {
    nm: ['奶酪', '翠绿', '蔚蓝', '泡泡', '绯红', '彩虹', '圣辉'], mat: 'bar', skill: 'cheesesmithing',
    slots: { head: ['头盔', '🪖', 2], body: ['胸甲', '🛡️', 3], legs: ['腿甲', '👖', 2], feet: ['重靴', '🥾', 1], hands: ['铁手套', '🧤', 1] },
    stats: function (s) { return { armor: 4 * s, eva: 0.4 * s, hp: 6 * s }; }
  },
  ranged: {
    nm: ['粗制', '爬虫', '哥布', '野兽', '幽影', '星辉', '虚空'], mat: 'cloth', skill: 'tailoring',
    slots: { head: ['兜帽', '🪶', 2], body: ['皮衣', '🧥', 3], legs: ['皮裤', '👖', 2], feet: ['软靴', '🥿', 1], hands: ['护腕', '🧤', 1] },
    stats: function (s) { return { armor: 1.2 * s, eva: 3 * s, rangedDmg: 1.1 * s, crit: NUM.CRIT_PER_SCALE * 0.5 * s, hp: 3 * s }; }
  },
  magic: {
    nm: ['棉', '亚麻', '竹', '丝', '辉光', '星辉', '虚空'], mat: 'cloth', skill: 'tailoring',
    slots: { head: ['法帽', '🎓', 2], body: ['法袍', '👘', 3], legs: ['法裙', '👖', 2], feet: ['法靴', '👞', 1], hands: ['法手套', '🧤', 1] },
    stats: function (s) { return { resist: 3 * s, eva: 2 * s, magicDmg: 1.2 * s, mp: 4 * s, hp: 2 * s }; }
  }
};

const WEAPON_LINES = [
  { k: 'sword', nm: ['奶酪剑', '翠绿剑', '蔚蓝剑', '泡泡剑', '绯红剑', '彩虹剑', '圣辉剑'], ic: '🗡️', style: 'slash', dmgType: 'physical', spd: 2.4, dmg: 2.2, acc: 2.2, mat: 'bar', qty: 3 },
  { k: 'spear', nm: ['奶酪矛', '翠绿矛', '蔚蓝矛', '泡泡矛', '绯红矛', '彩虹矛', '圣辉矛'], ic: '🔱', style: 'stab', dmgType: 'physical', spd: 2.8, dmg: 1.9, acc: 3.0, mat: 'bar', qty: 3 },
  { k: 'mace', nm: ['奶酪锤', '翠绿锤', '蔚蓝锤', '泡泡锤', '绯红锤', '彩虹锤', '圣辉锤'], ic: '🔨', style: 'smash', dmgType: 'physical', spd: 3.4, dmg: 3.0, acc: 0.9, mat: 'bar', qty: 3 },
  { k: 'bulwark', nm: ['奶酪壁垒', '翠绿壁垒', '蔚蓝壁垒', '泡泡壁垒', '绯红壁垒', '彩虹壁垒', '圣辉壁垒'], ic: '🛡️', style: 'smash', dmgType: 'physical', spd: 3.6, dmg: 1.0, acc: 0.5, mat: 'bar', qty: 3, extra: function (s) { return { armor: 6 * s, hp: 9 * s, defensive: 1 }; } },
  { k: 'bow', nm: ['木弓', '桦木弓', '雪松弓', '紫心弓', '银杏弓', '红木弓', '奥术弓'], ic: '🏹', style: 'ranged', dmgType: 'physical', spd: 2.2, dmg: 2.0, acc: 2.4, mat: 'wood', qty: 3, crit: NUM.CRIT_PER_SCALE },
  { k: 'crossbow', nm: ['木弩', '桦木弩', '雪松弩', '紫心弩', '银杏弩', '红木弩', '奥术弩'], ic: '🎯', style: 'ranged', dmgType: 'physical', spd: 3.0, dmg: 2.8, acc: 1.4, mat: 'wood', qty: 3, crit: NUM.CRIT_PER_SCALE * 0.7 },
  { k: 'fire_staff', nm: ['木火杖', '桦木火杖', '雪松火杖', '紫心火杖', '银杏火杖', '红木火杖', '奥术火杖'], ic: '🔥', style: 'magic', dmgType: 'fire', spd: 2.6, dmg: 2.6, acc: 1.5, mat: 'wood', qty: 2, proc: 'blaze' },
  { k: 'water_staff', nm: ['木水杖', '桦木水杖', '雪松水杖', '紫心水杖', '银杏水杖', '红木水杖', '奥术水杖'], ic: '💧', style: 'magic', dmgType: 'water', spd: 2.6, dmg: 2.6, acc: 1.5, mat: 'wood', qty: 2, proc: 'ripple' },
  { k: 'nature_staff', nm: ['木自然杖', '桦木自然杖', '雪松自然杖', '紫心自然杖', '银杏自然杖', '红木自然杖', '奥术自然杖'], ic: '🍃', style: 'magic', dmgType: 'nature', spd: 2.6, dmg: 2.6, acc: 1.5, mat: 'wood', qty: 2, proc: 'bloom' }
];

const MAT_ARR = { bar: BAR, wood: WOOD, cloth: CLOTH };
function matId(kind, t) { return MAT_ARR[kind][t][0]; }
function equipPrice(t) { return Math.round(140 * Math.pow(2.6, t)); }

Object.keys(ARMOR_LINES).forEach(function (lineKey) {
  const L = ARMOR_LINES[lineKey];
  Object.keys(L.slots).forEach(function (slot) {
    const info = L.slots[slot];
    for (let t = 0; t < 7; t++) {
      const s = TIER_SCALE[t];
      const inp = {}; inp[matId(L.mat, t)] = info[2];
      def({
        id: lineKey + '_' + slot + '_' + t, name: L.nm[t] + info[0], icon: info[1],
        cat: 'equip', slot: slot, line: lineKey, tier: t, lvl: TIER_LVL[t],
        st: L.stats(s), price: equipPrice(t),
        recipe: { skill: L.skill, time: 4 + 0.8 * t, xp: Math.round(20 * Math.pow(2.4, t)), in: inp }
      });
    }
  });
});

WEAPON_LINES.forEach(function (W2) {
  for (let t = 0; t < 7; t++) {
    const s = TIER_SCALE[t];
    const st = { acc: W2.acc * s, spd: W2.spd };
    st[W2.style === 'ranged' ? 'rangedDmg' : (W2.style === 'magic' ? 'magicDmg' : 'meleeDmg')] = W2.dmg * s;
    if (W2.crit) st.crit = W2.crit * s;
    if (W2.proc) st.proc = W2.proc;
    if (W2.extra) { const e = W2.extra(s); Object.keys(e).forEach(function (k) { st[k] = e[k]; }); }
    const inp = {}; inp[matId(W2.mat, t)] = W2.qty;
    def({
      id: W2.k + '_' + t, name: W2.nm[t], icon: W2.ic, cat: 'equip', slot: 'weapon',
      line: W2.k, tier: t, lvl: TIER_LVL[t], style: W2.style, dmgType: W2.dmgType,
      st: st, price: equipPrice(t),
      recipe: { skill: W2.mat === 'bar' ? 'cheesesmithing' : 'crafting', time: 4 + 0.8 * t, xp: Math.round(22 * Math.pow(2.4, t)), in: inp }
    });
  }
});

const RING_NM = ['铜戒', '银戒', '金戒', '宝石戒', '星尘戒', '银河戒', '圣辉戒'];
const NECK_NM = ['皮绳', '银链', '金链', '符文链', '星尘链', '银河链', '圣辉链'];
for (let t = 0; t < 7; t++) {
  const s = TIER_SCALE[t];
  def({
    id: 'ring_' + t, name: RING_NM[t], icon: '💍', cat: 'equip', slot: 'ring', line: 'jewel', tier: t, lvl: TIER_LVL[t],
    st: { acc: 2 * s, eva: 1 * s, hp: 4 * s, rareFind: NUM.RING_RARE * s }, price: equipPrice(t),
    recipe: { skill: 'crafting', time: 4 + 0.8 * t, xp: Math.round(22 * Math.pow(2.4, t)), in: { [matId('bar', t)]: 1 } }
  });
  def({
    id: 'neck_' + t, name: NECK_NM[t], icon: '📿', cat: 'equip', slot: 'neck', line: 'jewel', tier: t, lvl: TIER_LVL[t],
    st: { meleeDmg: 1.5 * s, rangedDmg: 1.5 * s, magicDmg: 1.5 * s, hp: 5 * s, wisdom: NUM.AMULET_WISDOM * s }, price: equipPrice(t),
    recipe: { skill: 'crafting', time: 4 + 0.8 * t, xp: Math.round(22 * Math.pow(2.4, t)), in: { [matId('bar', t)]: 1 } }
  });
}

Object.keys(TOOLS).forEach(function (sk) {
  for (let t = 0; t < 7; t++) {
    const eff = {}; eff[sk] = TOOL_EFF[t];
    def({
      id: 'tool_' + sk + '_' + t, name: TOOLS[sk][t], icon: TOOL_ICON[sk], cat: 'equip', slot: 'tool',
      line: 'tool', tier: t, lvl: TIER_LVL[t], toolSkill: sk, eff: eff, st: {}, price: equipPrice(t),
      recipe: { skill: 'crafting', time: 3 + 0.6 * t, xp: Math.round(18 * Math.pow(2.3, t)), in: { [matId('wood', t)]: 2, [matId('bar', t)]: 1 } }
    });
  }
});

def({ id: 'boots_collector', name: '采集者之靴', icon: '🥾', cat: 'equip', slot: 'feet', tier: 7, lvl: 30, st: { armor: 20, eva: 20, hp: 40 }, eff: { milking: 10, foraging: 10, woodcutting: 10 }, price: 90000, recipe: { skill: 'crafting', time: 20, xp: 3000, in: { bamboo_cloth: 3, cream: 20 } } });
def({ id: 'eye_watch', name: '鹰眼怀表', icon: '⌚', cat: 'equip', slot: 'offhand', tier: 7, lvl: 35, st: { acc: 40, eva: 20 }, eff: { cheesesmithing: 10, crafting: 10, tailoring: 10 }, price: 120000, recipe: { skill: 'crafting', time: 22, xp: 4000, in: { gouda_bar: 2, gem: 3 } } });
def({ id: 'chef_hat', name: '红厨帽', icon: '🧑‍🍳', cat: 'equip', slot: 'head', tier: 7, lvl: 30, st: { armor: 15, hp: 30 }, eff: { cooking: 10, brewing: 10 }, price: 90000, recipe: { skill: 'tailoring', time: 18, xp: 3000, in: { bamboo_cloth: 3, strawberry: 30 } } });
def({ id: 'ench_gloves', name: '附魔手套', icon: '🧤', cat: 'equip', slot: 'hands', tier: 7, lvl: 40, st: { armor: 25, acc: 30 }, eff: { alchemy: 10 }, enhanceSpeed: 10, price: 150000, recipe: { skill: 'crafting', time: 24, xp: 5000, in: { silk_cloth: 2, essence: 30 } } });
def({ id: 'clover_cape', name: '幸运四叶草', icon: '🍀', cat: 'equip', slot: 'cape', tier: 7, lvl: 25, st: { eva: 30, rareFind: 0.15, hp: 60 }, price: 100000, recipe: { skill: 'tailoring', time: 20, xp: 3500, in: { silk_cloth: 4, herb: 40 } } });
def({ id: 'sage_cape', name: '智者斗篷', icon: '🧣', cat: 'equip', slot: 'cape', tier: 7, lvl: 35, st: { eva: 40, wisdom: 0.06, mp: 60 }, price: 140000, recipe: { skill: 'tailoring', time: 22, xp: 4500, in: { silk_cloth: 4, tea_leaf: 30 } } });
def({ id: 'star_cape', name: '星海披风', icon: '🌌', cat: 'equip', slot: 'cape', tier: 8, lvl: 60, st: { eva: 90, armor: 60, rareFind: 0.1, amplify: 0.05, hp: 150 }, price: 400000, recipe: { skill: 'tailoring', time: 30, xp: 12000, in: { nova_cloth: 4, gem: 5 } } });

/* ---------- 动作表 ---------- */
const ACTIONS = {};
SKILLS.forEach(function (s) { ACTIONS[s.id] = []; });
function act(skill, o) { o.skill = skill; o.kind = o.kind || 'gather'; ACTIONS[skill].push(o); return o; }
function gxp(i) { return Math.round(25 * Math.pow(1.95, i)); }
function gtime(i) { return 3 + 0.2 * i; }

MILK.forEach(function (m, i) {
  act('milking', { id: 'milk_' + i, name: '挤' + m[1], lvl: LVL_REQ[i], time: gtime(i), xp: gxp(i), out: { [m[0]]: 1 }, rare: { cream: 0.08 }, tool: 'milking', icon: m[2] });
});
BERRY.forEach(function (m, i) {
  act('foraging', { id: 'berry_' + i, name: '采摘' + m[1], lvl: LVL_REQ[i], time: gtime(i), xp: gxp(i), out: { [m[0]]: 1 }, rare: { herb: 0.12, coffee_leaf: 0.08 }, tool: 'foraging', icon: m[2] });
});
FIBER.forEach(function (m, i) {
  act('foraging', { id: 'fiber_' + i, name: '收集' + m[1], lvl: LVL_REQ[i], time: gtime(i) + 0.4, xp: Math.round(gxp(i) * 0.8), out: { [m[0]]: 1 }, rare: { herb: 0.06 }, tool: 'foraging', icon: m[2] });
});
WOOD.forEach(function (m, i) {
  act('woodcutting', { id: 'wood_' + i, name: '砍伐' + m[1], lvl: LVL_REQ[i], time: gtime(i), xp: gxp(i), out: { [m[0]]: 1 }, rare: { herb: 0.05 }, tool: 'woodcutting', icon: m[2] });
});
BAR.forEach(function (m, i) {
  act('cheesesmithing', { id: 'smelt_' + i, name: '熔炼' + m[1], lvl: LVL_REQ[i], time: 4 + 0.3 * i, xp: Math.round(30 * Math.pow(2.1, i)), kind: 'artisan', in: { [MILK[i][0]]: 2 }, out: { [m[0]]: 1 }, tool: 'cheesesmithing', icon: m[2] });
});
CLOTH.forEach(function (m, i) {
  act('tailoring', { id: 'weave_' + i, name: '纺织' + m[1], lvl: LVL_REQ[i], time: 4 + 0.3 * i, xp: Math.round(30 * Math.pow(2.1, i)), kind: 'artisan', in: { [FIBER[i][0]]: 2 }, out: { [m[0]]: 1 }, tool: 'tailoring', icon: m[2] });
});
FOOD.forEach(function (m, i) {
  act('cooking', { id: 'cook_' + i, name: '烹饪' + m[1], lvl: LVL_REQ[i], time: 3.5 + 0.3 * i, xp: Math.round(32 * Math.pow(2.1, i)), kind: 'cook', in: { [BERRY[i][0]]: 2, [MILK[i][0]]: 1 }, out: { [m[0]]: 1 }, tool: 'cooking', icon: m[2] });
});
COFFEE.forEach(function (m, i) {
  act('brewing', { id: 'brew_coffee_' + i, name: '冲泡' + m[1], lvl: LVL_REQ[i], time: 4 + 0.3 * i, xp: Math.round(32 * Math.pow(2.1, i)), kind: 'brew', in: { coffee_leaf: 2 + i, [BERRY[i][0]]: 1 }, out: { [m[0]]: 1 }, tool: 'brewing', icon: m[2] });
});
TEA.forEach(function (m, i) {
  act('brewing', { id: 'brew_tea_' + i, name: '冲泡' + m[1], lvl: LVL_REQ[i], time: 4 + 0.3 * i, xp: Math.round(32 * Math.pow(2.1, i)), kind: 'brew', in: { tea_leaf: 2 + i, herb: 1 }, out: { [m[0]]: 1 }, tool: 'brewing', icon: m[2] });
});

act('alchemy', { id: 'alch_coinify', name: '金币化', lvl: 1, time: 5, xp: 40, kind: 'coinify', desc: '把物品转化为金币（成功得 1.6 倍市价，失败物品消失并返还少量精华）。', icon: '💰' });
act('alchemy', { id: 'alch_decompose', name: '分解', lvl: 10, time: 5, xp: 55, kind: 'decompose', desc: '把物品分解为星精华。', icon: '💎' });
act('alchemy', { id: 'alch_transmute', name: '嬗变', lvl: 25, time: 6, xp: 90, kind: 'transmute', desc: '把 3 份低阶材料升阶为 1 份高阶材料。', icon: '♻️' });

['weapon', 'head', 'body', 'legs', 'feet', 'hands', 'ring', 'neck', 'cape', 'offhand'].forEach(function (sl) {
  act('enhancing', { id: 'enh_' + sl, name: '强化' + SLOT_MAP[sl].name, lvl: 1, time: 6, xp: 55, kind: 'enhance', slot: sl, icon: SLOT_MAP[sl].ic });
});

/* 装备配方动作（动态加入各技能） */
function recipeAction(item) {
  const a = {
    id: 'make_' + item.id, name: '制作 ' + item.name, lvl: item.lvl, time: item.recipe.time,
    xp: item.recipe.xp, kind: 'artisan', in: item.recipe.in, out: { [item.id]: 1 },
    tool: item.recipe.skill === 'tailoring' ? 'tailoring' : (item.recipe.skill === 'cheesesmithing' ? 'cheesesmithing' : 'crafting'),
    icon: item.icon, makeItem: item.id
  };
  ACTIONS[item.recipe.skill].push(a);
}
ITEM_LIST.forEach(function (it) { if (it.cat === 'equip' && it.recipe) recipeAction(it); });

/* 动作索引 */
const ACTION_MAP = {};
Object.keys(ACTIONS).forEach(function (sk) {
  ACTIONS[sk].forEach(function (a) { a.skill = sk; ACTION_MAP[sk + ':' + a.id] = a; });
});
