import { useFlowCtx } from '../FlowCtx'

export function LintPanel() {
  const ctrl = useFlowCtx()
  const errs = ctrl.lint.filter((i) => i.level === 'error')
  const avis = ctrl.lint.filter((i) => i.level === 'aviso')

  if (!ctrl.lint.length) {
    return (
      <div className="fs-lint-empty">
        <p>Sin problemas detectados. El diagrama cumple las reglas básicas de revisión.</p>
      </div>
    )
  }

  return (
    <div className="fs-lint">
      <p className="fs-lint-count">
        {errs.length} errores · {avis.length} avisos
      </p>
      {(['error', 'aviso'] as const).map((level) => {
        const items = ctrl.lint.filter((i) => i.level === level)
        if (!items.length) return null
        return (
          <div key={level} className={`fs-lint-group fs-lint-${level}`}>
            <h4>{level === 'error' ? 'Errores' : 'Avisos'}</h4>
            <ul>
              {items.map((iss, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    className="fs-lint-item"
                    onClick={() => {
                      if (iss.nodeId) ctrl.focusNode(iss.nodeId)
                      else if (iss.edgeId) {
                        ctrl.onSelectionChange({
                          nodes: [],
                          edges: ctrl.edges.filter((e) => e.id === iss.edgeId),
                        })
                      }
                    }}
                  >
                    {iss.msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
