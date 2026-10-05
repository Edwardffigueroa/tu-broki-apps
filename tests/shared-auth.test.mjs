import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearToken,
  verificarToken,
  claveValida,
  leerCookie,
  cookieSesion,
  COOKIE,
} from '../shared/auth.js';

const SECRETO = 'secreto-de-prueba';

describe('auth: tokens firmados', () => {
  it('crea y verifica un token válido', () => {
    const t = crearToken(SECRETO);
    assert.equal(verificarToken(t, SECRETO), true);
  });

  it('rechaza un token con otro secreto', () => {
    const t = crearToken(SECRETO);
    assert.equal(verificarToken(t, 'otro'), false);
  });

  it('rechaza un token manipulado o vacío', () => {
    const t = crearToken(SECRETO);
    assert.equal(verificarToken(t.replace(/.$/, 'x'), SECRETO), false);
    assert.equal(verificarToken('', SECRETO), false);
    assert.equal(verificarToken(null, SECRETO), false);
    assert.equal(verificarToken('abc.def', SECRETO), false);
  });

  it('rechaza un token vencido', () => {
    const hace40dias = Date.now() - 40 * 24 * 3600 * 1000;
    const t = crearToken(SECRETO, hace40dias);
    assert.equal(verificarToken(t, SECRETO), false);
  });
});

describe('auth: clave y cookie', () => {
  it('compara la clave en tiempo constante', () => {
    assert.equal(claveValida('abc', 'abc'), true);
    assert.equal(claveValida('abd', 'abc'), false);
    assert.equal(claveValida('', 'abc'), false);
    assert.equal(claveValida(undefined, 'abc'), false);
  });

  it('lee la cookie de sesión del header', () => {
    const req = new Request('http://x/', { headers: { cookie: `a=1; ${COOKIE}=tok.en; b=2` } });
    assert.equal(leerCookie(req), 'tok.en');
    assert.equal(leerCookie(new Request('http://x/')), null);
  });

  it('la cookie es httpOnly, path raíz y SameSite=Lax', () => {
    const c = cookieSesion('t.k');
    assert.match(c, /HttpOnly/);
    assert.match(c, /Path=\//);
    assert.match(c, /SameSite=Lax/);
    assert.match(c, new RegExp(`^${COOKIE}=`));
  });
});
