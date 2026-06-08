import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  TimerReset,
  UserRoundSearch
} from "lucide-react";
import { radarSnapshot } from "./data";
import type { MonitoredAccount, RadarSignal, RadarSnapshot, ResetWindow } from "./types";
import "./styles.css";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const fullFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short"
});

function formatTime(value?: string) {
  if (!value) return "暂无信号";
  return dateTimeFormatter.format(new Date(value));
}

function formatFullTime(value: string) {
  return fullFormatter.format(new Date(value));
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    future_reset_hint: "官方预告",
    usage_program: "用量计划",
    issue_or_limit_anomaly: "限额异常",
    ambiguous_reset_chatter: "社群扩散"
  };
  return role ? (labels[role] ?? role) : "未分类";
}

function directionLabel(direction?: string) {
  const labels: Record<string, string> = {
    positive: "指向重置",
    neutral: "中性",
    negative: "反向"
  };
  return labels[direction ?? "neutral"] ?? "中性";
}

function accountStatusLabel(status: string) {
  const labels: Record<string, string> = {
    matched: "已捕捉承诺",
    quiet: "历史命中",
    watching: "持续监控"
  };
  return labels[status] ?? status;
}

function windowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    closed: "已关闭",
    historical: "历史",
    open: "开启中"
  };
  return labels[status] ?? status;
}

function getAdvice(confidence: number) {
  if (confidence >= 80) {
    return {
      label: "速蹬",
      detail: "高概率窗口，今天优先消耗额度",
      tone: "hot",
      tags: ["速蹬模式", "明早窗口", "保留证据"]
    };
  }
  if (confidence >= 50) {
    return {
      label: "盯紧",
      detail: "信号在累积，等官方再确认",
      tone: "watch",
      tags: ["盯紧官方", "等待确认", "保留额度"]
    };
  }
  return {
    label: "悠着点",
    detail: "当前重置概率不高",
    tone: "calm",
    tags: ["悠着点", "别冲动", "继续观察"]
  };
}

function probabilityTone(probability: number) {
  if (probability >= 70) return "hot";
  if (probability >= 35) return "watch";
  return "calm";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  })
    .format(date)
    .replaceAll("/", "-");
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai"
  }).format(date);
}

function getResetWindow(snapshot: RadarSnapshot) {
  const strongSignal = snapshot.signals.find((signal) => {
    const text = `${signal.title} ${signal.quote ?? ""}`;
    return (
      snapshot.confidence >= 70 &&
      signal.semanticRole === "future_reset_hint" &&
      /tomorrow|明天|resetting the limits|i will reset|go \/fast/i.test(text)
    );
  });

  if (!strongSignal) {
    return {
      active: false,
      title: "暂无未来窗口",
      description: "最近没有新的官方 reset / tomorrow / go /fast 强信号；当前只保持监控。",
      cards: [
        { label: "最近扫描", value: formatTime(snapshot.lastCheckedAt) },
        { label: "下一次扫描", value: formatTime(snapshot.nextScanAt) },
        { label: "窗口状态", value: "未开启" }
      ]
    };
  }

  const signalDate = new Date(strongSignal.detectedAt);
  const targetDate = /tomorrow|明天/i.test(`${strongSignal.title} ${strongSignal.quote ?? ""}`)
    ? addDays(signalDate, 1)
    : signalDate;
  const nextDate = addDays(targetDate, 1);
  const target = formatDateOnly(targetDate);
  const nextShort = formatShortDate(nextDate);
  const targetShort = formatShortDate(targetDate);

  return {
    active: true,
    title: `${target} 下午 - ${nextShort} 凌晨`,
    description: "原话包含未来重置语义；这里按来源时区换算给中国用户看。",
    cards: [
      { label: "中国窗口", value: `${targetShort} 14:00-${nextShort} 03:00` },
      { label: "按欧洲早上", value: `${targetShort} 14:00-18:00` },
      { label: "按美西早上", value: `${targetShort} 23:00-${nextShort} 03:00` }
    ]
  };
}

