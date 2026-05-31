# Codex 重置雷达

中文 Codex usage limits 重置信号雷达。

线上地址：

https://codex-reset-radar.sumerchaser.top/

## 数据源

默认不依赖 X token。

- 免费 RSS 实例池：FxTwitter / Nitter / XCancel / OpenRSS / RSSHub 路由，自动探测可用性。
- 公开 radar JSON：稳定兜底。
- X API v2：可选增强，配置 `X_BEARER_TOKEN` 后启用。
- 内置静态种子：所有上游失败时保底。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## Worker API

```text
GET /api/current
GET /api/current?refresh=1
GET /api/sources
GET /api/health
```

线上 Worker Cron 每 15 分钟刷新一次，并把最新快照写入 Cloudflare KV。

## Super Dev 文稿

项目文稿在：

```text
../output/codex-reset-radar-project/
```
