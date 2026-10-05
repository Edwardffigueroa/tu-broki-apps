/**
 * Acceso a datos del schema `diagramas`.
 */

function iso(d) {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function mapGrupo(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    color: r.color ?? null,
    orden: Number(r.orden) || 0,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function mapEtiqueta(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    color: r.color ?? null,
    created_at: iso(r.created_at),
  };
}

function mapDiagramaResumen(r) {
  return {
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    grupo_id: r.grupo_id ?? null,
    revision: Number(r.revision) || 1,
    archived_at: iso(r.archived_at),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    etiquetas: r.etiquetas || [],
  };
}

function mapDiagrama(r) {
  return {
    ...mapDiagramaResumen(r),
    modelo: r.modelo,
  };
}

async function etiquetasDeDiagramas(sql, ids) {
  if (!ids.length) return new Map();
  const filas = await sql`
    select de.diagrama_id, e.id, e.nombre, e.color, e.created_at
    from diagramas.diagrama_etiquetas de
    join diagramas.etiquetas e on e.id = de.etiqueta_id
    where de.diagrama_id in ${sql(ids)}
    order by e.nombre
  `;
  const map = new Map();
  for (const f of filas) {
    const list = map.get(f.diagrama_id) || [];
    list.push(mapEtiqueta(f));
    map.set(f.diagrama_id, list);
  }
  return map;
}

/* ---------- grupos ---------- */

export async function listarGrupos(sql) {
  const filas = await sql`
    select id, nombre, color, orden, created_at, updated_at
    from diagramas.grupos
    order by orden, nombre
  `;
  return filas.map(mapGrupo);
}

export async function crearGrupo(sql, { nombre, color, orden }) {
  const [r] = await sql`
    insert into diagramas.grupos (nombre, color, orden)
    values (${nombre}, ${color}, ${orden ?? 0})
    returning id, nombre, color, orden, created_at, updated_at
  `;
  return mapGrupo(r);
}

export async function actualizarGrupo(sql, id, patch) {
  const [cur] = await sql`
    select id, nombre, color, orden, created_at, updated_at
    from diagramas.grupos where id = ${id}
  `;
  if (!cur) return null;
  const nombre = patch.nombre !== undefined ? patch.nombre : cur.nombre;
  const color = patch.color !== undefined ? patch.color : cur.color;
  const orden = patch.orden !== undefined ? patch.orden : cur.orden;
  const [r] = await sql`
    update diagramas.grupos
    set nombre = ${nombre}, color = ${color}, orden = ${orden}, updated_at = now()
    where id = ${id}
    returning id, nombre, color, orden, created_at, updated_at
  `;
  return mapGrupo(r);
}

export async function eliminarGrupo(sql, id) {
  const [r] = await sql`
    delete from diagramas.grupos where id = ${id}
    returning id
  `;
  return Boolean(r);
}

/* ---------- etiquetas ---------- */

export async function listarEtiquetas(sql) {
  const filas = await sql`
    select id, nombre, color, created_at
    from diagramas.etiquetas
    order by nombre
  `;
  return filas.map(mapEtiqueta);
}

export async function crearEtiqueta(sql, { nombre, color }) {
  const [r] = await sql`
    insert into diagramas.etiquetas (nombre, color)
    values (${nombre}, ${color})
    returning id, nombre, color, created_at
  `;
  return mapEtiqueta(r);
}

export async function actualizarEtiqueta(sql, id, patch) {
  const [cur] = await sql`
    select id, nombre, color, created_at from diagramas.etiquetas where id = ${id}
  `;
  if (!cur) return null;
  const nombre = patch.nombre !== undefined ? patch.nombre : cur.nombre;
  const color = patch.color !== undefined ? patch.color : cur.color;
  const [r] = await sql`
    update diagramas.etiquetas
    set nombre = ${nombre}, color = ${color}
    where id = ${id}
    returning id, nombre, color, created_at
  `;
  return mapEtiqueta(r);
}

export async function eliminarEtiqueta(sql, id) {
  const [r] = await sql`
    delete from diagramas.etiquetas where id = ${id}
    returning id
  `;
  return Boolean(r);
}

/* ---------- diagramas ---------- */

export async function listarDiagramas(sql, { q, grupoId, etiquetaId, archivados } = {}) {
  const incluirArchivados = archivados === true;
  const like = q && q.trim() ? `%${q.trim()}%` : null;

  // Filtros compuestos: ramas explícitas (postgres.js no arma WHERE dinámico fácilmente).
  let filas;
  if (etiquetaId && grupoId && like) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      join diagramas.diagrama_etiquetas de on de.diagrama_id = d.id
      where de.etiqueta_id = ${etiquetaId} and d.grupo_id = ${grupoId} and d.titulo ilike ${like}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (etiquetaId && grupoId) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      join diagramas.diagrama_etiquetas de on de.diagrama_id = d.id
      where de.etiqueta_id = ${etiquetaId} and d.grupo_id = ${grupoId}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (etiquetaId && like) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      join diagramas.diagrama_etiquetas de on de.diagrama_id = d.id
      where de.etiqueta_id = ${etiquetaId} and d.titulo ilike ${like}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (etiquetaId) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      join diagramas.diagrama_etiquetas de on de.diagrama_id = d.id
      where de.etiqueta_id = ${etiquetaId}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (grupoId && like) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      where d.grupo_id = ${grupoId} and d.titulo ilike ${like}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (grupoId) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      where d.grupo_id = ${grupoId}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else if (like) {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      where d.titulo ilike ${like}
        and (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  } else {
    filas = await sql`
      select d.id, d.titulo, d.tipo, d.grupo_id, d.revision, d.archived_at, d.created_at, d.updated_at
      from diagramas.diagramas d
      where (${incluirArchivados} or d.archived_at is null)
      order by d.updated_at desc`;
  }

  const tags = await etiquetasDeDiagramas(
    sql,
    filas.map((f) => f.id),
  );
  return filas.map((f) => mapDiagramaResumen({ ...f, etiquetas: tags.get(f.id) || [] }));
}

export async function obtenerDiagrama(sql, id) {
  const [r] = await sql`
    select id, titulo, tipo, grupo_id, modelo, revision, archived_at, created_at, updated_at
    from diagramas.diagramas
    where id = ${id}
  `;
  if (!r) return null;
  const tags = await etiquetasDeDiagramas(sql, [id]);
  return mapDiagrama({ ...r, etiquetas: tags.get(id) || [] });
}

export async function crearDiagrama(sql, { titulo, tipo, grupoId, modelo }) {
  const [r] = await sql`
    insert into diagramas.diagramas (titulo, tipo, grupo_id, modelo)
    values (${titulo}, ${tipo}, ${grupoId}, ${sql.json(modelo)})
    returning id, titulo, tipo, grupo_id, modelo, revision, archived_at, created_at, updated_at
  `;
  return mapDiagrama({ ...r, etiquetas: [] });
}

/**
 * Actualiza metadatos y/o modelo con control de concurrencia optimista.
 * Devuelve { ok: true, diagrama } | { ok: false, conflicto: true, revision } | { ok: false, missing: true }
 */
export async function actualizarDiagrama(sql, id, patch) {
  return sql.begin(async (tx) => {
    const [cur] = await tx`
      select id, titulo, tipo, grupo_id, modelo, revision, archived_at, created_at, updated_at
      from diagramas.diagramas
      where id = ${id}
      for update
    `;
    if (!cur) return { ok: false, missing: true };

    if (patch.revision != null && Number(patch.revision) !== Number(cur.revision)) {
      return { ok: false, conflicto: true, revision: Number(cur.revision) };
    }

    const titulo = patch.titulo !== undefined ? patch.titulo : cur.titulo;
    const grupoId = patch.grupo_id !== undefined ? patch.grupo_id : cur.grupo_id;
    const modelo = patch.modelo !== undefined ? patch.modelo : cur.modelo;
    const archivedAt =
      patch.archived_at !== undefined ? patch.archived_at : cur.archived_at;
    const bump = patch.modelo !== undefined || patch.titulo !== undefined;

    const [r] = await tx`
      update diagramas.diagramas
      set
        titulo = ${titulo},
        grupo_id = ${grupoId},
        modelo = ${tx.json(modelo)},
        archived_at = ${archivedAt},
        revision = revision + ${bump ? 1 : 0},
        updated_at = now()
      where id = ${id}
      returning id, titulo, tipo, grupo_id, modelo, revision, archived_at, created_at, updated_at
    `;

    if (patch.etiqueta_ids !== undefined) {
      await tx`delete from diagramas.diagrama_etiquetas where diagrama_id = ${id}`;
      for (const eid of patch.etiqueta_ids) {
        await tx`
          insert into diagramas.diagrama_etiquetas (diagrama_id, etiqueta_id)
          values (${id}, ${eid})
          on conflict do nothing
        `;
      }
    }

    const tags = await etiquetasDeDiagramas(tx, [id]);
    return { ok: true, diagrama: mapDiagrama({ ...r, etiquetas: tags.get(id) || [] }) };
  });
}

export async function duplicarDiagrama(sql, id) {
  const origen = await obtenerDiagrama(sql, id);
  if (!origen) return null;

  const copia = await crearDiagrama(sql, {
    titulo: `${origen.titulo} (copia)`,
    tipo: origen.tipo,
    grupoId: origen.grupo_id,
    modelo: {
      ...origen.modelo,
      title: `${origen.modelo?.title || origen.titulo} (copia)`,
    },
  });

  if (origen.etiquetas?.length) {
    const ids = origen.etiquetas.map((e) => e.id);
    await actualizarDiagrama(sql, copia.id, {
      revision: copia.revision,
      etiqueta_ids: ids,
    });
    return obtenerDiagrama(sql, copia.id);
  }
  return copia;
}

export async function eliminarDiagrama(sql, id) {
  const [r] = await sql`
    delete from diagramas.diagramas where id = ${id}
    returning id
  `;
  return Boolean(r);
}
