export type RadarState = "quiet" | "watching" | "possible" | "confirmed" | "stale";

export type SourceHealth = "online" | "degraded" | "offline" | "stale";

export type RadarSource = {
  id: string;
  label: string;
  kind: "x-account" | "feed" | "manual";
  handle?: string;
  url?: string;
  health: SourceHealth;
  lastSeenAt?: string;
  matchCount24h: number;
  contributesToState: boolean;
};

export type MonitoredAccount = {
  id: string;
  name: string;
  handle: string;
  role: string;
  url: string;
  status: "watching" | "quiet" | "matched";
  lastSignalAt?: string;
  lastSignalTitle?: string;
};

export type RadarSignal = {
  id: string;
  sourceId: string;
  sourceLabel?: string;
  detectedAt: string;
  type: "reset" | "capacity" | "limit" | "schedule" | "negative" | "meta";
  confidenceDelta: number;
  score?: number;
  predictionRelevance?: number;
  direction?: "positive" | "negative" | "neutral";
  semanticRole?: string;
  title: string;
  evidence: string;
  quote?: string;
  sourceUrl?: string;
};

export type ResetWindow = {
  id: string;
  title: string;
  status: "open" | "closed" | "historical";
  openedAt: string;
  closedAt?: string;
  duration?: string;
  sourceAccount: string;
  sourceHandle: string;
  openSourceUrl: string;
  closeSourceUrl?: string;
  summary: string;
};

export type DetectionRules = {
  watchedHandles: string[];
  keywords: string[];
  negativeKeywords: string[];
  scanIntervalMinutes: number;
  staleThresholdMinutes: number;
};

export type AlertChannel = {
  id: string;
  label: string;
  kind: "browser" | "rss" | "webhook" | "email";
  enabled: boolean;
  lastTriggeredAt?: string;
};

export type HistoryPoint = {
  label: string;
  probability48h: number;
  windowOpen: boolean;
};

export type RadarSourceMode = "x-api" | "public-radar" | "free-rss" | "rsshub" | "mixed" | "fallback";

export type RadarSnapshot = {
  state: RadarState;
  confidence: number;
  summary: string;
  lastCheckedAt: string;
  nextScanAt: string;
  staleAfterMinutes: number;
  sourceMode?: RadarSourceMode;
  sourceStatus?: string;
  sourceNote: string;
  monitoredAccounts: MonitoredAccount[];
  sources: RadarSource[];
  resetWindows: ResetWindow[];
  signals: RadarSignal[];
  rules: DetectionRules;
  alerts: AlertChannel[];
  history: HistoryPoint[];
};
