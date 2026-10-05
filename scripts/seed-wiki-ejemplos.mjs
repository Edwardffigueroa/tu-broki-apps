/**
 * Crea (o refresca) las páginas de ejemplo de la Wiki.
 *
 *   node scripts/seed-wiki-ejemplos.mjs
 *
 * Requiere `npm run dev` corriendo y `.env.local` con SESSION_SECRET.
 * Si ya existen páginas con el mismo título, actualiza el contenido y guarda
 * una versión nueva (no duplica el árbol).
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
  try { json = JSON.parse(texto); } catch { json = texto; }
  if (r.status >= 400) {
    throw new Error(`${metodo} ${ruta} → ${r.status} ${JSON.stringify(json)}`);
  }
  return json;
}

/** Árbol plano → mapa título → página */
async function mapaPorTitulo() {
  const { pages } = await pedir('/api/wiki/pages');
  const m = new Map();
  for (const p of pages) m.set(p.title, p);
  return m;
}

async function asegurarPagina({ title, parentId = null, content, message }) {
  const mapa = await mapaPorTitulo();
  let page = mapa.get(title);

  if (!page) {
    page = await pedir('/api/wiki/pages', {
      metodo: 'POST',
      cuerpo: { title, parent_id: parentId, content: '', message: 'Página de ejemplo' },
    });
    console.log(`  + creada  ${title}`);
  } else {
    // Reparentar si hace falta (sin ciclos).
    if ((page.parent_id || null) !== (parentId || null)) {
      await pedir(`/api/wiki/page?id=${page.id}`, {
        metodo: 'PATCH',
        cuerpo: { parent_id: parentId },
      });
      console.log(`  ↕ movida  ${title}`);
    } else {
      console.log(`  · existe  ${title}`);
    }
    // Recargar para tener current_version_id / draft_revision frescos.
    page = await pedir(`/api/wiki/page?id=${page.id}`);
  }

  // Autoguardar borrador y luego versión explícita.
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
      cuerpo: {
        base_version_id: fresca.current_version_id,
        message: message || 'Contenido de ejemplo',
      },
    });
    console.log(`    ✓ versión guardada`);
  } catch (e) {
    if (String(e.message).includes('no_changes')) {
      console.log(`    · sin cambios`);
    } else {
      throw e;
    }
  }

  return pedir(`/api/wiki/page?id=${page.id}`);
}

async function aPapeleraSiExiste(titulo) {
  const mapa = await mapaPorTitulo();
  const p = mapa.get(titulo);
  if (!p) return;
  await pedir(`/api/wiki/page?id=${p.id}`, { metodo: 'DELETE' });
  console.log(`  🗑 papelera ${titulo}`);
}

/* ───────────────────────── contenidos ───────────────────────── */

