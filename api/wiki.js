/**
 * Entrypoint Vercel · wiki (1 función).
 * URLs: /api/wiki/{pages,page,draft,versions,…}
 */

import { entrypoint } from '../shared/despachar.js';
import * as pages from '../handlers/wiki/pages.js';
import * as page from '../handlers/wiki/page.js';
import * as draft from '../handlers/wiki/draft.js';
import * as versions from '../handlers/wiki/versions.js';
import * as bootstrap from '../handlers/wiki/bootstrap.js';
import * as search from '../handlers/wiki/search.js';
import * as backlinks from '../handlers/wiki/backlinks.js';
import * as assets from '../handlers/wiki/assets.js';
import * as documents from '../handlers/wiki/documents.js';
import * as importar from '../handlers/wiki/import.js';
import * as exportar from '../handlers/wiki/export.js';
import * as untrash from '../handlers/wiki/untrash.js';
import * as resolve from '../handlers/wiki/resolve.js';
import * as grep from '../handlers/wiki/grep.js';
import * as links from '../handlers/wiki/links.js';
import * as neighbors from '../handlers/wiki/neighbors.js';
import * as path from '../handlers/wiki/path.js';
import * as related from '../handlers/wiki/related.js';
import * as brokenLinks from '../handlers/wiki/broken-links.js';
import * as orphans from '../handlers/wiki/orphans.js';
import * as purge from '../handlers/wiki/purge.js';
import * as files from '../handlers/wiki/files.js';
import * as aliases from '../handlers/wiki/aliases.js';
import * as tags from '../handlers/wiki/tags.js';
import * as recent from '../handlers/wiki/recent.js';
import * as stats from '../handlers/wiki/stats.js';
import * as documentsFromUrl from '../handlers/wiki/documents-from-url.js';

const { GET, POST, PUT, PATCH, DELETE, default: handle } = entrypoint('wiki', {
  pages,
  page,
  draft,
  versions,
  bootstrap,
  search,
  backlinks,
  assets,
  documents,
  import: importar,
  export: exportar,
  untrash,
  resolve,
  grep,
  links,
  neighbors,
  path,
  related,
  'broken-links': brokenLinks,
  orphans,
  purge,
  files,
  aliases,
  tags,
  recent,
  stats,
  'documents-from-url': documentsFromUrl,
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
