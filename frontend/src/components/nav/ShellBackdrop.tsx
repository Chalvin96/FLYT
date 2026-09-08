import { useId } from 'react';

/**
 * Decorative abstract shape painted behind the app shell's page content.
 *
 * It fills blank space when a page's content is short. Purely ornamental:
 * `aria-hidden`, `pointer-events-none`, and pinned to the bottom half of the
 * shell at z-0 so it sits behind `main` (z-10) and the navbars (z-20). The
 * visual language mirrors BaseHeroCard decorations — overlapping organic
 * circles, very low opacity, theme-token fill — scaled to cover both narrow
 * (mobile ~320px) and wide (desktop) viewports.
 */
export function ShellBackdrop() {
  // SVG ids are document-global; suffix with useId so multiple mounts
  // (e.g. several shell trees in one JSDOM test document) never collide.
  const uid = useId();
  const fadeId = `shell-backdrop-fade-${uid}`;
  const maskId = `shell-backdrop-mask-${uid}`;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/2 overflow-hidden"
    >
      <svg
        className="fill-foreground h-full w-full opacity-[0.05]"
        preserveAspectRatio="xMidYMax slice"
        viewBox="0 0 1200 480"
      >
        <defs>
          <linearGradient id={fadeId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="60%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id={maskId}>
            <rect fill={`url(#${fadeId})`} height="480" width="1200" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <circle cx="160" cy="440" r="250" />
          <circle cx="420" cy="500" r="190" />
          <circle cx="680" cy="430" r="290" />
          <circle cx="1000" cy="460" r="230" />
          <circle cx="1150" cy="510" r="160" />
        </g>
      </svg>
    </div>
  );
}
