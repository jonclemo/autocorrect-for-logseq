// @logseq/libs is provided globally by Logseq
import type { Rules } from "./autocorrect";

const CACHE_KEYS = {
  etag: "remoteETag",
  lastChecked: "remoteLastChecked",
  cachedRules: "remoteCachedRules"
};

export async function loadCachedRemoteRules(): Promise<Rules | null> {
  const raw = logseq.settings?.[CACHE_KEYS.cachedRules];
  if (!raw) return null;
  try { return JSON.parse(String(raw)) as Rules; } catch { return null; }
}

export async function maybeRefreshRemoteRules(opts: {
  enabled: boolean;
  url: string;
  intervalHours: number;
}): Promise<Rules | null> {
  if (!opts.enabled || !opts.url) return null;

  const last = Number(logseq.settings?.[CACHE_KEYS.lastChecked] || 0);
  const intervalMs = Math.max(1, opts.intervalHours) * 60 * 60 * 1000;
  if (Date.now() - last < intervalMs) return null;

  const etag = String(logseq.settings?.[CACHE_KEYS.etag] || "");
  const headers: Record<string, string> = {};
  if (etag) headers["If-None-Match"] = etag;

  try {
    const res = await fetch(opts.url, { headers });
    await logseq.updateSettings({ [CACHE_KEYS.lastChecked]: Date.now() });

    if (res.status === 304) return null;
    if (!res.ok) return null;

    const newEtag = res.headers.get("ETag") || "";
    const text = await res.text();

    const rules = JSON.parse(text) as Rules;
    await logseq.updateSettings({
      [CACHE_KEYS.etag]: newEtag,
      [CACHE_KEYS.cachedRules]: JSON.stringify(rules)
    });

    return rules;
  } catch {
    return null;
  }
}
