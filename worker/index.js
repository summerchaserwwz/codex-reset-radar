const WATCH_HANDLES = ["thsottiaux", "sama"];
const PUBLIC_RADAR_URL = "https://codexradar.com/current.json";
const CACHE_KEY = "current";
const TZ = "Asia/Shanghai";
const ASSET_PREFIX = "asset:";
const DEFAULT_RSS_TEMPLATES = [
  "https://fxtwitter.com/{handle}/feed.xml",
  "https://nitter.net/{handle}/rss",
  "https://xcancel.com/{handle}/rss",
  "https://rss.xcancel.com/{handle}/rss",
  "https://openrss.org/x.com/{handle}",
  "https://rsshub.app/x/user/{handle}",
  "https://rsshub.app/twitter/user/{handle}"
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return serveAsset(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "codex-reset-radar-api",
        hasXToken: Boolean(env.X_BEARER_TOKEN),
        hasKv: Boolean(env.RADAR_KV),
        rssTemplates: rssTemplates(env),
        checkedAt: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/sources") {
      return json({ checkedAt: toChinaIso(new Date()), sources: await probeFreeRss(env) });
    }

    if (url.pathname === "/api/admin/assets" && request.method === "POST") {
      if (!env.ASSET_UPLOAD_KEY || url.searchParams.get("key") !== env.ASSET_UPLOAD_KEY) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const payload = await request.json();
      if (!payload?.path || !payload?.body || !payload?.contentType) {
        return json({ ok: false, error: "missing path/body/contentType" }, 400);
      }
      await env.RADAR_KV.put(`${ASSET_PREFIX}${normalizeAssetPath(payload.path)}`, JSON.stringify({
        body: payload.body,
        contentType: payload.contentType,
        uploadedAt: new Date().toISOString()
      }));
      return json({ ok: true, path: normalizeAssetPath(payload.path) });
    }

    if (url.pathname === "/api/refresh") {
      if (env.REFRESH_KEY && url.searchParams.get("key") !== env.REFRESH_KEY) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const snapshot = await refreshSnapshot(env);
      ctx.waitUntil(storeSnapshot(env, snapshot));
      return json(snapshot);
    }

    if (url.pathname === "/api/current") {
      if (url.searchParams.get("refresh") === "1") {
        const snapshot = await refreshSnapshot(env);
        ctx.waitUntil(storeSnapshot(env, snapshot));
        return json(snapshot);
      }

      const cached = await readCachedSnapshot(env);
      if (cached) return json(cached);

      const snapshot = await refreshSnapshot(env);
      ctx.waitUntil(storeSnapshot(env, snapshot));
      return json(snapshot);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshSnapshot(env).then((snapshot) => storeSnapshot(env, snapshot)));
  }
};

