import type { SVGProps } from 'react';

/**
 * 工程手绘风图标集。
 *
 * 全部是原创矢量：单色、细线（stroke 1.3）、圆角、线条带轻微抖动 —— 通过全局
 * 注入的 feTurbulence + feDisplacementMap 滤镜（id="sk-rough"）实现「白板草图」质感，
 * 但位移量很小，属于克制的工程草图，不是卡通涂鸦。
 *
 * 只在图标 / 空状态 / 插画 / 分割线处使用手绘元素，界面骨架保持工整。
 */

export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <filter id="sk-rough" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.15" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="sk-rough-soft" x="-14%" y="-14%" width="128%" height="128%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <linearGradient id="sk-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--c-accent)" />
          <stop offset="1" stopColor="var(--c-accent-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Shell({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <g filter="url(#sk-rough)">{children}</g>
    </svg>
  );
}

/* --------------------------------------------------------------- 导航图标 --- */
export const IconOverview = (p: IconProps) => (
  <Shell {...p}>
    <path d="M4.6 14.2a7.6 7.6 0 0 1 14.8-.4" />
    <path d="M12 14.6l4-4.4" />
    <circle cx="12" cy="15" r="1.3" />
    <path d="M4.2 18.4h15.5" />
  </Shell>
);

export const IconRoutes = (p: IconProps) => (
  <Shell {...p}>
    <path d="M12.3 3.8v16.4" />
    <path d="M12.4 6.4h6.1l-2 2.4 2 2.4h-6.1" />
    <path d="M11.9 13.4H6.3l1.9 2.3-1.9 2.3h5.6" />
  </Shell>
);

export const IconUpstream = (p: IconProps) => (
  <Shell {...p}>
    <rect x="4" y="13.4" width="16" height="6.2" rx="1.6" />
    <rect x="6.2" y="4.4" width="11.6" height="6" rx="1.6" />
    <path d="M12 10.6v2.6" />
    <path d="M9.6 11.9l2.4 2.2 2.4-2.2" />
    <path d="M7.4 16.5h1.4M7.4 18.1h1.4" />
  </Shell>
);

export const IconConsumers = (p: IconProps) => (
  <Shell {...p}>
    <circle cx="9.2" cy="9" r="2.8" />
    <path d="M4.2 19.4c.5-3 2.7-4.8 5-4.8s4.5 1.8 5 4.8" />
    <circle cx="17.4" cy="10.6" r="2.1" />
    <path d="M15.2 19.4c.3-2.2 1.4-3.6 2.9-3.6 1.3 0 2.4 1.1 2.8 3" />
  </Shell>
);

export const IconPlugins = (p: IconProps) => (
  <Shell {...p}>
    <path d="M9.4 4.6h3.1a1.4 1.4 0 0 1 1.4 1.4v1.6h1.7a1.4 1.4 0 0 1 1.4 1.4v3.1h1.5a1.4 1.4 0 0 1 1.4 1.4v2.4a1.4 1.4 0 0 1-1.4 1.4h-1.5v1.7a1.4 1.4 0 0 1-1.4 1.4H11a1.4 1.4 0 0 1-1.4-1.4v-1.6H7.8a1.4 1.4 0 0 1-1.4-1.4v-3h-1A1.4 1.4 0 0 1 4 12.6V9.6a1.4 1.4 0 0 1 1.4-1.4h1v-2.2a1.4 1.4 0 0 1 1.4-1.4Z" />
    <path d="M12.6 10.4h1.8v1.8h-1.8z" />
  </Shell>
);

export const IconCert = (p: IconProps) => (
  <Shell {...p}>
    <path d="M12 3.6l6.2 2.2v5.2c0 4-2.6 7.4-6.2 9.4-3.6-2-6.2-5.4-6.2-9.4V5.8L12 3.6Z" />
    <path d="M9.4 11.6l1.8 1.9 3.4-3.8" />
    <path d="M10.4 19.2l-.6 2.1 2.2-1.1 2.2 1.1-.6-2.1" />
  </Shell>
);

export const IconLogs = (p: IconProps) => (
  <Shell {...p}>
    <path d="M6 3.9h8.1l3.9 3.8v12a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4V5.3A1.4 1.4 0 0 1 6 3.9Z" />
    <path d="M14 4.1v3.7h3.8" />
    <path d="M7.8 12.4h7.6M7.8 15.2h7.6M7.8 17.9h4.4" />
  </Shell>
);

export const IconMetrics = (p: IconProps) => (
  <Shell {...p}>
    <path d="M4.6 19.4h15" />
    <path d="M7.6 19.2v-4.6M11.4 19.2V8.6M15.2 19.2v-7M19 19.2v-10" />
    <path d="M5.2 6.8l3.4-1.6 3 2.1 3.6-2.6 3.2 1.9" />
  </Shell>
);

export const IconSettings = (p: IconProps) => (
  <Shell {...p}>
    <path d="M4.8 7.6h6.1M14.4 7.6h4.8" />
    <circle cx="12.6" cy="7.6" r="1.9" />
    <path d="M4.8 16.4h4.4M13 16.4h6.2" />
    <circle cx="11.1" cy="16.4" r="1.9" />
  </Shell>
);

/* -------------------------------------------------------------- 通用图标 --- */
export const IconSearch = (p: IconProps) => (
  <Shell {...p}>
    <circle cx="11" cy="11" r="5.4" />
    <path d="M15.2 15.1l4 4" />
  </Shell>
);

export const IconBell = (p: IconProps) => (
  <Shell {...p}>
    <path d="M8 10.4a4 4 0 0 1 8 0v3.4l1.3 2.2H6.7L8 13.8Z" />
    <path d="M10.4 18.2a1.7 1.7 0 0 0 3.2 0" />
  </Shell>
);

