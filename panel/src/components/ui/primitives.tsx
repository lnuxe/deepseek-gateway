import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/* ---------------------------------------------------------------- Card ---- */
export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bare,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section className={`card fade-up ${className}`}>
      {(title || actions) && (
        <header className="flex items-start gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h3>}
            {subtitle && <p className="mt-[3px] text-[12px] text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bare ? '' : 'px-4 pb-4'}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------- Button ---- */
type BtnTone = 'default' | 'primary' | 'ghost' | 'danger';
const btnTone: Record<BtnTone, string> = {
  default:
    'border-hair bg-surface-2 text-ink hover:bg-surface-3 hover:border-hair-2',
  primary:
    'border-transparent bg-accent-soft text-accent border border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_22%,transparent)]',
  ghost: 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'border-[rgba(196,114,111,.35)] text-[#dda19e] hover:bg-[rgba(196,114,111,.12)]',
};

export function Button({
  children,
  onClick,
  tone = 'default',
  disabled,
  loading,
  icon,
  size = 'md',
  className = '',
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  tone?: BtnTone;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-[8px] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[12.5px]'
      } ${btnTone[tone]} ${className}`}
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Badge ---- */
const tones = {
  ok: 'text-ok border-[color-mix(in_srgb,var(--c-ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-ok)_10%,transparent)]',
  warn: 'text-warn border-[color-mix(in_srgb,var(--c-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-warn)_10%,transparent)]',
  err: 'text-err border-[color-mix(in_srgb,var(--c-err)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-err)_10%,transparent)]',
  info: 'text-info border-[color-mix(in_srgb,var(--c-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)]',
  muted: 'text-ink-3 border-hair bg-surface-2',
} as const;

export function Badge({ tone = 'muted', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] leading-[16px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** 状态点：呼吸动画只用于「活跃」状态 */
export function Dot({ tone = 'ok', breathe }: { tone?: 'ok' | 'warn' | 'err' | 'muted'; breathe?: boolean }) {
  const color = { ok: 'bg-ok text-ok', warn: 'bg-warn text-warn', err: 'bg-err text-err', muted: 'bg-ink-4 text-ink-4' }[tone];
  return <span className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${color} ${breathe ? 'breathe' : ''}`} />;
}

/* ---------------------------------------------------------------- Stat ---- */
export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'ok' | 'warn' | 'err';
  icon?: ReactNode;
}) {
  const valueTone = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'err' ? 'text-err' : 'text-ink';
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 font-mono text-[19px] leading-none ${valueTone}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-ink-4">{hint}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Rows ----- */
export function Rows({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-[var(--c-hair)]">{children}</dl>;
}

export function Row({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[12px] text-ink-3">{k}</dt>
      <dd className={`min-w-0 text-right text-[12.5px] text-ink ${mono ? 'font-mono text-[12px]' : ''} break-all`}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ Skeleton ---- */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Loading({ label = '加载中' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-3">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </div>
  );
}
