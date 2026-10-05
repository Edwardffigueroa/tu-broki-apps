/**
 * Importa el vault Obsidian (carpeta Tubroki) a la Wiki.
 *
 * - Vacía la wiki si CONFIRM_WIPE=1
 * - Excluye repos de código, research, meta Obsidian/agentes
 * - MD tal cual (solo reescribe embeds locales → asset:UUID)
 * - Binarios como kind=file
 * - Crea «Índice del conocimiento Tubroki» (ex-CLAUDE.md)
 *
 *   CONFIRM_WIPE=1 node scripts/import-vault-wiki.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APPS_ROOT = path.resolve(SCRIPT_DIR, '..');
const VAULT_ROOT = path.resolve(APPS_ROOT, '../..'); // …/Tubroki

function cargarEnv() {
  const f = path.join(APPS_ROOT, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}
cargarEnv();

const { getSql, cerrarSql } = await import(pathToFileURL(path.join(APPS_ROOT, 'shared/db.js')).href);
const repo = await import(pathToFileURL(path.join(APPS_ROOT, 'apps/wiki/server/repositorio.js')).href);
const {
  AUTOR,
  MAX_ASSET,
  mimeDesdeNombre,
  normalizarMime,
  iconoPorMime,
  validarAsset,
} = await import(pathToFileURL(path.join(APPS_ROOT, 'apps/wiki/server/modelo.js')).href);
const { parseFrontmatter, extractWikilinks, normalizeTitle } = await import(
  pathToFileURL(path.join(APPS_ROOT, 'apps/wiki/server/markdown.js')).href
);

const EXCLUDE_DIR_NAMES = new Set([
  '.git',
  '.obsidian',
  '.claude',
  '.agents',
  '.cursor',
  '.trae',
  '.vscode',
  '.pnpm-store',
  'node_modules',
  'tu-broki-app',
  'tu-broki-apps',
  'tu-broki-landing',
  'mvp-estimador-arriendos',
  'research',
  'worktrees',
]);

const EXCLUDE_FILE_EXACT = new Set([
  'CLAUDE.md',
  'tubroki-vault.plugin',
  '.gitignore',
  '.DS_Store',
  'tu-broki.code-workspace',
]);

const CODE_EXTS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.scss',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.prisma',
  '.lock',
  '.map',
]);

const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
  '.html',
  '.htm',
  '.txt',
  '.csv',
  '.json',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
]);

const reporte = {
  folders: 0,
  md: 0,
  files: 0,
  assets: 0,
  omitted: [],
  titleCollisions: [],
  unresolvedLinks: [],
};

function relPosix(abs) {
  return path.relative(VAULT_ROOT, abs).split(path.sep).join('/');
}

function debeExcluirDir(nombre, relDir) {
  if (EXCLUDE_DIR_NAMES.has(nombre)) return true;
  if (nombre.startsWith('.') && nombre !== '.') return true;
  // research solo bajo 03-tecnologia (EXCLUDE_DIR_NAMES ya cubre 'research')
  if (/obsidian/i.test(nombre) || /PLAN.?OBSIDIAN/i.test(nombre)) return true;
  if (relDir.includes('/worktrees/') || relDir.startsWith('worktrees/')) return true;
  return false;
}

function debeExcluirArchivo(nombre, rel) {
  if (EXCLUDE_FILE_EXACT.has(nombre)) return true;
  if (nombre.startsWith('.')) return true;
  if (nombre.endsWith('.code-workspace')) return true;
  if (nombre.endsWith('.tmp') || nombre.endsWith('.pdf#')) return true;
  if (/obsidian/i.test(nombre) || /PLAN.?OBSIDIAN/i.test(nombre)) return true;
  if (nombre.endsWith('.base') || nombre.endsWith('.canvas') || nombre.endsWith('.plugin')) {
    return true;
  }
  const ext = path.extname(nombre).toLowerCase();
  if (CODE_EXTS.has(ext)) return true;
  // Solo MD + binarios permitidos
  if (ext === '.md') return false;
  if (BINARY_EXTS.has(ext)) return false;
  return true;
}

function walkVault() {
  const folders = new Set();
  const mdFiles = [];
  const binFiles = [];

  function walk(absDir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (e) {
      reporte.omitted.push({ path: relDir || '.', reason: e.message });
      return;
    }
    for (const ent of entries) {
      const name = ent.name;
      const abs = path.join(absDir, name);
      const rel = relDir ? `${relDir}/${name}` : name;

      if (ent.isDirectory()) {
        if (debeExcluirDir(name, rel)) continue;
        folders.add(rel);
        walk(abs, rel);
        continue;
      }
      if (!ent.isFile()) continue;
      if (debeExcluirArchivo(name, rel)) {
        const ext = path.extname(name).toLowerCase();
        if (ext && !CODE_EXTS.has(ext) && ext !== '.md' && !BINARY_EXTS.has(ext)) {
          // silencioso para basura conocida
        }
        continue;
      }

      const ext = path.extname(name).toLowerCase();
      if (ext === '.md') {
        mdFiles.push({ abs, rel, name, title: name.replace(/\.md$/i, '') });
      } else if (BINARY_EXTS.has(ext)) {
        binFiles.push({ abs, rel, name, ext });
      }
    }
  }

  walk(VAULT_ROOT, '');
  return { folders: [...folders].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)), mdFiles, binFiles };
}

async function wipeWiki(sql) {
  console.log('Vaciar wiki…');
  // Romper FKs de páginas → versiones antes de borrar versiones.
  await sql`
    update wiki.pages set
      current_version_id = null,
      draft_base_version_id = null,
      draft_title = null,
      draft_content = null,
      draft_revision = 0,
      draft_updated_at = null
  `;
  await sql`delete from wiki.version_assets`;
  await sql`delete from wiki.page_links`;
  await sql`delete from wiki.page_versions`;
  await sql`delete from wiki.pages`;
  await sql`delete from wiki.assets`;
  console.log('  wiki vacía');
}

/** Reconstruye folderId desde páginas ya importadas (RESUME). */
async function rebuildFolderId(sql, folders) {
  const rows = await sql`
    select id, parent_id, title, kind
    from wiki.pages
    where deleted_at is null and kind = 'page'
  `;
  const children = new Map(); // parentKey -> Map<title, id>
  const root = new Map();
  for (const r of rows) {
    const key = r.parent_id || '';
    if (!children.has(key)) children.set(key, new Map());
    children.get(key).set(String(r.title), r.id);
    if (!r.parent_id) root.set(String(r.title), r.id);
  }
  const folderId = new Map();
  for (const f of folders) {
    const parts = f.split('/');
    let parentKey = '';
    let parentId = null;
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i];
      const pathSoFar = parts.slice(0, i + 1).join('/');
      const map = children.get(parentKey) || new Map();
      let id = map.get(name);
      // Colisiones de título de carpeta: Nombre (2)
      if (!id) {
        for (const [t, tid] of map) {
          if (t === name || t.startsWith(`${name} (`)) {
            id = tid;
            break;
          }
        }
      }
      if (!id) {
        ok = false;
        break;
      }
      folderId.set(pathSoFar, id);
      parentId = id;
      parentKey = id;
    }
    if (!ok) {
      // Crear faltantes
      await asegurarCarpeta(sql, f, folderId);
    }
  }
  return folderId;
}

