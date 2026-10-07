/**
 * Tests unitarios del modelo de diagramas (sin DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModelo, modeloVacio, validarTitulo } from '../apps/diagramas/server/modelo.js';

describe('diagramas/modelo', () => {
  it('normaliza un diagrama mínimo', () => {
    const r = normalizeModelo({
      title: 'Demo',
      lanes: [{ id: 'a', name: 'Área' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'start', label: 'Inicio' }],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.lanes.length, 1);
    assert.equal(r.modelo.nodes[0].type, 'start');
  });

  it('acepta aliases de tipo en español', () => {
    const r = normalizeModelo({
      lanes: ['Cliente'],
      nodes: [{ id: 'x', lane: 'Cliente', type: 'tarea', label: 'Hacer algo' }],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.nodes[0].type, 'task');
    assert.equal(r.modelo.lanes[0].id, 'cliente');
  });

  it('rechaza sin lanes', () => {
    const r = normalizeModelo({ nodes: [], edges: [] });
    assert.equal(r.ok, false);
  });

  it('ignora edges rotos con warning', () => {
    const r = normalizeModelo({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'start', label: 'Inicio' }],
      edges: [{ from: 'n1', to: 'fantasma' }],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.edges.length, 0);
    assert.ok(r.warn.length >= 1);
  });

  it('conserva puertos de conexión y acepta alias en español', () => {
    const r = normalizeModelo({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'start', label: 'Inicio' },
        { id: 'n2', lane: 'a', type: 'task', label: 'Tarea' },
      ],
      edges: [
        { from: 'n1', to: 'n2', fromPort: 'bottom', toPort: 'abajo' },
        { from: 'n2', to: 'n1', from_port: 'TOP', toPort: 'noexiste' },
      ],
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.modelo.edges[0], { from: 'n1', to: 'n2', fromPort: 'bottom', toPort: 'bottom' });
    assert.deepEqual(r.modelo.edges[1], { from: 'n2', to: 'n1', fromPort: 'top' });
  });

  it('conserva tamaño manual w/h del nodo', () => {
    const r = normalizeModelo({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'Grande', w: 150, h: 90 },
        { id: 'n2', lane: 'a', type: 'start', label: 'OK', width: 120, height: 50 },
      ],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.nodes[0].w, 150);
    assert.equal(r.modelo.nodes[0].h, 90);
    assert.equal(r.modelo.nodes[1].w, 120);
    assert.equal(r.modelo.nodes[1].h, 50);
  });

  it('conserva filas de carril (≠ default 2) y row de nodo', () => {
    const r = normalizeModelo({
      lanes: [
        { id: 'a', name: 'A', rows: 3 },
        { id: 'b', name: 'B', rows: 2 },
      ],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'Arriba', step: 1, row: 1 },
        { id: 'n2', lane: 'a', type: 'task', label: 'Abajo', step: 1, row: 2 },
      ],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.lanes[0].rows, 3);
    assert.equal(r.modelo.lanes[1].rows, undefined); // default 2 no se persiste
    assert.equal(r.modelo.nodes[0].row, 1);
    assert.equal(r.modelo.nodes[1].row, 2);
  });

  it('conserva docs (Markdown del proceso) y acepta string shorthand', () => {
    const r = normalizeModelo({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'start', label: 'Inicio' }],
      edges: [],
      docs: [
        { id: 'lectura', title: 'Resumen', body: 'Hola **mundo**' },
        'Solo texto',
      ],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.docs.length, 2);
    assert.deepEqual(r.modelo.docs[0], { id: 'lectura', title: 'Resumen', body: 'Hola **mundo**' });
    assert.equal(r.modelo.docs[1].body, 'Solo texto');
    assert.ok(r.modelo.docs[1].id);
  });

  it('modeloVacio tiene start', () => {
    const m = modeloVacio('X');
    assert.equal(m.title, 'X');
    assert.equal(m.nodes[0].type, 'start');
  });

  it('validarTitulo', () => {
    assert.equal(validarTitulo('').ok, false);
    assert.equal(validarTitulo('  Ok  ').ok, true);
    assert.equal(validarTitulo('  Ok  ').titulo, 'Ok');
  });
});
