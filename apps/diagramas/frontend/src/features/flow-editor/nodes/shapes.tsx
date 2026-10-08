function defaultFill(type: string): string {
  if (type === 'start') return 'var(--ok)'
  if (type === 'end') return 'var(--end)'
  if (type === 'decision') return 'var(--warn)'
  if (type === 'annotation') return 'color-mix(in srgb, var(--paper) 70%, transparent)'
  return 'var(--node)'
}

export function NodeShape({
  type,
  w,
  h,
  color,
}: {
  type: string
  w: number
  h: number
  color?: string
}) {
  const stroke = 'var(--node-line)'
  const fill = color || defaultFill(type)

  if (type === 'decision') {
    const cx = w / 2
    const cy = h / 2
    return (
      <svg className="fs-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polygon
          points={`${cx},2 ${w - 2},${cy} ${cx},${h - 2} 2,${cy}`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
        />
      </svg>
    )
  }

  if (type === 'event') {
    const r = Math.min(w, h) / 2 - 2
    const cx = w / 2
    const cy = h / 2
    return (
      <svg className="fs-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="1.6" />
        <circle cx={cx} cy={cy} r={r - 5} fill={fill} stroke={stroke} strokeWidth="1.2" />
      </svg>
    )
  }

  if (type === 'document') {
    return (
      <svg className="fs-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path
          d={`M4,4 H${w - 14} L${w - 4},14 V${h - 4} H4 Z M${w - 14},4 V14 H${w - 4}`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
      </svg>
    )
  }

  const rx = type === 'start' || type === 'end' ? Math.min(w, h) / 2 : 10
  return (
    <svg className="fs-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <rect x="2" y="2" width={w - 4} height={h - 4} rx={rx} fill={fill} stroke={stroke} strokeWidth="1.4" />
    </svg>
  )
}

/** Luminancia percibida 0–255; < 140 → texto claro. */
export function isDarkHex(hex?: string): boolean {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return false
  const h = hex.slice(1)
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

export function eventIcon(event?: string): string {
  switch (event) {
    case 'message':
      return '✉'
    case 'timer':
      return '⏱'
    case 'signal':
      return '△'
    case 'error':
      return '⚡'
    default:
      return '●'
  }
}
