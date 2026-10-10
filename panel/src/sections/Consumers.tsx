import { copyText } from '../lib/api';
import { useConsole } from '../lib/console';
import { Badge, Button, Card, Dot, Row, Rows } from '../components/ui/primitives';
import { EmptyNodes, IconCheck, IconCopy, IconRefresh, IconX } from '../components/sketch/icons';

const CLIENTS = [
  { id: 'cursor', label: 'Cursor', kind: '原生 UI', note: 'Models → Override OpenAI Base URL' },
  { id: 'cline', label: 'Cline / Continue', kind: '扩展', note: 'Provider: OpenAI Compatible' },
  { id: 'sdk', label: 'OpenAI SDK / curl', kind: '脚本', note: '指向本机 /v1 即可' },
];

export default function Consumers() {
  const { status, act, busy, notify } = useConsole();
  const cursor = status?.cursor ?? null;
  const wired = !!cursor && cursor.baseUrl === status?.gateway.baseUrl;

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="已检测到的消费者"
        subtitle="本机自动发现调用这个网关的客户端"
        actions={<Badge tone={wired ? 'ok' : 'muted'}>{wired ? '1 个已接入' : '0 个已接入'}</Badge>}
      >
        {cursor ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-[10px] border border-hair bg-surface px-3.5 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-hair-2 bg-surface-2 text-[12px] text-ink-2">
                Cu
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">Cursor</span>
                  <Badge tone={cursor.running ? 'ok' : 'muted'}>{cursor.running ? '运行中' : '未运行'}</Badge>
                  <span className="font-mono text-[11.5px] text-ink-4">{cursor.version ?? ''}</span>
                </div>
                <div className="mt-1 text-[11.5px] text-ink-4">{cursor.exePath}</div>
              </div>
              <Dot tone={wired ? 'ok' : 'warn'} breathe={wired} />
            </div>

            <Rows>
              <Row
                k="接入地址"
                v={cursor.baseUrl ? <span className={wired ? 'text-ok' : 'text-warn'}>{cursor.baseUrl}</span> : '尚未写入'}
                mono
              />
              <Row k="密钥开关" v={cursor.keyEnabled ? '已启用（使用本机 key）' : '未启用'} />
              <Row k="选择器模型" v={cursor.models.length ? cursor.models.join(' · ') : '—'} mono />
              <Row k="客户端补丁" v={cursor.patched === undefined ? '—' : cursor.patched ? '已应用' : '未应用'} />
            </Rows>

            <div className="flex flex-wrap gap-2">
              <Button
                tone="primary"
                size="sm"
                icon={<IconCheck size={13} />}
                loading={busy === 'cursor-write-config'}
                onClick={() => {
                  if (!window.confirm('写入会修改 Cursor 的本地设置（Base URL / 密钥开关 / 模型列表），请先完全退出 Cursor。确定写入？')) return;
                  act('cursor-write-config');
                }}
              >
                写入 Cursor 配置
              </Button>
              <Button
                size="sm"
                icon={<IconRefresh size={13} />}
                loading={busy === 'restart-cursor'}
                onClick={() => {
                  if (!window.confirm('重启 Cursor 会关闭当前窗口，确定继续？')) return;
                  act('restart-cursor');
                }}
              >
                重启 Cursor
              </Button>
              <Button
                size="sm"
                icon={<IconCopy size={13} />}
                onClick={async () => {
                  const ok = await copyText(status?.gateway.baseUrl ?? '');
                  notify(ok ? '已复制网关地址' : '复制失败', ok ? 'ok' : 'err');
                }}
              >
                复制网关地址
              </Button>
            </div>
            {!wired && (
              <p className="text-[11.5px] text-ink-4">
                提示：写入前请完全退出 Cursor；也可以在 Cursor 里手动填写 <span className="font-mono text-ink-3">{status?.gateway.baseUrl}</span>。
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <EmptyNodes size={148} />
            <div className="text-[13px] text-ink-2">还没有检测到本机客户端</div>
            <p className="max-w-[420px] text-[12px] text-ink-4">
              安装 Cursor 后打开一次，或直接把任意 OpenAI 兼容客户端指向 <span className="font-mono text-ink-3">{status?.gateway.baseUrl ?? 'http://127.0.0.1:8787/v1'}</span>。
            </p>
          </div>
        )}
      </Card>

      <Card title="支持的接入方式" subtitle="三种客户端只需要填一个地址" bare>
        <ul className="divide-y divide-[var(--c-hair)]">
          {CLIENTS.map((c) => {
            const isCursor = c.id === 'cursor';
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] text-ink">{c.label}</span>
                    <Badge tone="muted">{c.kind}</Badge>
                    {isCursor && cursor && <Badge tone={wired ? 'ok' : 'warn'}>{wired ? '已接入' : '待接入'}</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-4">{c.note}</span>
                </span>
                {isCursor && cursor && !wired && <IconX size={14} className="text-warn" />}
                {isCursor && wired && <IconCheck size={14} className="text-ok" />}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
