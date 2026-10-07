import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recursoDe, despachar } from '../shared/despachar.js';

describe('recursoDe', () => {
  it('lee pathname /api/<dominio>/<recurso>', () => {
    const req = new Request('http://localhost/api/wiki/pages?papelera=1');
    assert.equal(recursoDe(req, 'wiki'), 'pages');
  });

  it('lee __path del rewrite de Vercel', () => {
    const req = new Request('http://localhost/api/wiki?__path=pages&papelera=1');
    assert.equal(recursoDe(req, 'wiki'), 'pages');
  });

  it('rechaza paths anidados o vacíos', () => {
    assert.equal(recursoDe(new Request('http://localhost/api/wiki/'), 'wiki'), null);
    assert.equal(recursoDe(new Request('http://localhost/api/wiki/a/b'), 'wiki'), null);
    assert.equal(recursoDe(new Request('http://localhost/api/auth/sesion'), 'wiki'), null);
  });
});

describe('despachar', () => {
  const rutas = {
    ping: {
      GET: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    },
  };

  it('enruta método al handler del recurso', async () => {
    const res = await despachar(new Request('http://x/api/wiki/ping'), 'wiki', rutas);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('404 si el recurso no existe', async () => {
    const res = await despachar(new Request('http://x/api/wiki/nope'), 'wiki', rutas);
    assert.equal(res.status, 404);
  });

  it('405 si el método no está exportado', async () => {
    const res = await despachar(new Request('http://x/api/wiki/ping', { method: 'POST' }), 'wiki', rutas);
    assert.equal(res.status, 405);
  });
});
