# Codex 重置雷达接口调研

日期：2026-05-31
阶段：Super Dev research

## 结论

X 没有官方 RSS。官方 X API v2 可用，但目前是 pay-per-use，需要开发者 token，不适合这个项目作为默认依赖。

可落地的免费方案不是单个接口，而是“多源 RSS 探测 + 稳定 JSON 兜底”：

1. 免费 RSS 实例池：FxTwitter/Nitter/XCancel/OpenRSS/RSSHub 自托管或公共实例，按可用性逐个探测。
2. 公开 radar JSON：`https://codexradar.com/current.json`，当前最稳定；`https://codex-reset-radar.pages.dev/current.json` 仍可作为同源镜像参考。
3. 静态种子：所有上游失败时保底，避免页面空白。
4. X API v2：保留可选增强，不要求用户配置 token。

## 2026-06-08 复查

`codex-reset-radar.pages.dev` 当前已经升级为 v2 聚合结构，和 `codexradar.com` 内容一致。它聚合了当前窗口、24/48h 概率、正负信号、最近窗口、RSS open/close alert、官方 X、社群 X、评论样本、OpenAI Status、市场叙事和 model_iq。

我们的策略需要比它更严格：把“官方 reset 承诺”“个人 10X 用量奖励”“普通 Codex 热度”“个人 quota / weekly reset”分开权重，避免把热度或用量奖励误判成全体重置窗口。

## 官方 X API

### Recent Search

接口：`GET https://api.x.com/2/tweets/search/recent`

用途：搜索最近 7 天公开帖子。适合查：

```text
("codex reset" OR "usage limits" OR "rate limit" OR "Resetting the limits" OR "Time to go /fast") (from:thsottiaux OR from:sama OR codex) -is:retweet
```

缺点：需要 Bearer Token，并且按资源读取消耗计费。

### User Timeline

接口：

```text
GET /2/users/by/username/:username
GET /2/users/:id/tweets
```

用途：定向盯 `@thsottiaux`、`@sama`。

缺点：仍然需要 token。

### Filtered Stream

接口：

```text
GET /2/tweets/search/stream
POST /2/tweets/search/stream/rules
```

用途：秒级实时流。

结论：不适合 MVP。需要长连接和更复杂的 Worker/Queue 设计。

## 免费 RSS 源实测

### FxTwitter / FxEmbed

文档支持：

```text
https://fxtwitter.com/{handle}/feed.xml
```

实测：

- `https://fxtwitter.com/thsottiaux/feed.xml`：可用，返回 Tibo 时间线 RSS。
- `https://fxtwitter.com/sama/feed.xml`：可用，返回 Sam 时间线 RSS。
- Tibo feed 中已包含 `Resetting the limits tomorrow morning` 与 `Time to go /fast` 那条强信号。

结论：这是当前最可用的免费 RSS 源，已放到 Worker 默认实例池第一优先级。

### RSSHub

文档支持：

```text
/twitter/user/:id
/x/user/:id
```

实测公共 `rsshub.app`：

- `/twitter/user/thsottiaux`：跳到 Google 404。
- `/x/user/thsottiaux`：403，并提示 demo instance 不适合生产。

结论：RSSHub 适合自托管，公共实例只能作为弱探测源。

### Nitter / XCancel / OpenRSS

测试过：

```text
https://nitter.net/{handle}/rss
https://xcancel.com/{handle}/rss
https://rss.xcancel.com/{handle}/rss
https://openrss.org/x.com/{handle}
https://nitter.poast.org/{handle}/rss
https://nitter.tiekoetter.com/{handle}/rss
https://nitter.space/{handle}/rss
```

结果：

- `nitter.net`：HTTP 200 但空响应，不可用。
- 多个 Nitter 实例：403 或浏览器校验。
- `xcancel.com` / `rss.xcancel.com`：能返回 RSS，但返回的是 “RSS reader not yet whitelisted” 提示，需要给 xcancel 申请白名单后才是真 feed。
- `openrss.org/x.com/thsottiaux`：返回 HTML 页面，不是可直接消费的 RSS。

结论：这些源适合放在动态探测池里，谁可用用谁；当前稳定性低于 FxTwitter。

### RSS.app / TwitRSS

RSS.app 有界面化免费试用，但不是可直接稳定调用的免费公开 API。TwitRSS 当前没有可用的公开用户 feed 路径。

结论：不作为自动化主链路。

## 当前最强信号

公开 radar JSON 当前记录：

```text
Five million users would agree. Resetting the limits tomorrow morning to celebrate.

Time to go /fast
```

来源：

```text
https://x.com/thsottiaux/status/2060964284117782996
```

这比 “I will reset the usage limits” 更直接。

## 时区结论

`tomorrow morning` 不是北京时间早上。

2026-05-31 这次历史信号的中国用户观察窗口曾展示为：

```text
2026-06-01 下午 - 2026-06-02 凌晨
```

原因：

- 如果按欧洲早上 6/1 08:00-12:00，换算中国为 6/1 14:00-18:00。
- 如果按美西早上 6/1 08:00-12:00 PDT，换算中国为 6/1 23:00-6/2 03:00。

页面应该以中国窗口为主，美国/欧洲只作为参照。

## 实现策略

Worker Cron 每 15 分钟刷新：

1. 探测 `FREE_RSS_TEMPLATES` 实例池，并过滤 XCancel whitelist notice / OpenRSS HTML 这类假 item。
2. 读取公开 radar JSON。
3. 如果配置了 `X_BEARER_TOKEN`，额外走 X API v2。
4. 合并、去重、打分、写入 KV。
5. 前端读取 `/api/current`。

环境变量：

```text
FREE_RSS_TEMPLATES=https://fxtwitter.com/{handle}/feed.xml,https://nitter.net/{handle}/rss,https://xcancel.com/{handle}/rss,https://openrss.org/x.com/{handle},https://rsshub.app/x/user/{handle}
X_BEARER_TOKEN=可选
```
