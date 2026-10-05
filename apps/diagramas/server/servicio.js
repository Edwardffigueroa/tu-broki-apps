/**
 * Casos de uso de la app Diagramas.
 */

import { getSql } from '../../../shared/db.js';
import { ErrorHttp } from '../../../shared/http.js';
import {
  normalizeModelo,
  modeloVacio,
  validarTitulo,
  validarNombreCorto,
  validarColor,
  validarTipo,
} from './modelo.js';
import * as repo from './repositorio.js';

/* ---------- grupos ---------- */

export async function listarGrupos() {
  return repo.listarGrupos(getSql());
}

export async function crearGrupo(body) {
  const n = validarNombreCorto(body.nombre, 'nombre del grupo');
  if (!n.ok) throw new ErrorHttp(400, n.error);
  const c = validarColor(body.color);
  if (!c.ok) throw new ErrorHttp(400, c.error);
  const orden = body.orden != null ? Number(body.orden) || 0 : 0;
  return repo.crearGrupo(getSql(), { nombre: n.nombre, color: c.color, orden });
}

export async function actualizarGrupo(id, body) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del grupo.');
  let nombre;
  let color;
  let orden;
  if (body.nombre !== undefined) {
    const n = validarNombreCorto(body.nombre, 'nombre del grupo');
    if (!n.ok) throw new ErrorHttp(400, n.error);
    nombre = n.nombre;
  }
  if (body.color !== undefined) {
    const c = validarColor(body.color);
    if (!c.ok) throw new ErrorHttp(400, c.error);
    color = c.color;
  }
  if (body.orden !== undefined) orden = Number(body.orden) || 0;
  const g = await repo.actualizarGrupo(getSql(), id, { nombre, color, orden });
  if (!g) throw new ErrorHttp(404, 'Grupo no encontrado.');
  return g;
}

export async function eliminarGrupo(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del grupo.');
  const ok = await repo.eliminarGrupo(getSql(), id);
  if (!ok) throw new ErrorHttp(404, 'Grupo no encontrado.');
  return { ok: true };
}

/* ---------- etiquetas ---------- */

export async function listarEtiquetas() {
  return repo.listarEtiquetas(getSql());
}

export async function crearEtiqueta(body) {
  const n = validarNombreCorto(body.nombre, 'nombre de la etiqueta');
  if (!n.ok) throw new ErrorHttp(400, n.error);
  const c = validarColor(body.color);
  if (!c.ok) throw new ErrorHttp(400, c.error);
  try {
    return await repo.crearEtiqueta(getSql(), { nombre: n.nombre, color: c.color });
  } catch (e) {
    if (e?.code === '23505') throw new ErrorHttp(409, 'Ya existe una etiqueta con ese nombre.');
    throw e;
  }
}

export async function actualizarEtiqueta(id, body) {
  if (!id) throw new ErrorHttp(400, 'Falta el id de la etiqueta.');
  let nombre;
  let color;
  if (body.nombre !== undefined) {
    const n = validarNombreCorto(body.nombre, 'nombre de la etiqueta');
    if (!n.ok) throw new ErrorHttp(400, n.error);
    nombre = n.nombre;
  }
  if (body.color !== undefined) {
    const c = validarColor(body.color);
    if (!c.ok) throw new ErrorHttp(400, c.error);
    color = c.color;
  }
  try {
    const e = await repo.actualizarEtiqueta(getSql(), id, { nombre, color });
    if (!e) throw new ErrorHttp(404, 'Etiqueta no encontrada.');
    return e;
  } catch (err) {
    if (err instanceof ErrorHttp) throw err;
    if (err?.code === '23505') throw new ErrorHttp(409, 'Ya existe una etiqueta con ese nombre.');
    throw err;
  }
}

export async function eliminarEtiqueta(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id de la etiqueta.');
  const ok = await repo.eliminarEtiqueta(getSql(), id);
  if (!ok) throw new ErrorHttp(404, 'Etiqueta no encontrada.');
  return { ok: true };
}

