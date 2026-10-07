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
});

export { GET, POST, PUT, PATCH, DELETE, handle as default };