async function serveAsset(request, env) {
  const url = new URL(request.url);
  const pathname = normalizeAssetPath(url.pathname);
  const candidates = pathname.includes(".") ? [pathname] : [pathname, "/index.html"];
  for (const candidate of candidates) {
    const asset = await env.RADAR_KV?.get(`${ASSET_PREFIX}${candidate}`, "json");
    if (asset?.body && asset?.contentType) {
      return new Response(base64ToBytes(asset.body), {
        headers: {
          "content-type": asset.contentType,
          "cache-control": candidate.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache"
        }
      });
    }
  }
  return new Response("Codex Reset Radar asset not uploaded yet.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function normalizeAssetPath(pathname) {
  const normalized = `/${String(pathname || "/").replace(/^\/+/, "")}`;
  return normalized === "/" ? "/index.html" : normalized;
}

function base64ToBytes(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function readCachedSnapshot(env) {
  if (!env.RADAR_KV) return null;
  try {
    const cached = await env.RADAR_KV.get(CACHE_KEY, "json");
    if (!cached) return null;
    const ageMs = Date.now() - new Date(cached.lastCheckedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs < 20 * 60 * 1000) return cached;
  } catch (_error) {
    return null;
  }
  return null;
}

async function storeSnapshot(env, snapshot) {
  if (!env.RADAR_KV) return;
  await env.RADAR_KV.put(CACHE_KEY, JSON.stringify(snapshot), {
    expirationTtl: 60 * 60 * 24 * 7,
    metadata: { generatedAt: new Date().toISOString(), sourceMode: snapshot.sourceMode }
  });
}

async function refreshSnapshot(env) {
  const results = await Promise.allSettled([
    fetchPublicRadar(),
    fetchFreeRssPool(env),
    fetchOfficialX(env),
    fetchRssHub(env)
  ]);

  const publicRadar = valueFrom(results[0]);
  const freeRssSignals = valueFrom(results[1]) ?? [];
  const xSignals = valueFrom(results[2]) ?? [];
  const rssHubSignals = valueFrom(results[3]) ?? [];

  const base = publicRadar ? fromPublicRadar(publicRadar) : fallbackSnapshot();
  const liveSignals = [...freeRssSignals, ...xSignals, ...rssHubSignals];
  const mergedSignals = mergeSignals([...liveSignals, ...base.signals]);
  const hasX = xSignals.length > 0;
  const hasFreeRss = freeRssSignals.length > 0;
  const hasRssHub = rssHubSignals.length > 0;
  const sourceMode = hasX && publicRadar
    ? "mixed"
    : hasX
      ? "x-api"
      : hasFreeRss && publicRadar
        ? "mixed"
        : hasFreeRss
          ? "free-rss"
          : publicRadar
            ? "public-radar"
            : hasRssHub
              ? "rsshub"
              : "fallback";

  return {
    ...base,
    signals: mergedSignals,
    confidence: scoreSnapshot(base.confidence, mergedSignals),
    history: historyWithLatest(scoreSnapshot(base.confidence, mergedSignals), new Date()),
    lastCheckedAt: toChinaIso(new Date()),
    nextScanAt: toChinaIso(new Date(Date.now() + 15 * 60 * 1000)),
    sourceMode,
    sourceStatus: sourceStatus(sourceMode, Boolean(env.X_BEARER_TOKEN)),
    sourceNote:
      "优先使用免费 X RSS 实例池；无可用 RSS 时读取公开 radar JSON；X API v2 只作为可选增强。定时任务运行在 Cloudflare Worker Cron。"
  };
}

function valueFrom(result) {
  return result.status === "fulfilled" ? result.value : null;
}

async function fetchPublicRadar() {
  const response = await fetch(PUBLIC_RADAR_URL, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`public radar ${response.status}`);
  return response.json();
}

async function fetchOfficialX(env) {
  if (!env.X_BEARER_TOKEN) return [];
  const query = [
    '("codex reset" OR "usage limits" OR "rate limit" OR "Resetting the limits" OR "Time to go /fast")',
    "(from:thsottiaux OR from:sama OR codex)",
    "-is:retweet"
  ].join(" ");
  const params = new URLSearchParams({
    query,
    max_results: "50",
    "tweet.fields": "created_at,author_id,conversation_id,referenced_tweets",
    expansions: "author_id",
    "user.fields": "username,name"
  });
  const response = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
    headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` }
  });
  if (!response.ok) throw new Error(`x recent search ${response.status}`);
  const data = await response.json();
  const users = new Map((data.includes?.users ?? []).map((user) => [user.id, user]));
  return (data.data ?? []).map((post) => signalFromPost(post, users.get(post.author_id), "official_x"));
}

function rssTemplates(env) {
  if (!env.FREE_RSS_TEMPLATES) return DEFAULT_RSS_TEMPLATES;
  try {
    const parsed = JSON.parse(env.FREE_RSS_TEMPLATES);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed;
  } catch (_error) {
    return String(env.FREE_RSS_TEMPLATES)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return DEFAULT_RSS_TEMPLATES;
}

async function fetchFreeRssPool(env) {
  const settled = await Promise.allSettled(
    WATCH_HANDLES.flatMap((handle) =>
      rssTemplates(env).map(async (template) => {
        const url = template.replaceAll("{handle}", handle).replaceAll("{id}", handle);
        const response = await fetch(url, {
          headers: {
            accept: "application/rss+xml, application/atom+xml, text/xml",
            "user-agent": "CodexResetRadar/1.0 (+https://codex-reset-radar.sumerchaser.top)"
          },
          cf: { cacheTtl: 180, cacheEverything: true }
        });
        if (!response.ok) throw new Error(`free rss ${response.status}`);
        const xml = await response.text();
        if (!/<(rss|feed|item|entry)\b/i.test(xml) || isWhitelistNotice(xml)) throw new Error("not usable rss");
        return parseRssSignals(xml, handle, url, "免费 RSS");
      })
    )
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function probeFreeRss(env) {
  const probes = await Promise.allSettled(
    WATCH_HANDLES.flatMap((handle) =>
      rssTemplates(env).map(async (template) => {
        const url = template.replaceAll("{handle}", handle).replaceAll("{id}", handle);
        const startedAt = Date.now();
        try {
          const response = await fetch(url, {
            headers: {
              accept: "application/rss+xml, application/atom+xml, text/xml",
              "user-agent": "CodexResetRadar/1.0 (+https://codex-reset-radar.sumerchaser.top)"
            },
            cf: { cacheTtl: 60, cacheEverything: true }
          });
          const text = await response.text();
          return {
            handle,
            url,
            ok: response.ok && /<(rss|feed|item|entry)\b/i.test(text) && !isWhitelistNotice(text),
            status: response.status,
            contentType: response.headers.get("content-type"),
            itemCount: countItems(text),
            latencyMs: Date.now() - startedAt
          };
        } catch (error) {
          return { handle, url, ok: false, error: String(error?.message ?? error), latencyMs: Date.now() - startedAt };
        }
      })
    )
  );
  return probes.map((result) => (result.status === "fulfilled" ? result.value : { ok: false, error: String(result.reason) }));
}

async function fetchRssHub(env) {
  const base = (env.RSSHUB_BASE || "https://rsshub.app").replace(/\/$/, "");
  const settled = await Promise.allSettled(
    WATCH_HANDLES.map(async (handle) => {
      const response = await fetch(`${base}/twitter/user/${handle}`, {
        headers: { accept: "application/rss+xml,text/xml" },
        cf: { cacheTtl: 180, cacheEverything: true }
      });
      if (!response.ok) throw new Error(`rsshub ${handle} ${response.status}`);
      return parseRssSignals(await response.text(), handle, `${base}/twitter/user/${handle}`, "RSSHub");
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function parseRssSignals(xml, handle, feedUrl, sourceLabel) {
  const items = [
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => match[1])
  ].slice(0, 10);
  return items
    .map((body, index) => {
      const title = stripXml(readTag(body, "title"));
      const description = stripXml(readTag(body, "description") || readTag(body, "summary") || readTag(body, "content"));
      const link = stripXml(readTag(body, "link")) || readAtomLink(body);
      const pubDate = readTag(body, "pubDate") || readTag(body, "updated") || readTag(body, "published");
      const combined = description && title && description.includes(title)
        ? description
        : [title, description].filter(Boolean).join(" ");
      const text = combined.replace(/\s+/g, " ").trim();
      if (isWhitelistNotice(text)) return null;
      if (!isRelevant(text)) return null;
      const role = semanticRole(text);
      const official = handle === "thsottiaux" || handle === "sama";
      const isStrongReset = official && role === "future_reset_hint";
      const codexMeta = official && /codex/i.test(text);
      return {
        id: `rsshub-${handle}-${index}-${hash(text)}`,
        sourceId: handle,
        sourceLabel: official ? sourceLabel : "RSS",
        detectedAt: new Date(pubDate || Date.now()).toISOString(),
        type: classifyType(text),
        confidenceDelta: isStrongReset ? 96 : codexMeta ? 8 : 4,
        score: isStrongReset ? 100 : codexMeta ? 18 : 8,
        predictionRelevance: isStrongReset ? 96 : codexMeta ? 8 : 2,
        direction: "positive",
        semanticRole: role,
        title: summarizeTitle(text),
        evidence: `${sourceLabel} 抓到的 X 时间线信号，作为无 X token 的免费抓取源。`,
        quote: text,
        sourceUrl: normalizeSourceUrl(link, handle) || feedUrl || `https://x.com/${handle}`
      };
    })
    .filter(Boolean);
}

