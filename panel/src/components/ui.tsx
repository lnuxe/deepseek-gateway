import { Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  armed,
  icon,
  loading,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  armed?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] leading-none transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-[1px]';
  const styles: Record<string, string> = {
    default: 'border border-hair bg-[rgba(255,255,255,.06)] text-ink hover:bg-[rgba(255,255,255,.10)] hover:border-hair-2',
    primary:
      'border border-transparent text-[#0a0b12] font-semibold bg-[linear-gradient(150deg,#8aa7ff,#b79cff)] shadow-[0_18px_45px_-22px_rgba(138,167,255,.95)] hover:brightness-[1.06]',
    ghost: 'border border-transparent text-ink-3 hover:text-ink',
    danger: armed
      ? 'border border-[rgba(244,116,124,.55)] bg-[rgba(244,116,124,.16)] text-[#ffd9db]'
      : 'border border-[rgba(244,116,124,.32)] text-[#ffcdd0] hover:bg-[rgba(244,116,124,.10)]',
  };
  return (
    <button className={`${base} ${armed ? styles.danger : styles[variant]} ${className}`} onClick={onClick} disabled={disabled || loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function StepBadge({ state, index }: { state: 'todo' | 'current' | 'done'; index: number }) {
  const ring =
    state === 'current'
      ? 'bg-[linear-gradient(150deg,#8aa7ff,#b79cff)] text-[#080910] border-transparent shadow-[0_10px_30px_-12px_rgba(138,167,255,.9)]'
      : state === 'done'
        ? 'bg-[rgba(95,216,164,.16)] text-ok border-[rgba(95,216,164,.4)]'
        : 'bg-transparent text-ink-2 border-hair-2';
  return (
    <span className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-[12.5px] font-semibold transition-all duration-300 ${ring}`}>
      {state === 'done' ? <Check className="pop h-3.5 w-3.5" strokeWidth={3} /> : index}
    </span>
  );
}

export function Dot({ state }: { state: true | false | 'warn' }) {
  const color = state === true ? 'text-ok bg-ok' : state === false ? 'text-err bg-err' : 'text-warn bg-warn';
  return <span className={`relative inline-block h-[6px] w-[6px] rounded-full ${color} ${state === false ? '' : 'pulse-ring'}`} />;
}

export function Stat({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-hair py-2 text-[13px] last:border-0">
      <span className="text-ink-3">{label}</span>
      <span className={`text-right break-all text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</span>
    </div>
  );
}