export const IconChevron = ({ size = 14, dir = 'down' }: { size?: number; dir?: 'down' | 'up' | 'left' | 'right' }) => {
  const rot = { down: 0, left: 90, up: 180, right: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M7.5 10l4.5 4 4.5-4" />
    </svg>
  );
};

export const IconCopy = (p: IconProps) => (
  <Shell {...p}>
    <rect x="9" y="9" width="10.4" height="10.6" rx="1.6" />
    <path d="M6.4 15.2H5.4A1.4 1.4 0 0 1 4 13.8V5.4A1.4 1.4 0 0 1 5.4 4h8.4a1.4 1.4 0 0 1 1.4 1.4v1" />
  </Shell>
);

export const IconRefresh = (p: IconProps) => (
  <Shell {...p}>
    <path d="M19 11.2a7 7 0 0 0-12.1-4.3L4.6 9.2" />
    <path d="M4.8 5.4v3.9h3.9" />
    <path d="M5 12.8a7 7 0 0 0 12.1 4.3l2.3-2.3" />
    <path d="M19.2 18.6v-3.9h-3.9" />
  </Shell>
);

export const IconDownload = (p: IconProps) => (
  <Shell {...p}>
    <path d="M12 4.6v9.2" />
    <path d="M8.6 10.6L12 14l3.4-3.4" />
    <path d="M5 17.4v1.2A1.4 1.4 0 0 0 6.4 20h11.2a1.4 1.4 0 0 0 1.4-1.4v-1.2" />
  </Shell>
);

export const IconPlay = (p: IconProps) => (
  <Shell {...p}>
    <path d="M8.6 5.8l9 6.2-9 6.2V5.8Z" />
  </Shell>
);

export const IconPause = (p: IconProps) => (
  <Shell {...p}>
    <path d="M9.4 5.6v12.8M14.6 5.6v12.8" />
  </Shell>
);

export const IconCheck = (p: IconProps) => (
  <Shell {...p}>
    <path d="M5.2 12.6l4.4 4.2 9.2-9.6" />
  </Shell>
);

export const IconX = (p: IconProps) => (
  <Shell {...p}>
    <path d="M6.4 6.6l11 11M17.4 6.6l-11 11" />
  </Shell>
);

export const IconMenu = (p: IconProps) => (
  <Shell {...p}>
    <path d="M4.6 7.2h14.8M4.6 12h14.8M4.6 16.8h9.6" />
  </Shell>
);

export const IconSidebar = (p: IconProps) => (
  <Shell {...p}>
    <rect x="3.8" y="4.6" width="16.4" height="14.8" rx="2" />
    <path d="M9.6 4.8v14.4" />
    <path d="M6.2 8.2h1.4M6.2 11h1.4" />
  </Shell>
);

/* ----------------------------------------------------- 空状态 / 插画 / 分割 --- */

/** 空状态插画：一块「尚未接通」的节点草图 */
export function EmptyNodes({ size = 132 }: { size?: number }) {
  return (
    <svg viewBox="0 0 180 120" width={size} height={(size * 120) / 180} fill="none" stroke="var(--c-ink-4)" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <g filter="url(#sk-rough-soft)">
        <rect x="14" y="46" width="34" height="26" rx="5" />
        <path d="M20 72l-2 6h24l-2-6" />
        <rect x="122" y="16" width="40" height="24" rx="5" strokeDasharray="4 3" />
        <path d="M50 58h30" strokeDasharray="3 4" />
        <circle cx="88" cy="58" r="8" />
        <path d="M88 50V34" strokeDasharray="3 4" />
        <path d="M122 30h-14" strokeDasharray="3 4" />
        <circle cx="88" cy="58" r="2.4" fill="var(--c-ink-4)" stroke="none" />
        <path d="M104 74c6-2 12-2 18 1M104 82c7-1 13 0 18 3" opacity="0.7" />
        <path d="M22 96c14-3 28-4 42-3M78 99c10-2 20-2 30 0" opacity="0.5" />
      </g>
    </svg>
  );
}

/** 手绘分割线（仅用于标题与区块之间） */
export function SketchRule({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 6" height="6" width="100%" preserveAspectRatio="none" aria-hidden>
      <path
        d="M2 3.4c40-1.6 80-2.2 120-1.8 44 .4 88 1.4 132 2.4"
        fill="none"
        stroke="var(--c-hair-3)"
        strokeWidth="1"
        strokeLinecap="round"
        filter="url(#sk-rough-soft)"
      />
    </svg>
  );
}

/** 标题旁的手写体点缀下划线 */
export function TitleScribble({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 8" height="8" width="120" aria-hidden>
      <path
        d="M3 5.4c18-2.4 36-3.2 54-2.6 22 .8 42 2.4 60 4.6"
        fill="none"
        stroke="url(#sk-accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#sk-rough-soft)"
      />
    </svg>
  );
}

/** 品牌标记：手绘网关/节点图标（同时用于 favicon 预览） */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <g filter="url(#sk-rough)">
        <path d="M12 18.4l12-6.6 12 6.6v11.4L24 36.4l-12-6.6Z" />
        <path d="M24 11.8v6.6M24 29.8v6.6M12 18.4l7.4 3.9M28.6 25.7L36 29.8" strokeWidth="1.4" />
        <circle cx="24" cy="24" r="2.6" />
        <path d="M24 24l5-5" strokeWidth="1.3" />
        <circle cx="24" cy="11.6" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="36.2" cy="30" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="11.8" cy="18.4" r="1.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
