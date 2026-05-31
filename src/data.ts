import type { RadarSnapshot } from "./types";

export const radarSnapshot: RadarSnapshot = {
  state: "confirmed",
  confidence: 92,
  summary:
    "Tibo 已出现更直接的官方 X 信号：明天早上重置 limits 并建议 go /fast。中国用户应重点盯 6/1 下午到 6/2 凌晨。",
  lastCheckedAt: "2026-05-31T16:47:24+08:00",
  nextScanAt: "2026-05-31T17:02:24+08:00",
  staleAfterMinutes: 45,
  sourceMode: "public-radar",
  sourceStatus: "免费 RSS 优先；不可用时读取公开雷达快照",
  sourceNote:
    "生产链路优先走 fxtwitter / Nitter / XCancel / RSSHub 等免费 RSS 实例池；没有可用 RSS 时读取公开 radar JSON；X API v2 只作为可选增强。",
  monitoredAccounts: [
    {
      id: "sama",
      name: "Sam Altman",
      handle: "@sama",
      role: "OpenAI signal",
      url: "https://x.com/sama",
      status: "quiet",
      lastSignalAt: "2026-05-20T02:31:16+08:00",
      lastSignalTitle: "Sam 点赞承诺速率限制重置"
    },
    {
      id: "tibo",
      name: "Tibo Sottiaux",
      handle: "@thsottiaux",
      role: "Codex / product signal",
      url: "https://x.com/thsottiaux",
      status: "matched",
      lastSignalAt: "2026-05-31T13:59:10+08:00",
      lastSignalTitle: "Resetting the limits tomorrow morning. Time to go /fast"
    }
  ],
  sources: [
    {
      id: "sama",
      label: "Sam Altman",
      kind: "x-account",
      handle: "@sama",
      url: "https://x.com/sama",
      health: "online",
      lastSeenAt: "2026-05-20T02:31:16+08:00",
      matchCount24h: 0,
      contributesToState: false
    },
    {
      id: "tibo",
      label: "Tibo Sottiaux",
      kind: "x-account",
      handle: "@thsottiaux",
      url: "https://x.com/thsottiaux",
      health: "online",
      lastSeenAt: "2026-05-31T13:59:10+08:00",
      matchCount24h: 2,
      contributesToState: true
    },
    {
      id: "public-radar",
      label: "Existing Codex Reset Radar",
      kind: "feed",
      url: "https://codex-reset-radar.pages.dev/current.json",
      health: "online",
      lastSeenAt: "2026-05-31T16:47:24+08:00",
      matchCount24h: 12,
      contributesToState: true
    },
    {
      id: "community",
      label: "Community X chatter",
      kind: "feed",
      health: "degraded",
      lastSeenAt: "2026-05-31T04:07:02Z",
      matchCount24h: 7,
      contributesToState: false
    }
  ],
  resetWindows: [
    {
      id: "codex-speed-window-2026-05-23-codex",
      title: "长会话压缩耗额异常补偿重置",
      status: "closed",
      openedAt: "2026-05-23T08:21:33+08:00",
      closedAt: "2026-05-24T04:14:35+08:00",
      duration: "19小时53分",
      sourceAccount: "Tibo Sottiaux",
      sourceHandle: "@thsottiaux",
      openSourceUrl: "https://x.com/thsottiaux/status/2057980213854921096",
      closeSourceUrl: "https://x.com/thsottiaux/status/2058280452851638313",
      summary:
        "Tibo 表示 Codex 长会话压缩的 cache hit rate 受回滚优化影响，导致限制消耗更快；修复后已为所有账号重置使用限制。"
    },
    {
      id: "codex-speed-window-2026-05-20-codex",
      title: "Sam 点赞承诺速率限制重置",
      status: "historical",
      openedAt: "2026-05-20T02:31:16+08:00",
      duration: "历史窗口",
      sourceAccount: "Sam Altman",
      sourceHandle: "@sama",
      openSourceUrl: "https://x.com/sama/status/2056804900017947046",
      summary: "公开雷达将 Sam 相关互动记录为一次速率限制重置窗口事件。"
    }
  ],
  signals: [
    {
      id: "tibo-tomorrow-fast",
      sourceId: "tibo",
      sourceLabel: "官方 X",
      detectedAt: "2026-05-31T13:59:10+08:00",
      type: "reset",
      confidenceDelta: 95,
      score: 100,
      predictionRelevance: 95,
      direction: "positive",
      semanticRole: "future_reset_hint",
      title: "Tibo 明确说：明天早上重置 limits",
      quote: "Five million users would agree. Resetting the limits tomorrow morning to celebrate. Time to go /fast",
      evidence: "这是当前最强信号：来自 Tibo 的官方 X 回复，直接包含 tomorrow morning 与 go /fast。",
      sourceUrl: "https://x.com/thsottiaux/status/2060964284117782996"
    },
    {
      id: "tibo-future-reset-hint",
      sourceId: "tibo",
      sourceLabel: "官方 X",
      detectedAt: "2026-05-31T06:07:43Z",
      type: "reset",
      confidenceDelta: 90,
      score: 100,
      predictionRelevance: 90,
      direction: "positive",
      semanticRole: "future_reset_hint",
      title: "Tibo 另一次确认会重置 usage limits",
      quote: "@Trident2Gold Do not worry. This has nothing to do with memory. I will reset the usage limits",
      evidence: "第二条官方确认，和 tomorrow morning 信号互相印证。",
      sourceUrl: "https://x.com/thsottiaux/status/2060966434055061834"
    },
    {
      id: "latest-limit-anomaly",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-05-31T04:07:02Z",
      type: "limit",
      confidenceDelta: 18,
      score: 65,
      predictionRelevance: 18,
      direction: "positive",
      semanticRole: "issue_or_limit_anomaly",
      title: "社区用户报告过早触发 Codex rate limit",
      evidence: "该信号说明限额体验异常，但不是官方重置承诺。",
      quote: "hitting Codex rate limit too early",
      sourceUrl: "https://x.com/shizyukara223/status/2060936062319665424"
    },
    {
      id: "community-tomorrow-fast",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-05-31T06:49:48Z",
      type: "schedule",
      confidenceDelta: 18,
      score: 45,
      predictionRelevance: 18,
      direction: "positive",
      semanticRole: "issue_or_limit_anomaly",
      title: "社区扩散：明天重置，建议今天用完额度",
      quote: "toggle on /fast and use your entire limit today, we’re getting a codex reset tomorrow",
      evidence: "社群信号，不能当官方确认，但它指向 2026-06-01，并且与 Tibo 强信号同向。",
      sourceUrl: "https://x.com/kr0der/status/2060977022969745678"
    },
    {
      id: "community-tomorrow-am",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-05-31T08:09:24Z",
      type: "schedule",
      confidenceDelta: 4,
      score: 45,
      predictionRelevance: 4,
      direction: "positive",
      semanticRole: "ambiguous_reset_chatter",
      title: "社区扩散：Codex Reset Tomorrow AM",
      quote: "Codex Reset Tomorrow AM How to best use? Use while you sleep",
      evidence: "社群传播放大了明早重置的叙事，置信权重低于 Tibo。",
      sourceUrl: "https://x.com/JinjingLiang/status/2060997056903491622"
    },
    {
      id: "community-dropping-tomorrow",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-05-31T07:50:25Z",
      type: "schedule",
      confidenceDelta: 4,
      score: 45,
      predictionRelevance: 4,
      direction: "positive",
      semanticRole: "ambiguous_reset_chatter",
      title: "社区扩散：tomorrow morning",
      quote: "Codex reset dropping tomorrow morning. Burn every credit you have left today",
      evidence: "明天早上重置的社区信号，作为扩散证据，不作为官方来源。",
      sourceUrl: "https://x.com/HarshithLucky3/status/2060992281151520907"
    },
    {
      id: "ambiguous-reset-chatter",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-05-30T13:39:47Z",
      type: "schedule",
      confidenceDelta: 4,
      score: 45,
      predictionRelevance: 4,
      direction: "positive",
      semanticRole: "ambiguous_reset_chatter",
      title: "社区猜测可能会有 Codex reset",
      evidence: "属于主观猜测，权重很低。",
      quote: "My gut is telling me we will get a Codex reset tomorrow",
      sourceUrl: "https://x.com/lumaBuilds/status/2060717810846724222"
    },
    {
      id: "tibo-window-open",
      sourceId: "tibo",
      detectedAt: "2026-05-23T08:21:33+08:00",
      type: "reset",
      confidenceDelta: 86,
      direction: "positive",
      title: "Tibo 表示长会话压缩耗额异常后已重置限制",
      evidence: "该窗口已在 2026-05-24 04:14:35 +08:00 关闭。",
      sourceUrl: "https://x.com/thsottiaux/status/2057980213854921096"
    },
    {
      id: "sam-like-window",
      sourceId: "sama",
      detectedAt: "2026-05-20T02:31:16+08:00",
      type: "reset",
      confidenceDelta: 78,
      direction: "positive",
      title: "Sam 相关互动触发一次速率限制重置窗口记录",
      evidence: "历史事件，不代表当前窗口仍然开启。",
      sourceUrl: "https://x.com/sama/status/2056804900017947046"
    }
  ],
  rules: {
    watchedHandles: ["@sama", "@thsottiaux"],
    keywords: ["codex", "reset", "usage limit", "rate limit", "capacity", "quota"],
    negativeKeywords: ["my reset", "weekly reset", "personal quota"],
    scanIntervalMinutes: 15,
    staleThresholdMinutes: 45
  },
  alerts: [
    {
      id: "browser",
      label: "浏览器通知",
      kind: "browser",
      enabled: true
    },
    {
      id: "rss",
      label: "公开 RSS",
      kind: "rss",
      enabled: true,
      lastTriggeredAt: "2026-05-24T04:14:35+08:00"
    },
    {
      id: "webhook",
      label: "Webhook",
      kind: "webhook",
      enabled: false
    },
    {
      id: "email",
      label: "邮件摘要",
      kind: "email",
      enabled: false
    }
  ],
  history: [
    { label: "5/18", probability48h: 52, windowOpen: false },
    { label: "5/19", probability48h: 52, windowOpen: false },
    { label: "5/20", probability48h: 16, windowOpen: true },
    { label: "5/21", probability48h: 28, windowOpen: false },
    { label: "5/22", probability48h: 42, windowOpen: false },
    { label: "5/23", probability48h: 8, windowOpen: true },
    { label: "5/24", probability48h: 14, windowOpen: false },
    { label: "5/25", probability48h: 14, windowOpen: false },
    { label: "5/26", probability48h: 14, windowOpen: false },
    { label: "5/27", probability48h: 54, windowOpen: false },
    { label: "5/28", probability48h: 54, windowOpen: false },
    { label: "5/29", probability48h: 45, windowOpen: false },
    { label: "5/30", probability48h: 19, windowOpen: false },
    { label: "5/31", probability48h: 92, windowOpen: true }
  ]
};
