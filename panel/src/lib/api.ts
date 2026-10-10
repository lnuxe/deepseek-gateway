export type Action = {
  name: string;
  label: string;
  confirm: boolean;
  danger: boolean;
  local: boolean;
};

export type Check = { name: string; ok: boolean; detail?: string };

export type Status = {
  gateway: { baseUrl: string; host: string; port: number; uptimeSec: number; requests: number; pid: number; version: string };
  key: { present: boolean; source: string; length: number };
  models: { flash: string; pro: string };
  upstream: { base: string; ok: boolean; models: string[]; error?: string };
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
  actions: Action[];
};

export type ActionResult = { ok: boolean; message?: string; checks?: Check[]; latency?: number };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text.slice(0, 200) };
  }
  if (!res.ok && json.ok === undefined) json.ok = false;
  return json as T;
}

export const getStatus = () => req<Status>('/api/status');
export const getLog = (tail = 60) => req<{ tail: string }>(`/api/log?tail=${tail}`);

export const saveConfig = (patch: Record<string, unknown>) =>
  req<{ ok: boolean; message?: string; needRestart?: boolean }>('/api/config', {
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
