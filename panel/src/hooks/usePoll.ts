import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * 轮询接口，只在「页面可见 + enabled」时请求，避免后台空转。
 * key 变化时会立刻重新拉取（例如日志页切换 tail 条数）。
 */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number, enabled = true, key: string | number = '') {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await fetcherRef.current();
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    if (intervalMs <= 0) return;
    let timer: number | undefined;
    const start = () => {
      stop();
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') load();
      }, intervalMs);
    };
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    };
    start();
    const onVisible = () => (document.visibilityState === 'visible' ? (load(), start()) : stop());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, load, key]);

  return { ...state, refresh: load };
}
