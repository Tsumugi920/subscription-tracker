/**
 * 统计路由：
 * - GET /api/stats/summary        月度支出汇总（总额、年化、分类占比、周期分布、取消节省）
 * - GET /api/stats/trend?months=6 近 N 个月支出趋势（按订阅当月是否生效折算）
 */
const express = require('express');
const db = require('../db');
const {
  localToday,
  monthlyCost,
  round2,
  nextRenewDate,
  daysBetween,
  monthRange,
} = require('../date-utils');

const router = express.Router();

router.get('/summary', (req, res) => {
  const data = db.load();
  const today = localToday();
  const active = data.subscriptions.filter((s) => s.status === 'active');
  const cancelled = data.subscriptions.filter((s) => s.status === 'cancelled');

  const monthlyTotal = round2(active.reduce((sum, s) => sum + monthlyCost(s), 0));

  const categoryMap = new Map();
  const byCycle = { weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
  for (const sub of active) {
    categoryMap.set(sub.category, (categoryMap.get(sub.category) || 0) + monthlyCost(sub));
    byCycle[sub.cycle] = (byCycle[sub.cycle] || 0) + 1;
  }
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      monthlyTotal: round2(total),
      count: active.filter((s) => s.category === category).length,
      share: monthlyTotal > 0 ? Math.round((total / monthlyTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.monthlyTotal - a.monthlyTotal);

  const upcoming7Days = active.filter((s) => {
    const left = daysBetween(today, nextRenewDate(s, today));
    return left >= 0 && left <= 7;
  }).length;

  res.json({
    generatedAt: new Date().toISOString(),
    counts: { total: data.subscriptions.length, active: active.length, cancelled: cancelled.length },
    monthlyTotal,
    yearlyTotal: round2(monthlyTotal * 12),
    byCycle,
    byCategory,
    upcoming7Days,
    cancelledMonthlySaved: round2(cancelled.reduce((sum, s) => sum + monthlyCost(s), 0)),
  });
});

router.get('/trend', (req, res) => {
  let months = Number(req.query.months);
  if (!Number.isFinite(months) || months <= 0) months = 6;
  months = Math.min(Math.round(months), 24);

  const subs = db.load().subscriptions;
  const result = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const { start, end, label } = monthRange(-i);
    const total = subs.reduce((sum, s) => {
      const began = (s.startDate || '').slice(0, 10);
      const ended = s.status === 'cancelled' ? s.cancelDate || end : null;
      const alive = began <= end && (!ended || ended >= start);
      return alive ? sum + monthlyCost(s) : sum;
    }, 0);
    result.push({ month: label, total: round2(total) });
  }
  res.json({ months: result });
});

module.exports = router;
