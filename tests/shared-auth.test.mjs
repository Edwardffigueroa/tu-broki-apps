import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearToken,
  verificarToken,
  emailPermitido,
  emailsPermitidos,
  normalizarEmail,
  leerCookie,
  cookieSesion,
  COOKIE,
} from '../shared/auth.js';

const SECRETO = 'secreto-de-prueba';
const LISTA = 'edward@example.com, SOPORTE@Tubroki.com ,otro@test.com';

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

describe('auth: allowlist y cookie', () => {
  it('normaliza y valida emails de la allowlist', () => {
    assert.equal(normalizarEmail('  Edward@Example.com '), 'edward@example.com');
    assert.equal(emailPermitido('edward@example.com', LISTA), true);
    assert.equal(emailPermitido('SOPORTE@tubroki.com', LISTA), true);
    assert.equal(emailPermitido('intruso@evil.com', LISTA), false);
    assert.equal(emailPermitido('', LISTA), false);
    assert.equal(emailPermitido('no-es-email', LISTA), false);
    assert.equal(emailsPermitidos(LISTA).size, 3);
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
