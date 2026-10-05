import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import {
  AuthError,
  ConflictError,
  cacheLocal,
  irAAcceso,
  loadTareas,
  readLocalCache,
  saveTareas,
} from '../api/tareas'
import { CRONO_SCALE_KEY, HINT_KEY, PLACEHOLDER_HITO, PLACEHOLDER_SUB } from '../lib/constants'
import { buildPlaceholders } from '../lib/placeholders'
import { newTaskFactory, touch } from '../lib/taskFactory'
import type {
  BannerState,
  CronoScale,
  RoadmapState,
  SaveStatus,
  Task,
  ToastState,
  View,
} from '../lib/types'
import {
  guardarGrupoColores,
  hijos,
  leerCronoLabelsW,
  leerGrupoColores,
  leerTituloW,
  padres,
} from '../lib/utils'

type Action =
  | { type: 'HYDRATE'; tareas: Task[]; version: number | string | null; offline?: boolean }
  | { type: 'SET_VERSION'; version: number | string | null }
  | { type: 'SET_TAREAS'; tareas: Task[] }
  | { type: 'PATCH_UI'; patch: Partial<RoadmapState> }
  | { type: 'SET_SAVE'; status: SaveStatus; msg: string }
  | { type: 'SET_BANNER'; banner: BannerState }
  | { type: 'CLEAR_BANNER' }
  | { type: 'SET_TOAST'; toast: ToastState }
  | { type: 'SET_LOADING'; loading: boolean }

function initialState(): RoadmapState {
  let cronoScale: CronoScale = 'semanas'
  try {
    const s = localStorage.getItem(CRONO_SCALE_KEY)
    if (s === 'dias' || s === 'semanas' || s === 'meses') cronoScale = s
  } catch {
    /* */
  }
  let showHint = true
  try {
    showHint = localStorage.getItem(HINT_KEY) !== '1'
  } catch {
    /* */
  }
  return {
    tareas: [],
    version: null,
    view: 'tabla',
    search: '',
    filtroEstado: '',
    filtroGrupos: [],
    selectedId: null,
    collapsedGroups: [],
    expandedTasks: [],
    cronoScale,
    showSubInCrono: true,
    cronoLabelsW: leerCronoLabelsW(),
    tablaTituloW: leerTituloW(),
    saveStatus: 'idle',
    saveMsg: '—',
    offline: false,
    showHint,
    grupoColores: leerGrupoColores(),
    colorPickerGrupo: null,
    colorPickerAnchor: null,
    banner: { kind: '', message: '' },
    toast: null,
    helpOpen: false,
    appearIds: [],
    loading: true,
  }
}

function reducer(state: RoadmapState, action: Action): RoadmapState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        tareas: action.tareas,
        version: action.version,
        offline: action.offline ?? false,
        loading: false,
      }
    case 'SET_VERSION':
      return { ...state, version: action.version }
    case 'SET_TAREAS':
      return { ...state, tareas: action.tareas }
    case 'PATCH_UI':
      return { ...state, ...action.patch }
    case 'SET_SAVE':
      return { ...state, saveStatus: action.status, saveMsg: action.msg }
    case 'SET_BANNER':
      return { ...state, banner: action.banner }
    case 'CLEAR_BANNER':
      return { ...state, banner: { kind: '', message: '' } }
    case 'SET_TOAST':
      return { ...state, toast: action.toast }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

type StoreApi = {
  state: RoadmapState
  dispatch: React.Dispatch<Action>
  mutate: (fn: (tareas: Task[]) => Task[], opts?: { appearIds?: string[] }) => void
  setUi: (patch: Partial<RoadmapState>) => void
  scheduleSave: (immediate?: boolean) => void
  load: () => Promise<boolean>
  showToast: (message: string, undo?: () => void) => void
  crearTarea: (partial?: Partial<Task>) => void
  addSubtarea: (padreId: string, titulo?: string) => void
  duplicar: (id: string) => void
  eliminar: (id: string) => void
  renameGrupo: (oldName: string, newName: string) => void
  setColorGrupo: (grupo: string, paletteId: string | null) => void
  reorderPadres: (sourceId: string, targetId: string, before: boolean) => boolean
  reorderSubtareas: (sourceId: string, targetId: string, before: boolean) => boolean
  seedPlaceholders: () => void
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleExpand: (id: string) => void
  toggleCollapseGroup: (g: string) => void
  select: (id: string | null) => void
  setView: (view: View) => void
}

const Ctx = createContext<StoreApi | null>(null)

