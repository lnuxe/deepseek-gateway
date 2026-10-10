import { getMetrics, getRoutes } from '../lib/api';
import { usePoll } from '../hooks/usePoll';
import { fmtInt, fmtMs } from '../lib/format';
import { Card, Loading, Skeleton } from '../components/ui/primitives';

const methodTone = (m: string) =>
  m === 'GET' ? 'text-info border-[color-mix(in_srgb,var(--c-info)_35%,transparent)]' : 'text-ok border-[color-mix(in_srgb,var(--c-ok)_35%,transparent)]';

export default function Routes() {
  const { data, loading } = usePoll(getRoutes, 0);
  const { data: metrics } = usePoll(getMetrics, 10000);

  const live = new Map((metrics?.byRoute ?? []).map((r) => [r.route, r]));

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="网关路由"
        subtitle="本机网关对外提供的接口，以及它们转发到哪个上游"
        bare
      >
        {loading && <div className="px-4 py-4"><Skeleton className="h-24 w-full" /></div>}
        {!loading && data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead>
                <tr className="border-b border-hair text-left text-[11px] text-ink-4">
                  <th className="px-4 py-2 font-normal">方法</th>
                  <th className="px-4 py-2 font-normal">路径</th>
                  <th className="px-4 py-2 font-normal">上游</th>
                  <th className="px-4 py-2 font-normal">转发目标</th>
                  <th className="px-4 py-2 font-normal">说明</th>
                  <th className="px-4 py-2 text-right font-normal">请求</th>
                  <th className="px-4 py-2 text-right font-normal">平均耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-hair)]">
                {data.routes.map((r) => {
                  const m = live.get(r.path);
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface">
                      <td className="px-4 py-2.5">
                        <span className="flex gap-1">
                          {r.methods.map((method) => (
                            <span key={method} className={`rounded border px-1.5 py-[1px] font-mono text-[10.5px] ${methodTone(method)}`}>
                              {method}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{r.path}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-ink-2">{data.upstreams.find((u) => u.id === r.upstream)?.label ?? r.upstream}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-4">{r.target}</td>
                      <td className="px-4 py-2.5 text-ink-3">{r.note}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-ink-2">
                        {m ? fmtInt(m.count) : '0'}
                        {m && m.errors > 0 && <span className="ml-1 text-err">·{m.errors}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-ink-3">{m ? fmtMs(m.avgMs) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !data && <Loading label="未能读取路由表" />}
      </Card>
    </div>
  );
}
