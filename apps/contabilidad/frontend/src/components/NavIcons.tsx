import type { ViewId } from '../lib/types'

const ICONS: Record<ViewId, string> = {
  resumen:
    '<path d="M4 19V5M4 19h16M8 15v4M12 11v8M16 7v12"/>',
  movimientos:
    '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  resultados:
    '<path d="M4 19h16M6 15l4-6 3 3 5-7"/>',
  servicios:
    '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  metas: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  catalogo:
    '<path d="M4 6h16M4 12h16M4 18h10"/>',
}

export const VIEWS: [ViewId, string][] = [
  ['resumen', 'Resumen'],
  ['movimientos', 'Movimientos'],
  ['resultados', 'Estado de resultados'],
  ['servicios', 'Rentabilidad por servicio'],
  ['metas', 'Metas de ventas'],
  ['catalogo', 'Catálogo y supuestos'],
]

export function NavIcon({ view }: { view: ViewId }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" dangerouslySetInnerHTML={{ __html: ICONS[view] }} />
  )
}
