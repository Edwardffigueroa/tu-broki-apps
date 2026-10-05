export type ViewId =
  | 'resumen'
  | 'movimientos'
  | 'resultados'
  | 'servicios'
  | 'metas'
  | 'catalogo'

export type Movimiento = {
  id: string
  tipo: 'ingreso' | 'gasto'
  fecha: string
  fechaPendiente?: boolean
  estado: 'pagado' | 'pendiente'
  monto: number
  quien?: string
  tercero?: string
  concepto?: string
  notas?: string
  servicio?: string
  cantidad?: number
  costoDirecto?: number
  medio?: string
  categoria?: string
  servicioCac?: string
  creado?: number
}

export type Meta = {
  unidades: Record<string, number>
  ventas: number
  utilidad: number
}

export type Cfg = {
  iva: number
  ivaIncluido: boolean
  ica: number
  renta: number
  gmf: number
  wompiPct: number
  wompiFijo: number
  precios: Record<string, { precio?: number; costo?: number; cac?: number }>
  fijos: Array<{ n: string; m: number; g: string; nota?: string }> | null
}

export type Filtros = {
  q: string
  tipo: string
  mes: string
  cat: string
  estado: string
}
