/**
 * Crea la categoría «Biblioteca de documentos» con 1 imagen, 1 PDF y 1 HTML.
 *
 *   node scripts/seed-wiki-documentos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4747';
const RAIZ = path.resolve(import.meta.dirname, '..');

function cargarEnv() {
  const f = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
cargarEnv();

let cookie = '';

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const texto = await r.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = texto;
  }
  if (r.status >= 400) throw new Error(`${metodo} ${ruta} → ${r.status} ${JSON.stringify(json)}`);
  return json;
}

async function mapaPorTitulo() {
  const { pages } = await pedir('/api/wiki/pages');
  return new Map(pages.map((p) => [p.title, p]));
}

async function asegurarPagina({ title, parentId = null, content, message }) {
  const mapa = await mapaPorTitulo();
  let page = mapa.get(title);
  if (!page) {
    page = await pedir('/api/wiki/pages', {
      metodo: 'POST',
      cuerpo: { title, parent_id: parentId, content: content || '', message },
    });
    console.log(`  + página  ${title}`);
  } else {
    console.log(`  · existe  ${title}`);
    page = await pedir(`/api/wiki/page?id=${page.id}`);
  }
  if (content != null) {
    await pedir(`/api/wiki/draft?id=${page.id}`, {
      metodo: 'PUT',
      cuerpo: {
        content,
        draft_revision: page.draft_revision ?? 0,
        base_version_id: page.current_version_id,
      },
    });
    const fresca = await pedir(`/api/wiki/page?id=${page.id}`);
    try {
      await pedir(`/api/wiki/versions?id=${page.id}`, {
        metodo: 'POST',
        cuerpo: { base_version_id: fresca.current_version_id, message: message || 'Ejemplo' },
      });
    } catch (e) {
      if (!String(e.message).includes('no_changes')) throw e;
    }
  }
  return pedir(`/api/wiki/page?id=${page.id}`);
}

async function asegurarDocumento({ title, parentId, mime, base64, originalName, note }) {
  const mapa = await mapaPorTitulo();
  if (mapa.has(title)) {
    console.log(`  · doc     ${title}`);
    return mapa.get(title);
  }
  const page = await pedir('/api/wiki/documents', {
    metodo: 'POST',
    cuerpo: {
      title,
      parent_id: parentId,
      mime_type: mime,
      base64,
      original_name: originalName,
      note: note || '',
    },
  });
  console.log(`  + doc     ${title} (${mime})`);
  return page;
}

// PNG 64x40 azul simple
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABWbiRPAAAAhElEQVRoge3OMQ0AIAwAsVFcRf8sDRISGDjA3Z3MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMwH5gMAvQABFwAAAABJRU5ErkJggg==';

// PDF mínimo válido
const PDF_B64 = Buffer.from(
  `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 40 90 Td (TuBroki Wiki - Documento PDF de ejemplo) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000384 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
461
%%EOF`,
).toString('base64');

const HTML_B64 = Buffer.from(
  `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ficha de ejemplo · TuBroki</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;color:#0F172A;background:#F8FAFC}
  h1{color:#4338CA;font-size:22px}
  .card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;max-width:480px}
  .tag{display:inline-block;background:#EEF2FF;color:#4338CA;font-weight:700;font-size:12px;padding:2px 8px;border-radius:999px}
</style>
</head>
<body>
  <div class="card">
    <span class="tag">Ejemplo HTML</span>
    <h1>Ficha de inmueble</h1>
    <p>Este HTML vive como <strong>página-documento</strong> en el árbol de la Wiki.</p>
    <ul>
      <li>Canon: $2.000.000 COP</li>
      <li>Ciudad: Bogotá</li>
      <li>PACK sugerido: PACK 3</li>
    </ul>
    <p><em>Se previsualiza en un iframe sin scripts (sandbox).</em></p>
  </div>
</body>
</html>`,
  'utf8',
).toString('base64');

const GUIA = `# Cómo subir documentos

Los PDF, HTML e imágenes pueden vivir como **hijas** de cualquier categoría del árbol
(no solo embebidos en Markdown).

## Cómo hacerlo

1. Abre o crea la página madre (esta Biblioteca, por ejemplo).
2. Pulsa **📎** en la barra lateral, o arrastra el archivo sobre un nodo del árbol.
3. Se crea una página-documento con icono según el tipo.
4. Al abrirla ves el **visor** (imagen, PDF o HTML en sandbox) + notas opcionales.

## Qué admite

| Tipo | Preview |
|---|---|
| JPEG / PNG / GIF / WebP | Visor + lightbox |
| PDF | iframe |
| HTML | iframe \`sandbox\` sin scripts |

Máximo **3 MB** por archivo.

## Ejemplos en esta categoría

Mira las hijas de [[Biblioteca de documentos]]: imagen, PDF y HTML de demo.
`;

async function main() {
  console.log(`\nSeed documentos → ${BASE}\n`);
  await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { clave: process.env.APPS_PASSWORD },
  });

  const bib = await asegurarPagina({
    title: 'Biblioteca de documentos',
    content: GUIA,
    message: 'Hub de documentos',
  });

  // Colgarla bajo Bienvenida si existe.
  const mapa = await mapaPorTitulo();
  const bienvenida = mapa.get('Bienvenida a la Wiki');
  if (bienvenida && bib.parent_id !== bienvenida.id) {
    await pedir(`/api/wiki/page?id=${bib.id}`, {
      metodo: 'PATCH',
      cuerpo: { parent_id: bienvenida.id },
    });
    console.log('  ↕ Biblioteca bajo Bienvenida');
  }

  await asegurarDocumento({
    title: 'Ejemplo imagen',
    parentId: bib.id,
    mime: 'image/png',
    base64: PNG_B64,
    originalName: 'ejemplo-tubroki.png',
    note: 'Imagen de demostración del visor de documentos.',
  });

  await asegurarDocumento({
    title: 'Ejemplo PDF',
    parentId: bib.id,
    mime: 'application/pdf',
    base64: PDF_B64,
    originalName: 'ejemplo-tubroki.pdf',
    note: 'PDF mínimo para probar el iframe del visor.',
  });

  await asegurarDocumento({
    title: 'Ejemplo HTML',
    parentId: bib.id,
    mime: 'text/html',
    base64: HTML_B64,
    originalName: 'ficha-ejemplo.html',
    note: 'HTML sandboxed: se ve como documento, sin ejecutar scripts.',
  });

  console.log('\nListo. Abre «Biblioteca de documentos» en /wiki\n');
}

main().catch((e) => {
  console.error('\nError:', e.message);
  process.exit(1);
});
