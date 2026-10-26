/**
 * 续费提醒模块：按 7/30/90 天查看即将续费的订阅，并维护顶栏角标与仪表盘卡片。
 */
import { api } from './api.js';
import { formatMoney, priceLabel, toast } from './format.js';

const $ = (sel) => document.querySelector(sel);

let withinDays = 30;

export function initRemindersPanel() {
  document.querySelectorAll('#panel-reminders .range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      withinDays = Number(btn.dataset.days) || 30;
      document.querySelectorAll('#panel-reminders .range-btn')
        .forEach((b) => b.classList.toggle('active', b === btn));
      refreshReminders();
    });
  });

  // 「去处理」跳回订阅列表
  $('#reminders-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-goto="subs"]');
    if (btn) document.querySelector('.tab[data-tab="subs"]').click();
  });
}

function urgencyClass(daysLeft) {
  if (daysLeft <= 3) return 'u-red';
  if (daysLeft <= 7) return 'u-orange';
  if (daysLeft <= 14) return 'u-yellow';
  return 'u-green';
}

export async function refreshReminders() {
  try {
    const res = await api.getReminders(withinDays);
    const list = res.data || [];
    $('#reminders-empty').classList.toggle('hidden', list.length > 0);
    $('#reminders-list').innerHTML = list.map((item) => `
      <div class="reminder-item ${urgencyClass(item.daysLeft)}">
        <div class="reminder-when">
          <span class="days">${item.daysLeft === 0 ? '今天' : `${item.daysLeft} 天后`}</span>
          <span class="date">${item.renewDate}</span>
        </div>
        <div class="reminder-body">
          <div class="reminder-name">
            <strong>${item.name}</strong>
            <span class="chip">${item.category}</span>
          </div>
          <div class="reminder-sub muted">
            ${priceLabel(item)} · 折合每月 ${formatMoney(item.monthlyCost)}
          </div>
        </div>
        <button class="btn small" data-goto="subs">去处理</button>
      </div>`).join('');
  } catch (err) {
    toast('续费提醒加载失败：' + err.message, true);
  }
}

/** 顶栏角标 + 仪表盘「近 30 天待续费」卡片，任何数据变更后都会调用 */
export async function refreshReminderBadge() {
  try {
    const res = await api.getReminders(30);
    const badge = $('#reminder-badge');
    badge.textContent = String(res.count);
    badge.classList.toggle('hidden', !(res.count > 0));
    $('#stat-upcoming').textContent = res.count;
  } catch (err) {
    console.error('提醒角标更新失败:', err);
  }
}
