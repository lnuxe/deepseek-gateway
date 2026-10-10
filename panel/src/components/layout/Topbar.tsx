import { useEffect, useMemo, useRef, useState } from 'react';
import type { Status } from '../../lib/api';
import { NAV, type SectionId } from '../../lib/nav';
import { IconBell, IconChevron, IconMenu, IconSearch } from '../sketch/icons';
import { Badge, Dot } from '../ui/primitives';

type Alert = { id: string; tone: 'ok' | 'warn' | 'err' | 'info'; title: string; detail: string };

export function Topbar({
  section,
  status,
  onNavigate,
  onOpenMobile,
}: {
  section: SectionId;
  status: Status | null;
  onNavigate: (id: SectionId) => void;
  onOpenMobile: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openPanel, setOpenPanel] = useState<'none' | 'search' | 'bell' | 'env' | 'user'>('none');
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenPanel('none');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPanel('none');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenPanel((p) => (p === 'search' ? 'none' : 'search'));
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const nav = NAV.find((n) => n.id === section) ?? NAV[0];

  const alerts = useMemo<Alert[]>(() => {
    if (!status) return [];
    const out: Alert[] = [];
    if (!status.key.present) out.push({ id: 'key', tone: 'err', title: '未配置上游密钥', detail: '在「系统设置」中填入 DeepSeek API Key' });
    if (!status.upstream.ok) out.push({ id: 'up', tone: 'err', title: '上游不可达', detail: status.upstream.error ?? '无法连接上游服务' });
    else out.push({ id: 'up-ok', tone: 'ok', title: '上游连通', detail: `${status.upstream.models.length} 个模型可用 · ${status.upstream.latencyMs ?? '—'}ms` });
    if (status.cursor && status.cursor.baseUrl !== status.gateway.baseUrl) {
      out.push({ id: 'cursor', tone: 'warn', title: 'Cursor 尚未接入', detail: '把网关地址写入 Cursor 的模型设置' });
    }
    if (status.cursor?.patched === false) out.push({ id: 'patch', tone: 'warn', title: '客户端补丁未应用', detail: '在「系统设置 → 客户端补丁」中处理' });
    return out;
  }, [status]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter((n) => `${n.label}${n.en}${n.desc}`.toLowerCase().includes(q));
  }, [query]);

  const go = (id: SectionId) => {
    onNavigate(id);
    setOpenPanel('none');
    setQuery('');
  };

  return (
    <header
      ref={barRef}
      className="sticky top-0 z-20 flex h-[var(--top-h)] items-center gap-3 border-b border-hair bg-bg/85 px-4 backdrop-blur-[6px]"
    >
      <button type="button" onClick={onOpenMobile} className="focus-ring rounded-[8px] p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink lg:hidden" aria-label="打开导航">
        <IconMenu size={18} />
      </button>

      {/* 面包屑 */}
      <nav className="flex min-w-0 items-center gap-1.5 text-[12.5px]" aria-label="面包屑">
        <span className="hidden text-ink-4 sm:inline">控制台</span>
        <IconChevron size={13} dir="right" />
        <span className="truncate font-medium text-ink">{nav.label}</span>
        <span className="hidden truncate text-ink-4 md:inline">· {nav.desc}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {/* 环境切换 */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'env' ? 'none' : 'env'))}
            className="focus-ring flex items-center gap-2 rounded-[8px] border border-hair bg-surface-2 px-2.5 py-1.5 text-[11.5px] text-ink-2 transition-colors hover:border-hair-2 hover:text-ink"
          >
            <Dot tone={status?.upstream.ok ? 'ok' : 'warn'} breathe={!!status?.upstream.ok} />
            本机
            <span className="hidden font-mono text-[11px] text-ink-4 md:inline">:{status?.gateway.port ?? '—'}</span>
            <IconChevron size={12} />
          </button>
          {openPanel === 'env' && (
            <div className="card fade-up absolute right-0 mt-2 w-64 p-2 shadow-lg">
              <div className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-ink-4">运行环境</div>
              <button type="button" className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left text-[12px] hover:bg-surface-2">
                <Dot tone="ok" breathe />
                <span className="flex-1">本机单机</span>
                <span className="font-mono text-[11px] text-ink-4">{status?.gateway.baseUrl.replace('/v1', '') ?? ''}</span>
              </button>
              {['预发', '生产'].map((env) => (
                <div key={env} className="flex w-full cursor-not-allowed items-center gap-2 rounded-[6px] px-2 py-2 text-left text-[12px] text-ink-4" title="单机模式未接入控制平面">
                  {env}
                  <Badge tone="muted">未接入</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 搜索 */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'search' ? 'none' : 'search'))}
            className="focus-ring flex items-center gap-2 rounded-[8px] border border-hair bg-surface-2 px-2.5 py-1.5 text-[11.5px] text-ink-3 transition-colors hover:border-hair-2 hover:text-ink-2"
          >
            <IconSearch size={14} />
            搜索
            <kbd className="rounded border border-hair px-1 font-mono text-[10px] text-ink-4">⌘K</kbd>
          </button>
          {openPanel === 'search' && (
            <div className="card fade-up absolute right-0 mt-2 w-80 p-2 shadow-lg">
              <div className="flex items-center gap-2 border-b border-hair px-2 pb-2">
                <IconSearch size={14} className="text-ink-3" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0].id)}
                  placeholder="跳转到页面…"
                  className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-4"
                />
              </div>
              <div className="max-h-72 overflow-y-auto pt-1">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => go(r.id)}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <r.icon size={15} className="text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink">{r.label}</span>
                      <span className="block truncate text-[10.5px] text-ink-4">{r.desc}</span>
                    </span>
                  </button>
                ))}
                {results.length === 0 && <div className="px-2 py-3 text-[12px] text-ink-4">没有匹配的页面</div>}
              </div>
            </div>
          )}
        </div>

        {/* 通知 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'bell' ? 'none' : 'bell'))}
            className="focus-ring relative rounded-[8px] p-1.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="通知"
          >
            <IconBell size={17} />
            {alerts.some((a) => a.tone === 'err' || a.tone === 'warn') && (
              <span className="absolute right-1 top-1 h-[6px] w-[6px] rounded-full bg-warn" />
            )}
          </button>
          {openPanel === 'bell' && (
            <div className="card fade-up absolute right-0 mt-2 w-80 shadow-lg">
              <div className="border-b border-hair px-3 py-2 text-[11.5px] text-ink-3">状态通知</div>
              <div className="divide-y divide-[var(--c-hair)]">
                {alerts.map((a) => (
                  <div key={a.id} className="flex gap-2.5 px-3 py-2.5">
                    <Dot tone={a.tone === 'info' ? 'muted' : a.tone} breathe={a.tone === 'ok'} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-ink">{a.title}</div>
                      <div className="text-[11.5px] text-ink-4">{a.detail}</div>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && <div className="px-3 py-3 text-[12px] text-ink-4">暂无通知</div>}
              </div>
            </div>
          )}
        </div>

        {/* 用户 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'user' ? 'none' : 'user'))}
            className="focus-ring flex items-center gap-2 rounded-[8px] border border-hair bg-surface-2 py-1 pl-1 pr-2 transition-colors hover:border-hair-2"
          >
            <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-surface-3 text-[11px] font-medium text-ink-2">
              {(status?.runtime.user ?? 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[110px] truncate text-[11.5px] text-ink-2 sm:inline">{status?.runtime.user ?? '本机用户'}</span>
            <IconChevron size={12} />
          </button>
          {openPanel === 'user' && (
            <div className="card fade-up absolute right-0 mt-2 w-64 p-2 shadow-lg">
              <div className="px-2 py-1.5">
                <div className="text-[12.5px] text-ink">{status?.runtime.user ?? '本机用户'}</div>
                <div className="text-[11px] text-ink-4">
                  {status ? `${status.runtime.platform} · ${status.runtime.arch} · Node ${status.runtime.node}` : '—'}
                </div>
              </div>
              <div className="mt-1 border-t border-hair pt-1 text-[11.5px] text-ink-3">
                <div className="px-2 py-1.5">本控制台仅监听回环地址，无远程登录</div>
                <div className="truncate px-2 py-1.5 font-mono text-[10.5px] text-ink-4" title={status?.runtime.configPath}>
                  配置：{status?.runtime.configPath ?? '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
