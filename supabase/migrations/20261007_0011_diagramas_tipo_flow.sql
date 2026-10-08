-- App: diagramas · nuevo tipo 'swimlane-flow' (Carriles Pro sobre React Flow).
-- Aditiva: no modifica filas existentes.

alter table diagramas.diagramas
  drop constraint if exists diagramas_tipo_check;

alter table diagramas.diagramas
  add constraint diagramas_tipo_check
  check (tipo in ('swimlane', 'swimlane-flow'));

create index if not exists diagramas_tipo_idx
  on diagramas.diagramas (tipo) where archived_at is null;