/* ---------- diagramas ---------- */

export async function listarDiagramas(query) {
  const q = query.q || null;
  const grupoId = query.grupo || query.grupo_id || null;
  const etiquetaId = query.etiqueta || query.etiqueta_id || null;
  const archivados = query.archivados === '1' || query.archivados === 'true';
  return repo.listarDiagramas(getSql(), { q, grupoId, etiquetaId, archivados });
}

export async function obtenerDiagrama(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del diagrama.');
  const d = await repo.obtenerDiagrama(getSql(), id);
  if (!d) throw new ErrorHttp(404, 'Diagrama no encontrado.');
  return d;
}

export async function crearDiagrama(body) {
  const tituloIn = body.titulo ?? body.modelo?.title ?? 'Nuevo diagrama';
  const t = validarTitulo(tituloIn);
  if (!t.ok) throw new ErrorHttp(400, t.error);

  const tipoRaw = body.tipo || 'swimlane';
  const tipo = validarTipo(tipoRaw);
  if (!tipo.ok) throw new ErrorHttp(400, tipo.error);

  let modelo;
  if (body.modelo) {
    const n = normalizeModelo(body.modelo);
    if (!n.ok) throw new ErrorHttp(400, n.error);
    modelo = { ...n.modelo, title: n.modelo.title || t.titulo };
  } else {
    modelo = modeloVacio(t.titulo);
  }

  const grupoId = body.grupo_id || null;
  return repo.crearDiagrama(getSql(), {
    titulo: t.titulo,
    tipo: tipo.tipo,
    grupoId,
    modelo,
  });
}

export async function actualizarDiagrama(id, body) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del diagrama.');
  if (body.revision == null) {
    throw new ErrorHttp(400, 'Debes enviar "revision" para guardar sin pisar cambios.');
  }

  const patch = { revision: Number(body.revision) };

  if (body.titulo !== undefined) {
    const t = validarTitulo(body.titulo);
    if (!t.ok) throw new ErrorHttp(400, t.error);
    patch.titulo = t.titulo;
  }

  if (body.grupo_id !== undefined) {
    patch.grupo_id = body.grupo_id || null;
  }

  if (body.modelo !== undefined) {
    const n = normalizeModelo(body.modelo);
    if (!n.ok) throw new ErrorHttp(400, n.error);
    patch.modelo = n.modelo;
    if (body.titulo === undefined && n.modelo.title) {
      patch.titulo = n.modelo.title;
    }
  }

  if (body.archived === true) patch.archived_at = new Date().toISOString();
  if (body.archived === false) patch.archived_at = null;
  if (body.archived_at !== undefined) patch.archived_at = body.archived_at;

  if (body.etiqueta_ids !== undefined) {
    if (!Array.isArray(body.etiqueta_ids)) {
      throw new ErrorHttp(400, 'etiqueta_ids debe ser un array de ids.');
    }
    patch.etiqueta_ids = body.etiqueta_ids;
  }

  const r = await repo.actualizarDiagrama(getSql(), id, patch);
  if (r.missing) throw new ErrorHttp(404, 'Diagrama no encontrado.');
  if (r.conflicto) {
    throw new ErrorHttp(
      409,
      'Alguien más guardó este diagrama. Recarga antes de seguir editando.',
      { revision: r.revision },
    );
  }
  return r.diagrama;
}

export async function duplicarDiagrama(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del diagrama.');
  const d = await repo.duplicarDiagrama(getSql(), id);
  if (!d) throw new ErrorHttp(404, 'Diagrama no encontrado.');
  return d;
}

export async function eliminarDiagrama(id) {
  if (!id) throw new ErrorHttp(400, 'Falta el id del diagrama.');
  const ok = await repo.eliminarDiagrama(getSql(), id);
  if (!ok) throw new ErrorHttp(404, 'Diagrama no encontrado.');
  return { ok: true };
}
