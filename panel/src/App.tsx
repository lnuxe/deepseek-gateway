import { useState } from 'react';
import { AlertTriangle, KeyRound, Play, PlugZap, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import Backdrop from './components/Backdrop';
import { Advanced } from './components/Advanced';
import { StepCard, type StepState } from './components/StepCard';
import { Button, Dot } from './components/ui';
import { CopyRow, ProbeList, Toast } from './components/bits';
import { SketchKey, SketchPlug, SketchShield, SketchUnderline } from './components/illustrations';
import { useStatus } from './hooks/useStatus';
import { runAction, saveConfig, type Check } from './lib/api';

type ToastState = { msg: string; kind: 'ok' | 'err' } | null;

export default function App() {
  const { status, error, refresh } = useStatus(5000);
  const [toast, setToast] = useState<ToastState>(null);
  const [armedMap, setArmedMap] = useState<Record<string, boolean>>({});
  const [probe, setProbe] = useState<{ ok: boolean; checks: Check[] } | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);

  const notify = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), kind === 'err' ? 6000 : 3200);
  };
  const armed = (name: string) => !!armedMap[name];
  const arm = (name: string) => {
    setArmedMap((m) => ({ ...m, [name]: true }));
    setTimeout(() => setArmedMap((m) => ({ ...m, [name]: false })), 4200);
  };

  const act = async (name: string, opts: { confirm?: boolean; label?: string } = {}) => {
    if (opts.confirm && !armed(name)) return arm(name);
    setBusy(name);
    try {
      const r = await runAction(name);
      if (r.checks) setProbe({ ok: !!r.ok, checks: r.checks });
      notify((r.ok ? '✓ ' : '✗ ') + (r.message || opts.label || name), r.ok ? 'ok' : 'err');
      if (name === 'restart-gateway') setTimeout(refresh, 2200);
    } catch (e) {
      notify('✗ ' + (e instanceof Error ? e.message : String(e)), 'err');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (!status) {
    return (
      <>
        <Backdrop />
        <main className="relative z-10 mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center gap-4 px-6">
          <div className="shimmer h-12 w-12 rounded-2xl" />
          <div className="shimmer h-4 w-40 rounded-full" />
          {error && <p className="text-[12.5px] text-err">读取状态失败：{error}</p>}
        </main>
      </>
    );
  }

  const keyOk = status.key.present && status.upstream.ok;
  const cursorOk = !!status.cursor && status.cursor.baseUrl === status.gateway.baseUrl;
  const verifyOk = probe?.ok === true;

  const states: StepState[] = [
    keyOk ? 'done' : 'current',
    keyOk ? (cursorOk ? 'done' : 'current') : 'todo',
    keyOk || cursorOk ? (verifyOk ? 'done' : 'current') : 'todo',
  ];
  const tags = [
    keyOk ? '已完成' : '待完成',
    states[1] === 'done' ? '已完成' : states[1] === 'current' ? '待完成' : '先完成第 1 步',
    verifyOk ? '已通过' : states[2] === 'current' ? '待完成' : '先完成前面步骤',
  ];
  const openState = (i: number) => states[i] === 'current' || peek === String(i);

  const lede = !keyOk
    ? '第一步：把 DeepSeek 的 key 交给网关，其余自动完成'
    : !cursorOk
      ? '下一步：把网关地址写进 Cursor'
      : !verifyOk
        ? '最后一步：跑一遍自检确认通路'
        : '全部就绪 —— Cursor 已经在用你的 DeepSeek';

  return (
    <>
      <Backdrop />
      <main className="relative z-10 mx-auto w-full max-w-[720px] px-6 pt-16 pb-24">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(150deg,#8aa7ff,#b79cff)] shadow-[0_22px_60px_-24px_rgba(138,167,255,.9)]">
            <Sparkles className="h-5 w-5 text-[#07080e]" />
          </div>
          <h1 className="text-[23px] font-semibold tracking-wide">DeepSeek 网关</h1>
          <SketchUnderline className="mx-auto mt-0.5 h-2 w-[176px]" />
          <p className="mt-2 text-[13.5px] text-ink-2">{lede}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-2">
              <Dot state={true} /> 网关 :{status.gateway.port}
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot state={status.upstream.ok} />
              {status.upstream.ok ? 'DeepSeek 已连接' : 'DeepSeek 未连接'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot state={status.key.present} />
              {status.key.present ? `Key 已配置 · ${status.key.source}` : 'Key 未配置'}
            </span>
            {status.cursor && (
              <span className="inline-flex items-center gap-2">
                <Dot state={cursorOk} />
                {cursorOk ? 'Cursor 已接入' : 'Cursor 未接入'}
              </span>
            )}
          </div>
        </header>

        <ol className="flex flex-col gap-3.5">
          <StepCard
            index={1}
            delay={0.02}
            title="填入 DeepSeek API Key"
            hint={status.key.present ? `当前来源：${status.key.source}（${status.key.length} 字符）` : 'key 只保存在本机，不会上传'}
            state={states[0]}
            tag={tags[0]}
            open={openState(0)}
            onToggle={() => states[0] === 'done' && setPeek(peek === '0' ? null : '0')}
            art={<SketchKey size={104} />}
          >
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status.key.present ? '已保存 · 粘贴新 key 可覆盖' : 'sk-…'}
              spellCheck={false}
              autoComplete="off"
              className="focus-ring w-full rounded-xl border border-hair bg-[rgba(0,0,0,.28)] px-4 py-3 font-mono text-[13.5px] tracking-wider text-ink outline-none transition-colors focus:border-[rgba(138,167,255,.55)]"
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                icon={<KeyRound className="h-4 w-4" />}
                loading={busy === 'save-key'}
                disabled={!apiKey.trim()}
                onClick={async () => {
                  setBusy('save-key');
                  const saved = await saveConfig({ apiKey: apiKey.trim() });
                  if (!saved.ok) {
                    setBusy(null);
                    return notify('✗ ' + (saved.message || '保存失败'), 'err');
                  }
                  const test = await runAction('test-upstream');
                  setApiKey('');
                  setBusy(null);
                  notify(test.ok ? '✓ key 已保存，DeepSeek 连通' : '✗ key 已保存，但连接失败：' + (test.message || ''), test.ok ? 'ok' : 'err');
                  refresh();
                }}
              >
                保存并测试
              </Button>
              <Button loading={busy === 'test-upstream'} onClick={() => act('test-upstream')}>
                只测试连接
              </Button>
              {keyOk && <span className="text-[12.5px] text-ink-3">可用：{status.upstream.models.join(' / ')}</span>}
            </div>
          </StepCard>

          <StepCard
            index={2}
            delay={0.09}
            title="接入 Cursor"
            hint="把网关地址写进 Cursor 的模型设置"
            state={states[1]}
            tag={tags[1]}
            open={openState(1)}
            onToggle={() => states[1] === 'done' && setPeek(peek === '1' ? null : '1')}
            art={<SketchPlug size={104} />}
          >
            <CopyRow value={status.gateway.baseUrl} onCopied={(ok) => notify(ok ? '已复制网关地址' : '复制失败，请手动选中', ok ? 'ok' : 'err')} />
            <p className="text-[12.5px] text-ink-3">
              也可以在 Cursor 里手动填写：<span className="text-ink-2">Models → Override OpenAI Base URL</span>。
              自动写入需要先完全退出 Cursor。
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="primary"
                icon={<PlugZap className="h-4 w-4" />}
                loading={busy === 'cursor-write-config'}
                armed={armed('cursor-write-config')}
                onClick={() => act('cursor-write-config', { confirm: true })}
              >
                {armed('cursor-write-config') ? '再点一次确认' : '写入 Cursor 配置'}
              </Button>
              <Button
                icon={<RefreshCw className="h-4 w-4" />}
                loading={busy === 'restart-cursor'}
                armed={armed('restart-cursor')}
                onClick={() => act('restart-cursor', { confirm: true })}
              >
                {armed('restart-cursor') ? '再点一次确认' : '重启 Cursor'}
              </Button>
            </div>
            {status.cursor && (
              <p className="text-[12px] text-ink-3">
                检测到 Cursor {status.cursor.version ?? ''} · {status.cursor.running ? '正在运行' : '未运行'} ·{' '}
                {status.cursor.baseUrl ? `当前写入的地址 ${status.cursor.baseUrl}` : '尚未写入地址'}
              </p>
            )}
          </StepCard>

          <StepCard
            index={3}
            delay={0.16}
            title="验证"
            hint="跑一遍自检，确认任意模型名都能通"
            state={states[2]}
            tag={tags[2]}
            open={openState(2)}
            onToggle={() => states[2] === 'done' && setPeek(peek === '2' ? null : '2')}
            art={<SketchShield size={104} />}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary" icon={<ShieldCheck className="h-4 w-4" />} loading={busy === 'probe'} onClick={() => act('probe')}>
                运行自检
              </Button>
              <span className="text-[12.5px] text-ink-3">
                {probe ? (probe.ok ? '全部通过' : '有失败项，见下方') : '依次检查模型列表、任意模型名映射、流式输出'}
              </span>
            </div>
            {probe && <ProbeList checks={probe.checks} />}
          </StepCard>
        </ol>

        {error && (
          <p className="mt-4 flex items-center gap-2 text-[12.5px] text-err">
            <AlertTriangle className="h-3.5 w-3.5" /> 与网关通信失败：{error}
          </p>
        )}

        <Advanced status={status} notify={notify} onChanged={refresh} armed={armed} arm={arm} />

        <footer className="mt-10 flex items-center justify-center gap-2 text-[11.5px] text-ink-3">
          <Play className="h-3 w-3" />
          面板每 5 秒自检一次 · 只在 127.0.0.1 上监听
        </footer>
      </main>
      <Toast toast={toast} />
    </>
  );
}
