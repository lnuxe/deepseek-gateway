import { useMemo } from 'react';
import { getLog, getMetrics } from '../lib/api';
import { useConsole } from '../lib/console';
import { usePoll } from '../hooks/usePoll';
import { fmtInt, fmtMs, fmtPct, fmtUptime, parseLogLine, statusTone } from '../lib/format';
import { Card, Dot, Row, Rows, Skeleton, Stat } from '../components/ui/primitives';
import { HeroBand } from '../components/layout/HeroBand';
import { Sparkline } from '../components/ui/charts';
import { IconPlay, IconUpstream } from '../components/sketch/icons';

export default function Overview({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { status, act, busy } = useConsole();
  const { data: metrics } = usePoll(getMetrics, 10000);
  const { data: log } = usePoll(() => getLog(8), 6000);

  const logLines = useMemo(() => (log?.tail ?? '').split('\n').filter(Boolean).slice(-8).reverse(), [log]);

  if (!status) {
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

  const healthy = status.upstream.ok && status.key.present;
  const cursorOk = !!status.cursor && status.cursor.baseUrl === status.gateway.baseUrl;

  return (
    <div className="flex flex-col gap-3">
      <HeroBand />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="累计请求"
          value={metrics ? fmtInt(metrics.total) : '—'}
          hint={metrics ? `最近 1 分钟 ${metrics.rpm} 次` : '统计中'}
        />
        <Stat label="P95 延迟" value={metrics ? fmtMs(metrics.p95) : '—'} hint={metrics ? `P50 ${fmtMs(metrics.p50)}` : ''} />
        <Stat
          label="错误率"
          value={metrics ? fmtPct(metrics.errorRate) : '—'}
          tone={metrics && metrics.errorRate > 0.05 ? 'warn' : undefined}
          hint={metrics ? `${metrics.errors} 次 4xx/5xx` : ''}
        />
        <Stat label="运行时长" value={fmtUptime(status.gateway.uptimeSec)} hint={`PID ${status.gateway.pid}`} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 运行状态 */}
        <Card
          title="运行状态"
          subtitle="本机网关与其依赖"
          className="lg:col-span-2"
          actions={
            <span className={`inline-flex items-center gap-2 text-[11.5px] ${healthy ? 'text-ok' : 'text-warn'}`}>
              <Dot tone={healthy ? 'ok' : 'warn'} breathe={healthy} />
              {healthy ? '正常' : '需要处理'}
            </span>
          }
        >
          <Rows>
            <Row
              k="网关监听"
              v={
                <span className="inline-flex items-center gap-2">
                  <Dot tone="ok" breathe /> {status.gateway.host}:{status.gateway.port}
                </span>
              }
              mono
            />
            <Row
              k="上游服务"
              v={
                <span className={status.upstream.ok ? 'text-ok' : 'text-err'}>
                  {status.upstream.ok ? `连通 · ${fmtMs(status.upstream.latencyMs)}` : status.upstream.error ?? '不可达'}
                </span>
              }
            />
            <Row k="可用模型" v={status.upstream.models.length ? status.upstream.models.join(' · ') : '—'} mono />
            <Row
              k="上游密钥"
              v={status.key.present ? `已配置 · ${status.key.source}` : '未配置'}
              mono
            />
            <Row
              k="消费者接入"
              v={
                status.cursor
                  ? `${cursorOk ? '已接入' : '未接入'} · Cursor ${status.cursor.version ?? ''} ${status.cursor.running ? '（运行中）' : '（未运行）'}`
                  : '未检测到本机客户端'
              }
            />
            <Row k="最近错误" v={metrics?.lastError ? `${metrics.lastError.status} ${metrics.lastError.method} ${metrics.lastError.path}` : '无'} mono />
          </Rows>
        </Card>

        {/* 吞吐 */}
        <Card
          title="吞吐趋势"
          subtitle="最近 60 分钟请求数"
          actions={
            <button type="button" onClick={() => onNavigate('metrics')} className="focus-ring rounded-[6px] px-2 py-1 text-[11.5px] text-ink-3 hover:bg-surface-2 hover:text-ink">
              查看监控
            </button>
          }
        >
          {metrics ? <Sparkline values={metrics.series.map((s) => s.count)} height={64} /> : <Skeleton className="h-16 w-full" />}
          <div className="mt-3 flex items-center justify-between text-[11.5px] text-ink-4">
            <span>60 分钟前</span>
            <span className={metrics && metrics.rpmDelta > 0 ? 'text-ok' : 'text-ink-4'}>
              {metrics ? `当前 ${metrics.rpm} 次/分` : ''}
            </span>
            <span>现在</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 快捷动作 */}
        <Card title="快捷操作" subtitle="不常用的放在这里，日常只跑这两个" className="lg:col-span-1">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => act('probe', { dialogOn: 'checks' })}
              disabled={busy === 'probe'}
              className="focus-ring flex items-center gap-2.5 rounded-[8px] border border-hair bg-surface px-3 py-2.5 text-left text-[12.5px] transition-colors hover:border-hair-2 hover:bg-surface-2 disabled:opacity-50"
            >
              <IconPlay size={16} className="text-accent" />
              <span className="flex-1">运行自检</span>
              <span className="text-[11px] text-ink-4">{busy === 'probe' ? '执行中' : '5 项'}</span>
            </button>
            <button
              type="button"
              onClick={() => act('test-upstream')}
              disabled={busy === 'test-upstream'}
              className="focus-ring flex items-center gap-2.5 rounded-[8px] border border-hair bg-surface px-3 py-2.5 text-left text-[12.5px] transition-colors hover:border-hair-2 hover:bg-surface-2 disabled:opacity-50"
            >
              <IconUpstream size={16} className="text-info" />
              <span className="flex-1">测试上游连接</span>
              <span className="text-[11px] text-ink-4">{status.upstream.latencyMs ? fmtMs(status.upstream.latencyMs) : '—'}</span>
            </button>
            <div className="mt-0.5 rounded-[8px] border border-dashed border-hair px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-4">
              需要改 key / 端口 / 自启，或查看客户端补丁？都在
              <button type="button" onClick={() => onNavigate('settings')} className="focus-ring mx-1 text-ink-2 underline decoration-dotted underline-offset-2 hover:text-ink">
                系统设置
              </button>
              里。
            </div>
          </div>
        </Card>

        {/* 最近请求 */}
        <Card
          title="最近请求"
          subtitle="来自请求日志的最后 8 条"
          className="lg:col-span-2"
          actions={
            <button type="button" onClick={() => onNavigate('logs')} className="focus-ring rounded-[6px] px-2 py-1 text-[11.5px] text-ink-3 hover:bg-surface-2 hover:text-ink">
              全部日志
            </button>
          }
        >
          {logLines.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-ink-4">还没有请求</div>
          ) : (
            <ul className="divide-y divide-[var(--c-hair)] font-mono text-[11.5px]">
              {logLines.map((line, i) => {
                const p = parseLogLine(line);
                const tone = p.status ? statusTone(p.status) : 'muted';
                return (
                  <li key={i} className="flex items-center gap-3 py-1.5">
                    <span className="text-ink-4">{p.time}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">{p.body.replace(/\s*->.*$/, '')}</span>
                    {p.ms != null && <span className="text-ink-4">{p.ms}ms</span>}
                    <span
                      className={
                        tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'err' ? 'text-err' : 'text-ink-4'
                      }
                    >
                      {p.status ?? '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
