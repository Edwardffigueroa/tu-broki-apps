-- Wiki: el árbol de páginas no puede tener ciclos.
--
-- `parent_id` se mueve por drag & drop y por la API. Sin esta guarda, mover una
-- página dentro de una de sus propias subpáginas deja el subárbol desconectado
-- de la raíz: deja de aparecer en la barra lateral y solo se puede llegar por
-- búsqueda. La comprobación vive en la base porque la hace imposible desde
-- cualquier camino (API, importación, restauración, SQL manual).

create or replace function wiki.pages_sin_ciclos()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'tree_cycle'
      using errcode = 'P0001', detail = 'una página no puede ser su propia madre';
  end if;

  -- Sube por los ancestros del nuevo padre: si aparece la propia página, el
  -- movimiento cerraría un ciclo.
  if exists (
    with recursive ancestros as (
      select p.id, p.parent_id
        from wiki.pages p
       where p.id = new.parent_id
      union all
      select p.id, p.parent_id
        from wiki.pages p
        join ancestros a on p.id = a.parent_id
    )
    select 1 from ancestros where id = new.id
  ) then
    raise exception 'tree_cycle'
      using errcode = 'P0001', detail = 'el destino es una subpágina de la que se mueve';
  end if;

  return new;
end;
$$;

drop trigger if exists pages_sin_ciclos on wiki.pages;

create trigger pages_sin_ciclos
  before insert or update of parent_id on wiki.pages
  for each row
  execute function wiki.pages_sin_ciclos();
