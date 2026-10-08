import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AuthError,
  createMov,
  deleteMov,
  downloadCsv,
  fetchConfig,
  fetchMetas,
  fetchMovimientos,
  saveConfig,
  saveMeta,
  updateMov,
} from '../api/client'
import { contabilidadKeys } from '../api/queryClient'
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
  const qc = useQueryClient()
  const now = useMemo(() => new Date(), [])
  const cur = curMonthKey(now)

  const movsQ = useQuery({
    queryKey: contabilidadKeys.movimientos,
    queryFn: fetchMovimientos,
  })
  const metasQ = useQuery({
    queryKey: contabilidadKeys.metas,
    queryFn: fetchMetas,
  })
  const cfgQ = useQuery({
    queryKey: contabilidadKeys.config,
    queryFn: fetchConfig,
  })

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

  const authRedirecting = [movsQ.error, metasQ.error, cfgQ.error].some(
    (e) => e instanceof AuthError,
  )
  const failError = [movsQ.error, metasQ.error, cfgQ.error].find(
    (e) => e && !(e instanceof AuthError),
  )
  const ready = movsQ.isSuccess && metasQ.isSuccess && cfgQ.isSuccess
  // No pintar UI con DEF_CFG / listas vacías si falta alguna query o hay 401 en curso.
  const loading = (!ready && !failError) || authRedirecting
  const error = failError
    ? failError instanceof Error
      ? failError.message
      : String(failError)
    : null

  const movs = ready ? movsQ.data : []
  const metas = ready ? metasQ.data : {}
  const cfg = useMemo(
    () => mergeCfg(ready && cfgQ.data ? cfgQ.data : DEF_CFG) as Cfg,
    [ready, cfgQ.data],
  )
  const cfgVersion = cfgQ.dataUpdatedAt

  const reload = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: contabilidadKeys.movimientos }),
      qc.invalidateQueries({ queryKey: contabilidadKeys.metas }),
      qc.invalidateQueries({ queryKey: contabilidadKeys.config }),
    ])
  }, [qc])

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

  const movMut = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string | undefined
      data: Partial<Movimiento>
    }) => {
      if (id) return updateMov(id, data)
      return createMov(data)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: contabilidadKeys.movimientos })
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteMov(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: contabilidadKeys.movimientos })
    },
  })

  const metaMut = useMutation({
    mutationFn: ({ mes, data }: { mes: string; data: Meta }) =>
      saveMeta({ mes, ...data }),
    onSuccess: (saved, { mes }) => {
      qc.setQueryData<Record<string, Meta>>(contabilidadKeys.metas, (prev) => ({
        ...(prev || {}),
        [mes]: {
          unidades: saved.unidades,
          ventas: saved.ventas,
          utilidad: saved.utilidad,
        },
      }))
    },
  })

  const cfgMut = useMutation({
    mutationFn: (data: Partial<Cfg>) => saveConfig(data),
    onSuccess: (saved) => {
      qc.setQueryData(contabilidadKeys.config, saved)
    },
  })

  const upsertMov = async (id: string | undefined, data: Partial<Movimiento>) => {
    await movMut.mutateAsync({ id, data })
  }

  const removeMov = async (id: string) => {
    await delMut.mutateAsync(id)
  }

  const upsertMeta = async (mes: string, data: Meta) => {
    await metaMut.mutateAsync({ mes, data })
  }

  const upsertCfg = async (data: Partial<Cfg>) => {
    await cfgMut.mutateAsync(data)
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