export function RoadmapProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setUi = useCallback((patch: Partial<RoadmapState>) => {
    dispatch({ type: 'PATCH_UI', patch })
  }, [])

  const showToast = useCallback((message: string, undo?: () => void) => {
    dispatch({ type: 'SET_TOAST', toast: { message, undo } })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), 6000)
  }, [])

  const saveToServer = useCallback(async (force = false) => {
    const s = stateRef.current
    cacheLocal(s.tareas, s.version)
    if (s.offline && !force) {
      dispatch({ type: 'SET_SAVE', status: 'offline', msg: 'Guardado local' })
      return
    }
    dispatch({ type: 'SET_SAVE', status: 'saving', msg: 'Guardando…' })
    try {
      const { version } = await saveTareas(s.tareas, s.version)
      dispatch({ type: 'SET_VERSION', version })
      dispatch({ type: 'PATCH_UI', patch: { offline: false } })
      dispatch({ type: 'SET_SAVE', status: 'ok', msg: 'Guardado' })
      dispatch({ type: 'CLEAR_BANNER' })
      cacheLocal(s.tareas, version)
    } catch (e) {
      if (e instanceof AuthError) {
        irAAcceso()
        return
      }
      if (e instanceof ConflictError) {
        dispatch({ type: 'SET_SAVE', status: 'conflict', msg: 'Conflicto' })
        dispatch({
          type: 'SET_BANNER',
          banner: {
            kind: 'err',
            message:
              'Alguien más guardó cambios en este tablero. Recarga para verlos — si guardas ahora, los pisarías.',
            actionLabel: 'Recargar',
            action: 'reload',
          },
        })
        return
      }
      dispatch({ type: 'PATCH_UI', patch: { offline: true } })
      dispatch({ type: 'SET_SAVE', status: 'offline', msg: 'Guardado local' })
      dispatch({
        type: 'SET_BANNER',
        banner: {
          kind: 'warn',
          message: `No se pudo guardar. Los cambios quedaron en el navegador. ${e instanceof Error ? e.message : ''}`,
          actionLabel: 'Reintentar',
          action: 'retry-save',
        },
      })
    }
  }, [])

  const scheduleSave = useCallback(
    (immediate = false) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (immediate) {
        void saveToServer(true)
        return
      }
      dispatch({ type: 'SET_SAVE', status: 'saving', msg: 'Guardando…' })
      saveTimer.current = setTimeout(() => void saveToServer(), 400)
    },
    [saveToServer],
  )

  const mutate = useCallback(
    (fn: (tareas: Task[]) => Task[], opts?: { appearIds?: string[] }) => {
      const next = fn(stateRef.current.tareas)
      dispatch({ type: 'SET_TAREAS', tareas: next })
      if (opts?.appearIds?.length) {
        dispatch({ type: 'PATCH_UI', patch: { appearIds: opts.appearIds } })
        setTimeout(() => dispatch({ type: 'PATCH_UI', patch: { appearIds: [] } }), 600)
      }
      scheduleSave()
    },
    [scheduleSave],
  )


  const load = useCallback(async () => {
    try {
      const data = await loadTareas()
      let tareas = data.tareas
      if (!tareas.length) {
        tareas = buildPlaceholders()
        dispatch({ type: 'HYDRATE', tareas, version: data.version })
        dispatch({ type: 'PATCH_UI', patch: { expandedTasks: ['ph_dev'] } })
        scheduleSave(true)
      } else {
        dispatch({ type: 'HYDRATE', tareas, version: data.version })
      }
      cacheLocal(tareas, data.version)
      dispatch({ type: 'CLEAR_BANNER' })
      dispatch({ type: 'SET_SAVE', status: 'ok', msg: 'Sincronizado' })
      return true
    } catch (e) {
      if (e instanceof AuthError) {
        irAAcceso()
        return false
      }
      const cached = readLocalCache()
      if (cached) {
        dispatch({ type: 'HYDRATE', tareas: cached.tareas, version: cached.version, offline: true })
        dispatch({
          type: 'SET_BANNER',
          banner: {
            kind: 'warn',
            message:
              'Sin conexión. Tus cambios quedan en este navegador y se suben cuando vuelva la conexión.',
            actionLabel: 'Reintentar',
            action: 'retry-load',
          },
        })
        dispatch({ type: 'SET_SAVE', status: 'offline', msg: 'Sin conexión' })
        return false
      }
      dispatch({ type: 'SET_LOADING', loading: false })
      dispatch({
        type: 'SET_BANNER',
        banner: {
          kind: 'err',
          message: 'No se pudo cargar el tablero. Revisa tu conexión e inténtalo de nuevo.',
          actionLabel: 'Reintentar',
          action: 'retry-load',
        },
      })
      dispatch({ type: 'SET_SAVE', status: 'error', msg: 'Error' })
      return false
    }
  }, [scheduleSave])

  useEffect(() => {
    void load()
  }, [load])

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      mutate((tareas) =>
        tareas.map((t) => {
          if (t.id !== id) return t
          let next = touch({ ...t, ...patch })
          if (next.tipo === 'hito' && patch.fecha_inicio !== undefined) {
            next = { ...next, fecha_fin: next.fecha_inicio }
          }
          return next
        }),
      )
    },
    [mutate],
  )

  const crearTarea = useCallback(
    (partial: Partial<Task> = {}) => {
      const id = partial.id || undefined
      const task = newTaskFactory(
        {
          ...partial,
          ...(partial.tipo === 'hito'
            ? {
                tipo: 'hito',
                titulo: partial.titulo || PLACEHOLDER_HITO,
                estimacion_dias: '',
                fecha_inicio: partial.fecha_inicio || '',
                fecha_fin: partial.fecha_fin || partial.fecha_inicio || '',
              }
            : {}),
          ...(id ? { id } : {}),
        },
        stateRef.current.tareas.length,
      )
      mutate((tareas) => [...tareas, task], { appearIds: [task.id] })
      setUi({ selectedId: task.id })
    },
    [mutate, setUi],
  )

  const addSubtarea = useCallback(
    (padreId: string, titulo = PLACEHOLDER_SUB) => {
      const padre = stateRef.current.tareas.find((t) => t.id === padreId)
      if (!padre || padre.tipo === 'hito') return
      const kids = hijos(stateRef.current.tareas, padreId)
      const sub = newTaskFactory({
        padre_id: padreId,
        titulo,
        grupo: padre.grupo,
        orden: kids.length + 1,
        estimacion_dias: 1,
      })
      mutate((tareas) => [...tareas, sub], { appearIds: [sub.id] })
      const expanded = new Set(stateRef.current.expandedTasks)
      expanded.add(padreId)
      setUi({ expandedTasks: [...expanded], selectedId: padreId })
    },
    [mutate, setUi],
  )

  const duplicar = useCallback(
    (id: string) => {
      const t = stateRef.current.tareas.find((x) => x.id === id)
      if (!t) return
      const copy = newTaskFactory({
        ...t,
        id: undefined as unknown as string,
        titulo: t.titulo + ' (copia)',
        orden: stateRef.current.tareas.length + 1,
      })
      // strip id from spread by regenerating
      const fresh = newTaskFactory({
        padre_id: t.padre_id,
        tipo: t.tipo,
        titulo: t.titulo + ' (copia)',
        descripcion: t.descripcion,
        grupo: t.grupo,
        estado: t.estado,
        prioridad: t.prioridad,
        responsable: t.responsable,
        estimacion_dias: t.estimacion_dias,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        orden: stateRef.current.tareas.length + 1,
      })
      void copy
      mutate((tareas) => [...tareas, fresh], { appearIds: [fresh.id] })
      setUi({ selectedId: fresh.id })
    },
    [mutate, setUi],
  )

  const eliminar = useCallback(
    (id: string) => {
      const s = stateRef.current
      const victim = s.tareas.find((t) => t.id === id)
      if (!victim) return
      const removed = s.tareas.filter((t) => t.id === id || t.padre_id === id)
      const snapshot = s.tareas
      mutate((tareas) => tareas.filter((t) => t.id !== id && t.padre_id !== id))
      if (s.selectedId === id || removed.some((r) => r.id === s.selectedId)) {
        setUi({ selectedId: null })
      }
      showToast('Eliminado', () => {
        dispatch({ type: 'SET_TAREAS', tareas: snapshot })
        scheduleSave()
      })
    },
    [mutate, scheduleSave, setUi, showToast],
  )

  const renameGrupo = useCallback(
    (oldName: string, newName: string) => {
      const next = (newName || '').trim()
      if (!next || next === oldName) return
      mutate((tareas) =>
        tareas.map((t) => (t.grupo === oldName ? touch({ ...t, grupo: next }) : t)),
      )
      const s = stateRef.current
      const collapsed = s.collapsedGroups.map((g) => (g === oldName ? next : g))
      const colores = { ...s.grupoColores }
      if (colores[oldName]) {
        colores[next] = colores[oldName]
        delete colores[oldName]
        guardarGrupoColores(colores)
      }
      const filtroGrupos = s.filtroGrupos.map((g) => (g === oldName ? next : g))
      setUi({ collapsedGroups: collapsed, grupoColores: colores, filtroGrupos })
    },
    [mutate, setUi],
  )

  const setColorGrupo = useCallback(
    (grupo: string, paletteId: string | null) => {
      const colores = { ...stateRef.current.grupoColores }
      if (!paletteId) delete colores[grupo]
      else colores[grupo] = paletteId
      guardarGrupoColores(colores)
      setUi({ grupoColores: colores, colorPickerGrupo: null, colorPickerAnchor: null })
    },
    [setUi],
  )

  const reorderPadres = useCallback(
    (sourceId: string, targetId: string, before: boolean): boolean => {
      if (sourceId === targetId) return false
      const s = stateRef.current
      const source = s.tareas.find((t) => t.id === sourceId)
      const target = s.tareas.find((t) => t.id === targetId)
      if (!source || !target || source.padre_id || target.padre_id) return false
      mutate((tareas) => {
        const destGrupo = target.grupo
        let next = tareas.map((t) =>
          t.id === sourceId ? touch({ ...t, grupo: destGrupo }) : t,
        )
        const siblings = padres(next)
          .filter((t) => t.grupo === destGrupo && t.id !== sourceId)
          .sort((a, b) => a.orden - b.orden)
        const idx = siblings.findIndex((t) => t.id === targetId)
        if (idx < 0) return next
        const insertAt = before ? idx : idx + 1
        const ordered = [...siblings]
        ordered.splice(insertAt, 0, next.find((t) => t.id === sourceId)!)
        const orderMap = new Map(ordered.map((t, i) => [t.id, i + 1]))
        next = next.map((t) => (orderMap.has(t.id) ? touch({ ...t, orden: orderMap.get(t.id)! }) : t))
        return next
      })
      return true
    },
    [mutate],
  )

  const reorderSubtareas = useCallback(
    (sourceId: string, targetId: string, before: boolean): boolean => {
      if (sourceId === targetId) return false
      const s = stateRef.current
      const source = s.tareas.find((t) => t.id === sourceId)
      const target = s.tareas.find((t) => t.id === targetId)
      if (!source || !target || !source.padre_id || source.padre_id !== target.padre_id) return false
      mutate((tareas) => {
        const kids = hijos(tareas, source.padre_id).filter((t) => t.id !== sourceId)
        const idx = kids.findIndex((t) => t.id === targetId)
        if (idx < 0) return tareas
        const insertAt = before ? idx : idx + 1
        const ordered = [...kids]
        ordered.splice(insertAt, 0, source)
        const orderMap = new Map(ordered.map((t, i) => [t.id, i + 1]))
        return tareas.map((t) =>
          orderMap.has(t.id) ? touch({ ...t, orden: orderMap.get(t.id)! }) : t,
        )
      })
      return true
    },
    [mutate],
  )

  const seedPlaceholders = useCallback(() => {
    const tareas = buildPlaceholders()
    dispatch({ type: 'SET_TAREAS', tareas })
    try {
      localStorage.removeItem(HINT_KEY)
    } catch {
      /* */
    }
    setUi({ expandedTasks: ['ph_dev'], selectedId: null, showHint: true })
    scheduleSave(true)
  }, [scheduleSave, setUi])

  const toggleExpand = useCallback(
    (id: string) => {
      const set = new Set(stateRef.current.expandedTasks)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      setUi({ expandedTasks: [...set] })
    },
    [setUi],
  )

  const toggleCollapseGroup = useCallback(
    (g: string) => {
      const set = new Set(stateRef.current.collapsedGroups)
      if (set.has(g)) set.delete(g)
      else set.add(g)
      setUi({ collapsedGroups: [...set] })
    },
    [setUi],
  )

  const select = useCallback(
    (id: string | null) => setUi({ selectedId: id }),
    [setUi],
  )

  const setView = useCallback(
    (view: View) => setUi({ view }),
    [setUi],
  )


  const api = useMemo<StoreApi>(
    () => ({
      state,
      dispatch,
      mutate,
      setUi,
      scheduleSave,
      load,
      showToast,
      crearTarea,
      addSubtarea,
      duplicar,
      eliminar,
      renameGrupo,
      setColorGrupo,
      reorderPadres,
      reorderSubtareas,
      seedPlaceholders,
      updateTask,
      toggleExpand,
      toggleCollapseGroup,
      select,
      setView,
    }),
    [
      state,
      mutate,
      setUi,
      scheduleSave,
      load,
      showToast,
      crearTarea,
      addSubtarea,
      duplicar,
      eliminar,
      renameGrupo,
      setColorGrupo,
      reorderPadres,
      reorderSubtareas,
      seedPlaceholders,
      updateTask,
      toggleExpand,
      toggleCollapseGroup,
      select,
      setView,
    ],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useRoadmap(): StoreApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRoadmap fuera de RoadmapProvider')
  return ctx
}
