import { useEffect, useState } from 'react'
import { applyTheme, initTheme, resolvedTheme, type ThemeMode } from '../lib/theme'

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof document === 'undefined' ? 'light' : resolvedTheme(),
  )

  useEffect(() => {
    setMode(initTheme())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'diagramas.theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue)
        setMode(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const next = mode === 'dark' ? 'light' : 'dark'
  const classes = ['theme-toggle', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      title={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-pressed={mode === 'light'}
      onClick={() => {
        applyTheme(next)
        setMode(next)
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {mode === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
      <span>{mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