function readTag(text, tag) {
  return text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
}

function stripXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function readAtomLink(text) {
  return text.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
}

function normalizeSourceUrl(url, handle) {
  if (!url) return "";
  const statusId = String(url).match(/status(?:es)?\/(\d+)/)?.[1];
  if (statusId) return `https://x.com/${handle}/status/${statusId}`;
  return url;
}

function signalFromPost(post, user, source) {
  const handle = user?.username ? `@${user.username}` : "X";
  const text = post.text ?? "";
  return {
    id: `x:${post.id}`,
    sourceId: user?.username ?? source,
    sourceLabel: user?.username === "thsottiaux" || user?.username === "sama" ? "官方 X" : "社区 X",
    detectedAt: post.created_at,
    type: classifyType(text),
    confidenceDelta: user?.username === "thsottiaux" || user?.username === "sama" ? 86 : 20,
    score: user?.username === "thsottiaux" || user?.username === "sama" ? 96 : 58,
    predictionRelevance: user?.username === "thsottiaux" || user?.username === "sama" ? 88 : 18,
    direction: text.match(/\b(my|personal|weekly)\b/i) ? "negative" : "positive",
    semanticRole: semanticRole(text),
    title: `${handle} 捕捉到 ${summarizeTitle(text)}`,
    evidence: "来自 X API v2 recent search 的实时搜索结果。",
    quote: text,
    sourceUrl: `https://x.com/${user?.username ?? "i"}/status/${post.id}`
  };
}

