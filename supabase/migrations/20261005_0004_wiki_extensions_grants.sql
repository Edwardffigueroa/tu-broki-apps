-- Grants para que tubroki_apps pueda usar unaccent/digest (FTS y hashes).
grant usage on schema extensions to tubroki_apps;
grant execute on all functions in schema extensions to tubroki_apps;
alter default privileges in schema extensions grant execute on functions to tubroki_apps;
