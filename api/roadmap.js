/**
 * Entrypoint Vercel · roadmap (1 función).
 */

import { entrypoint } from '../shared/despachar.js';
import * as tareas from '../handlers/roadmap/tareas.js';
import * as exportar from '../handlers/roadmap/exportar.js';

const { GET, POST, PUT, PATCH, DELETE, default: handle } = entrypoint('roadmap', {
  tareas,
  exportar,
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
