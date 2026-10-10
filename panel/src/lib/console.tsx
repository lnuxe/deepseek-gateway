import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { copyText, getStatus, runAction, type ActionResult, type Status } from './api';
import { usePoll } from '../hooks/usePoll';
import { ResultDialog, type Dialog } from '../components/ui/Dialog';

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

type ConsoleCtx = {
  status: Status | null;
  statusError: string | null;
  refreshStatus: () => void;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
  act: (name: string, opts?: { dialogOn?: 'checks' | 'always' }) => Promise<ActionResult>;
  busy: string | null;
};

const Ctx = createContext<ConsoleCtx | null>(null);

export function useConsole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConsole must be used inside ConsoleProvider');
  return ctx;
}

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const { data: status, error, refresh } = usePoll(getStatus, 5000);
  const [toast, setToast] = useState<Toast>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), kind === 'err' ? 6000 : 3200);
  }, []);

  const act = useCallback<ConsoleCtx['act']>(
    async (name, opts = {}) => {
      setBusy(name);
      try {
        const r = await runAction(name);
        if (r.checks && (opts.dialogOn === 'checks' || opts.dialogOn === 'always')) {
          setDialog({
            title: name === 'probe' ? '网关自检结果' : '检查结果',
            subtitle: `共 ${r.checks.length} 项`,
            ok: !!r.ok,
            checks: r.checks,
          });
        } else if (opts.dialogOn === 'always') {
          setDialog({ title: name === 'probe' ? '网关自检' : '执行结果', ok: !!r.ok, message: r.message });
        } else {
          notify((r.ok ? '✓ ' : '✗ ') + (r.message || name), r.ok ? 'ok' : 'err');
        }
        if (name === 'restart-gateway') window.setTimeout(refresh, 2200);
        else refresh();
        return r;
      } catch (e) {
        const result = { ok: false, message: e instanceof Error ? e.message : String(e) };
        notify('✗ ' + result.message, 'err');
        return result;
      } finally {
        setBusy(null);
      }
    },
    [notify, refresh],
  );

  const copyDialog = useCallback(async () => {
    if (!dialog) return;
    const text = dialog.checks
      ? `${dialog.title}\n` + dialog.checks.map((c) => `${c.ok ? '[通过]' : '[失败]'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`).join('\n')
      : `${dialog.title}\n${dialog.message ?? ''}`;
    const ok = await copyText(text);
    notify(ok ? '已复制结果' : '复制失败', ok ? 'ok' : 'err');
  }, [dialog, notify]);

  const value = useMemo<ConsoleCtx>(
    () => ({ status, statusError: error, refreshStatus: refresh, notify, act, busy }),
    [status, error, refresh, notify, act, busy],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ResultDialog dialog={dialog} onClose={() => setDialog(null)} onCopy={copyDialog} />
      {toast && (
        <div
          className={`card fade-up fixed bottom-6 left-1/2 z-50 flex max-w-[min(560px,90vw)] -translate-x-1/2 items-center gap-2 px-3.5 py-2.5 text-[12.5px] shadow-lg ${
            toast.kind === 'ok' ? 'border-[color-mix(in_srgb,var(--c-ok)_40%,transparent)]' : 'border-[color-mix(in_srgb,var(--c-err)_45%,transparent)]'
          }`}
          role="status"
        >
          <span className={toast.kind === 'ok' ? 'text-ok' : 'text-err'}>{toast.kind === 'ok' ? '✓' : '✗'}</span>
          <span className="min-w-0">{toast.msg}</span>
        </div>
      )}
    </Ctx.Provider>
  );
}
