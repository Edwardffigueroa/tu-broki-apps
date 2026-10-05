import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AuthError,
  createMov,
  deleteMov,
  downloadCsv,
  irAAcceso,
  loadAll,
  saveConfig,
  saveMeta,
  updateMov,
} from '../api/client'
import { PERIOD_KEY, VIEW_KEY } from '../lib/constants'
import type { Cfg, Filtros, Meta, Movimiento, ViewId } from '../lib/types'
import { curMonthKey, DEF_CFG, mergeCfg } from '@finanzas'

type ToastFn = (msg: string) => void

type Store = {
  loading: boolean
  error: string | null
  movs: Movimiento[]
  metas: Record<string, Meta>
  cfg: Cfg
  /** Sube cada vez que llega una config nueva del servidor; sirve como `key` de editores. */
  cfgVersion: number
  view: ViewId
  period: string
  metaMonth: string
  filt: Filtros
  toast: string | null
  setView: (v: ViewId) => void
  setPeriod: (p: string) => void
  setMetaMonth: (m: string) => void
  setFilt: (f: Partial<Filtros>) => void
  showToast: ToastFn
  reload: () => Promise<void>
  upsertMov: (id: string | undefined, data: Partial<Movimiento>) => Promise<void>
  removeMov: (id: string) => Promise<void>
  upsertMeta: (mes: string, data: Meta) => Promise<void>
  upsertCfg: (data: Partial<Cfg>) => Promise<void>
  exportCsv: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

function readLS(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

export function ContabilidadProvider({ children }: { children: ReactNode }) {
  const now = useMemo(() => new Date(), [])
  const cur = curMonthKey(now)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [metas, setMetas] = useState<Record<string, Meta>>({})
  const [cfg, setCfgState] = useState<Cfg>(mergeCfg(DEF_CFG) as Cfg)
  const [cfgVersion, setCfgVersion] = useState(0)
  const setCfg = useCallback((c: Cfg) => {
    setCfgState(c)
    setCfgVersion((v) => v + 1)
  }, [])
  const [view, setViewState] = useState<ViewId>(
    () => readLS(VIEW_KEY, 'resumen') as ViewId,
  )
  const [period, setPeriodState] = useState(() => readLS(PERIOD_KEY, `y:${now.getFullYear()}`))
  const [metaMonth, setMetaMonth] = useState(cur)
  const [filt, setFiltState] = useState<Filtros>({
    q: '',
    tipo: '',
    mes: '',
    cat: '',
    estado: '',
  })
  const [toast, setToast] = useState<string | null>(null)

  const toastTimer = useRef<number | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const reload = useCallback(async () => {
    try {
      const data = await loadAll()
      setMovs(data.movimientos)
      setMetas(data.metas)
      setCfg(mergeCfg(data.config) as Cfg)
      setError(null)
    } catch (e) {
      if (e instanceof AuthError) {
        irAAcceso()
        return
      }
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [setCfg])

  useEffect(() => {
    void reload()
  }, [reload])

  const setView = (v: ViewId) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* */
    }
  }

  const setPeriod = (p: string) => {
    setPeriodState(p)
    try {
      localStorage.setItem(PERIOD_KEY, p)
    } catch {
      /* */
    }
  }

  const setFilt = (f: Partial<Filtros>) => setFiltState((prev) => ({ ...prev, ...f }))

  const upsertMov = async (id: string | undefined, data: Partial<Movimiento>) => {
    if (id) await updateMov(id, data)
    else await createMov(data)
    await reload()
  }

  const removeMov = async (id: string) => {
    await deleteMov(id)
    await reload()
  }

  const upsertMeta = async (mes: string, data: Meta) => {
    const saved = await saveMeta({ mes, ...data })
    setMetas((prev) => ({
      ...prev,
      [mes]: { unidades: saved.unidades, ventas: saved.ventas, utilidad: saved.utilidad },
    }))
  }

  const upsertCfg = async (data: Partial<Cfg>) => {
    const saved = await saveConfig(data)
    setCfg(mergeCfg(saved) as Cfg)
  }

  const exportCsv = async () => {
    await downloadCsv()
    showToast('Archivo listo')
  }

  const value: Store = {
    loading,
    error,
    movs,
    metas,
    cfg,
    cfgVersion,
    view,
    period,
    metaMonth,
    filt,
    toast,
    setView,
    setPeriod,
    setMetaMonth,
    setFilt,
    showToast,
    reload,
    upsertMov,
    removeMov,
    upsertMeta,
    upsertCfg,
    exportCsv,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useContabilidad(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useContabilidad fuera del provider')
  return s
}
