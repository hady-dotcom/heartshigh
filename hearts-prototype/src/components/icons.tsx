type P = { size?: number }

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true })

export const ShareIcon = ({ size = 22 }: P) => (<svg {...base(size)}><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>)
export const HeartIcon = ({ size = 22, filled = true }: P & { filled?: boolean }) => (<svg {...base(size)} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>)
export const SaveIcon = ({ size = 22 }: P) => (<svg {...base(size)}><path d="M6 3h12v18l-6-4-6 4z" /></svg>)
export const PlayIcon = ({ size = 22 }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>)
export const PauseIcon = ({ size = 22 }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>)
export const MicIcon = ({ size = 20 }: P) => (<svg {...base(size)}><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>)
export const ImageIcon = ({ size = 20 }: P) => (<svg {...base(size)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>)
export const LockIcon = ({ size = 20 }: P) => (<svg {...base(size)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>)
export const BellIcon = ({ size = 20 }: P) => (<svg {...base(size)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>)
export const ArrowIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>)
export const ChevronLeft = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>)
export const HomeIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>)
export const BookIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></svg>)
export const LibraryIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="M16 5l4 1-3 14-4-1z" /></svg>)
export const KeyIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></svg>)
export const PeopleIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>)
export const CalendarIcon = ({ size = 18 }: P) => (<svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>)
export const MoonIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>)
export const CogIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>)
export const GlobeIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>)
export const QuestionIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><path d="M12 17h.01" /></svg>)
export const BeakerIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M9 3h6" /><path d="M10 3v6l-5 9a1 1 0 0 0 .9 1.5h12.2a1 1 0 0 0 .9-1.5l-5-9V3" /><path d="M8 14h8" /></svg>)
export const FlagIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M5 21V4" /><path d="M5 4h11l-2.2 4L16 12H5" /></svg>)
export const ChartIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M4 19h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-6" /></svg>)
export const SparkIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z" /></svg>)
export const PathIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M8 7.5c3 1 5 8 8 9" /></svg>)
export const ScaleIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M12 3v18" /><path d="M5 8h14" /><path d="M5 8l-3 6h6zM19 8l-3 6h6z" /></svg>)
export const FilmIcon = ({ size = 18 }: P) => (<svg {...base(size)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>)
export const FrameIcon = ({ size = 18 }: P) => (<svg {...base(size)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 8h3M8 8v3M16 8h-3M16 8v3M8 16h3M8 16v-3M16 16h-3M16 16v-3" /></svg>)
export const ClapperIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M4 8h16v11H4z" /><path d="M4 8l16-4v4" /><path d="M8 5.2l1.6 3.2M12 4.2l1.6 3.2M16 3.2l1.6 3.2" /></svg>)
export const CompassIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2.2 6.3-6.3 2.2 2.2-6.3z" /></svg>)
export const SheetIcon = ({ size = 18 }: P) => (<svg {...base(size)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>)
export const NetworkIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="2" /><path d="M8 8l3 7M16 8l-3 7M8 7h8" /></svg>)

export function Flower({ size = 22, colour = '#e98fb0' }: { size?: number; colour?: string }) {
  return (
    <svg className="flower" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="12" cy="6.5" rx="4" ry="5" fill={colour} transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.6" fill="#e7a43a" />
    </svg>
  )
}

/** The Course Garden tree: fuller as more of the course is done, one fruit per thing done. */
export function GardenTree({ done, total, width = 120 }: { done: number; total: number; width?: number }) {
  const spots = [
    [38, 34], [62, 26], [80, 44], [28, 56], [52, 52], [74, 66], [40, 74], [60, 80], [86, 30], [20, 40], [66, 46], [48, 30],
  ]
  const count = Math.min(spots.length, Math.max(total, 1))
  const share = total > 0 ? done / total : done > 0 ? 1 : 0
  const scale = done <= 0 ? 0.55 : share >= 0.95 ? 1 : share >= 0.6 ? 0.9 : share >= 0.3 ? 0.78 : 0.66
  return (
    <svg width={width} viewBox="0 0 110 130" aria-label={`${done} of ${total} fruits`}>
      <rect x="49" y="78" width="12" height="48" rx="5" fill="#8a5a3b" />
      <g style={{ transform: `translate(55px, 58px) scale(${scale}) translate(-55px, -58px)` }}>
      <circle cx="34" cy="58" r="26" fill="#2f6b45" />
      <circle cx="74" cy="56" r="26" fill="#245c3c" />
      <circle cx="55" cy="38" r="30" fill="#1f6b45" />
      <circle cx="56" cy="70" r="22" fill="#2a7048" />
      </g>
      {spots.slice(0, count).map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="5.5" fill={index < done ? (index % 3 === 1 ? '#e9b44c' : '#ef7b4a') : 'rgba(255,255,255,0.35)'} stroke={index < done ? '#fff' : 'none'} strokeWidth="1.5" />
      ))}
    </svg>
  )
}
