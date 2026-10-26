/**
 * 数据持久层：所有订阅数据保存在 server/data.json。
 * 首次启动（data.json 不存在或损坏）时自动写入 15 条示例订阅，
 * 示例日期按「启动当天」动态生成，保证任何时候初始化都能看到合理的续费提醒。
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function pad(n) { return String(n).padStart(2, '0'); }
function localIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function isoFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIso(d);
}

// 内置 15 条示例订阅
// renewInDays：几天后续费（生效中）；cancelledAgo：几天前取消（取消记录示例）
const SAMPLE_DEFS = [
  { name: 'Netflix 标准版',       category: '视频娱乐', cycle: 'monthly', price: 45,   renewInDays: 3,   startAgo: 400, notes: '和家人共享的标准套餐' },
  { name: 'ChatGPT Plus',         category: 'AI 工具',  cycle: 'monthly', price: 140,  renewInDays: 1,   startAgo: 210, notes: '主力 AI 助手' },
  { name: '百度网盘超级会员',     category: '云存储',   cycle: 'monthly', price: 30,   renewInDays: 2,   startAgo: 650, notes: '照片与工作资料备份' },
  { name: 'iCloud+ 200GB',        category: '云存储',   cycle: 'monthly', price: 21,   renewInDays: 6,   startAgo: 900, notes: '手机照片同步' },
  { name: 'Spotify Premium',      category: '音乐',     cycle: 'monthly', price: 16.9, renewInDays: 7,   startAgo: 520, notes: '' },
  { name: 'GitHub Copilot',       category: '开发工具', cycle: 'monthly', price: 72,   renewInDays: 9,   startAgo: 300, notes: '写代码补全' },
  { name: '爱奇艺黄金会员',       category: '视频娱乐', cycle: 'monthly', price: 25,   renewInDays: 11,  startAgo: 260, notes: '' },
  { name: 'Adobe Creative Cloud', category: '设计创作', cycle: 'monthly', price: 68,   renewInDays: 21,  startAgo: 480, notes: '单应用套餐' },
  { name: 'YouTube Premium',      category: '视频娱乐', cycle: 'monthly', price: 25.9, renewInDays: 26,  startAgo: 190, notes: '' },
  { name: 'Notion Plus',          category: '办公效率', cycle: 'monthly', price: 60,   renewInDays: 34,  startAgo: 320, notes: '笔记与知识库' },
  { name: '网易云音乐黑胶 VIP',   category: '音乐',     cycle: 'yearly',  price: 128,  renewInDays: 82,  startAgo: 620, notes: '' },
  { name: 'Microsoft 365 个人版', category: '办公效率', cycle: 'yearly',  price: 398,  renewInDays: 136, startAgo: 700, notes: '' },
  { name: '健身房年卡',           category: '生活服务', cycle: 'yearly',  price: 2880, renewInDays: 190, startAgo: 500, notes: '工作日晚间力量训练' },
  { name: '腾讯视频 VIP',         category: '视频娱乐', cycle: 'monthly', price: 20,   cancelledAgo: 40, startAgo: 540, notes: '涨价后改用爱奇艺' },
  { name: '印象笔记高级版',       category: '办公效率', cycle: 'yearly',  price: 168,  cancelledAgo: 70, startAgo: 810, notes: '功能与 Notion 重复' },
];

let cache = null;
let writeChain = Promise.resolve();

function seed() {
  const now = new Date().toISOString();
  const subscriptions = SAMPLE_DEFS.map((def, i) => {
    const cancelled = def.renewInDays === undefined;
    return {
      id: i + 1,
      name: def.name,
      category: def.category,
      cycle: def.cycle,
      price: def.price,
      currency: 'CNY',
      startDate: isoFromNow(-def.startAgo),
      renewDate: cancelled ? isoFromNow(-def.cancelledAgo) : isoFromNow(def.renewInDays),
      status: cancelled ? 'cancelled' : 'active',
      cancelDate: cancelled ? isoFromNow(-def.cancelledAgo) : null,
      notes: def.notes || '',
      createdAt: now,
      updatedAt: now,
    };
  });
  return { nextId: subscriptions.length + 1, seededAt: now, subscriptions };
}

async function init() {
  if (!cache) {
    try {
      if (fs.existsSync(DATA_FILE)) {
        cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (err) {
      console.error('data.json 解析失败，将重新写入示例数据：', err.message);
      cache = null;
    }
  }
  if (!cache || !Array.isArray(cache.subscriptions)) {
    cache = seed();
    await persist();
    console.log(`已写入 ${cache.subscriptions.length} 条示例订阅 -> ${DATA_FILE}`);
  }
  return cache;
}

function load() {
  if (!cache) throw new Error('数据尚未初始化，请先调用 db.init()');
  return cache;
}

function nextId() {
  const data = load();
  return data.nextId++;
}

// 串行化写盘，避免并发写入互相覆盖
function persist() {
  const snapshot = cache;
  writeChain = writeChain
    .then(() => fs.promises.writeFile(DATA_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8'))
    .catch((err) => console.error('写入 data.json 失败：', err));
  return writeChain;
}

module.exports = { DATA_FILE, init, load, nextId, persist };
