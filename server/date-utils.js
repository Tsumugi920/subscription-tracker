/**
 * 日期与金额换算工具，供各路由复用（日期一律使用服务器本地时区，格式 YYYY-MM-DD）。
 */

function pad(n) { return String(n).padStart(2, '0'); }

function localIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localToday() {
  return localIso(new Date());
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** 把日期字符串向前滚动一个计费周期 */
function addCycle(dateStr, cycle) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (cycle === 'weekly') dt.setDate(dt.getDate() + 7);
  else if (cycle === 'monthly') dt.setMonth(dt.getMonth() + 1);
  else if (cycle === 'quarterly') dt.setMonth(dt.getMonth() + 3);
  else if (cycle === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
  return localIso(dt);
}

/** 生效中订阅的下一次续费日（renewDate 已过期则按周期向前滚动到未来） */
function nextRenewDate(sub, today = localToday()) {
  let date = sub.renewDate;
  let guard = 0;
  while (date < today && guard < 1000) {
    date = addCycle(date, sub.cycle);
    guard += 1;
  }
  return date;
}

function daysBetween(fromStr, toStr) {
  const a = new Date(`${fromStr}T00:00:00`);
  const b = new Date(`${toStr}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 把任意周期的费用折算成月费用 */
function monthlyCost(sub) {
  const price = Number(sub.price) || 0;
  if (sub.cycle === 'weekly') return round2((price * 52) / 12);
  if (sub.cycle === 'quarterly') return round2(price / 3);
  if (sub.cycle === 'yearly') return round2(price / 12);
  return round2(price);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 距今 offset 个月的那个自然月：首日 / 末日 / YYYY-MM 标签 */
function monthRange(offset) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return {
    start: localIso(first),
    end: localIso(lastDay),
    label: `${first.getFullYear()}-${pad(first.getMonth() + 1)}`,
  };
}

module.exports = {
  localIso,
  localToday,
  isValidDate,
  addCycle,
  nextRenewDate,
  daysBetween,
  monthlyCost,
  round2,
  monthRange,
};
