import { registerRead } from './read.mjs';
import { registerGraph } from './graph.mjs';
import { registerWrite } from './write.mjs';
import { registerLifecycle } from './lifecycle.mjs';
import { registerVersions } from './versions.mjs';
import { registerFiles } from './files.mjs';
import { registerMeta } from './meta.mjs';

export function registerAllTools(server, tokenCtx, opts = {}) {
  registerRead(server, tokenCtx);
  registerGraph(server, tokenCtx);
  registerWrite(server, tokenCtx);
  registerLifecycle(server, tokenCtx);
  registerVersions(server, tokenCtx);
  registerFiles(server, tokenCtx, opts);
  registerMeta(server, tokenCtx);
}
