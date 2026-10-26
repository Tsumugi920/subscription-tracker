/**
 * 前端入口：页签切换、仪表盘卡片、各面板的初始化与刷新调度。
 */
import { api } from './js/api.js';
import { formatMoney, toast } from './js/format.js';
import { initSubsPanel, refreshSubs, refreshCancelled } from './js/subs.js';
import { initRemindersPanel, refreshReminders, refreshReminderBadge } from './js/reminders.js';
import { refreshStats } from './js/stats.js';

const $ = (sel) => document.querySelector(sel);

async function loadDashboard() {
  try {
    const summary = await api.getStatsSummary();
    $('#stat-monthly').textContent = formatMoney(summary.monthlyTotal);
    $('#stat-yearly').textContent = formatMoney(summary.yearlyTotal);
    $('#stat-active').textContent = summary.counts.active;
    $('#stat-total').textContent = summary.counts.total;
    $('#stat-upcoming7').textContent = summary.upcoming7Days;
    $('#stat-cancelled').textContent = summary.counts.cancelled;
    $('#stat-saved').textContent = formatMoney(summary.cancelledMonthlySaved);
  } catch (err) {
    console.error('仪表盘加载失败:', err);
    toast('仪表盘加载失败：' + err.message, true);
  }
}

// 数据发生变化后，同时刷新仪表盘与提醒角标
function refreshAll() {
  loadDashboard();
  refreshReminderBadge();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
  if (name === 'subs') refreshSubs();
  else if (name === 'reminders') refreshReminders();
  else if (name === 'cancelled') refreshCancelled();
  else if (name === 'stats') refreshStats();
}

function boot() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  initSubsPanel({ onChanged: refreshAll });
  initRemindersPanel();

  refreshAll();
  refreshSubs();
}

boot();
