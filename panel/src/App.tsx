import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import Background from './components/layout/Background';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SketchDefs } from './components/sketch/icons';
import { Loading } from './components/ui/primitives';
import { ConsoleProvider, useConsole } from './lib/console';
import { NAV, type SectionId } from './lib/nav';

/* 按页面懒加载：首屏只加载概览，切换页面时再拉对应分片 */
const Overview = lazy(() => import('./sections/Overview'));
const Routes = lazy(() => import('./sections/Routes'));
const Upstreams = lazy(() => import('./sections/Upstreams'));
const Consumers = lazy(() => import('./sections/Consumers'));
const Plugins = lazy(() => import('./sections/Plugins'));
const Certificates = lazy(() => import('./sections/Certificates'));
const Logs = lazy(() => import('./sections/Logs'));
const Metrics = lazy(() => import('./sections/Metrics'));
const Settings = lazy(() => import('./sections/Settings'));

const isSectionId = (v: string): v is SectionId => NAV.some((n) => n.id === v);

/** hash 路由：#/logs，无需路由库，刷新/分享链接都能回到同一页 */
function useHashSection() {
  const read = () => {
    const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    return isSectionId(raw) ? raw : 'overview';
  };
  const [section, setSection] = useState<SectionId>(read);

  useEffect(() => {
    const onHash = () => setSection(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((id: string) => {
    if (!isSectionId(id)) return;
    window.location.hash = `/${id}`;
    setSection(id);
  }, []);

  return { section, navigate };
}

function Shell() {
  const { section, navigate } = useHashSection();
  const { status } = useConsole();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('console.nav.collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('console.nav.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const health = useMemo(() => {
    if (!status) return { ok: false, label: '正在连接网关…' };
    if (!status.upstream.ok) return { ok: false, label: '上游不可达' };
    if (!status.key.present) return { ok: false, label: '未配置密钥' };
    return { ok: true, label: `运行中 · ${status.gateway.host}:${status.gateway.port}` };
  }, [status]);

  const body = useMemo(() => {
    switch (section) {
      case 'routes':
        return <Routes />;
      case 'upstreams':
        return <Upstreams />;
      case 'consumers':
        return <Consumers />;
      case 'plugins':
        return <Plugins />;
      case 'certificates':
        return <Certificates />;
      case 'logs':
        return <Logs />;
      case 'metrics':
        return <Metrics />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview onNavigate={navigate} />;
    }
  }, [section, navigate]);

  const current = NAV.find((n) => n.id === section) ?? NAV[0];

  return (
    <div className="min-h-screen">
      <Sidebar
        active={section}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={navigate}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
        health={health}
      />

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? 'pl-nav-rail' : 'pl-nav'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <Topbar section={section} status={status} onNavigate={navigate} onOpenMobile={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-4">
          <div className="mb-3.5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold tracking-wide text-ink">{current.label}</h2>
              <p className="mt-0.5 text-[12px] text-ink-4">{current.desc}</p>
            </div>
            <span className="hidden font-mono text-[11px] text-ink-4 sm:block">
              {status ? `${status.gateway.host}:${status.gateway.port} · v1` : ''}
            </span>
          </div>

          <div key={section} className="fade-up">
            <Suspense fallback={<Loading label="加载页面…" />}>{body}</Suspense>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3 text-[11px] text-ink-4">
            <span>网关控制台 · 仅监听回环地址，无远程登录</span>
            <span className="font-mono">{status ? `PID ${status.gateway.pid} · ${status.runtime.node}` : '—'}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ConsoleProvider>
      <SketchDefs />
      <Background />
      <Shell />
    </ConsoleProvider>
  );
}
