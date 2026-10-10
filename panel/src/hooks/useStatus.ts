import { useEffect, useRef, useState } from 'react';
import { getStatus, type Status } from '../lib/api';

/** Polls /api/status on an interval and exposes {status, error, refresh}. */
export function useStatus(intervalMs = 5000) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setStatus(await getStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { status, error, refresh };
}
