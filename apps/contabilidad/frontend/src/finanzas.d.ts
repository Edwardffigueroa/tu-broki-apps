declare module '@finanzas' {
  export const TRUORA: number
  export const FIRMA: number
  export const NOTIF: number
  export const SERVICIOS: Array<{
    id: string
    cac: number
    n: number
    nombre: string
    linea: string
    para: string
    precio: number
    costo: number
    nota?: string
    recurrente?: boolean
    interno?: boolean
  }>
  export const LINEAS: string[]
  export const CATS: Array<{ id: string; puc: string; nombre: string }>
  export const PUC_ING: string
  export const PUC_COSTO: string
  export const FIJOS_DEF: Array<{ n: string; m: number; g: string; nota?: string }>
  export const DEF_CFG: Record<string, unknown>
  export const QUIENES: string[]
  export const MEDIOS: string[]
  export const TIPOS: string[]
  export const ESTADOS: string[]
  export const GRUPOS_FIJO: string[]
  export const MESES: string[]
  export const MESES_L: string[]

  export function money(n: number): string
  export function short(n: number): string
  export function pct(n: number, d?: number): string
  export function mLabel(k: string): string
  export function mLong(k: string): string
  export function fmtDate(f: string): string
  export function curMonthKey(now?: Date): string
  export function todayKey(now?: Date): string
  export function addMonths(k: string, n: number): string
  export function mergeCfg(raw?: unknown): Record<string, unknown>
  export function fijosList(cfg?: unknown): Array<{ n: string; m: number; g: string; nota?: string }>
  export function fijoMes(cfg?: unknown): number
  export function svc(id: string | undefined, cfg?: unknown): {
    id: string
    n: number
    nombre: string
    linea: string
    para: string
    precio: number
    costo: number
    cac: number
    nota?: string
    recurrente?: boolean
    interno?: boolean
  }
  export function catOf(id: string | undefined): { id: string; puc: string; nombre: string }
  export function netOf(bruto: number, cfg?: unknown): number
  export function unitMargin(s: { precio: number; costo: number }, cfg?: unknown): number
  export function marginAfterCac(
    s: { precio: number; costo: number; cac?: number },
    cfg?: unknown,
  ): number
  export function toUiMov(row: unknown): unknown
  export function toDbMov(d: unknown): unknown
  export function calc(
    m: {
      tipo: string
      monto?: number
      costoDirecto?: number
      medio?: string
    },
    cfg?: unknown,
  ): { bruto: number; neto: number; iva: number; costo: number; gasto?: number }
  export function inPeriod(m: { fecha?: string }, per: string): boolean
  export function pnl(
    list: unknown[],
    cfg?: unknown,
  ): {
    mkt: number
    mktServ: Record<string, number>
    nNuevos: number
    cacObj: number
    ventasBrutas: number
    iva: number
    ventas: number
    costos: number
    gastosCat: Record<string, number>
    gastos: number
    nVentas: number
    unidades: number
    cobrado: number
    porCobrar: number
    pagado: number
    porPagar: number
    porServ: Record<string, { u: number; bruto: number; neto: number; costo: number; n: number }>
    utilBruta: number
    utilOp: number
    ica: number
    uai: number
    renta: number
    utilNeta: number
    caja: number
    mcPct: number
    cacReal: number
    cacObjProm: number
  }
  export function monthsInData(movs: Array<{ fecha?: string }>, now?: Date): string[]
  export function periodLabel(p: string): string
  export function monthsCount(movs: Array<{ fecha?: string }>, p: string): number
  export function metaTotal(
    mt: { ventas?: number; unidades?: Record<string, number> } | null | undefined,
    cfg?: unknown,
  ): number
  export function paceFrac(k: string, now?: Date): number
  export function goalStatus(f: number): { c: string; t: string }
  export function niceStep(v: number): number
  export function csvEscape(v: unknown): string
  export function exportMovsCsv(movs: unknown[], cfg?: unknown): string
  export function servicioPorNombre(nombre: string): string | null
  export function categoriaPorNombreCsv(nombre: string): string
}
