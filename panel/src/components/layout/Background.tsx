/**
 * 背景层：极细网格 + 纸张噪点 + 低透明度拓扑节点呼吸。
 *
 * 性能取舍：全部是静态 DOM + 纯 CSS（仅 opacity/transform 动画，走合成层），
 * 不使用 canvas、粒子、视频或连线动效；节点数量克制（7 个，其中 4 个呼吸）。
 */
export default function Background() {
  return (
    <>
      <div className="bg-grid" />
      <div className="bg-noise" />
      <svg className="bg-topology" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke="var(--c-hair-2)" strokeWidth="0.7" opacity="0.5">
          <path d="M188 214 L512 176 L742 322 L1044 262 L1284 358" />
          <path d="M188 214 L352 486 L742 322" />
          <path d="M352 486 L604 682 L942 596 L1044 262" />
          <path d="M742 322 L1002 512 L1284 358" />
          <path d="M604 682 L902 764 L1178 664" />
        </g>
        <g fill="var(--c-accent-2)">
          <circle cx="742" cy="322" r="3.4" className="node-breathe" opacity="0.5" />
          <circle cx="1044" cy="262" r="2.6" className="node-breathe" opacity="0.42" style={{ animationDelay: '1.1s' }} />
          <circle cx="604" cy="682" r="2.8" className="node-breathe" opacity="0.4" style={{ animationDelay: '2.2s' }} />
          <circle cx="1284" cy="358" r="2.4" className="node-breathe" opacity="0.36" style={{ animationDelay: '3.1s' }} />
        </g>
        <g fill="var(--c-ink-4)" opacity="0.5">
          <circle cx="188" cy="214" r="2.2" />
          <circle cx="512" cy="176" r="2" />
          <circle cx="352" cy="486" r="2.2" />
          <circle cx="942" cy="596" r="2" />
          <circle cx="1002" cy="512" r="2.2" />
          <circle cx="902" cy="764" r="2" />
          <circle cx="1178" cy="664" r="2.2" />
        </g>
      </svg>
    </>
  );
}
