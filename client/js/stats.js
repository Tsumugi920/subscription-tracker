/**
 * 统计模块：分类占比、近 6 个月支出趋势、计费周期分布、月费用 Top 5。
 */
import { api } from './api.js';
import { formatMoney, cycleLabel, toast } from './format.js';

const $ = (sel) => document.querySelector(sel);

export async function refreshStats() {
  try {
    const [summary, trend, subsRes] = await Promise.all([
      api.getStatsSummary(),
      api.getStatsTrend(6),
      api.listSubs({ status: 'active' }),
    ]);
    renderCategory(summary.byCategory);
    renderTrend(trend.months);
    renderCycle(summary.byCycle);
    renderTop(subsRes.data);
  } catch (err) {
    toast('统计加载失败：' + err.message, true);
  }
}

function renderCategory(byCategory) {
  const el = $('#stats-category');
  if (!byCategory || !byCategory.length) {
    el.innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }
  el.innerHTML = byCategory.map((c) => `
    <div class="hbar">
      <div class="hbar-head">
        <span>${c.category} · ${c.count} 条</span>
        <span>${formatMoney(c.monthlyTotal)} · ${c.share}%</span>
      </div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${Math.max(c.share, 1)}%"></div>
      </div>
    </div>`).join('');
}

function renderTrend(months) {
  const max = Math.max(...months.map((m) => m.total), 1);
  $('#stats-trend').innerHTML = months.map((m) => `
    <div class="vbar">
      <span class="vbar-value">${formatMoney(m.total)}</span>
      <div class="vbar-fill" style="height:${Math.max((m.total / max) * 100, 2)}%"></div>
      <span class="vbar-label">${Number(m.month.slice(5))}月</span>
    </div>`).join('');
}

function renderCycle(byCycle) {
  $('#stats-cycle').innerHTML = Object.entries(byCycle).map(([cycle, count]) => `
    <span class="chip big">${cycleLabel(cycle)} · ${count} 条</span>`).join('');
}

function renderTop(activeSubs) {
  const top = activeSubs
    .slice()
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 5);
  $('#stats-top').innerHTML = top.map((s, i) => `
    <div class="top-row">
      <span class="top-rank">${i + 1}</span>
      <span class="top-name">${s.name}</span>
      <span class="top-cost">${formatMoney(s.monthlyCost)}/月</span>
    </div>`).join('') || '<div class="empty">暂无数据</div>';
}
