import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recursoDe, despachar, urlDe, requestAbsoluto } from '../shared/despachar.js';

describe('urlDe / requestAbsoluto', () => {
  it('acepta URL relativa como en el runtime de Vercel', () => {
    const req = {
      url: '/api/auth/enviar-codigo?__path=enviar-codigo&path=enviar-codigo',
      headers: new Headers({ host: 'tu-broki-apps.vercel.app', 'x-forwarded-proto': 'https' }),
    };
    const url = urlDe(req);
    assert.equal(url.pathname, '/api/auth/enviar-codigo');
    assert.equal(url.searchParams.get('__path'), 'enviar-codigo');
    assert.equal(url.origin, 'https://tu-broki-apps.vercel.app');
  });

  it('normaliza Request relativo a absoluto', () => {
    const rel = new Request('http://placeholder.local/api/auth/sesion');
    // Simula url relativa sobrescribiendo (Request real siempre es absoluto en Node)
    const fake = { url: '/api/auth/sesion', method: 'GET', headers: new Headers({ host: 'example.com' }) };
    const abs = requestAbsoluto(fake);
    assert.match(abs.url, /^https:\/\/example\.com\/api\/auth\/sesion$/);
    void rel;
  });
});

describe('recursoDe', () => {
  it('lee pathname /api/<dominio>/<recurso>', () => {
    const req = new Request('http://localhost/api/wiki/pages?papelera=1');
    assert.equal(recursoDe(req, 'wiki'), 'pages');
  });

  it('lee __path del rewrite de Vercel', () => {
    const req = new Request('http://localhost/api/wiki?__path=pages&papelera=1');
    assert.equal(recursoDe(req, 'wiki'), 'pages');
  });

  it('acepta path relativo de Vercel + query __path', () => {
    const req = {
      url: '/api/auth/enviar-codigo?__path=enviar-codigo&path=enviar-codigo',
      headers: new Headers({ host: 'x.vercel.app' }),
    };
    assert.equal(recursoDe(req, 'auth'), 'enviar-codigo');
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
