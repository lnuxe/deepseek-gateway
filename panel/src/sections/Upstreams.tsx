import { useState } from 'react';
import { getRoutes, getTls } from '../lib/api';
import { useConsole } from '../lib/console';
import { usePoll } from '../hooks/usePoll';
import { copyText } from '../lib/api';
import { fmtMs } from '../lib/format';
import { Badge, Button, Card, Dot, Row, Rows, Skeleton } from '../components/ui/primitives';
import { IconCopy, IconRefresh } from '../components/sketch/icons';

export default function Upstreams() {
  const { status, act, busy, notify } = useConsole();
  const { data } = usePoll(getRoutes, 0);
  const { data: tls } = usePoll(getTls, 60000);
  const [probing, setProbing] = useState(false);

  const probe = async () => {
    setProbing(true);
    const r = await act('test-upstream');
    setProbing(false);
    return r;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(data?.upstreams ?? []).map((u) => {
          const isPrimary = u.id === 'openai';
          const ok = isPrimary ? status?.upstream.ok : u.id === 'local' ? true : undefined;
          return (
            <Card
              key={u.id}
              title={u.label}
              subtitle={u.base}
              actions={
                <span className="inline-flex items-center gap-2 text-[11.5px]">
                  <Dot tone={ok === undefined ? 'muted' : ok ? 'ok' : 'err'} breathe={!!ok} />
                  <span className={ok === undefined ? 'text-ink-4' : ok ? 'text-ok' : 'text-err'}>
                    {ok === undefined ? '未探测' : ok ? '健康' : '不可达'}
                  </span>
                </span>
              }
            >
              <Rows>
                <Row k="协议" v={u.protocol} />
                <Row k="基础地址" v={u.base} mono />
                {isPrimary && <Row k="延迟" v={fmtMs(status?.upstream.latencyMs)} mono />}
                {isPrimary && (
                  <Row
                    k="可用模型"
                    v={
                      status?.upstream.models.length
                        ? status.upstream.models.map((m) => (
                            <span key={m} className="mr-1.5 inline-block rounded border border-hair bg-surface-2 px-1.5 py-[1px] font-mono text-[11px] text-ink-2">
                              {m}
                            </span>
                          ))
                        : '—'
                    }
                  />
                )}
                {isPrimary && u.id === 'openai' && tls && !tls.error && (
                  <Row k="TLS" v={`${tls.protocol} · ${tls.daysLeft} 天后到期`} mono />
                )}
                {isPrimary && status?.upstream.error && <Row k="错误" v={status.upstream.error} />}
              </Rows>
              {isPrimary && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button tone="primary" size="sm" loading={probing || busy === 'test-upstream'} icon={<IconRefresh size={13} />} onClick={probe}>
                    测试连通
                  </Button>
                  <Button
                    size="sm"
                    icon={<IconCopy size={13} />}
                    onClick={async () => {
                      const ok = await copyText(u.base);
                      notify(ok ? '已复制上游地址' : '复制失败', ok ? 'ok' : 'err');
                    }}
                  >
                    复制地址
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        {!data && (
          <Card title="上游服务">
            <Skeleton className="h-24 w-full" />
          </Card>
        )}
      </div>

      <Card title="模型清单" subtitle="上游 /v1/models 返回，供客户端选择器校验">
        {!status ? (
          <Skeleton className="h-10 w-full" />
        ) : status.upstream.models.length ? (
          <div className="flex flex-wrap gap-2">
            {status.upstream.models.map((m) => (
              <span key={m} className="rounded-[6px] border border-hair bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-ink-2">
                {m}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 text-[12.5px] text-ink-3">
            <Badge tone="warn">不可用</Badge>
            未能读取上游模型列表，检查密钥与网络。
          </div>
        )}
      </Card>
    </div>
  );
}
