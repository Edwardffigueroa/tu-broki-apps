import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  serializeCsv,
  escapeCell,
  parseLine,
  emptyCsv,
} from '../apps/roadmap/server/csv.js';
import { HEADERS, validateTareas } from '../apps/roadmap/server/modelo.js';

const sample = [
  {
    id: 't1',
    padre_id: '',
    tipo: 'tarea',
    titulo: 'Modificaciones al sitio web',
    descripcion: 'Ajustes de copy y SEO',
    grupo: 'Desarrollo',
    estado: 'En curso',
    prioridad: 'Alta',
    responsable: 'Socio Tech',
    estimacion_dias: 5,
    fecha_inicio: '2026-10-02',
    fecha_fin: '2026-10-15',
    orden: 1,
    creado: '2026-10-01T12:00:00.000Z',
    actualizado: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 't1s1',
    padre_id: 't1',
    tipo: 'tarea',
    titulo: 'Actualizar precios',
    descripcion: '',
    grupo: 'Desarrollo',
    estado: 'Hecha',
    prioridad: 'Media',
    responsable: '',
    estimacion_dias: 1,
    fecha_inicio: '',
    fecha_fin: '',
    orden: 1,
    creado: '2026-10-01T12:00:00.000Z',
    actualizado: '2026-10-01T12:00:00.000Z',
  },
];

describe('escapeCell / parseLine', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    assert.equal(escapeCell('hola'), 'hola');
    assert.equal(escapeCell('a,b'), '"a,b"');
    assert.equal(escapeCell('dice "hola"'), '"dice ""hola"""');
    assert.equal(escapeCell('línea1\nlínea2'), '"línea1\nlínea2"');
  });

  it('parsea celdas con comillas', () => {
    assert.deepEqual(parseLine('a,b,c'), ['a', 'b', 'c']);
    assert.deepEqual(parseLine('"a,b",c'), ['a,b', 'c']);
    assert.deepEqual(parseLine('"dice ""hola""",x'), ['dice "hola"', 'x']);
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trip conserva acentos, comas y saltos', () => {
    const weird = {
      ...sample[0],
      id: 'w1',
      titulo: 'Tarea con, coma y "comillas"',
      descripcion: 'Línea 1\nLínea 2 — ñáéíóú',
      grupo: 'Operaciones',
    };
    const csv = serializeCsv([weird, sample[1]]);
    assert.ok(csv.charCodeAt(0) === 0xfeff, 'debe empezar con BOM');
    const parsed = parseCsv(csv);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].titulo, weird.titulo);
    assert.equal(parsed[0].descripcion, weird.descripcion);
    assert.equal(parsed[1].padre_id, 't1');
    assert.equal(parsed[0].estimacion_dias, 5);
  });

  it('emptyCsv tiene todas las columnas', () => {
    const parsed = parseCsv(emptyCsv());
    assert.deepEqual(parsed, []);
    const text = emptyCsv();
    for (const h of HEADERS) {
      assert.ok(text.includes(h));
    }
  });

  it('campos vacíos se preservan', () => {
    const t = {
      id: 'e1',
      padre_id: '',
      tipo: 'hito',
      titulo: 'Lanzamiento',
      descripcion: '',
      grupo: 'Marketing',
      estado: 'Por hacer',
      prioridad: 'Baja',
      responsable: '',
      estimacion_dias: '',
      fecha_inicio: '2026-10-10',
      fecha_fin: '',
      orden: 0,
      creado: '',
      actualizado: '',
    };
    const parsed = parseCsv(serializeCsv([t]));
    assert.equal(parsed[0].responsable, '');
    assert.equal(parsed[0].estimacion_dias, '');
    assert.equal(parsed[0].tipo, 'hito');
  });
});

describe('validateTareas', () => {
  it('acepta tareas válidas', () => {
    const r = validateTareas(sample);
    assert.equal(r.ok, true);
    assert.equal(r.tareas.length, 2);
  });

  it('rechaza id duplicado', () => {
    const bad = [sample[0], { ...sample[0] }];
    const r = validateTareas(bad);
    assert.equal(r.ok, false);
    assert.match(r.error, /duplicado/);
  });

  it('rechaza padre desconocido', () => {
    const bad = [{ ...sample[1], padre_id: 'no-existe' }];
    // falta el padre en el array
    const r = validateTareas([{ ...sample[1], padre_id: 'no-existe', id: 'x' }]);
    assert.equal(r.ok, false);
    assert.match(r.error, /padre_id/);
  });

  it('rechaza estado inválido', () => {
    const r = validateTareas([{ ...sample[0], estado: 'Done' }]);
    assert.equal(r.ok, false);
  });

  it('rechaza fecha mal formada', () => {
    const r = validateTareas([{ ...sample[0], fecha_inicio: '01/10/2026' }]);
    assert.equal(r.ok, false);
    assert.match(r.error, /fecha_inicio/);
  });

  it('rechaza subtarea de subtarea', () => {
    const r = validateTareas([
      sample[0],
      sample[1],
      {
        ...sample[1],
        id: 'nieta',
        padre_id: 't1s1',
        titulo: 'Nieta',
      },
    ]);
    assert.equal(r.ok, false);
    assert.match(r.error, /un nivel/);
  });
});