const CONTENIDOS = {
  bienvenida: `# Bienvenida a la Wiki de TuBroki

Esta es la base de conocimiento del equipo. Aquí documentamos procesos, decisiones,
glosarios y lo que haga falta para que nadie dependa de un chat perdido.

## Empieza por aquí

1. Lee [[Cómo funciona]] — el modelo mental en 2 minutos.
2. Recorre [[Qué puedes hacer]] — el mapa de funcionalidades.
3. Prueba [[Guía de Markdown]] — cómo se ve el formato.
4. Mira un caso real en [[Casos de uso]].

## Qué es (y qué no es)

| Es | No es |
|---|---|
| Páginas en Markdown con versiones | Un Google Docs compartido |
| Wikilinks \`[[como Obsidian]]\` | Un wiki con HTML a mano |
| Árbol ordenable (tipo Confluence) | Un drive de archivos sueltos |
| Búsqueda en español | Solo búsqueda exacta |
| Import/export de vault Obsidian | Un sustituto de Notion para el mundo |

> Tip: escribe \`[[\` en el editor y te sugiere páginas existentes.
> Si el enlace aún no existe, aparece distinto y puedes crearlo al hacer clic.

## Atajos rápidos

- \`Ctrl/Cmd + S\` — guardar **versión** (queda en el historial)
- \`Ctrl/Cmd + K\` — buscar
- \`Ctrl/Cmd + Shift + H\` — abrir historial

El autoguardado del borrador corre solo (~2 s). Guardar versión es deliberado:
así el historial no se llena de cada tecla.

→ Siguiente: [[Cómo funciona]]
`,

  comoFunciona: `# Cómo funciona

Tres ideas bastan para usar la Wiki bien.

## 1. El Markdown es la fuente de verdad

Lo que escribes en el editor **es** la página. La vista previa solo renderiza.
No hay un segundo formato oculto.

- Encabezados, listas, tablas, citas, código: ver [[Guía de Markdown]].
- Enlaces internos con \`[[Título de la página]]\`: ver [[Wikilinks]].
- Imágenes con \`![descripción](asset:UUID)\` tras subirlas: ver [[Imágenes y archivos]].

## 2. Borrador ≠ versión

| Acción | Qué guarda | Cuándo |
|---|---|---|
| Escribir (autoguardado) | Borrador privado de la página | Cada ~2 s |
| **Guardar** / \`Ctrl+S\` | Versión inmutable en el historial | Cuando tú lo decides |
| Descartar borrador | Vuelve al contenido de la última versión | Si te arrepentiste |

Las versiones **no se editan**. Si restauras una vieja, se crea una versión **nueva**
con ese contenido (el historial queda intacto). Detalle en [[Historial y versiones]].

## 3. El árbol es el mapa

Las páginas viven en un árbol (padre → hijas), como en Confluence:

\`\`\`
Bienvenida a la Wiki
├── Cómo funciona          ← estás aquí
├── Qué puedes hacer
│   ├── Árbol de páginas
│   ├── Wikilinks
│   └── …
├── Guía de Markdown
└── Casos de uso
\`\`\`

Puedes arrastrar para reordenar o anidar. El sistema **bloquea ciclos**
(no puedes meter una página dentro de su propia subpágina).

→ Mapa completo: [[Qué puedes hacer]]
`,

  quePuedesHacer: `# Qué puedes hacer

Mapa de funcionalidades. Cada tarjeta es una página con el detalle y ejemplos vivos.

## Organizar

- [[Árbol de páginas]] — jerarquía, drag & drop, papelera
- [[Wikilinks]] — \`[[enlaces]]\` entre páginas + backlinks

## Escribir y versionar

- [[Historial y versiones]] — borrador, guardar, restaurar, conflictos
- [[Guía de Markdown]] — formato que entiende el editor

## Encontrar

- [[Búsqueda]] — full-text en español (sin tildes, ranking)
- Panel **Backlinks** — quién enlaza a la página abierta

## Multimedia y migración

- [[Imágenes y archivos]] — subir PNG/JPG/GIF/WebP/PDF (máx. 3 MB)
- [[Importar y exportar]] — ZIP tipo Obsidian de ida y vuelta

## Productividad

- [[Atajos de teclado]] — los que valen la pena memorizar

---

¿Primera vez? Empieza en [[Cómo funciona]].
¿Quieres ver un ejemplo de documentación real? [[Casos de uso]].
`,

  arbol: `# Árbol de páginas

La barra izquierda es el mapa de la Wiki. Cada ítem es una página; las hijas
se indentan bajo su madre.

## Crear

- Botón **+** en la barra lateral → crea una página raíz o hija (según contexto).
- Desde un \`[[enlace sin resolver]]\` → al hacer clic te ofrece crearla.
- Los títulos son **únicos** entre páginas activas. Si choca, se sugiere
  \`Título (2)\`, \`Título (3)\`… como en un vault.

## Mover y ordenar

Arrastra una página:

| Zona del drop | Efecto |
|---|---|
| Parte superior | Queda **antes** de la destino (misma madre) |
| Centro | Queda **dentro** (hija de la destino) |
| Parte inferior | Queda **después** de la destino |

El orden usa *fractional indexing* (texto, no enteros), así reordenar no
renumera a todos los hermanos.

### Lo que no se puede

Mover una página **dentro de una de sus subpáginas** está bloqueado
(en la base de datos, no solo en la UI). Si lo intentas, verás un 409:
*«No puedes mover una página dentro de una de sus subpáginas»*.

## Papelera

- **Papelera** en una página → soft-delete (no se borra el historial).
- Los **hijos suben al abuelo** para no quedar colgando.
- Los wikilinks que apuntaban aquí quedan **sin resolver** hasta que la recuperes.
- Vista papelera en la barra lateral → **Recuperar**.

Prueba: esta página es hija de [[Qué puedes hacer]], que a su vez cuelga de
[[Bienvenida a la Wiki]].
`,

  wikilinks: `# Wikilinks

Los enlaces internos se escriben como en Obsidian:

\`\`\`md
Ver [[Cómo funciona]] para el modelo mental.
Con alias: [[Guía de Markdown|esta guía de formato]].
\`\`\`

## Cómo se resuelven

1. El título se **normaliza**: minúsculas, sin tildes, espacios colapsados.
2. Se busca una página activa con ese \`title_key\`.
3. Si existe → enlace azul (clicabre la página).
4. Si no existe → estilo distinto; al clic puedes **crearla**.

> \`[[Cómo funciona]]\`, \`[[como funciona]]\` y \`[[Como Funciona]]\` apuntan a la misma página.

## Backlinks

Abre el panel lateral (**Historial / Backlinks**) en cualquier página.
Verás quién la menciona y un fragmento del contexto.

Esta página enlaza a [[Bienvenida a la Wiki]], [[Cómo funciona]],
[[Guía de Markdown]] y [[Búsqueda]] — ábrelas y mira sus backlinks.

## Al renombrar

Si renombras una página que tiene enlaces entrantes, la Wiki pregunta:

- **Sí, actualizar enlaces** → reescribe los \`[[antiguo]]\` a \`[[nuevo]]\` en las páginas que apuntaban aquí.
- **No, dejarlos** → los wikilinks antiguos quedan sin resolver (útiles si el rename es cosmético).

## Enlaces a páginas que aún no existen

Prueba este (sin crear): [[Página que aún no existe]].
Se ve distinto a propósito: es una invitación a documentar, no un 404 muerto.
`,

  historial: `# Historial y versiones

Cada **Guardar** crea una versión inmutable. El borrador es otra cosa.

## Flujo típico

\`\`\`
editas → autoguarda borrador (~2 s)
       → Ctrl/Cmd+S → versión N+1 en el historial
\`\`\`

Opcionalmente pones un mensaje (*«Ajuste del onboarding»*) al guardar
desde el botón; con el atajo se guarda directo.

## Qué ves en el panel

- Lista de versiones (número, autor **TuBroki**, mensaje, fecha).
- Abrir una → ver el contenido de ese momento.
- **Restaurar** → crea una versión **nueva** con ese contenido.
  La vieja no se borra ni se reescribe.

## Conflictos

Si dos personas (o dos pestañas) editan a la vez:

| Situación | Qué pasa |
|---|---|
| Borrador con \`draft_revision\` vieja | 409 — *«El borrador cambió. Recarga»* |
| Guardar con \`base_version_id\` vieja | 409 — *«Alguien guardó antes»* + opciones |

La UI ofrece **Guardar sobre la última** o **Descartar mis cambios**.

## Descartar borrador

Vuelve al contenido de la versión actual y limpia \`draft_*\`.
Útil cuando experimentaste y no quieres contaminar el historial.

Relacionado: [[Cómo funciona]] · [[Atajos de teclado]]
`,

  busqueda: `# Búsqueda

\`Ctrl/Cmd + K\` o el botón **Buscar** en la barra superior.

## Qué indexa

Título + contenido de la **versión actual** de cada página activa
(las de la papelera no salen).

Usa PostgreSQL Full-Text Search con configuración **\`spanish\`**:

- Entiende morfología (*funcionando* encuentra *funciona*).
- Ignora tildes gracias a \`unaccent\`.
- Ordena por relevancia (\`ts_rank\`) y muestra un *headline* con el fragmento.

## Pruébala

Busca alguna de estas palabras (están en estas páginas de ejemplo):

- \`wikilink\`
- \`papelera\`
- \`fractional\`
- \`Obsidian\`
- \`autoguardado\`

## Tips

- Busca conceptos, no rutas: el árbol es para navegar; la búsqueda es para recordar.
- Si no aparece, confirma que guardaste **versión** (el borrador no entra al índice hasta guardar).

Más: [[Wikilinks]] · [[Importar y exportar]]
`,

  imagenes: `# Imágenes y archivos

Puedes adjuntar archivos a una página. Quedan en la base (\`bytea\`),
no en un bucket externo, y se sirven solo con sesión activa.

## Formatos y límites

| Permitido | Límite |
|---|---|
| JPEG, PNG, GIF, WebP | 3 MB por archivo |
| PDF | 3 MB por archivo |

> El tope es 3 MB (no 4) porque el archivo viaja en base64 dentro del JSON
> de la función de Vercel, cuyo cuerpo máximo ronda los 4,5 MB.

## Cómo se referencian

Al subir, la Wiki inserta en el Markdown:

\`\`\`md
![descripción alternativa](asset:UUID-del-archivo)
\`\`\`

En la vista previa se reescribe a la URL autenticada
\`/api/wiki/assets?id=UUID\`. Los PDFs también funcionan como enlace.

## Deduplicación

Si subes el mismo binario dos veces (mismo SHA-256), se reutiliza el asset:
no ocupa el doble.

## En exportaciones

Al exportar el vault, las refs \`asset:UUID\` se reescriben a rutas de archivo
relativas dentro del ZIP, listas para Obsidian.

Ver también: [[Importar y exportar]] · [[Guía de Markdown]]
`,

  importExport: `# Importar y exportar

Puente de ida y vuelta con un vault tipo Obsidian.

## Exportar

Botón **Exportar** → ZIP con:

- Un \`.md\` por página, en carpetas según el árbol.
- Frontmatter YAML (\`title\`, fechas, etc.).
- Assets en una carpeta de archivos, con las refs reescritas.

Sirve como backup o para trabajar offline en Obsidian.

## Importar

Botón **Importar** → eliges un ZIP:

1. Se crean las **carpetas** del vault como páginas padre (incluye ancestros intermedios).
2. Se suben las **imágenes/PDFs** en lotes (el mapa de rutas se conserva entre lotes).
3. Se crean/actualizan las **páginas** \`.md\`, reescribiendo \`![](ruta)\` → \`![](asset:UUID)\`.
4. Opcionalmente se resuelven los \`[[wikilinks]]\` contra los títulos importados.

Si un título ya existe, se añade sufijo \` (2)\`, \` (3)\`… para no pisar.

## Buenas prácticas

- Exporta antes de un import grande (red de seguridad).
- Revisa el árbol después: a veces conviene reordenar a mano.
- Los wikilinks a páginas que no venían en el ZIP quedan sin resolver — créalas o ajústalas.

Relacionado: [[Árbol de páginas]] · [[Imágenes y archivos]] · [[Wikilinks]]
`,

  atajos: `# Atajos de teclado

Los que más se usan día a día:

| Atajo | Acción |
|---|---|
| \`Ctrl/Cmd + S\` | Guardar **versión** (historial) |
| \`Ctrl/Cmd + K\` | Abrir búsqueda |
| \`Ctrl/Cmd + Shift + H\` | Abrir panel de historial |
| \`[[\` | Autocompletar páginas al escribir |

## Ratón / trackpad

- Clic en un wikilink → abre la página (o ofrece crearla).
- Arrastrar en el árbol → reordenar / anidar (ver [[Árbol de páginas]]).
- Botón **Guardar** → diálogo ligero para mensaje de versión opcional.

## Recordatorio

El autoguardado del **borrador** no tiene atajo: ocurre solo.
\`Ctrl+S\` es el momento en que "publicas" al historial.

← Volver a [[Qué puedes hacer]]
`,

  markdown: `# Guía de Markdown

Todo lo que escribes aquí es Markdown estándar + wikilinks.

## Encabezados

\`\`\`md
# H1   (el título de la página ya es el H1 visual)
## H2
### H3
\`\`\`

## Énfasis

- *cursiva* con \`*asteriscos*\` o \`_guiones bajos_\`
- **negrita** con \`**doble**\`
- ~~tachado~~ con \`~~doble tilde~~\`
- \`código en línea\` con backticks

## Listas

- Viñetas con \`- \` o \`* \`
- Numeradas con \`1. \`
  - Anidadas con indentación

1. Primero
2. Segundo
   - detalle
3. Tercero

## Citas

> Las citas empiezan con \`>\`.
> Sirven para tips, advertencias o frases clave.

## Código

Bloque con tres backticks y lenguaje opcional:

\`\`\`js
const saludo = 'Hola TuBroki';
console.log(saludo);
\`\`\`

## Tablas

| Columna A | Columna B |
|---|---|
| celda | celda |
| otra | otra |

## Enlaces

- Externos: \`[TuBroki](https://tubroki.com)\` → [TuBroki](https://tubroki.com)
- Internos: \`[[Bienvenida a la Wiki]]\` → [[Bienvenida a la Wiki]]
- Con alias: \`[[Cómo funciona|el modelo mental]]\` → [[Cómo funciona|el modelo mental]]

## Imágenes

Tras subirlas (ver [[Imágenes y archivos]]):

\`\`\`md
![Texto alternativo](asset:UUID)
\`\`\`

## Separadores

Una línea con \`---\` produce una regla horizontal.

## Diagramas Mermaid

En la pestaña **Vista previa**, los bloques con lenguaje \`mermaid\` se renderizan como diagramas SVG.
El Markdown guardado sigue siendo texto plano (exportable a Obsidian).

Sintaxis: bloque de código con lenguaje \`mermaid\` (igual que \`js\` o \`md\` arriba).

### Ejemplo: flujo borrador → versión

\`\`\`mermaid
flowchart TD
  A[Escribes en el editor] --> B{Autoguardado ~2s}
  B --> C[Borrador en base]
  A --> D[Ctrl/Cmd + S]
  D --> E[Versión inmutable]
  E --> F[Historial + búsqueda]
\`\`\`

### Ejemplo: secuencia al abrir la Wiki

\`\`\`mermaid
sequenceDiagram
  participant U as Tú
  participant W as Wiki
  participant API as /api/wiki
  U->>W: Abres /wiki
  W->>API: GET bootstrap
  API-->>W: árbol + contenidos
  W-->>U: Navegación instantánea
  U->>W: Clic en otra página
  Note over W: Cache SWR → pinta al tiro
  W->>API: revalida en background
\`\`\`

> Si el diagrama no compila, la vista previa muestra un aviso en rojo.
> \`securityLevel: strict\` bloquea HTML/script dentro del diagrama.

---

¿Listo para documentar de verdad? Sigue en [[Casos de uso]].
`,

  casosUso: `# Casos de uso

Ejemplos de cómo el equipo puede usar la Wiki en el día a día.
No son páginas "de relleno": están plantillas vivas que puedes copiar o adaptar.

## En este árbol

- [[Documentar un proceso]] — plantilla tipo SOP (quién, cuándo, pasos, excepciones).
- [[Glosario del equipo]] — términos que se repiten (arriendos, PACKs, Te Cuida…).

## Ideas de otras ramas que puedes crear

| Rama | Para qué |
|---|---|
| \`Operaciones /\` | SOPs, checklists de activación, incidentes |
| \`Producto /\` | Decisiones, criterios de aceptación, changelogs internos |
| \`Comercial /\` | Scripts de WhatsApp, FAQs, objeciones |
| \`Onboarding /\` | Primeros 7 días de alguien nuevo |

## Patrón recomendado

1. Crea la página madre del tema (\`Operaciones\`).
2. Hijas por proceso (\`Activación de póliza\`, \`Cobro en mora\`…).
3. Enlaza con \`[[wikilinks]]\` a glosario y a páginas hermanas.
4. Guarda versión con un mensaje corto cada vez que el proceso cambie de verdad.

El potencial no está en tener muchas páginas: está en que **cualquiera del equipo**
encuentre la respuesta en menos de un minuto — por el árbol, por búsqueda o por backlinks.

← [[Bienvenida a la Wiki]] · [[Qué puedes hacer]]
`,

  documentarProceso: `# Documentar un proceso

> Plantilla. Duplica esta estructura cuando documentes un SOP real.
> Ejemplo ficticio: *coordinar la primera visita de un inmueble en arriendo*.

## Propósito

Dejar claro **quién hace qué** y en qué orden, sin depender del chat.

## Actores

| Rol | Responsabilidad |
|---|---|
| Propietario | Confirma disponibilidad y recibe al interesado |
| TuBroki (ops) | Filtra el lead y agenda en Calendly |
| Interesado | Asiste a la visita |

## Entrada / salida

- **Entra:** lead calificado (nombre, teléfono, inmueble de interés).
- **Sale:** visita agendada **o** lead descartado con motivo.

## Pasos

1. Recibir el lead por WhatsApp / formulario.
2. Validar que el inmueble está publicado y activo (ver [[Glosario del equipo]] → *PACK*).
3. Enviar opciones de horario (Calendly) al interesado.
4. Confirmar con el propietario 2 h antes.
5. Después de la visita: registrar resultado en la ficha del inmueble.

## Excepciones

- Si el propietario no responde en 24 h → escalar por llamada.
- Si el interesado cancela → liberar el slot y ofrecer otro lead.

## Enlaces útiles

- Modelo mental de la Wiki: [[Cómo funciona]]
- Cómo enlazar páginas hermanas: [[Wikilinks]]
- Términos: [[Glosario del equipo]]

---

Cuando el proceso cambie, **guarda una versión** con mensaje
(*«v2: añadimos confirmación 2 h antes»*). Así el historial cuenta la historia.
`,

  glosario: `# Glosario del equipo

Términos que se repiten en operaciones y producto. Enlázalos desde otras páginas
con \`[[Glosario del equipo]]\` o crea entradas hijas si crecen mucho.

## Arriendos

| Término | Significado |
|---|---|
| **PACK 1** | Publicación — \`$249.000 COP\` |
| **PACK 2** | Publicación + agenda — \`$349.000 COP\` |
| **PACK 3** | Todo para arrendar — \`$449.000 COP\` |
| **Canon** | Valor mensual del arriendo |
| **Estudio de antecedentes** | Validación de identidad / listas (~ \`$29.900 COP\`) |

## Seguros y posventa

| Término | Significado |
|---|---|
| **Te Cuida** | Línea de gestión / acompañamiento post-póliza |
| **Activación** | Puente corto después de expedir la póliza |
| **Mora** | Flujo cuando el inquilino se atrasa en el pago |

## Principios (no negociables)

- **Sin comisiones porcentuales** — solo tarifas fijas.
- **Arriendos primero** — ventas es secundaria.
- Precios siempre en COP con punto de miles: \`$449.000 COP\`.

## Cómo mantener este glosario

1. ¿Apareció un término 3 veces en chats? → agrégalo aquí.
2. Enlázalo desde los SOPs ([[Documentar un proceso]]).
3. Si una entrada crece (+1 pantalla), conviértela en página hija.

← [[Casos de uso]] · [[Bienvenida a la Wiki]]
`,
};

