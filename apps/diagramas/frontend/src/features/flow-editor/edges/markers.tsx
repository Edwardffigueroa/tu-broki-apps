export function EdgeMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <marker id="fs-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--ink)" />
        </marker>
        <marker id="fs-arrow-sel" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
        </marker>
        <marker id="fs-arrow-open" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
        </marker>
        <marker id="fs-arrow-open-sel" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        </marker>
        <marker id="fs-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <circle cx="4" cy="4" r="3" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
        </marker>
        <marker id="fs-circle-sel" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <circle cx="4" cy="4" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
        </marker>
      </defs>
    </svg>
  )
}

export function markerFor(kind: string, selected: boolean): { start?: string; end?: string } {
  const suf = selected ? '-sel' : ''
  switch (kind) {
    case 'message':
      return { end: `url(#fs-circle${suf})` }
    case 'return':
      return { start: `url(#fs-arrow-open${suf})`, end: `url(#fs-arrow${suf})` }
    case 'async':
      return { end: `url(#fs-arrow-open${suf})` }
    case 'association':
      return { end: `url(#fs-circle${suf})` }
    default:
      return { end: `url(#fs-arrow${suf})` }
  }
}
