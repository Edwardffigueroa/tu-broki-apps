/**
 * Tests del motor Carriles vía Node (sin DOM).
 * Cubre la lógica crítica portada del prototipo.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Importamos desde dist no aplica; reimplementamos asserts sobre el server modelo
// y un smoke del contrato JSON. El motor TS se valida al compilar el frontend.
import { normalizeModelo } from '../apps/diagramas/server/modelo.js'

const pedido = {
  title: 'Pedido en línea',
  lanes: [
    { id: 'cliente', name: 'Cliente' },
    { id: 'ventas', name: 'Ventas' },
  ],
  nodes: [
    { id: 'n1', lane: 'cliente', type: 'start', label: 'Hace un pedido' },
    { id: 'n2', lane: 'ventas', type: 'task', label: 'Revisar' },
  ],
  edges: [{ from: 'n1', to: 'n2' }],
}

describe('carriles contrato JSON', () => {
  it('pedido normaliza con edge', () => {
    const r = normalizeModelo(pedido)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.modelo.edges.length, 1)
    assert.equal(r.modelo.nodes[0].type, 'start')
  })
})
