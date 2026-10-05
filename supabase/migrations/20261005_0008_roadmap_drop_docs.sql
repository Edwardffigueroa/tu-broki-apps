-- Revert: quitar notas Markdown (docs) del tablero roadmap.
alter table roadmap.tableros drop column if exists docs;
