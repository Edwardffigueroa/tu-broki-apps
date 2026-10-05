/**
 * CSV RFC 4180 con BOM UTF-8 para exportar el roadmap (Numbers/Excel lo abren bien).
 * Las columnas salen de `modelo.js`.
 */

import { HEADERS } from './modelo.js';

const BOM = '\uFEFF';

/** Escapa un valor de celda según RFC 4180. */
export function escapeCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Parsea una línea CSV respetando comillas. Devuelve celdas. */
export function parseLine(line) {
  const cells = [];
  let i = 0;
  let cur = '';
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      cells.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  cells.push(cur);
  return cells;
}

/**
 * Divide el texto CSV en registros (filas), respetando comillas multilínea.
 */
export function splitRecords(text) {
  const records = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '""';
          i += 2;
          continue;
        }
        inQuotes = false;
        cur += ch;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (s[i + 1] === '\n') i += 1;
      records.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      records.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  if (cur.length > 0 || records.length === 0) {
    records.push(cur);
  }
  // Quitar última fila vacía típica de CSV que termina en newline
  if (records.length > 1 && records[records.length - 1] === '') {
    records.pop();
  }
  return records;
}

/** Convierte texto CSV → array de objetos tarea. */
export function parseCsv(text) {
  const records = splitRecords(text || '');
  if (records.length === 0) return [];

  const headerCells = parseLine(records[0]).map((h) => h.trim());
  const headerIndex = {};
  for (const h of HEADERS) {
    const idx = headerCells.indexOf(h);
    if (idx === -1) {
      throw new Error(`CSV sin columna requerida: ${h}`);
    }
    headerIndex[h] = idx;
  }

  const tareas = [];
  for (let r = 1; r < records.length; r++) {
    const line = records[r];
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const row = {};
    for (const h of HEADERS) {
      row[h] = cells[headerIndex[h]] ?? '';
    }
    // Normalizar tipos numéricos
    row.orden = row.orden === '' ? 0 : Number(row.orden);
    row.estimacion_dias =
      row.estimacion_dias === '' ? '' : Number(row.estimacion_dias);
    tareas.push(row);
  }
  return tareas;
}

/** Serializa array de tareas → texto CSV con BOM. */
export function serializeCsv(tareas) {
  const lines = [HEADERS.join(',')];
  for (const t of tareas || []) {
    const row = HEADERS.map((h) => {
      let v = t[h];
      if (v == null) v = '';
      return escapeCell(v);
    });
    lines.push(row.join(','));
  }
  return BOM + lines.join('\n') + '\n';
}

/** Cabecera sola (archivo vacío inicial). */
export function emptyCsv() {
  return BOM + HEADERS.join(',') + '\n';
}
