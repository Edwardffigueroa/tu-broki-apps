-- Wiki · funciones grafo/purge para MCP (solo desde repositorio).
-- Aplicada remotamente como wiki_0014_mcp_graph (2026-10-12).

create or replace function wiki.resolve_page(p_ref text, p_include_deleted boolean default false)
returns uuid
language plpgsql stable as $$
declare
  v_id uuid;
  v_key text;
begin
  if p_ref is null or btrim(p_ref) = '' then return null; end if;

  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_id from wiki.pages
     where id = p_ref::uuid and (p_include_deleted or deleted_at is null);
    if v_id is not null then return v_id; end if;
  end if;

  v_key := wiki.normalize_title(p_ref);

  select id into v_id from wiki.pages
   where title_key = v_key and deleted_at is null limit 1;
  if v_id is not null then return v_id; end if;

  select a.page_id into v_id
    from wiki.page_aliases a join wiki.pages p on p.id = a.page_id
   where a.alias_key = v_key and p.deleted_at is null limit 1;
  return v_id;
end $$;

create or replace function wiki.graph_neighbors(p_page_id uuid, p_depth int, p_direction text)
returns table (page_id uuid, title text, depth int, via uuid)
language sql stable as $$
  with recursive walk as (
    select p_page_id as page_id, 0 as depth, null::uuid as via
    union
    select case when e.source_page_id = w.page_id then e.target_page_id else e.source_page_id end,
           w.depth + 1, w.page_id
      from walk w
      join wiki.page_links e
        on (p_direction in ('out','both') and e.source_page_id = w.page_id and e.target_page_id is not null)
        or (p_direction in ('in','both')  and e.target_page_id = w.page_id)
     where w.depth < least(greatest(p_depth, 1), 4)
  ),
  best as (
    select page_id, min(depth) as depth from walk group by page_id
  )
  select b.page_id, p.title, b.depth,
         (select w.via from walk w where w.page_id = b.page_id and w.depth = b.depth limit 1) as via
    from best b join wiki.pages p on p.id = b.page_id and p.deleted_at is null
   where b.page_id <> p_page_id
   order by b.depth, p.title;
$$;

create or replace function wiki.graph_shortest_path(p_from uuid, p_to uuid, p_max int, p_both boolean)
returns uuid[]
language sql stable as $$
  with recursive walk as (
    select p_from as node, array[p_from] as path, 0 as depth
    union all
    select case when e.source_page_id = w.node then e.target_page_id else e.source_page_id end,
           w.path || case when e.source_page_id = w.node then e.target_page_id else e.source_page_id end,
           w.depth + 1
      from walk w
      join wiki.page_links e
        on (e.source_page_id = w.node and e.target_page_id is not null)
        or (p_both and e.target_page_id = w.node)
     where w.depth < least(greatest(p_max, 1), 6)
       and not (case when e.source_page_id = w.node then e.target_page_id else e.source_page_id end) = any(w.path)
       and not (p_to = any(w.path))
  )
  select path from walk where node = p_to order by depth limit 1;
$$;

create or replace function wiki.graph_related(p_page_id uuid, p_limit int)
returns table (page_id uuid, title text, score int)
language sql stable as $$
  with mine_out as (select target_page_id t from wiki.page_links where source_page_id = p_page_id and target_page_id is not null),
       mine_in  as (select source_page_id s from wiki.page_links where target_page_id = p_page_id),
       cand as (
         select l.source_page_id as pid, 2 as w from wiki.page_links l join mine_out m on m.t = l.target_page_id
         union all
         select l.target_page_id, 1 from wiki.page_links l join mine_in m on m.s = l.source_page_id where l.target_page_id is not null
       )
  select c.pid, p.title, sum(c.w)::int as score
    from cand c join wiki.pages p on p.id = c.pid and p.deleted_at is null
   where c.pid <> p_page_id
   group by c.pid, p.title
   order by score desc, p.title
   limit least(greatest(p_limit, 1), 50);
$$;

create or replace function wiki.mcp_purge(p_page_id uuid)
returns boolean
language plpgsql as $$
begin
  delete from wiki.pages where id = p_page_id and deleted_at is not null;
  return found;
end $$;

grant execute on function wiki.resolve_page(text, boolean) to tubroki_apps;
grant execute on function wiki.graph_neighbors(uuid, int, text) to tubroki_apps;
grant execute on function wiki.graph_shortest_path(uuid, uuid, int, boolean) to tubroki_apps;
grant execute on function wiki.graph_related(uuid, int) to tubroki_apps;
grant execute on function wiki.mcp_purge(uuid) to tubroki_apps;
