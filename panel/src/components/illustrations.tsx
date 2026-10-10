import type { SVGProps } from 'react';

/**
 * Hand-drawn spot illustrations, authored as inline SVG.
 *
 * Everything here is original vector work: wobbly single-weight strokes, round
 * caps and a turbulence/displacement filter ("rough") so lines look pen-drawn
 * instead of machine-perfect. No third-party artwork is bundled, so the repo
 * stays clean to publish.
 */

const ink = '#dfe6ff';

function Rough({ id, scale = 2.2 }: { id: string; scale?: number }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

const base: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: ink,
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** A pen-drawn key — step 1. */
export function SketchKey({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <Rough id="rough-key" />
        <pattern id="hatch-key" width="5" height="5" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="5" stroke={ink} strokeWidth="0.7" opacity="0.35" />
        </pattern>
      </defs>
      <g filter="url(#rough-key)" {...base}>
        <path d="M9.5 27.6c-1.9-4.6 1-9.7 5.9-10.6 4.3-.8 8.4 2 9.1 6.3.9 5.1-3.6 9.4-8.5 8.6-2.6-.4-4.6-1.9-5.7-4.1Z" fill="url(#hatch-key)" />
        <path d="M22.7 28.9c6.9 4.6 15.5 12.6 22.2 20.4" />
        <path d="M35.4 40.1l-3.6 4.2M40.9 46.3l-3.4 4.1" />
        <path d="M47.1 50.4c3.4 1.1 6.9 2.5 9.3 4.9" />
        <path d="M12.9 22.2c2.4-1.4 5.2-1.1 7.2.8" strokeWidth="1.1" opacity="0.7" />
      </g>
    </svg>
  );
}

/** A pen-drawn plug with a squiggly cord — step 2. */
export function SketchPlug({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <Rough id="rough-plug" />
        <pattern id="hatch-plug" width="5" height="5" patternTransform="rotate(-32)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="5" stroke={ink} strokeWidth="0.7" opacity="0.3" />
        </pattern>
      </defs>
      <g filter="url(#rough-plug)" {...base}>
        <path d="M22.4 33.1c-2.6-2.5-2.7-6.6-.2-9.2 2.5-2.6 6.6-2.7 9.2-.3 2.7 2.6 2.8 6.7.3 9.3-2.6 2.6-6.8 2.6-9.3.2Z" fill="url(#hatch-plug)" />
        <path d="M25.6 21.9c-.5-2.6-1.4-5-2.4-6.6M31.4 22.1c.7-2.5 1.9-4.7 3.1-6.2" />
        <path d="M31.5 33.6c5.4 3.4 8.1 8.8 7.6 14.4-.4 4.6-3.4 8.3-7.6 10.3" />
        <path d="M45.9 21.2c2 3.2 1.6 7.2-.9 9.9M52.6 18.3c3.3 4.9 2.7 11.6-1.5 15.9" strokeWidth="1.2" opacity="0.75" />
        <circle cx="48.4" cy="43.6" r="1.5" />
        <circle cx="53.9" cy="38.1" r="1.1" opacity="0.8" />
      </g>
    </svg>
  );
}

/** A pen-drawn shield with a check — step 3. */
export function SketchShield({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <Rough id="rough-shield" />
        <pattern id="hatch-shield" width="6" height="6" patternTransform="rotate(24)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke={ink} strokeWidth="0.7" opacity="0.28" />
        </pattern>
      </defs>
      <g filter="url(#rough-shield)" {...base}>
        <path d="M31.9 9.2c5.6 3.2 11.2 4.9 17.1 5.2-.2 11.9-1.6 22.5-8.1 30.4-3.7 4.5-8.3 7.6-9 8-1.1-.6-5.6-3.4-9.3-7.8-6.6-7.7-8.2-18.4-8.5-30.6 6.2-.3 12-2 17.8-5.2Z" fill="url(#hatch-shield)" />
        <path d="M23.4 32.4c2.6 2.2 4.7 4.7 6.3 7.5 3.6-6.3 7.9-11.6 12.9-15.9" strokeWidth="2.1" />
        <path d="M55.6 20.1c1.4.4 2.6 1.2 3.4 2.4M56.9 29.6c1.1-.2 2.2 0 3.2.6" strokeWidth="1.1" opacity="0.7" />
      </g>
    </svg>
  );
}

/** Loose sketchbook doodles used as a very faint layer over the background. */
export function Doodles({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <Rough id="rough-doodle" scale={3} />
      </defs>
      <g filter="url(#rough-doodle)" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
        <path d="M96 156c30-26 62-38 96-36 28 2 44 18 40 38-4 19-28 27-52 22" strokeWidth="1.4" />
        <path d="M1046 214c24-18 50-24 74-14 21 9 26 32 10 47-14 13-38 12-56 1" strokeWidth="1.2" />
        <circle cx="352" cy="742" r="46" strokeWidth="1.2" />
        <circle cx="352" cy="742" r="62" strokeWidth="0.9" opacity="0.7" />
        <path d="M862 660c18 20 40 30 66 30 22 0 36-12 34-28" strokeWidth="1.3" />
        <path d="M182 470c10-16 26-26 44-30M1240 560c-16-14-34-22-54-24" strokeWidth="1" />
        <path d="M640 96v26M627 109h26M1128 470v22M1117 481h22M420 214v20M410 224h20" strokeWidth="1.4" />
        <path d="M212 640l14 18-14 18M1000 330l-14 18 14 18" strokeWidth="1.1" />
        <path d="M560 800c60-16 120-24 180-22 42 2 84 8 126 18" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}

/** Hand-drawn wavy underline for headings. */
export function SketchUnderline({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 10" aria-hidden>
      <defs>
        <Rough id="rough-under" scale={1.6} />
      </defs>
      <path
        d="M3 6.5c26-4.2 52-5.6 79-4.4 24 1 47 3.6 70 7.1"
        filter="url(#rough-under)"
        fill="none"
        stroke="url(#under-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="under-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8aa7ff" />
          <stop offset="1" stopColor="#b79cff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
