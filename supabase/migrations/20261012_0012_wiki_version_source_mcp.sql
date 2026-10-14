-- Wiki: origen 'mcp' para versiones creadas por el servidor MCP.
-- Aplicada remotamente como wiki_0012_version_source_mcp (2026-10-12).
alter type wiki.version_source add value if not exists 'mcp';
