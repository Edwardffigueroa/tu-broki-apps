/**
 * Utilidades HTTP para las funciones de `api/` (firma Web: Request → Response).
 */

export class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function leerJson(request) {
  try {
    const texto = await request.text();
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErrorHttp(400, 'El cuerpo debe ser JSON válido.');
  }
}

/**
 * Envuelve un handler: convierte errores en respuestas JSON coherentes.
 * `ErrorHttp` conserva su status; cualquier otro error es 500 sin filtrar detalles.
 */
export function manejar(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (e) {
      if (e instanceof ErrorHttp) {
        return json(e.status, { error: e.message, ...e.extra });
      }
      console.error(e);
      return json(500, { error: 'Error interno. Inténtalo de nuevo en un momento.' });
    }
  };
}
