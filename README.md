# Subscription Tracker · 订阅管理

一个前后端一体的订阅服务管理工具：记录各类订阅（视频 / 音乐 / 云盘 / AI 工具…）的计费周期、费用、续费日与分类，自动把不同周期折算成月费用并汇总月度总支出，生成续费提醒，并保留取消记录与统计。

## 功能

- **订阅列表**：名称、分类、计费周期（每周 / 每月 / 每季 / 每年）、费用、下次续费日，支持关键字搜索与按分类 / 周期筛选，可新增、编辑、取消、恢复、删除
- **月度总支出**：仪表盘展示折算后的月度总支出与年化支出
- **续费提醒**：按 7 / 30 / 90 天查看即将续费的订阅，顶栏角标实时显示 30 天内待续费数量
- **取消记录与统计**：取消的订阅保留记录（含取消日期），可一键恢复；统计页展示分类占比、近 6 个月支出趋势、周期分布与月费用 Top 5

## 技术栈与端口

- 后端：Node.js + Express，REST API，数据持久化在 `server/data.json`（JSON 文件，无需数据库）
- 前端：原生 HTML / CSS / JavaScript（ES Modules），由后端静态托管，无构建步骤
- 端口：**3019**（启动时可用环境变量 `PORT` 覆盖）

## 目录结构

```
subscription-tracker/
├── package.json              # npm 配置（npm start 启动）
├── README.md
├── client/                   # 前端
│   ├── index.html            # 页面骨架（仪表盘 + 四个页签 + 新增/编辑弹窗）
│   ├── style.css             # 样式
│   ├── app.js                # 前端入口：页签切换、仪表盘
│   └── js/
│       ├── api.js            # REST API 封装
│       ├── subs.js           # 订阅列表 / 新增 / 编辑 / 取消 / 删除 / 取消记录
│       ├── reminders.js      # 续费提醒
│       ├── stats.js          # 支出统计图表
│       └── format.js         # 金额 / 日期 / 周期格式化工具
└── server/                   # 后端
    ├── index.js              # Express 入口（端口 3019）
    ├── db.js                 # data.json 读写与 15 条示例数据
    ├── date-utils.js         # 周期滚动 / 月费用折算 / 日期校验工具
    ├── data.json             # 数据文件（首次启动自动生成示例数据）
    └── routes/
        ├── subs.js           # /api/subs 增删改查、取消 / 恢复
        ├── reminders.js      # /api/reminders 续费提醒查询
        └── stats.js          # /api/stats 月度支出汇总与趋势
```

## 安装与启动

要求 Node.js ≥ 16。

```bash
cd /data/home/zcode-projects/subscription-tracker
npm install
npm start
```

然后浏览器打开 <http://localhost:3019>。

首次启动时如果 `server/data.json` 不存在，会自动写入 **15 条示例订阅**（其中 13 条生效中、2 条取消记录示例）。示例日期按启动当天动态生成，部分订阅的续费日就在未来几天内，便于直接查看续费提醒效果。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/subs` | 订阅列表，支持 `status` / `category` / `cycle` / `search` / `sort` 参数 |
| GET | `/api/subs/:id` | 订阅详情 |
| POST | `/api/subs` | 新增订阅 |
| PUT | `/api/subs/:id` | 更新订阅（传要修改的字段即可） |
| POST | `/api/subs/:id/cancel` | 取消订阅（保留记录） |
| POST | `/api/subs/:id/restore` | 恢复已取消的订阅 |
| DELETE | `/api/subs/:id` | 删除订阅记录 |
| GET | `/api/reminders?days=30` | 未来 N 天内待续费的订阅 |
| GET | `/api/stats/summary` | 月度支出汇总（总额、年化、分类占比、周期分布、取消节省） |
| GET | `/api/stats/trend?months=6` | 近 N 个月支出趋势 |

订阅字段：`name`（必填）、`cycle`（weekly / monthly / quarterly / yearly，必填）、`price`（元，必填）、`renewDate`（YYYY-MM-DD，必填）、`category`、`startDate`、`notes`、`status`。

### curl 示例

```bash
# 列出全部订阅
curl -s http://localhost:3019/api/subs

# 新增订阅
curl -s -X POST http://localhost:3019/api/subs \
  -H 'Content-Type: application/json' \
  -d '{"name":"Claude Pro","category":"AI 工具","cycle":"monthly","price":140,"renewDate":"2026-11-05"}'

# 月度支出汇总
curl -s http://localhost:3019/api/stats/summary

# 续费提醒（30 天内）
curl -s "http://localhost:3019/api/reminders?days=30"
```

## 数据文件

所有数据保存在 `server/data.json`，每次增删改都会立即写盘。想重置数据，停掉服务后删除该文件再启动 `npm start`，即可重新生成 15 条示例订阅。
