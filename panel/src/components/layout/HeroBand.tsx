import { useConsole } from '../../lib/console';
import { fmtMs, fmtUptime } from '../../lib/format';
import { Dot } from '../ui/primitives';
import { TitleScribble } from '../sketch/icons';

/**
 * 概览页顶部横幅：左侧是网关的一句话状态，右侧是艺术底图的「山脊」切片。
 * 图片从右往左用 mask 化开，和页面背景无缝衔接；图片缺失时只显示渐变与文字。
 */
export function HeroBand() {
  const { status } = useConsole();
  if (!status) return null;

  const healthy = status.upstream.ok && status.key.present;
  const cursorOk = !!status.cursor && status.cursor.baseUrl === status.gateway.baseUrl;

  return (
    <section className="card fade-up relative overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_0.95fr]">
        <div className="relative z-10 px-5 py-5">
          <div className="flex items-center gap-2 text-[11.5px] text-ink-4">
            <Dot tone={healthy ? 'ok' : 'warn'} breathe={healthy} />
            <span className={healthy ? 'text-ok' : 'text-warn'}>{healthy ? '网关运行中' : '需要处理'}</span>
            <span>·</span>
            <span className="font-mono">
              {status.gateway.host}:{status.gateway.port}
            </span>
          </div>

          <h3 className="mt-2 text-[17px] font-semibold tracking-wide text-ink">DeepSeek 网关 · 本机出口</h3>
          <TitleScribble className="mt-1 opacity-70" />
          <p className="mt-2 max-w-[420px] text-[12px] leading-relaxed text-ink-3">
            上游 <span className="font-mono text-ink-2">api.deepseek.com</span> ·{' '}
            {status.upstream.models.length} 个模型可用 · 延迟 {fmtMs(status.upstream.latencyMs)} · 已运行{' '}
            {fmtUptime(status.gateway.uptimeSec)}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-ink-4">
            <span className="inline-flex items-center gap-2">
              <Dot tone={status.upstream.ok ? 'ok' : 'err'} /> {status.upstream.ok ? '上游连通' : '上游不可达'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot tone={status.key.present ? 'ok' : 'err'} /> {status.key.present ? '密钥已配置' : '密钥未配置'}
            </span>
            {status.cursor && (
              <span className="inline-flex items-center gap-2">
                <Dot tone={cursorOk ? 'ok' : 'warn'} /> {cursorOk ? 'Cursor 已接入' : 'Cursor 待接入'}
              </span>
            )}
          </div>
        </div>

        {/* 山脊切片 */}
        <div className="relative hidden min-h-[168px] sm:block">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/art/horizon-band.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: '50% 62%',
              opacity: 0.85,
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 26%, #000 62%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 26%, #000 62%)',
            }}
          />
          {/* 左侧回接卡片底色，避免出现硬边 */}
          <div className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(to_right,var(--c-surface),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(to_top,rgba(14,17,20,.85),transparent)]" />
        </div>
      </div>
    </section>
  );
}
