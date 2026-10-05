/**
 * GET /api/roadmap/exportar → descarga tareas.csv (UTF-8 con BOM).
 */

import { manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { exportarCsv } from '../../apps/roadmap/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const csv = await exportarCsv();
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="roadmap-tubroki-${fecha}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