async function listExistingTitlesUnder(sql, parentId) {
  const rows = parentId
    ? await sql`
        select title, kind, asset_id from wiki.pages
        where deleted_at is null and parent_id = ${parentId}
      `
    : await sql`
        select title, kind, asset_id from wiki.pages
        where deleted_at is null and parent_id is null
      `;
  return new Set(rows.map((r) => String(r.title)));
}

async function asegurarCarpeta(sql, folderPath, folderId) {
  if (folderId.has(folderPath)) return folderId.get(folderPath);
  const parts = folderPath.split('/');
  const name = parts[parts.length - 1];
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
  const parentId = parentPath ? await asegurarCarpeta(sql, parentPath, folderId) : null;
  const unico = await repo.sugerirTituloUnico(sql, name);
  if (unico.title !== name) {
    reporte.titleCollisions.push({ wanted: name, got: unico.title, path: folderPath });
  }
  const page = await repo.crearPagina(sql, {
    title: unico.title,
    titleKey: unico.titleKey,
    parentId,
    content: '',
    author: AUTOR,
    source: 'import',
    message: 'Carpeta del vault',
  });
  folderId.set(folderPath, page.id);
  reporte.folders += 1;
  return page.id;
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reescribirEmbeds(content, noteRel, assetByPath, assetByBase) {
  let out = content;

  // ![[filename]] / ![[path/filename]]
  out = out.replace(/!\[\[([^\]]+)\]\]/g, (full, inner) => {
    const raw = String(inner).split('|')[0].trim();
    const key = raw.replace(/\\/g, '/');
    const base = key.split('/').pop();
    const id = assetByPath.get(key) || assetByBase.get(base?.toLowerCase());
    if (!id) return full;
    return `![](asset:${id})`;
  });

  // Markdown links/images with relative or vault paths
  out = out.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (full, pre, href, post) => {
    if (/^(https?:|mailto:|asset:|#|data:)/i.test(href)) return full;
    let decoded = href.split('#')[0].split('?')[0];
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* keep */
    }
    decoded = decoded.replace(/\\/g, '/');
    const noteDir = noteRel.includes('/') ? noteRel.split('/').slice(0, -1).join('/') : '';
    const candidates = [];
    if (decoded.startsWith('/')) candidates.push(decoded.replace(/^\//, ''));
    else {
      candidates.push(decoded);
      if (noteDir) candidates.push(path.posix.normalize(`${noteDir}/${decoded}`));
    }
    let id = null;
    for (const c of candidates) {
      id = assetByPath.get(c) || assetByPath.get(c.replace(/^\.\//, ''));
      if (id) break;
    }
    if (!id) {
      const base = decoded.split('/').pop();
      id = assetByBase.get(base?.toLowerCase());
    }
    if (!id) return full;
    return `${pre}asset:${id}${post}`;
  });

  return out;
}

function construirIndice() {
  return `# Índice del conocimiento Tubroki

> Punto de entrada de la base de conocimiento interna (wiki).
> Actualizado con el catálogo de servicios de octubre 2026 (fuente Mayra).
> Si un precio o nombre de servicio choca con [[Catalogo de Servicios TuBroki]], manda el catálogo.

## Cómo usar este índice

1. Busca primero aquí (precios, mapa, reglas).
2. Si necesitas detalle, ve a la carpeta del mapa.
3. Abre el \`_LEEME\` de esa carpeta cuando exista.

**Una pregunta = una carpeta.** No hace falta recorrer todo el árbol.

---

## El negocio

**Tubroki** es una plataforma inmobiliaria colombiana (Proptech). No somos una inmobiliaria tradicional: somos un **integrador de servicios a la medida**. El propietario paga solo lo que necesita, cuando lo necesita — tarifa fija, sin exclusividad, sin mandato.

| Dato | Valor |
|---|---|
| Razón social | TUBROKI SAS |
| Tagline | "La revolución inmobiliaria ha llegado" |
| Experiencia | +30 años en el sector |
| Etapa | Lanzamiento — validación de mercado |
| Canal principal | Digital: redes → WhatsApp → videollamada |
| WhatsApp | +57 315 094 9989 |
| Email | soporte@tubroki.com |
| Dirección | Carrera 61 # 9-230, Cali, Colombia |

**Equipo:** 2 socios fundadores, operación 100% virtual.

---

## Precios vigentes (oct 2026)

Fuente de verdad: [[Catalogo de Servicios TuBroki]].

| # | Servicio | Aplica | Precio |
|---|---|---|---|
| 1 | Publica gratis en TuBroki | Arriendo y venta | Gratis |
| 2 | Publicación + atención a interesados | Arriendo y venta | $499.000 COP |
| 3 | Todo para arrendar | Arriendo | $629.000 COP |
| 4 | Todo para vender | Venta | $789.000 COP |
| 5 | Validación de antecedentes | Arriendo, venta, compradores | $39.000 COP |
| 6 | Contrato de arrendamiento + firma digital | Arriendo | $199.000 COP |
| 7 | TuBroki Te Cuida (admin mensual + póliza) | Arriendo | $59.000/mes + póliza |
| 8 | Diagnóstico del inmueble (asesoría legal) | Venta | $249.000 COP |
| 9 | Todo para comprar | Compradores | $689.000 COP |

### Reglas no negociables

- Sin comisiones porcentuales al cliente en la oferta de cara al público (tarifas fijas).
- Sin exclusividad ni mandato.
- Precios siempre en COP con punto de miles: \`$629.000 COP\`.
- Arriendos primero, salvo instrucción contraria.
- El propietario realiza las visitas.

### Retirados (no ofrecer)

PACK 1/2 antiguos, estudio de crédito, combos de estudio, inventario/acta sueltos, administración sin póliza, varios add-ons de venta sueltos. Detalle en el catálogo.

---

## Mapa de navegación (carpetas reales del vault)

### Estrategia — [[01-negocio-y-estrategia]]

| Busco | Dónde |
|---|---|
| Visión / modelo / validación / estrategia | Subcarpetas de [[01-negocio-y-estrategia]] |
| Decisiones | \`01-negocio-y-estrategia/05 decisiones/\` |
| Checklist MVP | [[MVP-Checklist-Produccion]] |

### Producto — [[02-producto]]

| Busco | Dónde |
|---|---|
| Catálogo / journeys arriendos | [[02-producto]] → \`01-arriendos/\` · [[ARRIENDOS-CATALOGO MAESTRO DE SERVICIOS]] |
| Ventas / compradores | \`02-producto/02-ventas/\`, \`02-producto/03-compradores/\` |

### Tecnología — [[03-tecnologia]]

| Busco | Dónde |
|---|---|
| Arquitectura app / calculadora / Miro | [[documentacion-tecnica]] |
| Infra | \`03-tecnologia/infraestructura/\` |
| Código | Vive en repos aparte (no en esta wiki) |

### Marketing — [[04-marketing]]

Marca, públicos, contenido, guía fotográfica, material comercial.

### Comercial — [[05-comercial]]

| Busco | Dónde |
|---|---|
| **Catálogo de servicios (fuente de verdad)** | [[Catalogo de Servicios TuBroki]] |
| Planes arriendos / flujos WhatsApp | \`05-comercial/Plan 3 - Arriendos/\` |
| Pipeline / scripts | Carpetas comerciales del árbol |

### Operaciones — [[06-operaciones]]

SOPs, partners, flujos, FAQs.

### Finanzas y legal

- [[07-financiero]] — proyecciones, presupuesto
- [[08-legal]] — contratos, T&C, sociedad
- También existe \`07 admin-finanzas-legal\` (legado / paralelo): preferir las carpetas numeradas claras.

### Equipo — [[09-equipo]]

Reuniones, backlog, tareas.

### Otros — [[otros]]

Notas transversales (cuentas, guía fotográfica, unit economics, etc.).

---

## Tono de marca (resumen)

- Segunda persona, español Colombia, directo, con números reales.
- Empoderador: le devolvemos el control al usuario.
- Nunca sonar a inmobiliaria tradicional ni a corporate vacío.

---

## Partners

Finca Raíz, MetroCuadrado, Proppit · SURA / SBS / Mundial · Trucheck · Calendly — ver carpetas en [[06-operaciones]].

---

*Este índice reemplaza al antiguo \`CLAUDE.md\` del vault Obsidian. El contenido de las notas se importó sin reescribir copy; solo se adaptaron embeds de archivos a la wiki.*
`;
}

async function main() {
  const resume = process.env.RESUME === '1';
  if (!resume && process.env.CONFIRM_WIPE !== '1') {
    console.error(
      'Abortado: CONFIRM_WIPE=1 para import limpio, o RESUME=1 para completar un import interrumpido.',
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL (.env.local).');
    process.exit(1);
  }

  console.log(`Vault: ${VAULT_ROOT}${resume ? ' (RESUME)' : ''}`);
  const { folders, mdFiles, binFiles } = walkVault();
  console.log(`Inventario: ${folders.length} carpetas, ${mdFiles.length} md, ${binFiles.length} archivos`);

  const sql = getSql();
  try {
    let folderId = new Map();
    if (resume) {
      console.log('Reconstruyendo carpetas…');
      folderId = await rebuildFolderId(sql, folders);
      console.log(`  ${folderId.size} carpetas en mapa`);
    } else {
      await wipeWiki(sql);
      console.log('Carpetas…');
      for (const f of folders) {
        await asegurarCarpeta(sql, f, folderId);
        if (reporte.folders % 25 === 0) process.stdout.write(`  ${reporte.folders} carpetas\r`);
      }
      console.log(`  ${reporte.folders} carpetas`);
    }

    // Assets + file pages
    const assetByPath = new Map();
    const assetByBase = new Map();
    console.log('Archivos binarios…');
    for (const [i, file] of binFiles.entries()) {
      try {
        const parentRel = file.rel.includes('/')
          ? file.rel.split('/').slice(0, -1).join('/')
          : null;
        const parentId = parentRel ? folderId.get(parentRel) || null : null;
        const existing = await listExistingTitlesUnder(sql, parentId);
        if (resume && (existing.has(file.name) || [...existing].some((t) => t.startsWith(`${file.name} (`)))) {
          // Recuperar asset_id si existe
          const rows = parentId
            ? await sql`
                select a.id, a.original_name from wiki.pages p
                join wiki.assets a on a.id = p.asset_id
                where p.deleted_at is null and p.parent_id = ${parentId} and p.kind = 'file'
                  and (p.title = ${file.name} or p.title like ${file.name + ' (%'})
                limit 1
              `
            : await sql`
                select a.id, a.original_name from wiki.pages p
                join wiki.assets a on a.id = p.asset_id
                where p.deleted_at is null and p.parent_id is null and p.kind = 'file'
                  and (p.title = ${file.name} or p.title like ${file.name + ' (%'})
                limit 1
              `;
          if (rows[0]) {
            assetByPath.set(file.rel, rows[0].id);
            assetByBase.set(file.name.toLowerCase(), rows[0].id);
          }
          continue;
        }

        const buf = fs.readFileSync(file.abs);
        const mime = normalizarMime(mimeDesdeNombre(file.name) || 'application/octet-stream', file.name);
        const v = validarAsset({ mimeType: mime, buffer: buf });
        if (!v.ok) {
          reporte.omitted.push({ path: file.rel, reason: v.error });
          continue;
        }
        const asset = await repo.upsertAsset(sql, {
          buffer: buf,
          mimeType: mime,
          originalName: file.name,
        });
        assetByPath.set(file.rel, asset.id);
        assetByBase.set(file.name.toLowerCase(), asset.id);
        reporte.assets += 1;

        const titleBase = file.name;
        const unico = await repo.sugerirTituloUnico(sql, titleBase);
        if (unico.title !== titleBase) {
          reporte.titleCollisions.push({ wanted: titleBase, got: unico.title, path: file.rel });
        }
        await repo.crearPaginaArchivo(sql, {
          title: unico.title,
          titleKey: unico.titleKey,
          parentId,
          icon: iconoPorMime(mime),
          assetId: asset.id,
          note: '',
          author: AUTOR,
          originalName: file.name,
        });
        reporte.files += 1;
      } catch (e) {
        reporte.omitted.push({ path: file.rel, reason: e.message });
      }
      if ((i + 1) % 20 === 0 || i === binFiles.length - 1) {
        process.stdout.write(`  binarios ${i + 1}/${binFiles.length}\r`);
      }
    }
    console.log(`  +${reporte.files} file-pages · +${reporte.assets} assets`);

    // Markdown pages
    console.log('Páginas Markdown…');
    const titleKeyToId = new Map();
    const allPages = await sql`
      select id, title_key from wiki.pages where deleted_at is null
    `;
    for (const r of allPages) titleKeyToId.set(r.title_key, r.id);

    for (const [i, note] of mdFiles.entries()) {
      try {
        const parentRel = note.rel.includes('/')
          ? note.rel.split('/').slice(0, -1).join('/')
          : null;
        const parentId = parentRel ? folderId.get(parentRel) || null : null;
        if (resume) {
          const existing = await listExistingTitlesUnder(sql, parentId);
          if (
            existing.has(note.title) ||
            [...existing].some((t) => t === note.title || t.startsWith(`${note.title} (`))
          ) {
            continue;
          }
        }
        const raw = fs.readFileSync(note.abs, 'utf8');
        const { metadata, body } = parseFrontmatter(raw);
        const content = reescribirEmbeds(body, note.rel, assetByPath, assetByBase);
        const unico = await repo.sugerirTituloUnico(sql, note.title);
        if (unico.title !== note.title) {
          reporte.titleCollisions.push({ wanted: note.title, got: unico.title, path: note.rel });
        }
        const page = await repo.crearPagina(sql, {
          title: unico.title,
          titleKey: unico.titleKey,
          parentId,
          metadata: metadata || {},
          content,
          author: AUTOR,
          source: 'import',
          message: 'Importación vault',
        });
        titleKeyToId.set(unico.titleKey, page.id);
        titleKeyToId.set(normalizeTitle(note.title), page.id);
        reporte.md += 1;
      } catch (e) {
        reporte.omitted.push({ path: note.rel, reason: e.message });
      }
      if ((i + 1) % 50 === 0 || i === mdFiles.length - 1) {
        process.stdout.write(`  md ${i + 1}/${mdFiles.length} (+${reporte.md})\r`);
      }
    }
    console.log(`  +${reporte.md} páginas md`);

    // Índice
    console.log('Índice del conocimiento…');
    {
      const rootTitles = await listExistingTitlesUnder(sql, null);
      const tieneIndice = [...rootTitles].some((t) =>
        t.startsWith('Índice del conocimiento Tubroki'),
      );
      if (!tieneIndice) {
        const unico = await repo.sugerirTituloUnico(sql, 'Índice del conocimiento Tubroki');
        const page = await repo.crearPagina(sql, {
          title: unico.title,
          titleKey: unico.titleKey,
          parentId: null,
          content: construirIndice(),
          author: AUTOR,
          source: 'import',
          message: 'Índice (ex-CLAUDE.md)',
        });
        titleKeyToId.set(unico.titleKey, page.id);
        console.log(`  + ${page.title}`);
      } else {
        console.log('  · índice ya existe');
      }
    }

    // Reporte wikilinks rotos (muestra)
    console.log('Analizando wikilinks…');
    const freshKeys = await sql`select title_key from wiki.pages where deleted_at is null`;
    const keySet = new Set(freshKeys.map((r) => r.title_key));
    const unresolved = new Map();
    for (const note of mdFiles) {
      try {
        const raw = fs.readFileSync(note.abs, 'utf8');
        const { body } = parseFrontmatter(raw);
        for (const link of extractWikilinks(body)) {
          const key = normalizeTitle(link);
          if (!key) continue;
          if (!keySet.has(key)) {
            unresolved.set(key, (unresolved.get(key) || 0) + 1);
          }
        }
      } catch {
        /* ignore */
      }
    }
    reporte.unresolvedLinks = [...unresolved.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([key, count]) => ({ key, count }));

    const outPath = path.join(APPS_ROOT, 'scripts/import-vault-wiki-report.json');
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          vault: VAULT_ROOT,
          mode: resume ? 'resume' : 'wipe',
          max_asset: MAX_ASSET,
          counts: {
            folders: reporte.folders,
            md_added: reporte.md,
            files_added: reporte.files,
            assets_added: reporte.assets,
            omitted: reporte.omitted.length,
            title_collisions: reporte.titleCollisions.length,
            total_pages: (
              await sql`select count(*)::int as n from wiki.pages where deleted_at is null`
            )[0].n,
          },
          omitted: reporte.omitted.slice(0, 200),
          title_collisions: reporte.titleCollisions.slice(0, 100),
          unresolved_wikilinks_sample: reporte.unresolvedLinks,
        },
        null,
        2,
      ),
    );

    console.log('\n✅ Import listo');
    console.log(
      JSON.stringify(
        {
          md_added: reporte.md,
          files_added: reporte.files,
          assets_added: reporte.assets,
          omitted: reporte.omitted.length,
          collisions: reporte.titleCollisions.length,
          unresolved_sample: reporte.unresolvedLinks.length,
          report: outPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await cerrarSql();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
