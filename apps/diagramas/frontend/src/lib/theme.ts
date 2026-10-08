export type ThemeMode = 'light' | 'dark'

const LS_KEY = 'diagramas.theme'

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function readStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* */
  }
  return null
}

export function resolvedTheme(stored: ThemeMode | null = readStoredTheme()): ThemeMode {
  return stored ?? (systemPrefersDark() ? 'dark' : 'light')
}

/** Aplica `data-theme` en <html> y persiste la preferencia. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode)
  try {
    localStorage.setItem(LS_KEY, mode)
  } catch {
    /* */
  }
}

export function initTheme(): ThemeMode {
  const mode = resolvedTheme()
  document.documentElement.setAttribute('data-theme', mode)
  return mode
}

export function toggleTheme(current?: ThemeMode): ThemeMode {
  const next: ThemeMode = (current ?? resolvedTheme()) === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
