/**
 * GET /api/contabilidad/exportar — CSV de movimientos
 */

import { manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { exportarCsv } from '../../apps/contabilidad/server/servicio.js';
import { curMonthKey } from '../../apps/contabilidad/lib/finanzas.mjs';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const csv = await exportarCsv();
  const filename = `TuBroki_movimientos_${curMonthKey()}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
