import { useEffect, useState } from 'react';
import { copyText, saveConfig } from '../lib/api';
import { useConsole } from '../lib/console';
import { fmtMs, fmtUptime } from '../lib/format';
import { Badge, Button, Card, Dot, Row, Rows, Skeleton } from '../components/ui/primitives';
import { IconCheck, IconCopy, IconPlay, IconRefresh } from '../components/sketch/icons';

export default function Settings() {
  const { status, act, busy, notify, refreshStatus } = useConsole();
  const [key, setKey] = useState('');
  const [port, setPort] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingPort, setSavingPort] = useState(false);

  useEffect(() => {
    if (status) setPort(String(status.gateway.port));
  }, [status?.gateway.port]);

  if (!status) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} title="加载中">
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  const patchActions = status.actions.filter((a) => a.local && /patch/.test(a.name));
  const portChanged = Number(port) !== status.gateway.port && port.trim() !== '';

  const saveKey = async () => {
    if (!key.trim()) return notify('请先粘贴上游密钥', 'err');
    setSavingKey(true);
    const saved = await saveConfig({ apiKey: key.trim() });
    if (!saved.ok) {
      setSavingKey(false);
      return notify('✗ ' + (saved.message || '保存失败'), 'err');
    }
    const test = await act('test-upstream');
    setKey('');
    setSavingKey(false);
    notify(test.ok ? '✓ 密钥已保存，上游连通' : '✗ 密钥已保存，但连接失败：' + (test.message ?? ''), test.ok ? 'ok' : 'err');
    refreshStatus();
  };

  const savePort = async () => {
    setSavingPort(true);
    const r = await saveConfig({ port: Number(port) });
    setSavingPort(false);
    notify((r.ok ? '✓ ' : '✗ ') + (r.message || '已保存，重启网关后生效'), r.ok ? 'ok' : 'err');
    refreshStatus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 上游密钥 */}
        <Card
          title="上游密钥"
          subtitle="保存在本机 config.json，不会写入仓库"
          actions={
            <span className="inline-flex items-center gap-2 text-[11.5px]">
              <Dot tone={status.key.present ? 'ok' : 'err'} breathe={status.key.present} />
              <span className={status.key.present ? 'text-ok' : 'text-err'}>{status.key.present ? '已配置' : '未配置'}</span>
            </span>
          }
        >
          <div className="flex flex-col gap-2.5">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={status.key.present ? `已保存 · 来源 ${status.key.source}` : 'sk-…'}
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-[8px] border border-hair bg-surface px-3 py-2.5 font-mono text-[12.5px] tracking-wider text-ink outline-none placeholder:text-ink-4 focus:border-hair-3"
            />
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" size="sm" icon={<IconCheck size={13} />} loading={savingKey} onClick={saveKey} disabled={!key.trim()}>
                保存并测试
              </Button>
              <Button size="sm" icon={<IconPlay size={13} />} loading={busy === 'test-upstream'} onClick={() => act('test-upstream', { dialogOn: 'always' })}>
                只测试连接
              </Button>
            </div>
            <Rows>
              <Row k="来源" v={status.key.present ? status.key.source : '—'} mono />
              <Row k="长度" v={status.key.present ? `${status.key.length} 字符` : '—'} />
              <Row k="上游延迟" v={fmtMs(status.upstream.latencyMs)} mono />
            </Rows>
          </div>
        </Card>

        {/* 监听 */}
        <Card title="监听端口" subtitle="控制台与 API 都走这个端口，仅绑定回环地址">
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-32 rounded-[8px] border border-hair bg-surface px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-hair-3"
              />
              <Button tone="primary" size="sm" loading={savingPort} onClick={savePort} disabled={!portChanged}>
                保存
              </Button>
              <Button
                size="sm"
                icon={<IconRefresh size={13} />}
                loading={busy === 'restart-gateway'}
                onClick={() => {
                  if (confirm('重启网关会短暂中断正在进行的请求，确定继续？')) act('restart-gateway');
                }}
              >
                重启网关
              </Button>
            </div>
            {portChanged && <Badge tone="warn">端口有改动，重启网关后生效</Badge>}
            <Rows>
              <Row k="监听地址" v={`${status.gateway.host}:${status.gateway.port}`} mono />
              <Row k="对外暴露" v={status.gateway.host === '127.0.0.1' ? '否 · 仅本机' : '是'} />
              <Row k="进程" v={`PID ${status.gateway.pid} · 运行 ${fmtUptime(status.gateway.uptimeSec)}`} />
              <Row k="端口冲突" v="启动时若端口被占用，网关会提示并退出" />
            </Rows>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 自启 */}
        <Card title="开机自启" subtitle="登录后自动拉起网关">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => act('autostart-install')} loading={busy === 'autostart-install'}>
              注册开机自启
            </Button>
            <Button
              size="sm"
              tone="danger"
              onClick={() => {
                if (confirm('确定取消开机自启？')) act('autostart-remove');
              }}
              loading={busy === 'autostart-remove'}
            >
              取消开机自启
            </Button>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-4">
            当前为手动启动模式：桌面快捷方式「DeepSeek 网关」即可拉起，注册后会写入当前用户的启动项。
          </p>
        </Card>

        {/* 客户端补丁 */}
        <Card
          title="客户端补丁"
          subtitle="仅本机生效的适配脚本，不进公开仓库"
          actions={<Badge tone={patchActions.length ? 'info' : 'muted'}>{patchActions.length ? '可用' : '未加载'}</Badge>}
        >
          {patchActions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {patchActions.map((a) => (
                  <Button
                    key={a.name}
                    size="sm"
                    tone={a.danger ? 'danger' : 'default'}
                    loading={busy === a.name}
                    onClick={() => {
                      if (a.danger && !confirm(`${a.label}？`)) return;
                      act(a.name);
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
              <Rows>
                <Row k="当前状态" v={status.cursor?.patched === undefined ? '未检测' : status.cursor?.patched ? '已应用' : '未应用'} />
                <Row k="说明" v="客户端升级覆盖后需要重新应用" />
              </Rows>
            </>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-ink-4">
              未检测到本机适配脚本（<span className="font-mono">local-actions.mjs</span>）。放回该文件并重启网关后，这里会出现检查 / 应用 / 回滚入口。
            </p>
          )}
        </Card>
      </div>

      {/* 运行时 */}
      <Card
        title="运行时信息"
        subtitle="用于排查环境问题"
        actions={
          <Button
            size="sm"
            icon={<IconCopy size={13} />}
            onClick={async () => {
              const ok = await copyText(
                JSON.stringify(
                  {
                    gateway: status.gateway,
                    runtime: status.runtime,
                    upstream: status.upstream,
                    key: { present: status.key.present, source: status.key.source },
                  },
                  null,
                  2,
                ),
              );
              notify(ok ? '已复制诊断信息' : '复制失败', ok ? 'ok' : 'err');
            }}
          >
            复制诊断信息
          </Button>
        }
      >
        <Rows>
          <Row k="系统用户" v={status.runtime.user} />
          <Row k="平台" v={`${status.runtime.platform} · ${status.runtime.arch}`} mono />
          <Row k="Node" v={status.runtime.node} mono />
          <Row k="网关版本" v="v1.0.0" mono />
          <Row k="工作目录" v={status.runtime.dir} mono />
          <Row k="配置文件" v={status.runtime.configPath} mono />
          <Row k="日志文件" v={status.runtime.logPath} mono />
        </Rows>
      </Card>
    </div>
  );
}
