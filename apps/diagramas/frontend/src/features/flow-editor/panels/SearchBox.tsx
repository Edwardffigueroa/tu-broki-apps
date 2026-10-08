import { useEffect, useRef, useState } from 'react'
import { useFlowCtx } from '../FlowCtx'

export function SearchBox() {
  const ctrl = useFlowCtx()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = q.trim() ? ctrl.searchNodes(q) : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open && !q) {
    return (
      <button type="button" className="fs-search-trigger" onClick={() => setOpen(true)}>
        Buscar ⌘K
      </button>
    )
  }

  return (
    <div className="fs-search">
      <input
        ref={inputRef}
        type="search"
        placeholder="Buscar pasos…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            ctrl.focusNode(results[0].id)
            setOpen(false)
            setQ('')
          }
        }}
      />
      {results.length > 0 && (
        <ul className="fs-search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  ctrl.focusNode(r.id)
                  setOpen(false)
                  setQ('')
                }}
              >
                <strong>{r.label}</strong>
                <span>{r.lane}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
