/**
 * 订阅路由：/api/subs
 * 提供订阅的增删改查、取消（保留记录）与恢复。
 */
const express = require('express');
const db = require('../db');
const {
  localToday,
  isValidDate,
  nextRenewDate,
  daysBetween,
  monthlyCost,
} = require('../date-utils');

const router = express.Router();

const CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'];
const STATUSES = ['active', 'cancelled'];

// 包装 async 处理器，把异常交给统一的错误中间件
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 校验并提取请求体中的订阅字段；requireCore=true 时核心字段（名称/周期/费用/续费日）必填 */
function pickFields(body, requireCore) {
  const errors = [];
  const out = {};

  if (requireCore || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) errors.push('name（名称）不能为空');
    else if (name.length > 60) errors.push('name 长度不能超过 60');
    else out.name = name;
  }
  if (requireCore || body.category !== undefined) {
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : '其他';
    if (category.length > 30) errors.push('category 长度不能超过 30');
    else out.category = category;
  }
  if (requireCore || body.cycle !== undefined) {
    if (!CYCLES.includes(body.cycle)) errors.push(`cycle 必须是 ${CYCLES.join(' / ')} 之一`);
    else out.cycle = body.cycle;
  }
  if (requireCore || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('price 必须是大于等于 0 的数字');
    else out.price = Math.round(price * 100) / 100;
  }
  if (requireCore || body.renewDate !== undefined) {
    if (!isValidDate(body.renewDate)) errors.push('renewDate 必须是合法的 YYYY-MM-DD 日期');
    else out.renewDate = body.renewDate;
  }
  if (body.startDate !== undefined) {
    if (!isValidDate(body.startDate)) errors.push('startDate 必须是合法的 YYYY-MM-DD 日期');
    else out.startDate = body.startDate;
  }
  if (body.notes !== undefined) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (notes.length > 200) errors.push('notes 长度不能超过 200');
    else out.notes = notes;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push(`status 必须是 ${STATUSES.join(' / ')} 之一`);
    else out.status = body.status;
  }

  return { errors, out };
}

/** 附带派生字段：下一次续费日、剩余天数、折合月费用 */
function withDerived(sub) {
  const derived = { ...sub, monthlyCost: monthlyCost(sub) };
  if (sub.status !== 'active') {
    derived.nextRenewDate = null;
    derived.daysLeft = null;
    return derived;
  }
  const next = nextRenewDate(sub);
  derived.nextRenewDate = next;
  derived.daysLeft = daysBetween(localToday(), next);
  return derived;
}

// 列表：GET /api/subs?status=&category=&cycle=&search=&sort=
router.get('/', (req, res) => {
  const data = db.load();
  const { status, category, cycle, search, sort } = req.query;

  let list = data.subscriptions.slice();
  if (status === 'active' || status === 'cancelled') list = list.filter((s) => s.status === status);
  if (category) list = list.filter((s) => s.category === category);
  if (cycle) list = list.filter((s) => s.cycle === cycle);
  if (search) {
    const kw = String(search).toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(kw) || (s.notes || '').toLowerCase().includes(kw)
    );
  }

  const sortKey = ['name', 'price', 'renewDate', 'createdAt'].includes(sort) ? sort : 'renewDate';
  list.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0));

  res.json({ total: list.length, data: list.map(withDerived) });
});

// 详情：GET /api/subs/:id
router.get('/:id', (req, res) => {
  const data = db.load();
  const sub = data.subscriptions.find((s) => s.id === Number(req.params.id));
  if (!sub) return res.status(404).json({ error: `订阅 #${req.params.id} 不存在` });
  res.json({ data: withDerived(sub) });
});

// 新增：POST /api/subs
router.post(
  '/',
  wrap(async (req, res) => {
    const { errors, out } = pickFields(req.body || {}, true);
    if (errors.length) return res.status(400).json({ error: errors.join('；') });

    const data = db.load();
    const now = new Date().toISOString();
    const status = out.status || 'active';
    const sub = {
      id: db.nextId(),
      name: out.name,
      category: out.category,
      cycle: out.cycle,
      price: out.price,
      currency: 'CNY',
      startDate: out.startDate || localToday(),
      renewDate: out.renewDate,
      status,
      cancelDate: status === 'cancelled' ? localToday() : null,
      notes: out.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    data.subscriptions.push(sub);
    await db.persist();
    res.status(201).json({ message: '订阅已创建', data: withDerived(sub) });
  })
);

// 更新：PUT /api/subs/:id（只需传要修改的字段）
router.put(
  '/:id',
  wrap(async (req, res) => {
    const data = db.load();
    const sub = data.subscriptions.find((s) => s.id === Number(req.params.id));
    if (!sub) return res.status(404).json({ error: `订阅 #${req.params.id} 不存在` });

    const { errors, out } = pickFields(req.body || {}, false);
    if (errors.length) return res.status(400).json({ error: errors.join('；') });

    Object.assign(sub, out);
    if (out.status === 'active') sub.cancelDate = null;
    if (out.status === 'cancelled' && !sub.cancelDate) sub.cancelDate = localToday();
    sub.updatedAt = new Date().toISOString();
    await db.persist();
    res.json({ message: '订阅已更新', data: withDerived(sub) });
  })
);

// 取消订阅：POST /api/subs/:id/cancel（记录保留，进入「取消记录」）
router.post(
  '/:id/cancel',
  wrap(async (req, res) => {
    const data = db.load();
    const sub = data.subscriptions.find((s) => s.id === Number(req.params.id));
    if (!sub) return res.status(404).json({ error: `订阅 #${req.params.id} 不存在` });
    if (sub.status === 'cancelled') return res.status(400).json({ error: '该订阅已经是取消状态' });

    sub.status = 'cancelled';
    sub.cancelDate = localToday();
    sub.updatedAt = new Date().toISOString();
    await db.persist();
    res.json({ message: '已取消订阅', data: withDerived(sub) });
  })
);

// 恢复订阅：POST /api/subs/:id/restore
router.post(
  '/:id/restore',
  wrap(async (req, res) => {
    const data = db.load();
    const sub = data.subscriptions.find((s) => s.id === Number(req.params.id));
    if (!sub) return res.status(404).json({ error: `订阅 #${req.params.id} 不存在` });
    if (sub.status === 'active') return res.status(400).json({ error: '该订阅已经是生效状态' });

    sub.status = 'active';
    sub.cancelDate = null;
    sub.updatedAt = new Date().toISOString();
    await db.persist();
    res.json({ message: '已恢复订阅', data: withDerived(sub) });
  })
);

// 删除：DELETE /api/subs/:id（彻底移除记录）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const data = db.load();
    const idx = data.subscriptions.findIndex((s) => s.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: `订阅 #${req.params.id} 不存在` });

    const [removed] = data.subscriptions.splice(idx, 1);
    await db.persist();
    res.json({ message: '订阅已删除', data: removed });
  })
);

module.exports = router;
