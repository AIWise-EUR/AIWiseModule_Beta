-- Add private team annotations. Existing auth, content approval and public Beta data are unchanged.
begin;
create schema if not exists aiwise_private;
revoke all on schema aiwise_private from public, anon, authenticated;

create function public.workspace_valid_beta_anchor(a jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare k text; v text;
begin
 if a is null or jsonb_typeof(a) <> 'object' or octet_length(a::text)>20000 then return false; end if;
 if not (a ?& array['kind','path','fingerprint','excerpt']) then return false; end if;
 for k in select jsonb_object_keys(a) loop
  if k not in ('kind','path','fingerprint','excerpt','quote','start','end','x','y','w','h') then return false; end if;
 end loop;
 foreach k in array array['kind','path','fingerprint','excerpt'] loop
  if jsonb_typeof(a->k)<>'string' then return false; end if;
 end loop;
 if a->>'kind' not in ('comment','highlight','box','pin') or length(a->>'path')>2048
 or a->>'path' !~ '^body(>[a-z][a-z0-9-]*:nth-of-type\([1-9][0-9]*\)){1,30}$'
 or a->>'fingerprint' !~ '^[0-9a-f]{64}$' or length(a->>'excerpt') not between 1 and 280 then return false; end if;
 if a->>'kind'='highlight' then
  if not (a ?& array['quote','start','end']) or jsonb_typeof(a->'quote')<>'string'
  or length(a->>'quote') not between 1 and 4000 or a->>'start' !~ '^[0-9]{1,7}$' or a->>'end' !~ '^[0-9]{1,7}$'
  or jsonb_typeof(a->'start')<>'number' or jsonb_typeof(a->'end')<>'number' then return false; end if;
  if (a->>'end')::int <= (a->>'start')::int then return false; end if;
 end if;
 if a->>'kind' in ('box','pin') then
  foreach k in array array['x','y'] loop
   if not a ? k or jsonb_typeof(a->k)<>'number' then return false; end if;
   if (a->>k)::numeric not between 0 and 1 then return false; end if;
  end loop;
 end if;
 if a->>'kind'='box' then
  foreach k in array array['w','h'] loop
   if not a ? k or jsonb_typeof(a->k)<>'number' then return false; end if;
   if (a->>k)::numeric <= 0 or (a->>k)::numeric > 1 then return false; end if;
  end loop;
  if (a->>'x')::numeric+(a->>'w')::numeric > 1.000001 or (a->>'y')::numeric+(a->>'h')::numeric > 1.000001 then return false; end if;
 end if;
 return true;
end $$;
revoke all on function public.workspace_valid_beta_anchor(jsonb) from public,anon,authenticated;
grant execute on function public.workspace_valid_beta_anchor(jsonb) to authenticated;

create table public.workspace_beta_memos (
 id uuid primary key,
 page text not null check (length(page)<=512 and page ~ '^(common/[a-z0-9-]+\.html|course-specific/[a-z0-9_-]+/[a-zA-Z0-9_.()-]+\.html)(\?course=(aws1|ped|other))?$'),
 anchor jsonb not null check (public.workspace_valid_beta_anchor(anchor)),
 body text not null check (length(btrim(body)) between 1 and 8000),
 author_id uuid not null references auth.users(id),
 author_name text not null,
 created_at timestamptz not null default now(),
 resolved boolean not null default false,
 resolved_by uuid references auth.users(id),
 resolved_at timestamptz
);
create table public.workspace_beta_replies (
 id uuid primary key,
 memo_id uuid not null references public.workspace_beta_memos(id),
 body text not null check (length(btrim(body)) between 1 and 8000),
 author_id uuid not null references auth.users(id),
 author_name text not null,
 created_at timestamptz not null default now()
);
create index workspace_beta_memos_page on public.workspace_beta_memos(page,created_at);
create index workspace_beta_memos_author on public.workspace_beta_memos(author_id);
create index workspace_beta_memos_resolver on public.workspace_beta_memos(resolved_by);
create index workspace_beta_replies_thread on public.workspace_beta_replies(memo_id,created_at);
create index workspace_beta_replies_author on public.workspace_beta_replies(author_id);
alter table public.workspace_beta_memos enable row level security;
alter table public.workspace_beta_replies enable row level security;
revoke all on public.workspace_beta_memos,public.workspace_beta_replies from public,anon,authenticated;
grant select on public.workspace_beta_memos,public.workspace_beta_replies to authenticated;
grant insert(id,page,anchor,body) on public.workspace_beta_memos to authenticated;
grant insert(id,memo_id,body) on public.workspace_beta_replies to authenticated;
grant update(resolved) on public.workspace_beta_memos to authenticated;

-- Trigger-only authority: derive the identity and timestamp, never accept them from a client.
-- No direct execution or schema access is exposed to browser roles.
create function aiwise_private.beta_feedback_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); team_role text := public.workspace_role(); display text;
begin
 if actor is null or team_role is null then raise exception 'Active team membership required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=actor;
  new.author_id:=actor; new.author_name:=coalesce(display,'Team member'); new.created_at:=now();
  if tg_table_name='workspace_beta_memos' then new.resolved:=false;new.resolved_by:=null;new.resolved_at:=null;end if;
 else
  if old.author_id<>actor and team_role<>'admin' then raise exception 'Only the author or an administrator can resolve feedback' using errcode='42501';end if;
  new.resolved_by:=case when new.resolved then actor else null end;
  new.resolved_at:=case when new.resolved then now() else null end;
 end if;
 return new;
end $$;
revoke all on function aiwise_private.beta_feedback_stamp() from public,anon,authenticated;
create trigger beta_memo_stamp before insert or update on public.workspace_beta_memos for each row execute function aiwise_private.beta_feedback_stamp();
create trigger beta_reply_stamp before insert on public.workspace_beta_replies for each row execute function aiwise_private.beta_feedback_stamp();

create policy beta_memo_read on public.workspace_beta_memos for select to authenticated using ((select public.workspace_role()) is not null);
create policy beta_memo_add on public.workspace_beta_memos for insert to authenticated with check ((select public.workspace_role()) is not null and author_id=(select auth.uid()));
create policy beta_memo_resolve on public.workspace_beta_memos for update to authenticated
 using ((select public.workspace_role()) is not null and (author_id=(select auth.uid()) or (select public.workspace_role())='admin'))
 with check ((select public.workspace_role()) is not null and (author_id=(select auth.uid()) or (select public.workspace_role())='admin'));
create policy beta_reply_read on public.workspace_beta_replies for select to authenticated using ((select public.workspace_role()) is not null);
create policy beta_reply_add on public.workspace_beta_replies for insert to authenticated with check ((select public.workspace_role()) is not null and author_id=(select auth.uid()));
notify pgrst,'reload schema';
commit;
