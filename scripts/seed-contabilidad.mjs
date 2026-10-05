#!/usr/bin/env node
/**
 * Semilla idempotente de Contabilidad:
 * - upsert config/catalogo (DEF_CFG + FIJOS_DEF)
 * - inserta movimientos del CSV solo si la tabla está vacía (o FORCE_SEED=1)
 *
 * Uso: npm run seed:contabilidad
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSql, cerrarSql } from '../shared/db.js';
import {
  FIJOS_DEF,
  DEF_CFG,
  servicioPorNombre,
  categoriaPorNombreCsv,
} from '../apps/contabilidad/lib/finanzas.mjs';
import * as repo from '../apps/contabilidad/server/repositorio.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = path.join(RAIZ, 'apps/contabilidad/seed/movimientos-2026-10.csv');

const ENV_LOCAL = path.join(RAIZ, '.env.local');
if (fs.existsSync(ENV_LOCAL)) process.loadEnvFile(ENV_LOCAL);

function parseCsv(texto) {
  const lines = texto.replace(/^\ufeff/, '').trim().split(/\r?\n/);
  const head = lines[0].split(';');
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(';');
    const o = {};
    head.forEach((h, i) => {
      o[h] = cols[i] ?? '';
    });
    return o;
  });
}

function rowToMov(row) {
  const isI = row.Tipo === 'Ingreso';
  const estado =
    row.Estado === 'Pendiente' || row.Estado === 'Por cobrar' || row.Estado === 'Por pagar'
      ? 'pendiente'
      : 'pagado';
  if (isI) {
    return {
      tipo: 'ingreso',
      fecha: row.Fecha,
      fecha_pendiente: false,
      estado,
      monto: Number(row['Monto bruto']) || 0,
      quien: row['Pagó/recibió'] || 'Empresa',
      tercero: row.Tercero || '',
      concepto: row.Concepto || '',
      notas: row.Notas || '',
      servicio: servicioPorNombre(row['Servicio/Categoría']),
      cantidad: Number(row.Cantidad) || 1,
      costo_directo: Number(row['Costo directo']) || 0,
      medio: row['Medio de pago'] || 'Transferencia',
      categoria: null,
      servicio_cac: null,
    };
  }
  return {
    tipo: 'gasto',
    fecha: row.Fecha,
    fecha_pendiente: false,
    estado,
    monto: Number(row['Monto bruto']) || 0,
    quien: row['Pagó/recibió'] || 'Empresa',
    tercero: row.Tercero || '',
    concepto: row.Concepto || '',
    notas: row.Notas || '',
    servicio: null,
    cantidad: null,
    costo_directo: null,
    medio: null,
    categoria: categoriaPorNombreCsv(row['Servicio/Categoría']),
    servicio_cac: null,
  };
}

async function main() {
  const sql = getSql();
  const cfg = {
    ...DEF_CFG,
    fijos: FIJOS_DEF.map((f) => ({ ...f })),
    precios: {},
  };
  await repo.upsertConfig(sql, cfg);
  console.log('[seed:contabilidad] config/catalogo upserted');

  const n = await repo.contarMovimientos(sql);
  const force = process.env.FORCE_SEED === '1';
  if (n > 0 && !force) {
    console.log(`[seed:contabilidad] ${n} movimiento(s) ya existen — skip CSV (FORCE_SEED=1 para forzar)`);
    return;
  }
  if (force && n > 0) {
    await sql`delete from contabilidad.movimientos`;
    console.log('[seed:contabilidad] FORCE_SEED: movimientos borrados');
  }

  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  for (const row of rows) {
    const d = rowToMov(row);
    if (d.tipo === 'ingreso' && !d.servicio) {
      throw new Error(`No se resolvió servicio: ${row['Servicio/Categoría']}`);
    }
    await repo.crearMovimiento(sql, d);
    console.log(`[seed:contabilidad] + ${d.tipo} ${d.fecha} $${d.monto}`);
  }
  console.log(`[seed:contabilidad] listo (${rows.length} movimientos)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarSql());
