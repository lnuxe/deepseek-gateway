import { useMemo } from 'react';

/**
 * 极简 SVG 迷你图与进度条 —— 不引入图表库，纯 path 计算，重绘成本极低。
 */
export function Sparkline({
  values,
  height = 40,
  width = 240,
  tone = 'accent',
  fill = true,
}: {
  values: number[];
  height?: number;
  width?: number;
  tone?: 'accent' | 'warn' | 'err';
  fill?: boolean;
}) {
  const stroke = tone === 'warn' ? 'var(--c-warn)' : tone === 'err' ? 'var(--c-err)' : 'var(--c-accent)';
  const { line, area } = useMemo(() => {
    if (values.length === 0) return { line: '', area: '' };
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = `M${pts.join(' L')}`;
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { line, area };
  }, [values, width, height]);

  if (!line) return <div className="text-[11.5px] text-ink-4">暂无数据</div>;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      {fill && <path d={area} fill={stroke} opacity="0.08" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'ok' | 'warn' | 'err' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg = { accent: 'var(--c-accent)', ok: 'var(--c-ok)', warn: 'var(--c-warn)', err: 'var(--c-err)' }[tone];
  return (
    <div className="h-[6px] w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: bg, transitionTimingFunction: 'var(--ease-out)' }}
      />
    </div>
  );
}

/** 证书有效期倒计时环 */
export function Ring({ pct, size = 68, label, value }: { pct: number; size?: number; label?: string; value?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-hair-2)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 300ms var(--ease-out)' }}
        />
      </svg>
      <div className="absolute text-center leading-tight">
        <div className="font-mono text-[13px] text-ink">{value}</div>
        <div className="text-[10px] text-ink-4">{label}</div>
      </div>
    </div>
  );
}
