import { useEffect } from 'react';
import type { Check } from '../../lib/api';
import { Button } from './primitives';
import { IconCheck, IconCopy, IconX } from '../sketch/icons';

export type Dialog = {
  title: string;
  subtitle?: string;
  ok: boolean;
  message?: string;
  checks?: Check[];
};

/**
 * 结果弹窗：用于需要看细节的动作结果（例如 7 项自检）。
 * ESC / 点击遮罩关闭，内容可一键复制。动效与全局一致：150–200ms ease-out。
 */
export function ResultDialog({ dialog, onClose, onCopy }: { dialog: Dialog | null; onClose: () => void; onCopy: () => void }) {
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={dialog.title}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="card fade-up relative w-full max-w-[560px] overflow-hidden bg-bg-2 shadow-2xl">
        <header className="flex items-start gap-3 border-b border-hair px-4 py-3">
          <span className={`mt-[3px] inline-flex h-4 w-4 items-center justify-center ${dialog.ok ? 'text-ok' : 'text-err'}`}>
            {dialog.ok ? <IconCheck size={15} /> : <IconX size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13.5px] font-semibold text-ink">{dialog.title}</h3>
            {dialog.subtitle && <p className="mt-0.5 text-[11.5px] text-ink-4">{dialog.subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="focus-ring rounded-[6px] p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="关闭">
            <IconX size={15} />
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {dialog.message && (
            <pre className="mb-3 max-h-40 overflow-auto rounded-[8px] border border-hair bg-surface px-3 py-2 font-mono text-[11.5px] whitespace-pre-wrap break-all text-ink-2">
              {dialog.message}
            </pre>
          )}
          {dialog.checks && (
            <ul className="flex flex-col divide-y divide-[var(--c-hair)]">
              {dialog.checks.map((c) => (
                <li key={c.name} className="flex items-center gap-3 py-2 text-[12.5px]">
                  <span className={c.ok ? 'text-ok' : 'text-err'}>{c.ok ? <IconCheck size={14} /> : <IconX size={14} />}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-4">{c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-hair px-4 py-2.5">
          <span className="text-[11.5px] text-ink-4">
            {dialog.checks ? `${dialog.checks.filter((c) => c.ok).length} / ${dialog.checks.length} 通过` : ''}
          </span>
          <div className="flex gap-2">
            <Button size="sm" icon={<IconCopy size={13} />} onClick={onCopy}>
              复制结果
            </Button>
            <Button size="sm" tone="primary" onClick={onClose}>
              知道了
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
