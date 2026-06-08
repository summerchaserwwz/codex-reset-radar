import type { RadarSnapshot } from "./types";

export const radarSnapshot: RadarSnapshot = {
  state: "watching",
  confidence: 27,
  summary:
    "官方关注点集中在个人 10X 用量奖励，而不是全体补偿重置。社区有额度压力，但缺少新的官方全局 reset 暗示。",
  lastCheckedAt: "2026-06-08T12:26:10+08:00",
  nextScanAt: "2026-06-08T12:41:10+08:00",
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
      status: "watching",
      lastSignalAt: "2026-05-31T13:59:10+08:00",
      lastSignalTitle: "持续监控"
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
      url: "https://codexradar.com/current.json",
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
      id: "tibo-10x-usage-program",
      sourceId: "tibo",
      sourceLabel: "官方 X",
      detectedAt: "2026-06-08T12:26:10+08:00",
      type: "capacity",
      confidenceDelta: 8,
      score: 18,
      predictionRelevance: 8,
      direction: "positive",
      semanticRole: "usage_program",
      title: "官方 10X 用量奖励信号",
      quote: "I have a new kind of big button that I can press for Codex. Over the next 100 days, we will select one person per day and 10x their usage.",
      evidence: "这是个人用量奖励，不是全体 usage limits reset；只作为低权重背景信号。",
      sourceUrl: "https://x.com/thsottiaux"
    },
    {
      id: "community-quota-pressure",
      sourceId: "community",
      sourceLabel: "社区 X",
      detectedAt: "2026-06-08T12:26:10+08:00",
      type: "limit",
      confidenceDelta: 4,
      score: 12,
      predictionRelevance: 4,
      direction: "positive",
      semanticRole: "issue_or_limit_anomaly",
      title: "社区额度压力",
      quote: "社区仍有 Codex quota / limit 讨论，但没有新的官方重置承诺。",
      evidence: "只能说明需求压力，不能直接推导重置窗口。",
      sourceUrl: "https://codexradar.com/current.json"
    },
    {
      id: "no-official-reset",
      sourceId: "codexradar",
      sourceLabel: "聚合研判",
      detectedAt: "2026-06-08T12:26:10+08:00",
      type: "negative",
      confidenceDelta: 0,
      score: 1,
      predictionRelevance: 0,
      direction: "negative",
      semanticRole: "ambiguous_reset_chatter",
      title: "暂无官方全局 reset",
      quote: "没有 Tibo、Sam 或 OpenAI 的新 reset / tomorrow / go /fast 承诺。",
      evidence: "反向信号会压低预测，避免把普通 Codex 讨论误判成重置窗口。",
      sourceUrl: "https://codexradar.com/current.json"
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
    { label: "5/26", probability48h: 14, windowOpen: false },
    { label: "5/27", probability48h: 54, windowOpen: false },
    { label: "5/28", probability48h: 54, windowOpen: false },
    { label: "5/29", probability48h: 45, windowOpen: false },
    { label: "5/30", probability48h: 19, windowOpen: false },
    { label: "5/31", probability48h: 6, windowOpen: false },
    { label: "6/1", probability48h: 14, windowOpen: false },
    { label: "6/2", probability48h: 14, windowOpen: false },
    { label: "6/3", probability48h: 55, windowOpen: false },
    { label: "6/4", probability48h: 18, windowOpen: false },
    { label: "6/5", probability48h: 27, windowOpen: false },
    { label: "6/6", probability48h: 34, windowOpen: false },
    { label: "6/7", probability48h: 33, windowOpen: false },
    { label: "6/8", probability48h: 27, windowOpen: false }
  ]
};
