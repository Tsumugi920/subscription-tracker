/**
 * subscription-tracker 后端入口
 * - 托管 client/ 下的前端静态资源
 * - 提供 REST API：/api/subs、/api/reminders、/api/stats
 * - 端口固定 3019（可用环境变量 PORT 覆盖），数据持久化在 server/data.json
 */
const path = require('path');
const express = require('express');
const db = require('./db');
const subsRouter = require('./routes/subs');
const remindersRouter = require('./routes/reminders');
const statsRouter = require('./routes/stats');

const PORT = Number(process.env.PORT) || 3019; // 项目约定端口，避开常用开发端口 3000~3018

const app = express();
app.use(express.json());

// 前端静态资源
app.use(express.static(path.join(__dirname, '..', 'client')));

// REST API 路由
app.use('/api/subs', subsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/stats', statsRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'subscription-tracker', time: new Date().toISOString() });
});

// 未匹配到的 API 路径统一返回 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.originalUrl}` });
});

// 统一错误处理
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[server error]', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log('✅ subscription-tracker 已启动');
      console.log(`   前端页面: http://localhost:${PORT}`);
      console.log(`   REST API: http://localhost:${PORT}/api/subs`);
    });
  })
  .catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
