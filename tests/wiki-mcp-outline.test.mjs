import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { headings, outline, section, slice, wordCount } from '../apps/wiki/mcp/outline.mjs';
import { applyEdits } from '../apps/wiki/mcp/edits.mjs';
import { unifiedDiff } from '../apps/wiki/mcp/diff.mjs';
import { firmarAsset, verificarFirma } from '../apps/wiki/mcp/signed-url.mjs';
import { ok } from '../apps/wiki/mcp/format.mjs';

process.env.SESSION_SECRET ||= 'test-secret-for-unit-32chars!!';

describe('outline', () => {
  const md = `# Título\n\nIntro\n\n## Sección A\n\nTexto A\n\n### Sub\n\nx\n\n## Sección B\n\nTexto B\n`;

  it('headings ignores fences', () => {
    const withFence = '# Real\n```\n# Fake\n```\n## Two\n';
    const h = headings(withFence);
    assert.equal(h.length, 2);
    assert.equal(h[0].text, 'Real');
    assert.equal(h[1].text, 'Two');
  });

  it('outline + section + slice', () => {
    assert.match(outline(md, 2), /Sección A/);
    const sec = section(md, 'Sección A');
    assert.ok(sec.text.includes('Texto A'));
    assert.ok(!sec.text.includes('Texto B'));
    const s = slice(md, 0, 40);
    assert.ok(s.text.length <= 40 || s.next_offset != null);
    assert.ok(wordCount(md) > 5);
  });
});

describe('edits', () => {
  it('str_replace ambiguous', () => {
    assert.throws(
      () => applyEdits('aa aa', [{ op: 'str_replace', old: 'aa', new: 'b' }]),
      (e) => e.code === 'ambiguous_match',
    );
  });

  it('append + replace_section', () => {
    const md = '# T\n\n## A\n\nx\n\n## B\n\ny\n';
    const { text, summary } = applyEdits(md, [
      { op: 'append', text: '\nfin\n' },
      { op: 'replace_section', heading: 'A', text: 'nuevo' },
    ]);
    assert.ok(text.includes('nuevo'));
    assert.ok(text.includes('fin'));
    assert.ok(summary.length === 2);
  });
});

describe('diff', () => {
  it('unifiedDiff counts', () => {
    const d = unifiedDiff('a\nb\nc\n', 'a\nx\nc\n');
    assert.equal(d.added, 1);
    assert.equal(d.removed, 1);
    assert.match(d.text, /-/);
  });
});

describe('signed-url', () => {
  it('roundtrip', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const { exp, sig } = firmarAsset(id, 600);
    assert.equal(verificarFirma(id, exp, sig), true);
    assert.equal(verificarFirma(id, exp, '00'.repeat(32)), false);
  });
});

describe('format', () => {
  it('ok shape', () => {
    const r = ok('hola', { a: 1 });
    assert.equal(r.content[0].text, 'hola');
    assert.deepEqual(r.structuredContent, { a: 1 });
  });
});
