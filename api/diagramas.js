/**
 * Entrypoint Vercel · diagramas (1 función).
 */

import { entrypoint } from '../shared/despachar.js';
import * as diagrama from '../handlers/diagramas/diagrama.js';
import * as diagramas from '../handlers/diagramas/diagramas.js';
import * as duplicar from '../handlers/diagramas/duplicar.js';
import * as etiquetas from '../handlers/diagramas/etiquetas.js';
import * as grupos from '../handlers/diagramas/grupos.js';

const { GET, POST, PUT, PATCH, DELETE, default: handle } = entrypoint('diagramas', {
  diagrama,
  diagramas,
  duplicar,
  etiquetas,
  grupos,
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
