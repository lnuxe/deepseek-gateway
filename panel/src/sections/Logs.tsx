import { useEffect, useMemo, useRef, useState } from 'react';
import { getLog } from '../lib/api';
import { usePoll } from '../hooks/usePoll';
import { parseLogLine, statusTone } from '../lib/format';
import { Badge, Button, Card, Skeleton } from '../components/ui/primitives';
import { IconDownload, IconPause, IconPlay } from '../components/sketch/icons';

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: '2xx', label: '成功' },
  { id: '4xx', label: '客户端错误' },
  { id: '5xx', label: '服务端错误' },
] as const;

export default function Logs() {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [tail, setTail] = useState(200);
  const { data, loading } = usePoll(() => getLog(tail), paused ? 0 : 4000, !paused, tail);
  const boxRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const lines = useMemo(() => {
    const all = (data?.tail ?? '').split('\n').filter(Boolean);
    return all.filter((line) => {
      const p = parseLogLine(line);
      const matchQ = !query || line.toLowerCase().includes(query.toLowerCase());
      if (!matchQ) return false;
      if (filter === 'all') return true;
      if (p.status == null) return false;
      return `${Math.floor(p.status / 100)}xx` === filter;
    });
  }, [data, filter, query]);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const exportLog = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateway-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="请求日志"
        subtitle="每转发一次记录一行（模型 · 流式标志 · 状态码 · 耗时），同时落盘到 gateway.log"
        bare
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" tone={paused ? 'default' : 'ghost'} icon={paused ? <IconPlay size={13} /> : <IconPause size={13} />} onClick={() => setPaused((p) => !p)}>
              {paused ? '继续' : '暂停'}
            </Button>
            <Button size="sm" icon={<IconDownload size={13} />} onClick={exportLog} disabled={lines.length === 0}>
              导出
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-2.5">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`focus-ring rounded-[6px] px-2 py-1 text-[11.5px] transition-colors ${
                  filter === f.id ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="过滤关键字（模型名 / 路径 / 状态码）"
            className="min-w-[180px] flex-1 rounded-[6px] border border-hair bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-4 focus:border-hair-3"
          />
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className="rounded-[6px] border border-hair bg-surface px-2 py-1.5 text-[11.5px] text-ink-2 outline-none"
          >
            {[100, 200, 500, 1000].map((n) => (
              <option key={n} value={n} className="bg-bg-2">
                最近 {n} 条
              </option>
            ))}
          </select>
          {paused && <Badge tone="warn">已暂停</Badge>}
          <span className="ml-auto text-[11.5px] text-ink-4">{lines.length} 行</span>
        </div>

        <div
          ref={boxRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
          }}
          className="h-[calc(100vh-330px)] min-h-[280px] overflow-auto bg-bg-2/60 px-4 py-3 font-mono text-[11.5px] leading-[1.75]"
        >
          {loading && !data && <Skeleton className="h-24 w-full" />}
          {!loading && lines.length === 0 && <div className="py-8 text-center text-[12.5px] text-ink-4">没有匹配的日志</div>}
          {lines.map((line, i) => {
            const p = parseLogLine(line);
            const tone = p.status ? statusTone(p.status) : 'muted';
            const toneCls = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'err' ? 'text-err' : 'text-ink-4';
            return (
              <div key={i} className="flex gap-3 whitespace-pre-wrap break-all hover:bg-surface">
                <span className="shrink-0 text-ink-4">{p.time}</span>
                <span className="min-w-0 flex-1 text-ink-2">{p.body.replace(/\s*->.*$/, '')}</span>
                {p.ms != null && <span className="shrink-0 text-ink-4">{p.ms}ms</span>}
                <span className={`w-8 shrink-0 text-right ${toneCls}`}>{p.status ?? '—'}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
