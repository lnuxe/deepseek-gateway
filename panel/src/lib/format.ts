export const fmtInt = (n: number) => n.toLocaleString('en-US');

export function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export const fmtMs = (ms: number | null | undefined) => (ms == null ? '—' : `${Math.round(ms)}ms`);

export const fmtPct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`;

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export const shortFingerprint = (fp: string | null | undefined) =>
  !fp ? '—' : fp.replace(/:/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim().toUpperCase();

export const statusTone = (status: number): 'ok' | 'warn' | 'err' | 'muted' => {
  if (status < 300) return 'ok';
  if (status < 400) return 'muted';
  if (status < 500) return 'warn';
  return 'err';
};

/** 把一行日志解析成结构化片段，便于着色渲染 */
export function parseLogLine(line: string) {
  const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  const time = m ? m[1].slice(11, 19) : '';
  const body = m ? m[2] : line;
  const statusMatch = body.match(/->\s*(\d{3})/);
  const msMatch = body.match(/\((\d+)ms\)/);
  return {
    time,
    body,
    status: statusMatch ? Number(statusMatch[1]) : null,
    ms: msMatch ? Number(msMatch[1]) : null,
  };
}