function fromPublicRadar(data) {
  if (data?.schema_version === "2.0") return fromCodexRadarV2(data);

  const now = data.checked_at ?? new Date().toISOString();
  const current = data.current_window;
  const rawSignals = data.prediction?.signal_summary_24h?.signals ?? [];
  const signals = [];

  if (current?.source_text) {
    signals.push({
      id: `x:${idFromUrl(current.source) || current.event_id || "current-window"}`,
      sourceId: current.source_author ?? "thsottiaux",
      sourceLabel: "官方 X",
      detectedAt: current.opened_at ?? now,
      type: "reset",
      confidenceDelta: 95,
      score: 100,
      predictionRelevance: 95,
      direction: "positive",
      semanticRole: "future_reset_hint",
      title: "Tibo 明确说：明天早上重置 limits",
      quote: current.source_text,
      evidence: "公开 radar 当前窗口来自 Tibo 官方 X，包含 tomorrow morning 与 go /fast。",
      sourceUrl: current.source
    });
  }

  for (const item of rawSignals.slice(0, 14)) {
    signals.push({
      id: item.signal_id ?? `public-${hash(item.text ?? item.url ?? Math.random().toString())}`,
      sourceId: item.source ?? "community",
      sourceLabel: item.source_label ?? "社区 X",
      detectedAt: item.created_at ?? item.display_at ?? now,
      type: classifyType(item.text ?? ""),
      confidenceDelta: item.prediction_relevance ?? 0,
      score: item.score,
      predictionRelevance: item.prediction_relevance,
      direction: item.prediction_direction ?? "neutral",
      semanticRole: item.semantic_role,
      title: summarizeTitle(item.text ?? ""),
      evidence: "公开 radar signal_summary_24h 收录的 X 信号。",
      quote: item.text,
      sourceUrl: item.url
    });
  }

  return {
    state: current?.state === "open" ? "confirmed" : "possible",
    confidence: current?.state === "open" ? 92 : Math.round((data.prediction?.probability_48h ?? 0.45) * 100),
    summary: current?.source_text
      ? "Tibo 官方 X 已出现 tomorrow morning 重置信号；页面会按信号发布时间动态换算中国观察窗口。"
      : data.prediction?.reasoning_summary ?? "正在监控 Codex 重置信号。",
    lastCheckedAt: normalizeChinaIso(now),
    nextScanAt: toChinaIso(new Date(Date.now() + 15 * 60 * 1000)),
    staleAfterMinutes: 45,
    sourceMode: "public-radar",
    sourceStatus: "公开 radar JSON 正常",
    sourceNote: "读取公开 radar JSON。",
    monitoredAccounts: [
      {
        id: "sama",
        name: "Sam Altman",
        handle: "@sama",
        role: "OpenAI signal",
        url: "https://x.com/sama",
        status: "quiet",
        lastSignalAt: "2026-05-20T02:31:16+08:00",
        lastSignalTitle: "历史重置信号"
      },
      {
        id: "tibo",
        name: "Tibo Sottiaux",
        handle: "@thsottiaux",
        role: "Codex / product signal",
        url: "https://x.com/thsottiaux",
        status: current?.source_author === "thsottiaux" ? "matched" : "watching",
        lastSignalAt: current?.opened_at ?? signals[0]?.detectedAt,
        lastSignalTitle: current?.source_text ? "Resetting the limits tomorrow morning" : signals[0]?.title
      }
    ],
    sources: [],
    resetWindows: [
      {
        id: data.last_window?.id ?? "codex-speed-window-2026-05-24-codex",
        title: data.last_window?.title ?? "长会话压缩耗额异常补偿重置",
        status: data.last_window?.status ?? "closed",
        openedAt: data.last_window?.opened_at ?? "2026-05-23T08:21:33+08:00",
        closedAt: data.last_window?.closed_at,
        duration: data.last_window?.window_human,
        sourceAccount: "Tibo Sottiaux",
        sourceHandle: "@thsottiaux",
        openSourceUrl: data.last_window?.sources?.[0]?.url ?? "https://x.com/thsottiaux",
        closeSourceUrl: data.last_window?.sources?.[1]?.url,
        summary: data.last_window?.summary ?? "历史重置窗口。"
      }
    ],
    signals,
    rules: {
      watchedHandles: ["@sama", "@thsottiaux"],
      keywords: ["codex", "reset", "usage limit", "rate limit", "capacity", "quota", "/fast"],
      negativeKeywords: ["my reset", "weekly reset", "personal quota"],
      scanIntervalMinutes: 15,
      staleThresholdMinutes: 45
    },
    alerts: [],
    history: historyWithLatest(current?.state === "open" ? 92 : Math.round((data.prediction?.probability_48h ?? 0.45) * 100))
  };
}

