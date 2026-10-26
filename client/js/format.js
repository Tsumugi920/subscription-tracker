/**
 * 前端通用小工具：金额 / 日期 / 周期文案 / HTML 转义 / 轻提示。
 */

export function formatMoney(value) {
  const n = Number(value) || 0;
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function cycleLabel(cycle) {
  return { weekly: '每周', monthly: '每月', quarterly: '每季', yearly: '每年' }[cycle] || cycle || '';
}

export function cyclePer(cycle) {
  return { weekly: ' /周', monthly: ' /月', quarterly: ' /季', yearly: ' /年' }[cycle] || '';
}

export function priceLabel(sub) {
  return formatMoney(sub.price) + cyclePer(sub.cycle);
}

export function statusLabel(status) {
  return status === 'cancelled' ? '已取消' : '生效中';
}

/** 与后端一致的「折合月费用」换算 */
export function monthlyCost(sub) {
  const price = Number(sub.price) || 0;
  if (sub.cycle === 'weekly') return (price * 52) / 12;
  if (sub.cycle === 'quarterly') return price / 3;
  if (sub.cycle === 'yearly') return price / 12;
  return price;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function pad(n) { return String(n).padStart(2, '0'); }

export function localIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return localIso(new Date());
}

export function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIso(d);
}

let toastTimer = null;
export function toast(message, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', Boolean(isError));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