/* ───────────────────────── orquestación ───────────────────────── */

async function main() {
  console.log(`\nSeed Wiki ejemplos → ${BASE}\n`);

  const { cookieSesionScript } = await import('./sesion-local.mjs');
  cookie = cookieSesionScript();
  console.log('sesión ok\n');

  // Limpieza de stubs viejos que ya no aportan.
  console.log('limpieza de stubs');
  for (const t of ['Demo Import', 'Segunda pagina', 'Inicio Wiki']) {
    await aPapeleraSiExiste(t);
  }

  console.log('\npáginas');
  const bienvenida = await asegurarPagina({
    title: 'Bienvenida a la Wiki',
    content: CONTENIDOS.bienvenida,
    message: 'Hub de ejemplos v1',
  });

  const como = await asegurarPagina({
    title: 'Cómo funciona',
    parentId: bienvenida.id,
    content: CONTENIDOS.comoFunciona,
    message: 'Modelo mental',
  });

  const mapa = await asegurarPagina({
    title: 'Qué puedes hacer',
    parentId: bienvenida.id,
    content: CONTENIDOS.quePuedesHacer,
    message: 'Mapa de features',
  });

  // Hijas de "Qué puedes hacer"
  for (const [title, key, msg] of [
    ['Árbol de páginas', 'arbol', 'Árbol y papelera'],
    ['Wikilinks', 'wikilinks', 'Enlaces internos'],
    ['Historial y versiones', 'historial', 'Borrador vs versión'],
    ['Búsqueda', 'busqueda', 'FTS español'],
    ['Imágenes y archivos', 'imagenes', 'Assets bytea'],
    ['Importar y exportar', 'importExport', 'Puente Obsidian'],
    ['Atajos de teclado', 'atajos', 'Shortcuts'],
  ]) {
    await asegurarPagina({
      title,
      parentId: mapa.id,
      content: CONTENIDOS[key],
      message: msg,
    });
  }

  await asegurarPagina({
    title: 'Guía de Markdown',
    parentId: bienvenida.id,
    content: CONTENIDOS.markdown,
    message: 'Referencia de formato',
  });

  const casos = await asegurarPagina({
    title: 'Casos de uso',
    parentId: bienvenida.id,
    content: CONTENIDOS.casosUso,
    message: 'Plantillas vivas',
  });

  await asegurarPagina({
    title: 'Documentar un proceso',
    parentId: casos.id,
    content: CONTENIDOS.documentarProceso,
    message: 'Plantilla SOP',
  });

  await asegurarPagina({
    title: 'Glosario del equipo',
    parentId: casos.id,
    content: CONTENIDOS.glosario,
    message: 'Términos TuBroki',
  });

  // Tocamos "Cómo funciona" no se usa después; silenciar lint de unused.
  void como;

  const final = await mapaPorTitulo();
  console.log(`\nListo: ${final.size} página(s) activas.`);
  console.log('Abre http://127.0.0.1:4747/wiki y empieza por «Bienvenida a la Wiki».\n');
}

main().catch((e) => {
  console.error('\nError:', e.message);
  process.exit(1);
});
