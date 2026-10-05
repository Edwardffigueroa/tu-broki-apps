import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null
let mermaidTheme: 'default' | 'dark' | null = null

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

const renderer = {
  code({ text, lang }: Tokens.Code) {
    if ((lang || '').toLowerCase() === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`
    }
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`
  },
}

marked.use({
  gfm: true,
  breaks: true,
  renderer,
})

/** Convierte Markdown (GFM) a HTML seguro. Los bloques ```mermaid quedan como <pre class="mermaid">. */
export function mdToSafeHtml(md: string): string {
  const raw = marked.parse(md || '', { async: false }) as string
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel'],
    ADD_TAGS: [],
  })
}

async function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => mod.default)
  }
  return mermaidReady
}

/** Renderiza los nodos `.mermaid` dentro de `root`. Lazy-load del paquete. */
export async function renderMermaidIn(root: HTMLElement): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>('.mermaid')].filter(
    (n) => !n.getAttribute('data-processed'),
  )
  if (!nodes.length) return
  try {
    const mermaid = await loadMermaid()
    const theme = prefersDark() ? 'dark' : 'default'
    if (theme !== mermaidTheme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme,
        fontFamily: 'Instrument Sans, Segoe UI, system-ui, sans-serif',
      })
      mermaidTheme = theme
    }
    await mermaid.run({ nodes })
  } catch (err) {
    nodes.forEach((n) => {
      if (!n.getAttribute('data-processed')) {
        n.setAttribute('data-processed', '1')
        n.classList.add('mermaid-err')
        n.textContent = 'No se pudo dibujar este Mermaid.\n\n' + (err instanceof Error ? err.message : String(err))
      }
    })
  }
}
