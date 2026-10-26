/**
 * 订阅模块：订阅列表渲染与筛选、新增/编辑弹窗、取消/恢复/删除，以及「取消记录」页签。
 */
import { api } from './api.js';
import {
  formatMoney,
  cycleLabel,
  cyclePer,
  statusLabel,
  monthlyCost,
  escapeHtml,
  toast,
  addDaysIso,
} from './format.js';

const DEFAULT_CATEGORIES = [
  '视频娱乐', '音乐', '云存储', '办公效率', 'AI 工具', '开发工具', '设计创作', '生活服务', '其他',
];

const $ = (sel) => document.querySelector(sel);

const filters = { search: '', category: '', cycle: '' };
let categories = [...DEFAULT_CATEGORIES];
let editingId = null;
const names = {}; // id -> 订阅名称，用于确认弹窗文案
let onChanged = () => {};

export function initSubsPanel({ onChanged: cb } = {}) {
  onChanged = cb || onChanged;

  $('#search-input').addEventListener('input', (e) => { filters.search = e.target.value.trim(); refreshSubs(); });
  $('#filter-category').addEventListener('change', (e) => { filters.category = e.target.value; refreshSubs(); });
  $('#filter-cycle').addEventListener('change', (e) => { filters.cycle = e.target.value; refreshSubs(); });
  $('#btn-add').addEventListener('click', openCreateDialog);
  $('#dialog-cancel').addEventListener('click', () => $('#sub-dialog').close());
  $('#sub-form').addEventListener('submit', onFormSubmit);
  $('#subs-tbody').addEventListener('click', onRowAction);
  $('#cancelled-tbody').addEventListener('click', onRowAction);

  buildCategoryOptions();
}

async function buildCategoryOptions() {
  try {
    const res = await api.listSubs({});
    categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...res.data.map((s) => s.category)]));
  } catch (err) {
    console.error('分类选项加载失败:', err);
  }
  const options = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  $('#filter-category').innerHTML = `<option value="">全部分类</option>${options}`;
  $('#category-list').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  if (filters.category) $('#filter-category').value = filters.category;
}

/** 订阅列表（默认只看生效中的订阅） */
export async function refreshSubs() {
  try {
    const res = await api.listSubs({
      status: 'active',
      search: filters.search,
      category: filters.category,
      cycle: filters.cycle,
    });
    renderSubs(res.data);
  } catch (err) {
    toast('订阅列表加载失败：' + err.message, true);
  }
}

/** 取消记录页签 */
export async function refreshCancelled() {
  try {
    const res = await api.listSubs({ status: 'cancelled' });
    renderCancelled(res.data);
  } catch (err) {
    toast('取消记录加载失败：' + err.message, true);
  }
}

function renderSubs(list) {
  list.forEach((s) => { names[s.id] = s.name; });
  $('#subs-count').textContent = `（${list.length} 条）`;
  $('#subs-empty').classList.toggle('hidden', list.length > 0);
  $('#subs-tbody').innerHTML = list.map((sub) => {
    const renewCell = sub.status === 'active'
      ? `<div class="renew">${sub.nextRenewDate}</div>${sub.daysLeft <= 7 ? `<span class="chip warn">还剩 ${sub.daysLeft} 天</span>` : ''}`
      : '<span class="muted">—</span>';
    return `
      <tr data-id="${sub.id}">
        <td>
          <div class="sub-name">${escapeHtml(sub.name)}</div>
          ${sub.notes ? `<div class="notes muted">${escapeHtml(sub.notes)}</div>` : ''}
        </td>
        <td><span class="chip">${escapeHtml(sub.category)}</span></td>
        <td>${cycleLabel(sub.cycle)}</td>
        <td class="num">
          <strong>${formatMoney(sub.price)}</strong><span class="muted">${cyclePer(sub.cycle)}</span>
          <div class="muted small-text">折合 ${formatMoney(sub.monthlyCost)}/月</div>
        </td>
        <td>${renewCell}</td>
        <td><span class="chip ${sub.status === 'active' ? 'ok' : 'danger'}">${statusLabel(sub.status)}</span></td>
        <td class="actions">
          <button class="btn small" data-action="edit">编辑</button>
          ${sub.status === 'active'
            ? '<button class="btn small warn-btn" data-action="cancel">取消订阅</button>'
            : '<button class="btn small" data-action="restore">恢复</button>'}
          <button class="btn small danger" data-action="delete">删除</button>
        </td>
      </tr>`;
  }).join('');
}

