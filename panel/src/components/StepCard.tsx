import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { StepBadge } from './ui';
import { MDiv, MLi } from './motion';

export type StepState = 'todo' | 'current' | 'done';

const shell: Record<StepState, string> = {
  todo: 'opacity-55',
  current:
    'border-[rgba(138,167,255,.45)] bg-[linear-gradient(180deg,rgba(138,167,255,.09),rgba(255,255,255,.02))] shadow-[0_0_0_1px_rgba(138,167,255,.12),0_40px_90px_-55px_rgba(138,167,255,.95)]',
  done: 'opacity-75 hover:opacity-100',
};

/** One guided step: header always visible, body animates open/closed. */
export function StepCard({
  index,
  title,
  hint,
  state,
  tag,
  open,
  onToggle,
  art,
  delay = 0,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  state: StepState;
  tag: string;
  open: boolean;
  onToggle?: () => void;
  art?: ReactNode;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <MLi
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.4, 0, 0.2, 1], layout: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
      className={`glass relative overflow-hidden rounded-[18px] border transition-colors duration-300 ${shell[state]}`}
    >
      {/* hand-drawn spot illustration, watermarked into the card corner */}
      {art && (
        <span
          className={`pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 transition-opacity duration-500 ${
            state === 'current' ? 'opacity-[0.20]' : 'opacity-[0.10]'
          }`}
        >
          {art}
        </span>
      )}

      <button
        type="button"
        onClick={onToggle}
        className={`relative flex w-full items-center gap-3.5 px-5 py-[17px] text-left ${state === 'done' ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <StepBadge state={state} index={index} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="mt-0.5 block text-[12.5px] text-ink-3">{hint}</span>
        </span>
        <span className={`shrink-0 text-[11.5px] ${state === 'done' ? 'text-ok' : 'text-ink-3'}`}>{tag}</span>
        {state === 'done' && <ChevronRight className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />}
      </button>

      {open && (
        <MDiv
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden"
        >
          <div className="flex flex-col gap-3.5 px-5 pb-5">{children}</div>
        </MDiv>
      )}
    </MLi>
  );
}
