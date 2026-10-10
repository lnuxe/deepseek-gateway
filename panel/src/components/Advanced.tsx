import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SlidersHorizontal } from 'lucide-react';
import { getLog, runAction, saveConfig, type Status } from '../lib/api';
import { Button } from './ui';

function paint(raw: string) {
  if (!raw) return [{ key: 'empty', html: '（还没有请求）', cls: 'text-ink-3' }];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      let h = line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
      h = h.replace(/^(\[[^\]]+\])/, '<span class="text-ink-3">$1</span>');
      h = h.replace(/->\s(\d{3})/, (_m, c: string) => `<span class="text-ink-3">-&gt;</span> <span class="${c[0] === '2' ? 'text-ok' : c[0] === '4' ? 'text-warn' : 'text-err'}">${c}</span>`);
      h = h.replace(/\((\d+)ms\)/g, '<span class="text-ink-3">($1ms)</span>');
      return { key: String(i), html: h };
    });
}

export function Advanced({
  status,
  notify,
  onChanged,
  armed,
  arm,
}: {
  status: Status;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
  onChanged: () => void;
  armed: (name: string) => boolean;
  arm: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(() => paint(''));
  const [paused, setPaused] = useState(false);
  const [port, setPort] = useState(String(status.gateway.port));
  const [flash, setFlash] = useState(status.models.flash);
  const [pro, setPro] = useState(status.models.pro);
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const tick = async () => {
      if (paused) return;
      try {
        const { tail } = await getLog(60);
        if (!live) return;
        const el = box.current;
        const stick = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        setLines(paint(tail));
        if (stick && el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [open, paused]);

  useEffect(() => {
    setPort(String(status.gateway.port));
    setFlash(status.models.flash);
    setPro(status.models.pro);
  }, [status.gateway.port, status.models.flash, status.models.pro]);

  const fire = async (name: string, confirm = false) => {
    if (confirm && !armed(name)) return arm(name);
    const r = await runAction(name);
    notify((r.ok ? '✓ ' : '✗ ') + (r.message || name), r.ok ? 'ok' : 'err');
    if (name === 'restart-gateway') setTimeout(onChanged, 2200);
    else onChanged();
  };

  const patchActions = status.actions.filter((a) => a.local && /patch/.test(a.name));

  return (
    <section className="mt-9 border-t border-hair pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex items-center gap-2 rounded-lg text-[12.5px] text-ink-3 transition-colors hover:text-ink-2"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        高级设置
        <span className="text-ink-3/70">端口 · 模型名 · 自启 · 补丁 · 日志</span>
      </button>

      {open && (
        <div className="mt-5 flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-[12.5px] font-semibold text-ink-2">服务</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                { label: '端口', value: port, set: setPort, type: 'number' },
                { label: '普通模型名 → 模型', value: flash, set: setFlash, type: 'text' },
                { label: 'pro / reasoner → 模型', value: pro, set: setPro, type: 'text' },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="mb-1.5 block text-[11.5px] text-ink-3">{f.label}</span>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="focus-ring w-full rounded-xl border border-hair bg-[rgba(0,0,0,.28)] px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-[rgba(138,167,255,.55)]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Button
                onClick={async () => {
                  const r = await saveConfig({ port: Number(port), flashModel: flash.trim(), proModel: pro.trim() });
                  notify((r.ok ? '✓ ' : '✗ ') + (r.message || ''), r.ok ? 'ok' : 'err');
                  onChanged();
                }}
              >
                保存
              </Button>
              <Button armed={armed('restart-gateway')} onClick={() => fire('restart-gateway', true)}>
                {armed('restart-gateway') ? '再点一次确认' : '重启网关'}
              </Button>
              <Button onClick={() => fire('autostart-install')}>注册开机自启</Button>
              <Button armed={armed('autostart-remove')} onClick={() => fire('autostart-remove', true)}>
                {armed('autostart-remove') ? '再点一次确认' : '取消开机自启'}
              </Button>
            </div>
          </div>

          {patchActions.length > 0 && (
            <div>
              <h3 className="mb-3 text-[12.5px] font-semibold text-ink-2">
                客户端补丁 <span className="font-normal text-ink-3">（仅本地，不进仓库）</span>
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {patchActions.map((a) => (
                  <Button
                    key={a.name}
                    armed={armed(a.name)}
                    onClick={() => fire(a.name, a.danger)}
                    variant={a.danger ? 'danger' : 'default'}
                  >
                    {armed(a.name) ? '再点一次确认' : a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-ink-2">请求日志</h3>
              <Button variant="ghost" icon={paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} onClick={() => setPaused((p) => !p)}>
                {paused ? '继续' : '暂停'}
              </Button>
            </div>
            <pre
              ref={box}
              className="h-[210px] overflow-auto rounded-2xl border border-hair bg-[rgba(0,0,0,.34)] p-3.5 font-mono text-[12px] leading-[1.65] whitespace-pre-wrap break-words text-[#b6bccd]"
            >
              {lines.map((l) => (
                <span key={l.key}>
                  <span dangerouslySetInnerHTML={{ __html: l.html }} />
                  {'\n'}
                </span>
              ))}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
