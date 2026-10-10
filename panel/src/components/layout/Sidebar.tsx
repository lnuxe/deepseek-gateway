import { NAV, type SectionId } from '../../lib/nav';
import { BrandMark, TitleScribble } from '../sketch/icons';
import { Dot } from '../ui/primitives';

export function Sidebar({
  active,
  collapsed,
  mobileOpen,
  onNavigate,
  onToggleCollapse,
  onCloseMobile,
  health,
}: {
  active: SectionId;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (id: SectionId) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  health: { ok: boolean; label: string };
}) {
  return (
    <>
      {/* 移动端遮罩 */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-hair bg-bg-2 transition-[width,transform] duration-200 lg:translate-x-0 ${
          collapsed ? 'w-[var(--nav-w-collapsed)]' : 'w-[var(--nav-w)]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-label="主导航"
      >
        {/* 品牌 */}
        <div className={`flex h-[var(--top-h)] items-center gap-2.5 border-b border-hair px-3 ${collapsed ? 'justify-center' : ''}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-hair-2 bg-surface-2 text-accent">
            <BrandMark size={18} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-[12.5px] font-semibold tracking-wide">网关控制台</span>
              </div>
              <div className="truncate text-[10.5px] text-ink-4">Gateway Console · 单机</div>
            </div>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                title={collapsed ? `${item.label} · ${item.en}` : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`focus-ring group relative mb-0.5 flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left transition-colors duration-150 ${
                  isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'
                } ${collapsed ? 'justify-center' : ''}`}
                style={{ transitionTimingFunction: 'var(--ease-out)' }}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" aria-hidden />
                )}
                <Icon size={17} className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] leading-[1.35]">{item.label}</span>
                    <span className="block truncate text-[10px] leading-[1.35] text-ink-4">{item.en}</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 底部状态 */}
        <div className={`border-t border-hair px-3 py-3 ${collapsed ? 'px-2' : ''}`}>
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <Dot tone={health.ok ? 'ok' : 'err'} breathe={health.ok} />
            {!collapsed && <span className="truncate text-[11.5px] text-ink-3">{health.label}</span>}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`focus-ring mt-2.5 hidden w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11.5px] text-ink-3 transition-colors hover:bg-surface hover:text-ink lg:flex ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
              <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2" />
              <path d="M9.4 4.8v14.4" />
            </svg>
            {!collapsed && <span>折叠导航</span>}
          </button>
          {!collapsed && <TitleScribble className="mt-2 opacity-40" />}
        </div>
      </aside>
    </>
  );
}
