/**
 * Acceso a datos del schema `contabilidad`.
 */

import { toUiMov } from '../lib/finanzas.mjs';

function isoDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function mapMov(r) {
  return toUiMov({
    ...r,
    fecha: isoDate(r.fecha),
  });
}

export async function listarMovimientos(sql) {
  const filas = await sql`
    select *
    from contabilidad.movimientos
    order by fecha desc, creado desc
  `;
  return filas.map(mapMov);
}

export async function obtenerMovimiento(sql, id) {
  const [r] = await sql`
    select * from contabilidad.movimientos where id = ${id}
  `;
  return r ? mapMov(r) : null;
}

export async function crearMovimiento(sql, d) {
  const [r] = await sql`
    insert into contabilidad.movimientos (
      tipo, fecha, fecha_pendiente, estado, monto, quien, tercero, concepto, notas,
      servicio, cantidad, costo_directo, medio, categoria, servicio_cac
    ) values (
      ${d.tipo}, ${d.fecha}::date, ${!!d.fecha_pendiente}, ${d.estado}, ${d.monto},
      ${d.quien}, ${d.tercero}, ${d.concepto}, ${d.notas},
      ${d.servicio}, ${d.cantidad}, ${d.costo_directo}, ${d.medio},
      ${d.categoria}, ${d.servicio_cac}
    )
    returning *
  `;
  return mapMov(r);
}

export async function actualizarMovimiento(sql, id, d) {
  const [r] = await sql`
    update contabilidad.movimientos set
      tipo = ${d.tipo},
      fecha = ${d.fecha}::date,
      fecha_pendiente = ${!!d.fecha_pendiente},
      estado = ${d.estado},
      monto = ${d.monto},
      quien = ${d.quien},
      tercero = ${d.tercero},
      concepto = ${d.concepto},
      notas = ${d.notas},
      servicio = ${d.servicio},
      cantidad = ${d.cantidad},
      costo_directo = ${d.costo_directo},
      medio = ${d.medio},
      categoria = ${d.categoria},
      servicio_cac = ${d.servicio_cac},
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return r ? mapMov(r) : null;
}

export async function eliminarMovimiento(sql, id) {
  const [r] = await sql`
    delete from contabilidad.movimientos where id = ${id} returning id
  `;
  return !!r;
}

export async function contarMovimientos(sql) {
  const [r] = await sql`select count(*)::int as n from contabilidad.movimientos`;
  return r?.n || 0;
}

export async function listarMetas(sql) {
  const filas = await sql`
    select mes, unidades, ventas, utilidad, updated_at
    from contabilidad.metas
    order by mes desc
  `;
  const out = {};
  for (const f of filas) {
    out[f.mes] = {
      unidades: f.unidades || {},
      ventas: Number(f.ventas) || 0,
      utilidad: Number(f.utilidad) || 0,
    };
  }
  return out;
}

export async function upsertMeta(sql, { mes, unidades, ventas, utilidad }) {
  const [r] = await sql`
    insert into contabilidad.metas (mes, unidades, ventas, utilidad, updated_at)
    values (${mes}, ${sql.json(unidades)}, ${ventas}, ${utilidad}, now())
    on conflict (mes) do update set
      unidades = excluded.unidades,
      ventas = excluded.ventas,
      utilidad = excluded.utilidad,
      updated_at = now()
    returning mes, unidades, ventas, utilidad
  `;
  return {
    mes: r.mes,
    unidades: r.unidades || {},
    ventas: Number(r.ventas) || 0,
    utilidad: Number(r.utilidad) || 0,
  };
}

export async function obtenerConfig(sql, clave = 'catalogo') {
  const [r] = await sql`
    select data from contabilidad.config where clave = ${clave}
  `;
  return r?.data || null;
}

export async function upsertConfig(sql, data, clave = 'catalogo') {
  const [r] = await sql`
    insert into contabilidad.config (clave, data, updated_at)
    values (${clave}, ${sql.json(data)}, now())
    on conflict (clave) do update set
      data = excluded.data,
      updated_at = now()
    returning data
  `;
  return r.data;
}
