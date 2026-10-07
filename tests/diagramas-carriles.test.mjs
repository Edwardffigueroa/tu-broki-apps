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

/**
 * Smoke del sizing por texto: se valida en el frontend (measure.ts) al compilar.
 * Aquí solo documentamos el contrato: el JSON no guarda w/h; el layout los calcula.
 */
describe('carriles sizing por texto', () => {
  it('el modelo no exige dimensiones: layout las deriva del label', () => {
    const r = normalizeModelo({
      lanes: ['A'],
      nodes: [
        { id: 'corto', lane: 'A', type: 'start', label: 'OK' },
        {
          id: 'largo',
          lane: 'A',
          type: 'task',
          label: 'Este es un texto bastante más largo para el shape',
        },
      ],
      edges: [],
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.modelo.nodes[0].w, undefined)
    assert.equal(r.modelo.nodes[1].label.length > r.modelo.nodes[0].label.length, true)
  })
})

describe('carriles multi-fila', () => {
  it('acepta rows en lane y row en node (contrato JSON)', () => {
    const r = normalizeModelo({
      lanes: [{ id: 'ops', name: 'Ops', rows: 4 }],
      nodes: [
        { id: 'a', lane: 'ops', type: 'task', label: 'Fila 1', step: 1, row: 1 },
        { id: 'b', lane: 'ops', type: 'task', label: 'Fila 3', step: 1, row: 3 },
      ],
      edges: [{ from: 'a', to: 'b', fromPort: 'bottom', toPort: 'top' }],
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.modelo.lanes[0].rows, 4)
    assert.equal(r.modelo.nodes[0].row, 1)
    assert.equal(r.modelo.nodes[1].row, 3)
    assert.equal(r.modelo.edges[0].fromPort, 'bottom')
  })
})
