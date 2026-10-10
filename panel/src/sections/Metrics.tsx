import { getMetrics } from '../lib/api';
import { usePoll } from '../hooks/usePoll';
import { fmtInt, fmtMs, fmtPct, fmtUptime, statusTone } from '../lib/format';
import { Card, Skeleton, Stat } from '../components/ui/primitives';
import { Bar, Sparkline } from '../components/ui/charts';

export default function Metrics() {
  const { data: m, loading } = usePoll(getMetrics, 5000);

  if (!m && loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!m) return <Card title="监控">未能读取指标</Card>;

  const maxStatus = Math.max(...m.byStatus.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="每分钟请求" value={fmtInt(m.rpm)} hint={m.rpmDelta === 0 ? '与上一分钟持平' : m.rpmDelta > 0 ? `较上一分钟 +${m.rpmDelta}` : `较上一分钟 ${m.rpmDelta}`} />
        <Stat label="累计请求" value={fmtInt(m.total)} hint={`运行 ${fmtUptime(m.uptimeSec)}`} />
        <Stat label="P50 / P95" value={`${fmtMs(m.p50)} / ${fmtMs(m.p95)}`} hint="本进程内采样（最近 500 次）" />
        <Stat
          label="错误率"
          value={fmtPct(m.errorRate)}
          hint={`${m.errors} 次非 2xx`}
          tone={m.errorRate > 0.05 ? 'err' : m.errorRate > 0.01 ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="请求量（60 分钟）" subtitle="按分钟聚合的转发次数">
          <Sparkline values={m.series.map((s) => s.count)} height={90} />
          <div className="mt-2 flex justify-between text-[11px] text-ink-4">
            <span>60 分钟前</span>
            <span>峰值 {fmtInt(Math.max(...m.series.map((s) => s.count), 0))}</span>
            <span>现在</span>
          </div>
        </Card>

        <Card title="错误量（60 分钟）" subtitle="非 2xx 响应按分钟聚合">
          <Sparkline values={m.series.map((s) => s.errors)} height={90} tone="err" />
          <div className="mt-2 flex justify-between text-[11px] text-ink-4">
            <span>60 分钟前</span>
            <span>共 {fmtInt(m.errors)} 次</span>
            <span>现在</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="响应状态分布" subtitle="累计状态码计数">
          <div className="flex flex-col gap-2.5">
            {m.byStatus.length === 0 && <div className="py-4 text-center text-[12.5px] text-ink-4">暂无数据</div>}
            {m.byStatus.map((s) => {
              const tone = statusTone(s.status);
              return (
                <div key={s.status} className="flex items-center gap-3">
                  <span
                    className={`w-10 shrink-0 font-mono text-[11.5px] ${
                      tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'err' ? 'text-err' : 'text-ink-3'
                    }`}
                  >
                    {s.status}
                  </span>
                  <div className="flex-1">
                    <Bar value={s.count} max={maxStatus} tone={tone === 'muted' ? 'accent' : tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'err'} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[11.5px] text-ink-3">{fmtInt(s.count)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="按路由统计" subtitle="请求量、错误与平均耗时" bare>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12px]">
              <thead>
                <tr className="border-b border-hair text-left text-[11px] text-ink-4">
                  <th className="px-4 py-2 font-normal">路由</th>
                  <th className="px-4 py-2 text-right font-normal">请求</th>
                  <th className="px-4 py-2 text-right font-normal">错误</th>
                  <th className="px-4 py-2 text-right font-normal">平均</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-hair)]">
                {m.byRoute.map((r) => (
                  <tr key={r.route} className="transition-colors hover:bg-surface">
                    <td className="px-4 py-2 font-mono text-[11.5px] text-ink-2">{r.route}</td>
                    <td className="px-4 py-2 text-right font-mono text-[11.5px]">{fmtInt(r.count)}</td>
                    <td className={`px-4 py-2 text-right font-mono text-[11.5px] ${r.errors ? 'text-err' : 'text-ink-4'}`}>{r.errors}</td>
                    <td className="px-4 py-2 text-right font-mono text-[11.5px] text-ink-3">{r.count ? fmtMs(r.avgMs) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="最近错误" subtitle="最近一次非 2xx 响应">
        {m.lastError ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[12px] text-ink-2">
            <span className="text-err">{m.lastError.status}</span>
            <span>{m.lastError.method}</span>
            <span className="text-ink-3">{m.lastError.path}</span>
            <span className="ml-auto text-[11.5px] text-ink-4">{new Date(m.lastError.at).toLocaleString('zh-CN', { hour12: false })}</span>
          </div>
        ) : (
          <div className="text-[12.5px] text-ink-4">运行以来没有出现错误响应</div>
        )}
      </Card>

      <div className="text-[11px] text-ink-4">
        指标在网关进程内累计，重启后归零；采样缓冲上限 500 次请求，长期统计请以日志文件为准。
      </div>
    </div>
  );
}
