-- Account-specific viewed items. Existing review checks and resolved states are unchanged.
begin;
create table public.workspace_review_seen (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 token text not null check(token ~ '^[0-9a-f]{64}$'),
 seen_at timestamptz not null default now(),
 primary key(user_id,token)
);
alter table public.workspace_review_seen enable row level security;
revoke all on public.workspace_review_seen from public,anon,authenticated;
grant select on public.workspace_review_seen to authenticated;
grant insert(token) on public.workspace_review_seen to authenticated;
create policy own_review_seen_read on public.workspace_review_seen for select to authenticated
 using (user_id=(select auth.uid()) and (select public.workspace_role()) is not null);
create policy own_review_seen_add on public.workspace_review_seen for insert to authenticated
 with check (user_id=(select auth.uid()) and (select public.workspace_role()) is not null);
-- Optional stable Studio address on new feedback; old anchors are retained intact.
alter table public.workspace_beta_memos
 add column content_course text,
 add column content_chapter text,
 add column content_locale text,
 add column item_key text,
 add constraint beta_memo_studio_address check (
 (content_course is null and content_chapter is null and content_locale is null and item_key is null) or
 (content_course is not null and content_chapter is not null and content_locale is not null and item_key is not null
 and content_course in ('common','aws1','ped','other') and content_chapter in ('c1','c2','c3','map')
 and content_locale in ('en','nl') and length(item_key) between 1 and 160 and item_key like content_chapter||'.%')
 ),
 add constraint beta_memo_studio_source foreign key(content_course,content_chapter,content_locale)
 references public.workspace_content_sources(course,chapter,locale);
grant insert(content_course,content_chapter,content_locale,item_key) on public.workspace_beta_memos to authenticated;
create index beta_memo_studio_item on public.workspace_beta_memos(content_course,content_chapter,content_locale,item_key);
notify pgrst,'reload schema';
commit;
