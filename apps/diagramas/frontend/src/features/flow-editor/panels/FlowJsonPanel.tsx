import { useMemo, useRef } from 'react'
import { buildFlowAiPrompt, toNarrative, toText } from '@flow'
import { useFlowCtx } from '../FlowCtx'

function lineCount(text: string): number {
  if (!text) return 1
  let n = 1
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

export function FlowJsonPanel() {
  const ctrl = useFlowCtx()
  const gutterRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const lines = useMemo(() => lineCount(ctrl.jsonText), [ctrl.jsonText])
  const gutter = useMemo(
    () => Array.from({ length: lines }, (_, i) => String(i + 1)).join('\n'),
    [lines],
  )

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text)
      ctrl.showToast(msg)
    } catch {
      ctrl.showToast('No se pudo copiar')
    }
  }

  function syncScroll() {
    const ed = editorRef.current
    const gut = gutterRef.current
    if (ed && gut) gut.scrollTop = ed.scrollTop
  }

  return (
    <div className="fs-json-panel">
      <p className={`fs-json-status ${ctrl.jsonStatus.kind}`}>{ctrl.jsonStatus.msg}</p>
      <div className="fs-code" data-readonly={ctrl.readOnly ? '1' : '0'}>
        <div className="fs-code-gutter" ref={gutterRef} aria-hidden="true">
          {gutter}
        </div>
        <textarea
          ref={editorRef}
          className="fs-json-editor"
          spellCheck={false}
          aria-label="Código JSON del diagrama"
          value={ctrl.jsonText}
          readOnly={ctrl.readOnly}
          onChange={(e) => ctrl.onJsonChange(e.target.value)}
          onScroll={syncScroll}
          onFocus={() => ctrl.setJsonFocused(true)}
          onBlur={() => ctrl.setJsonFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault()
              const el = e.currentTarget
              const start = el.selectionStart
              const end = el.selectionEnd
              const next = `${el.value.slice(0, start)}  ${el.value.slice(end)}`
              ctrl.onJsonChange(next)
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + 2
              })
            }
          }}
        />
      </div>
      <div className="fs-json-actions">
        <button type="button" onClick={() => ctrl.formatJson()} disabled={ctrl.readOnly}>
          Formatear
        </button>
        <button type="button" onClick={() => void copyText(toText(ctrl.model), 'JSON copiado')}>
          Copiar JSON
        </button>
        <button
          type="button"
          title="Paso a paso: actores (carriles), fases y quién habla con quién"
          onClick={() =>
            void copyText(toNarrative(ctrl.model), 'Descripción del proceso copiada')
          }
        >
          Copiar descripción del proceso
        </button>
        <button
          type="button"
          onClick={() => void copyText(buildFlowAiPrompt(ctrl.model), 'Prompt IA copiado')}
        >
          Copiar prompt IA
        </button>
      </div>
    </div>
  )
}