function fromCodexRadarV2(data) {
  const prediction = data.prediction ?? {};
  const confidence = Math.round((prediction.probability_48h ?? 0.27) * 100);
  const window = data.window ?? {};
  const recentWindows = data.recent_windows ?? [];
  const signals = [];

  if (window.open && window.source_url) {
    signals.push({
      id: `codexradar-window-${idFromUrl(window.source_url) || hash(window.title ?? "open-window")}`,
      sourceId: "codexradar",
      sourceLabel: "CodexRadar",
      detectedAt: window.opened_at ?? data.monitored_at,
      type: "reset",
      confidenceDelta: 96,
      score: 100,
      predictionRelevance: 96,
      direction: "positive",
      semanticRole: "future_reset_hint",
      title: window.title ?? "官方速蹬窗口开启",
      quote: window.message,
      evidence: "CodexRadar v2 当前窗口显示已开启。",
      sourceUrl: window.source_url
    });
  }

  for (const text of prediction.positive_signals ?? []) {
    signals.push({
      id: `codexradar-positive-${hash(text)}`,
      sourceId: "codexradar",
      sourceLabel: "聚合研判",
      detectedAt: prediction.updated_at ?? data.monitored_at,
      type: classifyType(text),
      confidenceDelta: 4,
      score: 12,
      predictionRelevance: 4,
      direction: "positive",
      semanticRole: semanticRole(text),
      title: summarizeTitle(text),
      evidence: "CodexRadar v2 的正向研判项，作为背景信号低权重使用。",
      quote: text,
      sourceUrl: data.links?.html ?? "https://codexradar.com/"
    });
  }

  for (const text of prediction.negative_signals ?? []) {
    signals.push({
      id: `codexradar-negative-${hash(text)}`,
      sourceId: "codexradar",
      sourceLabel: "聚合研判",
      detectedAt: prediction.updated_at ?? data.monitored_at,
      type: "negative",
      confidenceDelta: 0,
      score: 1,
      predictionRelevance: 0,
      direction: "negative",
      semanticRole: "ambiguous_reset_chatter",
      title: "反向信号",
      evidence: "CodexRadar v2 的反向研判项。",
      quote: text,
      sourceUrl: data.links?.html ?? "https://codexradar.com/"
    });
  }

  return {
    state: data.window_open ? "confirmed" : confidence >= 50 ? "possible" : "watching",
    confidence,
    summary: prediction.summary ?? window.message ?? "正在监控 Codex 重置信号。",
    lastCheckedAt: normalizeChinaIso(data.monitored_at ?? prediction.updated_at ?? new Date()),
    nextScanAt: toChinaIso(new Date(Date.now() + 15 * 60 * 1000)),
    staleAfterMinutes: 45,
    sourceMode: "public-radar",
    sourceStatus: "CodexRadar v2 JSON 正常",
    sourceNote: "读取 CodexRadar v2 current.json，叠加免费 X RSS 源。",
    monitoredAccounts: [
      {
        id: "sama",
        name: "Sam Altman",
        handle: "@sama",
        role: "OpenAI signal",
        url: "https://x.com/sama",
        status: "watching",
        lastSignalAt: data.monitored_at,
        lastSignalTitle: "持续监控"
      },
      {
        id: "tibo",
        name: "Tibo Sottiaux",
        handle: "@thsottiaux",
        role: "Codex / product signal",
        url: "https://x.com/thsottiaux",
        status: window.open ? "matched" : "watching",
        lastSignalAt: window.opened_at ?? data.monitored_at,
        lastSignalTitle: window.open ? window.title : "持续监控"
      }
    ],
    sources: [],
    resetWindows: recentWindows.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status === "open" ? "open" : "closed",
      openedAt: item.opened_at,
      closedAt: item.closed_at,
      duration: item.window_human,
      sourceAccount: "Tibo Sottiaux",
      sourceHandle: "@thsottiaux",
      openSourceUrl: item.source_url,
      closeSourceUrl: item.source_url,
      summary: `${item.summary ?? ""}${item.scope ? ` 适用范围：${item.scope}。` : ""}`.trim()
    })),
    signals,
    rules: {
      watchedHandles: ["@sama", "@thsottiaux", "@OpenAIDevs", "OpenAI Status", "社区 X", "评论区"],
      keywords: ["codex", "reset", "usage limit", "rate limit", "capacity", "quota", "/fast", "status"],
      negativeKeywords: ["my reset", "weekly reset", "personal quota"],
      scanIntervalMinutes: 15,
      staleThresholdMinutes: 45
    },
    alerts: [],
    history: historyWithLatest(confidence, new Date(data.monitored_at ?? Date.now()))
  };
}