function renderCancelled(list) {
  list.forEach((s) => { names[s.id] = s.name; });
  const saved = list.reduce((sum, s) => sum + monthlyCost(s), 0);
  $('#cancelled-summary').textContent = list.length
    ? `（共 ${list.length} 条，恢复前每月可省 ${formatMoney(saved)}）`
    : '';
  $('#cancelled-empty').classList.toggle('hidden', list.length > 0);
  $('#cancelled-tbody').innerHTML = list.map((sub) => `
    <tr data-id="${sub.id}">
      <td><div class="sub-name">${escapeHtml(sub.name)}</div></td>
      <td><span class="chip">${escapeHtml(sub.category)}</span></td>
      <td>${cycleLabel(sub.cycle)}</td>
      <td class="num">${formatMoney(sub.price)}<span class="muted">${cyclePer(sub.cycle)}</span></td>
      <td>${sub.cancelDate || '—'}</td>
      <td class="muted">${escapeHtml(sub.notes || '—')}</td>
      <td class="actions">
        <button class="btn small" data-action="restore">恢复</button>
        <button class="btn small danger" data-action="delete">删除</button>
      </td>
    </tr>`).join('');
}

async function onRowAction(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tr = btn.closest('tr');
  if (!tr) return;

  const id = Number(tr.dataset.id);
  const action = btn.dataset.action;
  const name = names[id] || '该订阅';

  if (action === 'edit') {
    await openEditDialog(id);
    return;
  }

  const confirms = {
    cancel: `确定取消订阅「${name}」吗？记录会保留在「取消记录」里。`,
    delete: `确定删除「${name}」吗？该记录会被彻底移除，不可恢复。`,
  };
  if (confirms[action] && !window.confirm(confirms[action])) return;

  try {
    if (action === 'cancel') {
      await api.cancelSub(id);
      toast('已取消订阅');
    } else if (action === 'restore') {
      await api.restoreSub(id);
      toast('已恢复订阅');
    } else if (action === 'delete') {
      await api.deleteSub(id);
      toast('已删除订阅');
    }
    refreshSubs();
    refreshCancelled();
    onChanged();
  } catch (err) {
    toast(err.message, true);
  }
}

function openCreateDialog() {
  editingId = null;
  const form = $('#sub-form');
  form.reset();
  form.elements.renewDate.value = addDaysIso(30);
  $('#dialog-title').textContent = '新增订阅';
  $('#sub-dialog').showModal();
}

async function openEditDialog(id) {
  try {
    const res = await api.getSub(id);
    const sub = res.data;
    editingId = id;
    const form = $('#sub-form');
    form.elements.name.value = sub.name;
    form.elements.category.value = sub.category;
    form.elements.cycle.value = sub.cycle;
    form.elements.price.value = sub.price;
    form.elements.renewDate.value = sub.renewDate;
    form.elements.notes.value = sub.notes || '';
    $('#dialog-title').textContent = `编辑订阅：${sub.name}`;
    $('#sub-dialog').showModal();
  } catch (err) {
    toast(err.message, true);
  }
}

async function onFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.elements.name.value.trim(),
    category: form.elements.category.value.trim() || '其他',
    cycle: form.elements.cycle.value,
    price: Number(form.elements.price.value),
    renewDate: form.elements.renewDate.value,
    notes: form.elements.notes.value.trim(),
  };

  if (!payload.name) { toast('请填写订阅名称', true); return; }
  if (!Number.isFinite(payload.price) || payload.price < 0) { toast('请填写有效的费用', true); return; }
  if (!payload.renewDate) { toast('请选择下次续费日期', true); return; }

  try {
    if (editingId) {
      await api.updateSub(editingId, payload);
      toast('订阅已更新');
    } else {
      await api.createSub(payload);
      toast('订阅已添加');
      buildCategoryOptions();
    }
    $('#sub-dialog').close();
    editingId = null;
    refreshSubs();
    refreshCancelled();
    onChanged();
  } catch (err) {
    toast(err.message, true);
  }
}
