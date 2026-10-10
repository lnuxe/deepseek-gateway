import { Check, Copy, Loader2, Play, Pause, X } from 'lucide-react';
import type { Check as ProbeCheck } from '../lib/api';
import { copyText } from '../lib/api';
import { Button } from './ui';
import { MDiv, MLi } from './motion';

export function Toast({ toast }: { toast: { msg: string; kind: 'ok' | 'err' } | null }) {
  if (!toast) return null;
  return (
    <MDiv
      key={toast.msg}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={`glass fixed bottom-7 left-1/2 z-20 flex max-w-[min(560px,90vw)] -translate-x-1/2 items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] ${
        toast.kind === 'ok' ? 'border-[rgba(95,216,164,.45)]' : 'border-[rgba(244,116,124,.5)]'
      }`}
    >
      {toast.kind === 'ok' ? <Check className="h-4 w-4 shrink-0 text-ok" /> : <X className="h-4 w-4 shrink-0 text-err" />}
      <span className="min-w-0">{toast.msg}</span>
    </MDiv>
  );
}

export function CopyRow({ value, onCopied }: { value: string; onCopied: (ok: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <code className="rounded-xl border border-[rgba(138,167,255,.18)] bg-[rgba(138,167,255,.10)] px-3 py-2 font-mono text-[13px] text-[#cfd6ff]">
        {value}
      </code>
      <Button icon={<Copy className="h-3.5 w-3.5" />} variant="ghost" onClick={async () => onCopied(await copyText(value))}>
        复制
      </Button>
    </div>
  );
}

export function ProbeList({ checks }: { checks: ProbeCheck[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((c, i) => (
        <MLi
          key={c.name}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.25 }}
          className="flex items-center gap-3 text-[13px]"
        >
          <span className={c.ok ? 'text-ok' : 'text-err'}>{c.ok ? '✓' : '✗'}</span>
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          <span className="font-mono text-[11.5px] text-ink-3">{c.detail}</span>
        </MLi>
      ))}
    </ul>
  );
}

export { Loader2, Play, Pause };
