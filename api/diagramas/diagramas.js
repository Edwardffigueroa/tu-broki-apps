/**
 * GET  /api/diagramas/diagramas?q=&grupo=&etiqueta=&archivados=
 * POST /api/diagramas/diagramas  { titulo?, tipo?, grupo_id?, modelo? }
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { listarDiagramas, crearDiagrama } from '../../apps/diagramas/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const url = new URL(request.url);
  const diagramas = await listarDiagramas({
    q: url.searchParams.get('q'),
    grupo: url.searchParams.get('grupo'),
    etiqueta: url.searchParams.get('etiqueta'),
    archivados: url.searchParams.get('archivados'),
  });
  return json(200, { diagramas });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const diagrama = await crearDiagrama(body);
  return json(201, diagrama);
});