function fallbackSnapshot() {
  return fromCodexRadarV2({
    schema_version: "2.0",
    service: "codex-reset-radar",
    monitored_at: new Date().toISOString(),
    timezone: TZ,
    window_open: false,
    status: "none",
    recommended_action: "wait",
    window: {
      open: false,
      status: "none",
      action: "wait",
      message: "当前没有开启的速蹬窗口",
      title: "Codex 可靠性事故补偿重置",
      scope: "所有付费计划",
      opened_at: null,
      closed_at: "2026-06-04T08:25:58+08:00",
      source_url: "https://x.com/thsottiaux/status/2062329981548802523"
    },
    prediction: {
      level: "low",
      probability_24h: 0.17,
      probability_48h: 0.27,
      expected_window: "暂无明确窗口",
      summary: "当前没有新的官方全局 reset 承诺；只保留免费 RSS 与公开快照的低概率观察。",
      positive_signals: [],
      negative_signals: ["没有 Tibo、Sam 或 OpenAI 的新 reset 承诺。"],
      updated_at: new Date().toISOString()
    },
    recent_windows: [
      {
        id: "codex-speed-window-2026-06-04-codex",
        title: "Codex 可靠性事故补偿重置",
        status: "closed",
        opened_at: "2026-06-04T08:25:00+08:00",
        closed_at: "2026-06-04T08:25:00+08:00",
        window_human: "无窗",
        scope: "所有付费计划",
        summary: "Tibo 表示过去 24 小时内有三次影响 Codex 可靠性的小事故，并已为所有付费计划重置 Codex 使用限制。",
        source_url: "https://x.com/thsottiaux/status/2062329981548802523"
      }
    ],
    links: { html: "https://codexradar.com/", rss: "https://codexradar.com/feed.xml" }
  });
}

