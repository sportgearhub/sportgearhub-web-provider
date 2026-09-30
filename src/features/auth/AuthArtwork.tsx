/**
 * The picture beside the sign-in form on wide screens. It is drawn rather than photographed so the
 * auth screens stay a single small bundle with nothing to load — swap it for a photograph by
 * replacing this component's contents with an <img>, the layout does not care which it gets.
 */
export function AuthArtwork({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 1200"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="auth-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#141033" />
          <stop offset="38%" stopColor="#3d2260" />
          <stop offset="70%" stopColor="#9c3f6d" />
          <stop offset="100%" stopColor="#ef8163" />
        </linearGradient>
        <radialGradient id="auth-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffd9a8" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ff9e6d" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff9e6d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="auth-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9694f" />
          <stop offset="22%" stopColor="#7e3557" />
          <stop offset="65%" stopColor="#2e1a44" />
          <stop offset="100%" stopColor="#150f2c" />
        </linearGradient>
        <linearGradient id="auth-ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a2c63" />
          <stop offset="100%" stopColor="#35204b" />
        </linearGradient>
        <linearGradient id="auth-ridge-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e1b45" />
          <stop offset="100%" stopColor="#221534" />
        </linearGradient>
      </defs>

      {/* sky and the low sun behind the ridges */}
      <rect width="800" height="700" fill="url(#auth-sky)" />
      <circle cx="545" cy="628" r="250" fill="url(#auth-sun)" />
      <circle cx="545" cy="640" r="46" fill="#ffe0b8" opacity="0.9" />

      {/* three ridges, palest at the back */}
      <path d="M0 700V486l118-92 96 74 104-120 112 128 92-64 130 116 148-92v264Z" fill="url(#auth-ridge-far)" opacity="0.82" />
      <path d="M0 700V556l150-118 128 106 118-72 136 128 122-74 146 96v78Z" fill="url(#auth-ridge-mid)" />
      <path d="M0 700V622l176-96 142 110 136-66 158 112 188-88v106Z" fill="#191030" />

      {/* the lake, with the sun's column broken into streaks */}
      <rect y="700" width="800" height="500" fill="url(#auth-water)" />
      <g fill="#ffcba0">
        <rect x="470" y="716" width="150" height="7" rx="3.5" opacity="0.5" />
        <rect x="436" y="742" width="220" height="6" rx="3" opacity="0.34" />
        <rect x="404" y="774" width="286" height="6" rx="3" opacity="0.24" />
        <rect x="366" y="814" width="352" height="5" rx="2.5" opacity="0.17" />
        <rect x="330" y="862" width="410" height="5" rx="2.5" opacity="0.12" />
        <rect x="292" y="918" width="466" height="4" rx="2" opacity="0.08" />
      </g>
      <g fill="#ffffff" opacity="0.07">
        <rect x="60" y="760" width="190" height="4" rx="2" />
        <rect x="24" y="838" width="150" height="4" rx="2" />
        <rect x="120" y="962" width="230" height="4" rx="2" />
      </g>

      {/* two figures on the ice, for scale */}
      <g fill="#120c24" opacity="0.85">
        <ellipse cx="243" cy="744" rx="12" ry="2.5" />
        <path d="M239 726c0-2 1.6-3.6 3.6-3.6s3.6 1.6 3.6 3.6v12c0 2-1.6 3.6-3.6 3.6s-3.6-1.6-3.6-3.6Z" />
        <circle cx="242.6" cy="719" r="3.2" />
        <ellipse cx="268" cy="748" rx="11" ry="2.4" />
        <path d="M264.6 731c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4v11.4c0 1.9-1.5 3.4-3.4 3.4s-3.4-1.5-3.4-3.4Z" />
        <circle cx="268" cy="724.4" r="3" />
      </g>
    </svg>
  );
}
