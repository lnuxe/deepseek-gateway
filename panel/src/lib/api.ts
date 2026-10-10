export type Check = { name: string; ok: boolean; detail?: string };

export type Status = {
  gateway: { baseUrl: string; host: string; port: number; uptimeSec: number; requests: number; pid: number; version: string };
  runtime: { user: string; platform: string; arch: string; node: string; configPath: string; logPath: string; dir: string };
  key: { present: boolean; source: string; length: number };
  models: { flash: string; pro: string };
  upstream: { base: string; ok: boolean; models: string[]; latencyMs: number | null; error?: string };
  localActionsLoaded: boolean;
  cursor: null | {
    installed: boolean;
    exePath: string;
    version: string | null;
    running: boolean;
    baseUrl: string | null;
    keyEnabled: boolean | null;
    models: string[];
    patched?: boolean;
  };
  actions: { name: string; label: string; confirm: boolean; danger: boolean; local: boolean }[];
};

export type Metrics = {
  uptimeSec: number;
  total: number;
  errors: number;
  errorRate: number;
  rpm: number;
  rpmDelta: number;
  p50: number;
  p95: number;
  byRoute: { route: string; count: number; errors: number; avgMs: number }[];
  byStatus: { status: number; count: number }[];
  series: { offset: number; count: number; errors: number }[];
  lastError: { at: string; status: number; path: string; method: string } | null;
};

export type RoutesPayload = {
  routes: { id: string; methods: string[]; path: string; upstream: string; target: string; note: string }[];
  upstreams: { id: string; label: string; base: string; protocol: string }[];
};

export type TlsInfo = {
  host: string;
  port: number;
  error?: string;
  authorized?: boolean;
  authorizationError?: string | null;
  protocol?: string;
  cipher?: string;
  subject?: string | null;
  issuer?: string | null;
  altNames?: string[];
  validFrom?: string | null;
  validTo?: string;
  daysLeft?: number;
  serialNumber?: string | null;
  fingerprint?: string | null;
};

export type ActionResult = { ok: boolean; message?: string; checks?: Check[]; latency?: number };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false, message: text.slice(0, 200) };
  }
  return json as T;
}

export const getStatus = () => req<Status>('/api/status');
export const getMetrics = () => req<Metrics>('/api/metrics');
export const getRoutes = () => req<RoutesPayload>('/api/routes');
export const getTls = () => req<TlsInfo>('/api/tls');
export const getLog = (tail = 80) => req<{ tail: string }>(`/api/log?tail=${tail}`);

export const saveConfig = (patch: Record<string, unknown>) =>
  req<{ ok: boolean; message?: string }>('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

export const runAction = (name: string) =>
  req<ActionResult>('/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
