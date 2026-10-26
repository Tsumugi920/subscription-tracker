/**
 * 续费提醒路由：/api/reminders?days=30
 * 返回未来 N 天内要续费的生效中订阅；
 * renewDate 已经过期的订阅会按计费周期滚动到下一次续费日。
 */
const express = require('express');
const db = require('../db');
const { localToday, nextRenewDate, daysBetween, monthlyCost } = require('../date-utils');

const router = express.Router();

router.get('/', (req, res) => {
  const data = db.load();
  const today = localToday();

  let days = Number(req.query.days);
  if (!Number.isFinite(days) || days <= 0) days = 30;
  days = Math.min(Math.round(days), 365);

  const items = [];
  for (const sub of data.subscriptions) {
    if (sub.status !== 'active') continue;
    const renewDate = nextRenewDate(sub, today);
    const daysLeft = daysBetween(today, renewDate);
    if (daysLeft <= days) {
      items.push({
        id: sub.id,
        name: sub.name,
        category: sub.category,
        cycle: sub.cycle,
        price: sub.price,
        currency: sub.currency,
        renewDate,
        daysLeft,
        monthlyCost: monthlyCost(sub),
      });
    }
  }

  items.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
  res.json({ from: today, withinDays: days, count: items.length, data: items });
});

module.exports = router;
