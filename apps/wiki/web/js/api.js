/** Cliente HTTP para /api/wiki/* */

async function pedir(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 401) {
    location.href = '/acceso';
    throw new Error('Sin sesión');
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Error');
      err.status = res.status;
      err.code = data.code;
      err.data = data;
      throw err;
    }
    return data;
  }
  if (!res.ok) {
    const err = new Error('Error de red');
    err.status = res.status;
    throw err;
  }
  return res;
}

export const api = {
  bootstrap: () => pedir('/api/wiki/bootstrap'),
  arbol: (papelera = false) =>
    pedir(`/api/wiki/pages${papelera ? '?papelera=1' : ''}`),
  crear: (body) =>
    pedir('/api/wiki/pages', { method: 'POST', body: JSON.stringify(body) }),
  obtener: (id) => pedir(`/api/wiki/page?id=${encodeURIComponent(id)}`),
  actualizar: (id, body) =>
    pedir(`/api/wiki/page?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  eliminar: (id) =>
    pedir(`/api/wiki/page?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  recuperar: (id) =>
    pedir(`/api/wiki/untrash?id=${encodeURIComponent(id)}`, { method: 'POST' }),
  draft: (id, body) =>
    pedir(`/api/wiki/draft?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  descartarDraft: (id) =>
    pedir(`/api/wiki/draft?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  versiones: (id) =>
    pedir(`/api/wiki/versions?id=${encodeURIComponent(id)}`),
  version: (id, vid) =>
    pedir(`/api/wiki/versions?id=${encodeURIComponent(id)}&vid=${encodeURIComponent(vid)}`),
  guardar: (id, body) =>
    pedir(`/api/wiki/versions?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  restaurar: (id, vid) =>
    pedir(
      `/api/wiki/versions?id=${encodeURIComponent(id)}&vid=${encodeURIComponent(vid)}&accion=restaurar`,
      { method: 'POST' },
    ),
  backlinks: (id) =>
    pedir(`/api/wiki/backlinks?id=${encodeURIComponent(id)}`),
  search: (q) =>
    pedir(`/api/wiki/search?q=${encodeURIComponent(q)}`),
  assetUrl: (id) => `/api/wiki/assets?id=${encodeURIComponent(id)}`,
  crearDocumento: async (file, { parentId = null, title = null, note = '' } = {}) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return pedir('/api/wiki/documents', {
      method: 'POST',
      body: JSON.stringify({
        title: title || file.name.replace(/\.[^.]+$/, ''),
        parent_id: parentId,
        mime_type: file.type || 'application/octet-stream',
        original_name: file.name,
        base64: btoa(binary),
        note,
      }),
    });
  },
  reemplazarDocumento: async (id, file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return pedir(`/api/wiki/documents?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        mime_type: file.type || 'application/octet-stream',
        original_name: file.name,
        base64: btoa(binary),
      }),
    });
  },
  subirAsset: async (file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return pedir('/api/wiki/assets', {
      method: 'POST',
      body: JSON.stringify({
        mime_type: file.type || 'application/octet-stream',
        original_name: file.name,
        base64,
      }),
    });
  },
  importar: (body) =>
    pedir('/api/wiki/import', { method: 'POST', body: JSON.stringify(body) }),
  exportar: () => pedir('/api/wiki/export', { method: 'POST' }),
};
