/**
 * Entrypoint Vercel · contabilidad (1 función).
 */

import { entrypoint } from '../shared/despachar.js';
import * as config from '../handlers/contabilidad/config.js';
import * as exportar from '../handlers/contabilidad/exportar.js';
import * as metas from '../handlers/contabilidad/metas.js';
import * as movimiento from '../handlers/contabilidad/movimiento.js';
import * as movimientos from '../handlers/contabilidad/movimientos.js';

const { GET, POST, PUT, PATCH, DELETE, default: handle } = entrypoint('contabilidad', {
  config,
  exportar,
  metas,
  movimiento,
  movimientos,
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
