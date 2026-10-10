import { useState } from 'react';
import { Doodles } from './illustrations';

/**
 * Ambient backdrop: a self-rendered seamless loop (see tools/render-bg) played
 * behind a soft vignette. If the video is missing or the browser cannot decode
 * it, the layer stays transparent and the CSS gradient below shows through, so
 * the panel never depends on the asset being present.
 */
export default function Backdrop() {
  const [videoOk, setVideoOk] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* static fallback: keeps the page alive before/without the video */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 22% 12%, rgba(126,154,255,.20), transparent 60%),' +
            'radial-gradient(100% 80% at 82% 30%, rgba(168,130,255,.16), transparent 62%),' +
            'radial-gradient(120% 90% at 50% 100%, rgba(64,198,190,.14), transparent 60%),' +
            '#05060a',
        }}
      />
      <video
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]"
        style={{ opacity: videoOk ? 1 : 0 }}
        src="./bg/aurora.mp4"
        poster="./bg/poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        onCanPlay={() => setVideoOk(true)}
      />
      {/* vignette + film grain so text stays readable over the loop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 85% at 50% -5%, transparent 38%, rgba(3,4,8,.72) 100%)',
          mixBlendMode: 'multiply',
        }}
      />
      {/* hand-drawn sketchbook layer, drifting almost imperceptibly */}
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-screen"
        style={{ animation: 'doodle-drift 80s ease-in-out infinite alternate' }}
      >
        <Doodles className="h-full w-full" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
