import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTitle,
  extractWikilinks,
  extractAssetIds,
  parseFrontmatter,
  serializeFrontmatter,
  positionBetween,
  rewriteAssetRefsForExport,
} from '../apps/wiki/server/markdown.js';
import { validarTitulo, validarContenido, validarAsset, MAX_ASSET } from '../apps/wiki/server/modelo.js';

describe('wiki markdown', () => {
  it('normaliza títulos sin tildes', () => {
    assert.equal(normalizeTitle('  Árbol de Decisión '), 'arbol de decision');
  });

  it('extrae wikilinks e ignora embeds', () => {
    const md = 'Ver [[Página A]] y [[Página B|alias]] y ![[imagen.png]]';
    const keys = extractWikilinks(md);
    assert.deepEqual(keys.sort(), ['pagina a', 'pagina b']);
  });

  it('extrae asset UUIDs', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const ids = extractAssetIds(`![x](asset:${id}) y otra ![y](asset:${id})`);
    assert.deepEqual(ids, [id]);
  });

  it('parsea y serializa frontmatter', () => {
    const raw = `---\ntitle: Hola\ntags: a\n---\n\nCuerpo`;
    const { metadata, body } = parseFrontmatter(raw);
    assert.equal(metadata.title, 'Hola');
    assert.equal(body, 'Cuerpo');
    const again = serializeFrontmatter({ title: 'Hola' }, 'Cuerpo');
    assert.match(again, /^---\n/);
    assert.match(again, /title: Hola/);
  });

  it('genera posiciones fraccionarias', () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    assert.ok(b > a);
  });

  it('reescribe assets al exportar', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const map = new Map([[id, 'abc.png']]);
    const out = rewriteAssetRefsForExport(`![x](asset:${id})`, map);
    assert.equal(out, '![x](assets/abc.png)');
  });
});

describe('wiki modelo', () => {
  it('valida títulos', () => {
    assert.equal(validarTitulo('').ok, false);
    assert.equal(validarTitulo('OK').ok, true);
    assert.equal(validarTitulo('OK').titleKey, 'ok');
  });

  it('valida contenido', () => {
    assert.equal(validarContenido('hola').ok, true);
    assert.equal(validarContenido('x'.repeat(1_000_001)).ok, false);
  });

  it('valida assets', () => {
    const buf = Buffer.from('abc');
    assert.equal(validarAsset({ mimeType: 'image/png', buffer: buf }).ok, true);
    assert.equal(validarAsset({ mimeType: 'text/html', buffer: buf }).ok, true);
    assert.equal(validarAsset({ mimeType: 'application/zip', buffer: buf }).ok, false);
    assert.equal(
      validarAsset({ mimeType: 'image/png', buffer: Buffer.alloc(MAX_ASSET + 1) }).ok,
      false,
    );
  });
});
