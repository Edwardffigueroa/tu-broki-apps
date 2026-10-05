/**
 * Casos de uso de Contabilidad.
 */

import { getSql } from '../../../shared/db.js';
import { ErrorHttp } from '../../../shared/http.js';
import { mergeCfg, toDbMov, exportMovsCsv } from '../lib/finanzas.mjs';
import { validarMovimiento, validarMeta, validarCfg, cfgInicial } from './modelo.js';
import * as repo from './repositorio.js';

export async function listarMovimientos() {
  return repo.listarMovimientos(getSql());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Evita que un id malformado llegue a Postgres como `uuid` y reviente en 500. */
function exigirId(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del movimiento.');
  if (!UUID_RE.test(String(id))) throw new ErrorHttp(404, 'Movimiento no encontrado.');
  return String(id);
}

export async function obtenerMovimiento(id) {
  exigirId(id);
  const m = await repo.obtenerMovimiento(getSql(), id);
  if (!m) throw new ErrorHttp(404, 'Movimiento no encontrado.');
  return m;
}

export async function crearMovimiento(body) {
  const v = validarMovimiento(body);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  return repo.crearMovimiento(getSql(), toDbMov(v.data));
}

export async function actualizarMovimiento(id, body) {
  exigirId(id);
  const v = validarMovimiento(body);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  const m = await repo.actualizarMovimiento(getSql(), id, toDbMov(v.data));
  if (!m) throw new ErrorHttp(404, 'Movimiento no encontrado.');
  return m;
}

export async function eliminarMovimiento(id) {
  exigirId(id);
  const ok = await repo.eliminarMovimiento(getSql(), id);
  if (!ok) throw new ErrorHttp(404, 'Movimiento no encontrado.');
  return { ok: true };
}

export async function listarMetas() {
  return repo.listarMetas(getSql());
}

export async function guardarMeta(body) {
  const v = validarMeta(body);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  return repo.upsertMeta(getSql(), v.data);
}

export async function obtenerConfig() {
  const raw = await repo.obtenerConfig(getSql());
  return mergeCfg(raw || cfgInicial());
}

export async function guardarConfig(body) {
  const v = validarCfg(body);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  const saved = await repo.upsertConfig(getSql(), v.data);
  return mergeCfg(saved);
}

export async function exportarCsv() {
  const sql = getSql();
  const [movs, cfgRaw] = await Promise.all([
    repo.listarMovimientos(sql),
    repo.obtenerConfig(sql),
  ]);
  const cfg = mergeCfg(cfgRaw || cfgInicial());
  return exportMovsCsv(movs, cfg);
}

export { cfgInicial };