function mergeSignals(signals) {
  const seen = new Set();
  return signals
    .filter((signal) => {
      const key = signal.sourceUrl || signal.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => scoreOf(b) - scoreOf(a) || new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 18);
}

function scoreSnapshot(baseConfidence, signals) {
  const strongest = Math.max(...signals.map(scoreOf), baseConfidence);
  return Math.max(0, Math.min(96, Math.round(strongest)));
}

function scoreOf(signal) {
  return Math.max(signal.score ?? 0, signal.confidenceDelta ?? 0) + (signal.predictionRelevance ?? 0) / 100;
}

function sourceStatus(mode, hasToken) {
  if (mode === "x-api") return "官方 X API 实时抓取正常";
  if (mode === "mixed") return "免费 RSS / 公开 radar 多源校验";
  if (mode === "free-rss") return "免费 RSS 实例池抓取正常";
  if (mode === "public-radar") return hasToken ? "X API/RSS 暂无新命中，使用公开 radar 快照" : "免费 RSS 暂无命中，使用公开 radar 快照";
  if (mode === "rsshub") return "RSSHub 兜底命中；建议配置 X_BEARER_TOKEN";
  return "上游不可用，显示内置兜底快照";
}

function isRelevant(text) {
  return /codex|usage limit|rate limit|reset|\/fast|quota|limit/i.test(text);
}

function isWhitelistNotice(text) {
  return /rss reader not yet whitelist|not yet whitelisted|send an email rss/i.test(text);
}

function classifyType(text) {
  if (/reset|resetting|tomorrow morning/i.test(text)) return "reset";
  if (/10x usage|big button|select one person per day|usage program/i.test(text)) return "capacity";
  if (/rate limit|usage limit|quota|limit/i.test(text)) return "limit";
  if (/tomorrow|morning|am/i.test(text)) return "schedule";
  return "meta";
}

function semanticRole(text) {
  if (/resetting the limits|i will reset|tomorrow morning|time to go \/fast/i.test(text)) return "future_reset_hint";
  if (/10x usage|big button|select one person per day|usage program/i.test(text)) return "usage_program";
  if (/\b(my|personal|weekly)\b/i.test(text)) return "personal_quota_schedule";
  if (/rate limit|usage|quota|burning/i.test(text)) return "issue_or_limit_anomaly";
  return "ambiguous_reset_chatter";
}

function summarizeTitle(text) {
  if (/resetting the limits|tomorrow morning/i.test(text)) return "明天早上重置 limits";
  if (/i will reset/i.test(text)) return "官方承诺重置 usage limits";
  if (/10x usage|big button|select one person per day|usage program/i.test(text)) return "官方 10X 用量奖励信号";
  if (/\/fast/i.test(text)) return "社区提示 go /fast";
  if (/rate limit|usage limit/i.test(text)) return "限额异常信号";
  return text.slice(0, 42) || "X 信号";
}

function historyWithLatest(latest, endDate = new Date()) {
  const baseline = [14, 14, 54, 54, 45, 19, 6, 14, 14, 55, 18, 27, 33, latest];
  return baseline.map((probability48h, index) => {
    const date = new Date(endDate);
    date.setDate(date.getDate() - (baseline.length - 1 - index));
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      probability48h,
      windowOpen: probability48h >= 80
    };
  });
}

function normalizeChinaIso(value) {
  return toChinaIso(new Date(value));
}

function toChinaIso(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

function idFromUrl(url) {
  return String(url ?? "").match(/status\/(\d+)/)?.[1];
}

function hash(text) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value.toString(36);
}

function countItems(text) {
  return (text.match(/<(item|entry)\b/gi) ?? []).length;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