function App() {
  const [snapshot, setSnapshot] = React.useState<RadarSnapshot>(radarSnapshot);

  React.useEffect(() => {
    let alive = true;

    fetch(`/api/current?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json() as Promise<RadarSnapshot>;
      })
      .then((data) => {
        if (alive && data?.signals?.length && typeof data.confidence === "number") {
          setSnapshot(data);
        }
      })
      .catch(() => {
        if (alive) setSnapshot(radarSnapshot);
      });

    return () => {
      alive = false;
    };
  }, []);

  return <RadarDashboard snapshot={snapshot} />;
}

function RadarDashboard({ snapshot }: { snapshot: RadarSnapshot }) {
  const [copied, setCopied] = React.useState(false);
  const strongest = snapshot.signals[0];
  const upcomingSignals = snapshot.signals.filter((signal) => !["tibo-window-open", "sam-like-window"].includes(signal.id));

  async function copyShareLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <TimerReset size={22} strokeWidth={2.1} />
          </div>
          <div>
            <p className="eyebrow">Codex reset</p>
            <h1>Codex 重置雷达</h1>
          </div>
        </div>

        <div className="topbar-meta">
          <span className="status-pill open">
            <Activity size={14} />
            {snapshot.sourceMode === "x-api"
              ? "实时 X API"
              : snapshot.sourceMode === "free-rss" || snapshot.sourceMode === "mixed"
                ? "免费 RSS 源"
                : "已捕捉到信号"}
          </span>
          <span>{formatFullTime(snapshot.lastCheckedAt)}</span>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" aria-label="刷新页面" onClick={() => window.location.reload()}>
            <RefreshCw size={17} />
          </button>
          <button className="primary-action" type="button" onClick={copyShareLink}>
            <Copy size={16} />
            {copied ? "已复制" : "复制链接"}
          </button>
        </div>
      </header>

      <section className="hero-grid" aria-label="重置预测">
        <div className="hero-column">
          <ForecastPanel snapshot={snapshot} />
          <StrongestSignal signal={strongest} />
        </div>
        <div className="hero-column">
          <ProbabilityCurvePanel snapshot={snapshot} />
          <MonitorPanel accounts={snapshot.monitoredAccounts} />
        </div>
      </section>

      <section className="section-block route-block" aria-label="重置路线">
        <div className="section-heading">
          <p className="eyebrow">Route</p>
          <h2>重置路线</h2>
        </div>
        <ResetRoutePanel signals={upcomingSignals} windows={snapshot.resetWindows} />
      </section>

    </main>
  );
}

function ForecastPanel({ snapshot }: { snapshot: RadarSnapshot }) {
  const advice = getAdvice(snapshot.confidence);
  const tone = probabilityTone(snapshot.confidence);
  const resetWindow = getResetWindow(snapshot);

  return (
    <section className={`panel forecast-panel probability-${tone}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Forecast</p>
          <h2>重置预测</h2>
        </div>
        <span className={`advice-pill ${advice.tone}`}>{advice.label}模式</span>
      </div>

      <div className="gauge-card" style={{ "--score": snapshot.confidence } as React.CSSProperties}>
        <div className={`energy-gauge ${tone}`} aria-label={`重置概率 ${snapshot.confidence}%`}>
          <span className="energy-glow" aria-hidden="true" />
          <span className="energy-flow" aria-hidden="true" />
          <span className="energy-mist" aria-hidden="true" />
          <div className="gauge-core">
            <span>48h 概率</span>
            <strong>{snapshot.confidence}%</strong>
            <em>{advice.detail}</em>
          </div>
        </div>
      </div>

      <div className={`window-callout ${tone}`}>
        <span>{resetWindow.active ? "中国主观察" : "当前窗口"}</span>
        <strong>{resetWindow.title}</strong>
        <p>{resetWindow.description}</p>
      </div>

      <div className="timezone-grid" aria-label={resetWindow.active ? "中美时差对照" : "监控状态"}>
        {resetWindow.cards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="hint-row">
        {advice.tags.map((tag, index) => (
          <span className={`hint-${index + 1}`} key={tag}>{tag}</span>
        ))}
      </div>

      <p className="summary">{snapshot.summary}</p>
    </section>
  );
}

function ProbabilityCurvePanel({ snapshot }: { snapshot: RadarSnapshot }) {
  const width = 720;
  const height = 250;
  const padX = 20;
  const padY = 22;
  const chartBottom = height - padY;
  const chartHeight = height - padY * 2;
  const points = snapshot.history.map((point, index) => {
    const x = padX + (index / (snapshot.history.length - 1)) * (width - padX * 2);
    const y = padY + (1 - point.probability48h / 100) * chartHeight;
    return { ...point, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${chartBottom} ${polyline} ${width - padX},${chartBottom}`;
  const latest = points[points.length - 1];
  const peak = points.reduce((best, point) => (point.probability48h > best.probability48h ? point : best), points[0]);
  const tone = probabilityTone(latest.probability48h);

  return (
    <section className={`panel curve-panel probability-${tone}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Daily</p>
          <h2>概率曲线</h2>
        </div>
        <span className="state-token high">今日 {latest.probability48h}%</span>
      </div>

      <div className="curve-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日重置概率曲线">
          <defs>
            <linearGradient id="curveFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(0, 217, 146, 0.26)" />
              <stop offset="100%" stopColor="rgba(0, 217, 146, 0)" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((line) => {
            const y = padY + (1 - line / 100) * chartHeight;
            return <line className="curve-grid-line" key={line} x1={padX} x2={width - padX} y1={y} y2={y} />;
          })}
          <polygon className="probability-area" points={area} />
          <polyline className="probability-line" points={polyline} />
          {points.map((point) => (
            <circle
              className={`probability-dot ${probabilityTone(point.probability48h)}${point.windowOpen ? " open" : ""}`}
              cx={point.x}
              cy={point.y}
              key={point.label}
              r={point.label === latest.label ? 5 : 3.5}
            />
          ))}
          <circle className="probability-pulse" cx={latest.x} cy={latest.y} r="7" />
        </svg>
      </div>

      <div className="curve-footer">
        <div>
          <span>峰值</span>
          <strong>{peak.label} / {peak.probability48h}%</strong>
        </div>
        <div>
          <span>今日</span>
          <strong>{latest.label} / {latest.probability48h}%</strong>
        </div>
        <div>
          <span>窗口</span>
          <strong>{latest.windowOpen ? "已开启" : "未开启"}</strong>
        </div>
      </div>
    </section>
  );
}

function StrongestSignal({ signal }: { signal: RadarSignal }) {
  return (
    <section className="panel signal-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Signal</p>
          <h2>最强信号</h2>
        </div>
        <span className="delta-token">分数 {signal.score}</span>
      </div>

      <div className="x-thread-card">
        <div className="x-author">
          <div className="x-avatar" aria-hidden="true">T</div>
          <div>
            <strong>Tibo Sottiaux</strong>
            <span>@thsottiaux 回复 @Trident2Gold</span>
          </div>
        </div>
        <blockquote>{signal.quote}</blockquote>
        <div className="x-thread-footer">
          <span>{formatFullTime(signal.detectedAt)}</span>
          {signal.sourceUrl ? (
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
              打开 X
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </div>

      <h3 className="signal-title">{signal.title}</h3>
      <p>{signal.evidence}</p>

      <div className="signal-meta">
        <div>
          <span>捕捉时间</span>
          <strong>{formatFullTime(signal.detectedAt)}</strong>
        </div>
        <div>
          <span>语义</span>
          <strong>{roleLabel(signal.semanticRole)}</strong>
        </div>
      </div>
    </section>
  );
}

function MonitorPanel({ accounts }: { accounts: MonitoredAccount[] }) {
  return (
    <section className="panel monitor-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Accounts</p>
          <h2>监控人</h2>
        </div>
        <UserRoundSearch size={18} />
      </div>

      <div className="account-list">
        {accounts.map((account) => (
          <article className="account-card" key={account.id}>
            <div>
              <span className={`account-state ${account.status}`}>{accountStatusLabel(account.status)}</span>
              <h3>{account.name}</h3>
              <a href={account.url} target="_blank" rel="noreferrer">
                {account.handle}
                <ExternalLink size={13} />
              </a>
            </div>
            <p>{account.lastSignalTitle ?? account.role}</p>
            <small>{account.lastSignalAt ? formatFullTime(account.lastSignalAt) : "暂无近期命中"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResetRoutePanel({ signals, windows }: { signals: RadarSignal[]; windows: ResetWindow[] }) {
  const orderedSignals = [...signals].sort(
    (first, second) => new Date(second.detectedAt).getTime() - new Date(first.detectedAt).getTime()
  );

  return (
    <section className="panel route-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>路线</h2>
        </div>
        <Search size={18} />
      </div>

      <div className="route-line">
        {orderedSignals.map((signal) => (
          <article className="route-card" key={signal.id}>
            <div className="route-pin" aria-hidden="true" />
            <div className="route-card-head">
              <div>
                <span className="route-time">{formatTime(signal.detectedAt)}</span>
                <h3>{signal.title}</h3>
              </div>
              <span className={`direction ${signal.direction ?? "neutral"}`}>{directionLabel(signal.direction)}</span>
            </div>
            <p>{signal.quote ?? signal.evidence}</p>
            <div className="timeline-meta">
              <span>{signal.sourceLabel ?? signal.sourceId}</span>
              <span>{roleLabel(signal.semanticRole)}</span>
              <span>权重 {signal.predictionRelevance ?? signal.confidenceDelta}</span>
            </div>
            <div className="timeline-action">
              {signal.sourceUrl ? (
                <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
                  打开 X
                  <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
          </article>
        ))}

        {windows.map((window) => (
          <article className="route-card historical" key={window.id}>
            <div className="route-pin" aria-hidden="true" />
            <div className="route-card-head">
              <div>
                <span className="route-time">{formatTime(window.openedAt)}</span>
                <h3>{window.title}</h3>
              </div>
              <span className={`window-status ${window.status}`}>{windowStatusLabel(window.status)}</span>
            </div>
            <p>{window.summary}</p>
            <div className="timeline-meta">
              <span>{window.sourceAccount}</span>
              <span>{window.sourceHandle}</span>
              <span>{window.closedAt ? `关闭 ${formatTime(window.closedAt)}` : (window.duration ?? "时间未知")}</span>
            </div>
            <div className="timeline-action evidence-links">
              <a href={window.openSourceUrl} target="_blank" rel="noreferrer">
                打开证据
                <ExternalLink size={13} />
              </a>
              {window.closeSourceUrl ? (
                <a href={window.closeSourceUrl} target="_blank" rel="noreferrer">
                  关闭证据
                  <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
