import { getTls } from '../lib/api';
import { useConsole } from '../lib/console';
import { usePoll } from '../hooks/usePoll';
import { fmtDate, shortFingerprint } from '../lib/format';
import { Badge, Card, Dot, Loading, Row, Rows, Skeleton } from '../components/ui/primitives';
import { Ring } from '../components/ui/charts';
import { EmptyNodes } from '../components/sketch/icons';

export default function Certificates() {
  const { status } = useConsole();
  const { data: tls, loading, refresh } = usePoll(getTls, 120000);

  const pct = tls?.daysLeft != null ? Math.min(1, tls.daysLeft / 90) : 0;
  const tone = !tls ? 'muted' : tls.error ? 'err' : tls.daysLeft! < 14 ? 'warn' : 'ok';

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="上游 TLS 证书"
        subtitle={tls ? `${tls.host}:${tls.port}` : '正在握手…'}
        actions={
          <span className="inline-flex items-center gap-2 text-[11.5px]">
            <Dot tone={tone} breathe={tone === 'ok'} />
            <span className={tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'err' ? 'text-err' : 'text-ink-4'}>
              {loading ? '检测中' : tls?.error ? '握手失败' : tls?.authorized ? '链验证通过' : '未验证'}
            </span>
          </span>
        }
      >
        {loading && !tls && <Skeleton className="h-24 w-full" />}
        {tls && tls.error && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <EmptyNodes size={132} />
            <div className="text-[12.5px] text-err">{tls.error}</div>
            <p className="text-[11.5px] text-ink-4">可能是网络不可达或上游地址被改动，检查「上游服务」页。</p>
          </div>
        )}
        {tls && !tls.error && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Ring pct={pct} value={String(tls.daysLeft)} label="天后到期" size={76} />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">{tls.subject ?? '—'}</div>
                <div className="mt-0.5 truncate text-[11.5px] text-ink-4">签发：{tls.issuer ?? '—'}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={tone === 'muted' ? 'muted' : tone}>{tls.protocol ?? 'TLS'}</Badge>
                  {tls.authorized ? <Badge tone="ok">已受信任</Badge> : <Badge tone="warn">未受信任</Badge>}
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Rows>
                <Row k="生效" v={fmtDate(tls.validFrom)} mono />
                <Row k="到期" v={fmtDate(tls.validTo)} mono />
                <Row k="密码套件" v={tls.cipher ?? '—'} mono />
                <Row k="指纹 SHA-256" v={shortFingerprint(tls.fingerprint)} mono />
              </Rows>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="备用名称 (SAN)" subtitle="证书覆盖的域名">
          {tls?.altNames?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tls.altNames.map((n) => (
                <span key={n} className="rounded-[6px] border border-hair bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-2">
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-ink-4">{loading ? '读取中…' : '—'}</div>
          )}
        </Card>

        <Card title="本机监听" subtitle="控制台的入站连接">
          <Rows>
            <Row k="协议" v={status ? `HTTP/1.1（回环 ${status.gateway.host}）` : '—'} />
            <Row k="地址" v={status?.gateway.baseUrl ?? '—'} mono />
            <Row k="对外暴露" v={status && status.gateway.host === '127.0.0.1' ? '否 · 仅本机可访问' : '是 · 请确认防火墙'} />
            <Row k="证书" v="不适用（明文回环）" />
          </Rows>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={refresh} className="focus-ring rounded-[6px] px-2 py-1 text-[11.5px] text-ink-3 hover:bg-surface-2 hover:text-ink">
              重新检测
            </button>
          </div>
        </Card>
      </div>

      {loading && !tls && <Loading label="正在建立 TLS 握手" />}
    </div>
  );
}
