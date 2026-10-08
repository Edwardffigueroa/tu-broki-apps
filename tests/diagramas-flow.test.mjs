/**
 * Tests de la lib swimlane-flow (puro, sin DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../apps/diagramas/lib/flow/index.mjs';
import { normalizeModelo } from '../apps/diagramas/server/modelo.js';

describe('diagramas/flow/normalize', () => {
  it('normaliza un modelo mínimo y asigna x/dy', () => {
    const r = F.normalizeFlow({
      lanes: ['Cliente'],
      nodes: [{ id: 'n1', lane: 'Cliente', type: 'start', label: 'Inicio' }],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.kind, 'swimlane-flow');
    assert.equal(r.modelo.version, 1);
    assert.equal(typeof r.modelo.nodes[0].x, 'number');
    assert.equal(typeof r.modelo.nodes[0].dy, 'number');
  });

  it('rechaza raíz inválida', () => {
    for (const bad of [null, [], 'x']) {
      const r = F.normalizeFlow(bad);
      assert.equal(r.ok, false);
      assert.match(r.error, /objeto/);
    }
  });

  it('exige al menos un carril', () => {
    const r = F.normalizeFlow({ lanes: [], nodes: [], edges: [] });
    assert.equal(r.ok, false);
  });

  it('detecta carril y paso repetidos', () => {
    assert.equal(
      F.normalizeFlow({
        lanes: [
          { id: 'a', name: 'A' },
          { id: 'a', name: 'B' },
        ],
        nodes: [],
        edges: [],
      }).error,
      'Carril repetido: "a".',
    );
    assert.equal(
      F.normalizeFlow({
        lanes: [{ id: 'a', name: 'A' }],
        nodes: [
          { id: 'n1', lane: 'a', type: 'task', label: '1' },
          { id: 'n1', lane: 'a', type: 'task', label: '2' },
        ],
        edges: [],
      }).error,
      'Paso repetido: "n1".',
    );
  });

  it('resuelve carril por name y aliases de tipo', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'cliente', name: 'Cliente' }],
      nodes: [
        { id: 'a', lane: 'Cliente', type: 'tarea', label: 'Hacer' },
        { id: 'b', lane: 'cliente', type: 'decisión', label: '¿?' },
        { id: 'c', lane: 'cliente', type: 'evento', label: 'Ping', col: 2, slot: 1 },
        { id: 'd', lane: 'cliente', type: 'base de datos', label: 'DB', col: 3, slot: 1 },
        { id: 'e', lane: 'cliente', type: 'nota', label: 'Nota', col: 4, slot: 1 },
        { id: 'f', lane: 'cliente', type: 'raro', label: 'X', col: 5, slot: 1 },
      ],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.nodes[0].lane, 'cliente');
    assert.equal(r.modelo.nodes[0].type, 'task');
    assert.equal(r.modelo.nodes[1].type, 'decision');
    assert.equal(r.modelo.nodes[2].type, 'event');
    assert.equal(r.modelo.nodes[3].type, 'data');
    assert.equal(r.modelo.nodes[4].type, 'annotation');
    assert.equal(r.modelo.nodes[5].type, 'task');
    assert.ok(r.warn.some((w) => /desconocido/i.test(w)));
  });

  it('valida color y convierte rows a height', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A', color: 'red', rows: 3 }],
      nodes: [],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.lanes[0].color, undefined);
    assert.equal(r.modelo.lanes[0].height, 3 * 120 + 20);
    assert.ok(r.warn.length);

    const ok = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A', color: '#abc' }],
      nodes: [],
      edges: [],
    });
    assert.equal(ok.modelo.lanes[0].color, '#abc');
  });

  it('acepta color de paso y descarta inválidos', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'A', col: 1, slot: 1, color: '#E2E9FC' },
        { id: 'n2', lane: 'a', type: 'task', label: 'B', col: 2, slot: 1, color: 'rojo' },
      ],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.nodes[0].color, '#E2E9FC');
    assert.equal(r.modelo.nodes[1].color, undefined);
    assert.ok(r.warn.some((w) => /Color inválido/.test(w)));
  });

  it('acepta textColor / labelColor de paso', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'A', col: 1, slot: 1, textColor: '#FFFFFF' },
        { id: 'n2', lane: 'a', type: 'task', label: 'B', col: 2, slot: 1, labelColor: '#14202B' },
      ],
      edges: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.nodes[0].textColor, '#FFFFFF');
    assert.equal(r.modelo.nodes[1].textColor, '#14202B');
  });

  it('descarta conexiones inválidas y normaliza aliases', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: '1', col: 1, slot: 1 },
        { id: 'n2', lane: 'a', type: 'task', label: '2', col: 2, slot: 1 },
      ],
      edges: [
        { source: 'n1', target: 'n2', fromPort: 'derecha', kind: 'reproceso' },
        { from: 'n1', to: 'ghost' },
        { from: 'n1', to: 'n2', fromHandle: 'bottom', toHandle: 'top', kind: 'raro' },
      ],
    });
    assert.equal(r.ok, true);
    assert.equal(r.modelo.edges.length, 2);
    assert.equal(r.modelo.edges[0].kind, 'return');
    assert.equal(r.modelo.edges[0].fromHandle, 'right');
    assert.equal(r.modelo.edges[1].kind, 'flow');
    assert.equal(r.modelo.edges[1].fromHandle, 'bottom');
  });

  it('elimina event en nodos no-event y es idempotente', () => {
    const raw = {
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'task', label: 'T', event: 'timer', col: 1, slot: 1 }],
      edges: [],
    };
    const r1 = F.normalizeFlow(raw);
    assert.equal(r1.modelo.nodes[0].event, undefined);
    const r2 = F.normalizeFlow(r1.modelo);
    assert.deepEqual(r2.modelo, r1.modelo);
    const before = structuredClone(raw);
    F.normalizeFlow(raw);
    assert.deepEqual(raw, before);
  });

  it('rechaza demasiados nodos', () => {
    const nodes = Array.from({ length: 801 }, (_, i) => ({
      id: 's' + i,
      lane: 'a',
      type: 'task',
      label: 'x',
      col: 1,
      slot: 1,
    }));
    const r = F.normalizeFlow({ lanes: [{ id: 'a', name: 'A' }], nodes, edges: [] });
    assert.equal(r.ok, false);
    assert.match(r.error, /800/);
  });
});

describe('diagramas/flow/autoplace', () => {
  it('coloca por col/slot con la fórmula del contrato', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'task', label: 'T', col: 3, slot: 2 }],
      edges: [],
    });
    // task 160×64 → x = 2*200 + (200-160)/2 = 420; dy = 10 + 120 + (120-64)/2 = 158
    assert.equal(r.modelo.nodes[0].x, 420);
    assert.equal(r.modelo.nodes[0].dy, 158);
  });

  it('no mueve nodos con x/dy explícitos', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [{ id: 'n1', lane: 'a', type: 'task', label: 'T', x: 99, dy: 33 }],
      edges: [],
    });
    assert.equal(r.modelo.nodes[0].x, 99);
    assert.equal(r.modelo.nodes[0].dy, 33);
  });

  it('cadena topológica asigna columnas crecientes', () => {
    const r = F.normalizeFlow({
      lanes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      nodes: [
        { id: 'a', lane: 'a', type: 'task', label: 'A' },
        { id: 'b', lane: 'b', type: 'task', label: 'B' },
        { id: 'c', lane: 'a', type: 'task', label: 'C' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    assert.equal(r.modelo.nodes.find((n) => n.id === 'a').col, 1);
    assert.equal(r.modelo.nodes.find((n) => n.id === 'b').col, 2);
    assert.equal(r.modelo.nodes.find((n) => n.id === 'c').col, 3);
  });
});

describe('diagramas/flow/geometry', () => {
  it('laneGeometry y placeFromAbsolute', () => {
    const r = F.normalizeFlow({
      lanes: [
        { id: 'a', name: 'A', height: 380 },
        { id: 'b', name: 'B', height: 260 },
      ],
      nodes: [{ id: 'n1', lane: 'a', type: 'task', label: 'T', x: 40, dy: 40 }],
      edges: [],
    });
    const g = F.laneGeometry(r.modelo);
    assert.deepEqual(g.tops, [0, 380]);
    assert.equal(g.total, 640);

    const p = F.placeFromAbsolute(r.modelo, { x: 50, y: 400 }, { w: 160, h: 64 });
    assert.equal(p.lane, 'b');
    const top = F.placeFromAbsolute(r.modelo, { x: 0, y: -100 }, { w: 40, h: 40 });
    assert.equal(top.lane, 'a');
  });

  it('colOf/slotOf son inversos de autoplace', () => {
    for (let col = 1; col <= 5; col++) {
      for (let slot = 1; slot <= 2; slot++) {
        const w = 160;
        const h = 64;
        const x = (col - 1) * 200 + (200 - w) / 2;
        const dy = 10 + (slot - 1) * 120 + (120 - h) / 2;
        assert.equal(F.colOf(x + w / 2), col);
        assert.equal(F.slotOf(260, dy + h / 2), slot);
      }
    }
  });

  it('phaseAt usa intervalo semiabierto', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      phases: [
        { id: 'p1', name: 'P1', width: 400 },
        { id: 'p2', name: 'P2', width: 400 },
      ],
      nodes: [],
      edges: [],
    });
    assert.equal(F.phaseAt(r.modelo, 0), 'p1');
    assert.equal(F.phaseAt(r.modelo, 399), 'p1');
    assert.equal(F.phaseAt(r.modelo, 400), 'p2');
  });
});

describe('diagramas/flow/lint', () => {
  it('marca decisión sin salidas suficientes', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'd1', lane: 'a', type: 'decision', label: '¿OK?', col: 1, slot: 1 },
        { id: 't1', lane: 'a', type: 'task', label: 'Sí', col: 2, slot: 1 },
      ],
      edges: [{ from: 'd1', to: 't1' }],
    });
    const issues = F.lintFlow(r.modelo);
    assert.ok(issues.some((i) => i.code === 'DECISION_SALIDAS' && i.level === 'error'));
  });

  it('data sin salidas no es huérfano; task sí', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [
        { id: 'd1', lane: 'a', type: 'data', label: 'DB', col: 1, slot: 1 },
        { id: 't1', lane: 'a', type: 'task', label: 'T', col: 2, slot: 1 },
      ],
      edges: [],
    });
    const issues = F.lintFlow(r.modelo);
    assert.ok(!issues.some((i) => i.code === 'HUERFANO_SALIDA' && i.nodeId === 'd1'));
    assert.ok(issues.some((i) => i.code === 'HUERFANO_SALIDA' && i.nodeId === 't1'));
  });

  it('detecta solape en el mismo carril', () => {
    const r = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A', height: 400 }],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'A', x: 40, dy: 40, w: 160, h: 64 },
        { id: 'n2', lane: 'a', type: 'task', label: 'B', x: 50, dy: 50, w: 160, h: 64 },
      ],
      edges: [],
    });
    assert.ok(F.lintFlow(r.modelo).some((i) => i.code === 'SOLAPE'));
  });
});

describe('diagramas/flow/edit', () => {
  function base() {
    return F.normalizeFlow({
      lanes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      nodes: [
        { id: 'n1', lane: 'a', type: 'task', label: 'A', col: 1, slot: 1 },
        { id: 'end1', lane: 'a', type: 'end', label: 'Fin', col: 2, slot: 1 },
      ],
      edges: [],
    }).modelo;
  }

  it('addNode no muta y genera id libre', () => {
    const m = base();
    const next = F.addNode(m, { type: 'task', lane: 'a', x: 100, dy: 40 });
    assert.notEqual(next, m);
    assert.equal(m.nodes.length, 2);
    assert.equal(next.nodes.length, 3);
    assert.equal(next.nodes[2].id, 'n2');
  });

  it('updateNode aplica y limpia color de paso', () => {
    const m = base();
    const painted = F.updateNode(m, 'n1', { color: '#14202B' });
    assert.equal(painted.nodes[0].color, '#14202B');
    const cleared = F.updateNode(painted, 'n1', { color: null });
    assert.equal(cleared.nodes[0].color, undefined);
  });

  it('addNodeAfter desde end no conecta', () => {
    const m = base();
    const { m: next, id } = F.addNodeAfter(m, 'end1', 'task');
    assert.ok(id);
    assert.equal(next.edges.length, 0);
  });

  it('addEdge duplicado devuelve el mismo objeto', () => {
    const m = F.addEdge(base(), { from: 'n1', to: 'end1', fromHandle: 'right', toHandle: 'left' });
    const again = F.addEdge(m, { from: 'n1', to: 'end1', fromHandle: 'right', toHandle: 'left' });
    assert.equal(again, m);
  });

  it('addEdge defaults kind por carril/annotation', () => {
    let m = base();
    m = F.addNode(m, { type: 'task', lane: 'b', x: 40, dy: 40, label: 'B' });
    const bId = m.nodes.find((n) => n.label === 'B').id;
    m = F.addEdge(m, { from: 'n1', to: bId });
    assert.equal(m.edges.at(-1).kind, 'message');
    m = F.addNode(m, { type: 'annotation', lane: 'a', x: 200, dy: 40 });
    const ann = m.nodes.find((n) => n.type === 'annotation').id;
    m = F.addEdge(m, { from: ann, to: 'n1' });
    assert.equal(m.edges.at(-1).kind, 'association');
  });

  it('deleteElements elimina conexiones', () => {
    let m = F.addEdge(base(), { from: 'n1', to: 'end1' });
    m = F.deleteElements(m, { nodeIds: ['n1'], edgeIds: [] });
    assert.equal(m.nodes.length, 1);
    assert.equal(m.edges.length, 0);
  });

  it('deleteLane del único carril no cambia', () => {
    const m = F.normalizeFlow({
      lanes: [{ id: 'a', name: 'A' }],
      nodes: [],
      edges: [],
    }).modelo;
    assert.equal(F.deleteLane(m, 'a'), m);
  });

  it('reverseEdge intercambia extremos y handles', () => {
    let m = F.addEdge(base(), {
      from: 'n1',
      to: 'end1',
      fromHandle: 'right',
      toHandle: 'left',
    });
    const id = m.edges[0].id;
    m = F.reverseEdge(m, id);
    assert.equal(m.edges[0].from, 'end1');
    assert.equal(m.edges[0].to, 'n1');
    assert.equal(m.edges[0].fromHandle, 'left');
    assert.equal(m.edges[0].toHandle, 'right');
  });

  it('pasteNodes remapea ids', () => {
    const m = base();
    const { m: next, ids } = F.pasteNodes(m, {
      nodes: [{ id: 'n1', lane: 'a', type: 'task', label: 'Copia', x: 0, dy: 0 }],
      edges: [],
    });
    assert.equal(ids.length, 1);
    assert.notEqual(ids[0], 'n1');
    assert.ok(next.nodes.some((n) => n.id === ids[0]));
  });
});

describe('diagramas/flow/convert', () => {
  const CLASICO_MAT = {
    title: 'Pedido',
    lanes: [
      { id: 'cliente', name: 'Cliente', rows: 1 },
      { id: 'tubroki', name: 'TuBroki', rows: 2 },
      { id: 'sistema', name: 'Sistema', rows: 3 },
    ],
    nodes: [
      { id: 's1', lane: 'cliente', type: 'start', label: 'Inicio', step: 1, row: 1 },
      { id: 't1', lane: 'cliente', type: 'task', label: 'Pide', step: 2, row: 1, note: 'WA' },
      { id: 'd1', lane: 'tubroki', type: 'decision', label: '¿OK?', step: 3, row: 1 },
      { id: 't2', lane: 'sistema', type: 'task', label: 'Crea', step: 4, row: 1 },
      { id: 'doc1', lane: 'sistema', type: 'document', label: 'PDF', step: 5, row: 1 },
      { id: 'e1', lane: 'cliente', type: 'end', label: 'Listo', step: 6, row: 1 },
      { id: 'e2', lane: 'cliente', type: 'end', label: 'No', step: 4, row: 1 },
    ],
    edges: [
      { from: 's1', to: 't1' },
      { from: 't1', to: 'd1', label: 'envía' },
      { from: 'd1', to: 't2', label: 'Sí', fromPort: 'right', toPort: 'left' },
      { from: 'd1', to: 'e2', label: 'No' },
      { from: 't2', to: 'doc1' },
      { from: 'doc1', to: 'e1' },
      { from: 'e2', to: 't1', label: 'reintento' },
      { from: 't2', to: 't1', fromPort: 'bottom', toPort: 'bottom' },
    ],
    docs: [{ id: 'lectura', title: 'Lee', body: 'Hola' }],
  };

  it('fromCarriles conserva ids y marca retornos', () => {
    const { modelo, warn } = F.fromCarriles(CLASICO_MAT);
    assert.equal(modelo.kind, 'swimlane-flow');
    assert.equal(modelo.lanes[0].height, 1 * 120 + 20);
    assert.equal(modelo.lanes[1].height, 2 * 120 + 20);
    assert.deepEqual(
      modelo.nodes.map((n) => n.id).sort(),
      CLASICO_MAT.nodes.map((n) => n.id).sort(),
    );
    assert.ok(modelo.edges.some((e) => e.kind === 'return'));
    assert.ok(warn.some((w) => /reproceso/i.test(w)));
    assert.equal(modelo.docs[0].body, 'Hola');
  });

  it('ida y vuelta clásico → Pro → clásico conserva estructura', () => {
    const { modelo: pro } = F.fromCarriles(CLASICO_MAT);
    const { modelo: back } = F.toCarriles(pro);
    assert.equal(back.lanes.length, CLASICO_MAT.lanes.length);
    for (const l of CLASICO_MAT.lanes) {
      const bl = back.lanes.find((x) => x.id === l.id);
      assert.ok(bl);
      assert.equal(bl.name, l.name);
      assert.equal(bl.rows ?? 2, l.rows ?? 2);
    }
    for (const n of CLASICO_MAT.nodes) {
      const bn = back.nodes.find((x) => x.id === n.id);
      assert.ok(bn, n.id);
      assert.equal(bn.lane, n.lane);
      assert.equal(bn.type, n.type);
      assert.equal(bn.label, n.label);
      assert.equal(bn.step, n.step);
      assert.equal(bn.row, n.row);
    }
    for (const e of CLASICO_MAT.edges) {
      assert.ok(
        back.edges.some(
          (x) =>
            x.from === e.from &&
            x.to === e.to &&
            (x.label || '') === (e.label || '') &&
            (x.fromPort || '') === (e.fromPort || '') &&
            (x.toPort || '') === (e.toPort || ''),
        ),
        `${e.from}->${e.to}`,
      );
    }
  });

  it('toCarriles del ejemplo de arriendo es válido en el normalizador clásico', () => {
    const pro = F.normalizeFlow(F.EXAMPLE_ARRIENDO).modelo;
    const { modelo, warn } = F.toCarriles(pro);
    const n = normalizeModelo(modelo);
    assert.equal(n.ok, true);
    const seen = new Set();
    for (const node of n.modelo.nodes) {
      const key = `${node.lane}|${node.step}|${node.row}`;
      assert.ok(!seen.has(key), key);
      seen.add(key);
    }
    assert.ok((modelo.docs || []).some((d) => d.title === 'Fases (de Carriles Pro)'));
    assert.ok(warn.length);
  });
});

describe('diagramas/flow/totext y ejemplos', () => {
  it('toText es determinista y round-trip', () => {
    const m = F.normalizeFlow(F.EXAMPLE_MINI).modelo;
    const t1 = F.toText(m);
    const t2 = F.toText(m);
    assert.equal(t1, t2);
    const parsed = JSON.parse(t1);
    const again = F.normalizeFlow(parsed);
    assert.equal(again.ok, true);
    assert.deepEqual(again.modelo, m);
  });

  it('EXAMPLE_ARRIENDO cumple CA3', () => {
    const r = F.normalizeFlow(F.EXAMPLE_ARRIENDO);
    assert.equal(r.ok, true);
    assert.equal(r.modelo.lanes.length, 8);
    assert.equal(r.modelo.phases.length, 7);
    assert.equal(r.modelo.nodes.length, 59);
    assert.equal(r.modelo.edges.length, 72);
    assert.equal(F.lintFlow(r.modelo).filter((i) => i.level === 'error').length, 0);
    assert.ok(!/\d+\s*%/.test(JSON.stringify(F.EXAMPLE_ARRIENDO)));
  });

  it('toNarrative y aiprompt del arriendo', () => {
    const m = F.normalizeFlow(F.EXAMPLE_ARRIENDO).modelo;
    const nar = F.toNarrative(m);
    assert.match(nar, /Arriendo de punta a punta/);
    assert.match(nar, /\$629\.000 COP/);
    assert.ok(!/%/.test(nar) || !/\d+\s*%/.test(nar));
    const prompt = F.buildFlowAiPrompt();
    assert.match(prompt, /col/);
    assert.match(prompt, /slot/);
    assert.match(prompt, /phases/);
    assert.match(prompt, /kind/);
  });

  it('modeloVacioFlow tiene 3 carriles y un start', () => {
    const m = F.modeloVacioFlow('X');
    assert.deepEqual(
      m.lanes.map((l) => l.id),
      ['cliente', 'tubroki', 'sistema'],
    );
    assert.equal(m.nodes[0].type, 'start');
  });

  it('moveLane con toIndex relativo (i+dir) mueve un puesto', () => {
    const m = F.normalizeFlow({
      lanes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      nodes: [{ id: 'n1', lane: 'b', type: 'task', label: 'T', x: 40, dy: 40 }],
      edges: [],
    }).modelo;
    const i = m.lanes.findIndex((l) => l.id === 'b');
    const up = F.moveLane(m, 'b', i - 1);
    assert.deepEqual(
      up.lanes.map((l) => l.id),
      ['b', 'a', 'c'],
    );
    assert.equal(up.nodes[0].dy, 40);
    const down = F.moveLane(m, 'b', i + 1);
    assert.deepEqual(
      down.lanes.map((l) => l.id),
      ['a', 'c', 'b'],
    );
  });

  it('sintético 300 pasos normaliza en < 1s', () => {
    const nPasos = 300;
    const nCarriles = 10;
    const lanes = Array.from({ length: nCarriles }, (_, i) => ({
      id: 'l' + i,
      name: 'Carril ' + (i + 1),
      height: 260,
    }));
    const nodes = Array.from({ length: nPasos }, (_, i) => ({
      id: 's' + i,
      lane: 'l' + (i % nCarriles),
      type: i % 7 === 3 ? 'decision' : 'task',
      label: 'Paso ' + i,
      col: Math.floor(i / nCarriles) + 1,
      slot: (i % 2) + 1,
    }));
    const edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
    const t0 = performance.now();
    const r = F.normalizeFlow({ title: 'Sintético', lanes, nodes, edges });
    F.lintFlow(r.modelo);
    F.toText(r.modelo);
    const ms = performance.now() - t0;
    assert.equal(r.ok, true);
    assert.ok(ms < 1000, `tardó ${ms}ms`);
  });
});
