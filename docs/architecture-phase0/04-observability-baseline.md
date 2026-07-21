# 可观测性基线

> 目的：阶段 1+ 重构前后对比「有没有变慢 / 变坏 / 漏斗掉量」。  
> 快照日期：2026-07-21

---

## 1. 已有能力（勿删）

### 1.1 接口统计

| 组件 | 说明 |
|------|------|
| 表 `analytics_api_daily` | 按日、`route_key`、`biz_category` 聚合 cnt / sum_ms / max_ms |
| 表 `api_slow_events` | 慢请求明细（默认阈值相关逻辑在 `server.js` analytics 中间件） |
| 管理台 | 菜单 `api-analytics` →「接口统计」 |
| API | `GET /api/admin/analytics/api-stats` |

**重构基线看什么：**

- 核心 route：`POST /api/tax.php`、`GET /api/tax.php`、`POST /api/user.php`、`POST /api/auth.php`、`POST /api/payments/alipay/create`
- 日均次数、平均耗时（sum_ms/cnt）、max_ms、慢事件条数

### 1.2 转化 / 安装漏斗

| 组件 | 说明 |
|------|------|
| 表 `install_guide_track_events` | 安装页与 App 打开等 `track_*` |
| 管理台 | `install-guide-stats`、`analytics-conversion`、`channel-analysis` |
| KPI API | `conversion-kpis`、`daily-conversion`、`registration-funnel`、`install-guide-stats` 等 |

**重构基线看什么（按北京日）：**

- 独立访客 → 下载点击 → App 首次打开 → 注册成功  
- 激活相关：`activate-events`、渠道 funnel

### 1.3 主机与错误

| 组件 | 说明 |
|------|------|
| `serverMonitor.js` | 磁盘/负载等 + 邮件告警 |
| 管理台 | `server-monitor` |
| 部署 | `scripts/deploy.sh` 写 deploy marker，降低部署期误报 |

### 1.4 健康检查

- 源站：`GET http://127.0.0.1:3000/health`（compose 内）
- 边缘：`scripts/deploy.sh` 探 `http://127.0.0.1/`

---

## 2. 阶段 0 固定的「对照面板」

发版或阶段 1 合并前，在管理台记录（可截图或记到附录）：

1. **接口统计**：近 1 日 / 近 7 日，上述核心 route 的 cnt 与均时  
2. **转化分析**：当日注册率与漏斗各步  
3. **安装页统计**：浏览量、APK/iOS 点击  
4. **慢接口**：`api_slow_events` 近 24h 条数（可 SQL）

示例 SQL（只读）：

```sql
-- 近 7 日核心接口均时
SELECT stat_date, route_key, cnt,
       ROUND(sum_ms / NULLIF(cnt, 0), 1) AS avg_ms, max_ms
FROM analytics_api_daily
WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND route_key IN (
    'POST /api/tax.php',
    'GET /api/tax.php',
    'POST /api/auth.php',
    'POST /api/user.php'
  )
ORDER BY stat_date DESC, route_key;

-- 近 24h 慢请求
SELECT COUNT(*) AS slow_cnt
FROM api_slow_events
WHERE created_at >= NOW() - INTERVAL 1 DAY;
```

（表字段若有差异以库为准；`route_key` 实际值见管理台导出。）

---

## 3. 阶段 1 不得破坏的约定

- 继续写入 `analytics_api_daily` / `api_slow_events`（或提供等价替代并改管理台）。
- `track_*` 事件名保持稳定（安装漏斗字典见 `server.js` 中文映射表）。
- `/health` 与 deploy 探针行为不变。

---

## 4. 已知缺口（后续阶段改进，本阶段仅记录）

| 缺口 | 建议阶段 |
|------|----------|
| 无独立 APM / 分布式追踪 | 阶段 1 后可选接入 |
| 限流与计数在进程内存 | 多副本前需外置 |
| 前端错误未统一上报 | 前端现代化阶段 |
