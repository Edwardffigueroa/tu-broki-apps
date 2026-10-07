/**
 * Entrypoint Vercel · auth (1 función).
 * URLs: /api/auth/{enviar-codigo,verificar,sesion,logout}
 */

import { entrypoint } from '../shared/despachar.js';
import * as enviarCodigo from '../handlers/auth/enviar-codigo.js';
import * as verificar from '../handlers/auth/verificar.js';
import * as sesion from '../handlers/auth/sesion.js';
import * as logout from '../handlers/auth/logout.js';

const { GET, POST, PUT, PATCH, DELETE, default: handle } = entrypoint('auth', {
  'enviar-codigo': enviarCodigo,
  verificar,
  sesion,
  logout,
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
