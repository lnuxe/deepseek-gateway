import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getStatus, runAction, type ActionResult, type Status } from './api';
import { usePoll } from '../hooks/usePoll';

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

type ConsoleCtx = {
  status: Status | null;
  statusError: string | null;
  refreshStatus: () => void;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
  act: (name: string) => Promise<ActionResult>;
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
  const [busy, setBusy] = useState<string | null>(null);

  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), kind === 'err' ? 6000 : 3200);
  }, []);

  const act = useCallback(
    async (name: string) => {
      setBusy(name);
      try {
        const r = await runAction(name);
        notify((r.ok ? '✓ ' : '✗ ') + (r.message || name), r.ok ? 'ok' : 'err');
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

  const value = useMemo<ConsoleCtx>(
    () => ({ status, statusError: error, refreshStatus: refresh, notify, act, busy }),
    [status, error, refresh, notify, act, busy],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
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
