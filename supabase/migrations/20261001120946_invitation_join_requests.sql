-- Shared links collect requests; only an administrator's access decision enrolls members.
begin;
alter table aiwise_private.team_invitations alter column max_uses drop not null;
update aiwise_private.team_invitations set role='member',eligibility='any',target='',days=7,max_uses=null,expires_at=created_at+interval '7 days';
alter table aiwise_private.team_invitations add constraint team_invitation_request_defaults check(role='member' and eligibility='any' and target='' and days=7 and max_uses is null);
create table aiwise_private.team_join_requests (
 user_id uuid primary key references auth.users(id),invitation_id uuid not null references aiwise_private.team_invitations(id),requested_at timestamptz not null default now()
);
create index team_join_requests_invitation on aiwise_private.team_join_requests(invitation_id);
alter table aiwise_private.team_join_requests enable row level security;
revoke all on aiwise_private.team_join_requests from public,anon,authenticated;
-- Cached clients must not retain the old automatic enrollment API.
revoke all on function aiwise_private.create_invitation(uuid,text,text,text,text,text,integer,integer),public.workspace_create_invitation(uuid,text,text,text,text,text,integer,integer),aiwise_private.accept_invitation(uuid,text),public.workspace_accept_invitation(uuid,text) from public,anon,authenticated,service_role;

create function aiwise_private.create_join_link(p_id uuid,p_token text,p_label text) returns uuid
language plpgsql security definer set search_path='' as $$
declare old aiwise_private.team_invitations; digest bytea;
begin
 lock table public.workspace_members in share row exclusive mode;
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_label is null or length(btrim(p_label)) not between 1 and 100 then raise exception 'Enter an invitation name.' using errcode='22023';end if;
 digest:=sha256(convert_to(p_token,'UTF8'));
 select * into old from aiwise_private.team_invitations where id=p_id;
 if found then
  if old.created_by<>auth.uid() or old.token_hash<>digest or old.label<>btrim(p_label) then raise exception 'Invitation request changed. Create a new link.' using errcode='22023';end if;
  return old.id;
 end if;
 insert into aiwise_private.team_invitations(id,token_hash,label,role,eligibility,target,days,max_uses,created_by,expires_at)
 values(p_id,digest,btrim(p_label),'member','any','',7,null,auth.uid(),now()+interval '7 days');return p_id;
end $$;
create or replace function aiwise_private.list_invitations(p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid page.' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
  select i.id,i.label,i.role,i.eligibility,i.target,i.uses,i.max_uses,i.created_at,i.expires_at,i.revoked_at,
  (select count(*) from aiwise_private.team_join_requests q where q.invitation_id=i.id) requests,
  case when i.revoked_at is not null then 'revoked' when not coalesce(m.active and m.role='admin',false) then 'issuer_inactive' when i.expires_at<=now() then 'expired' else 'active' end status
  from aiwise_private.team_invitations i left join public.workspace_members m on m.user_id=i.created_by
  order by i.created_at desc,i.id limit p_limit offset p_offset
 ) r;
 return jsonb_build_object('invitations',result,'total',(select count(*) from aiwise_private.team_invitations));
end $$;
create or replace function aiwise_private.invitation_details(p_id uuid,p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i aiwise_private.team_invitations; mail text; reason text; access public.workspace_members;
begin
 if auth.uid() is null then raise exception 'Sign in to review this invitation.' using errcode='42501';end if;
 select email into mail from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and not coalesce(is_anonymous,false);
 if nullif(mail,'') is null then raise exception 'Confirm your email and sign in first.' using errcode='42501';end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'This invitation is not available.' using errcode='22023';end if;
 select * into i from aiwise_private.team_invitations where id=p_id and token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then raise exception 'This invitation is not available.' using errcode='22023';end if;
 select * into access from public.workspace_members where user_id=auth.uid();
 reason:=case when access.user_id is not null and not access.active then 'paused'
 when access.active then 'member'
 when exists(select 1 from aiwise_private.team_join_requests where user_id=auth.uid()) then 'requested'
 when i.revoked_at is not null then 'revoked'
 when not exists(select 1 from public.workspace_members where user_id=i.created_by and active and role='admin') then 'issuer_inactive'
 when i.expires_at<=now() then 'expired' else 'eligible' end;
 return jsonb_build_object('label',i.label,'role','member','approval_required',true,'status',reason,'expires_at',i.expires_at,'current_role',case when access.active then access.role end);
end $$;
create function aiwise_private.request_team_access(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare info jsonb;
begin
 lock table public.workspace_members in share row exclusive mode;
 info:=aiwise_private.invitation_details(p_id,p_token);
 if info->>'status'='member' then return jsonb_build_object('requested',false,'role',info->>'current_role');end if;
 if info->>'status'='requested' then return jsonb_build_object('requested',true);end if;
 if info->>'status'<>'eligible' then raise exception 'This invitation cannot be used (%).',info->>'status' using errcode='22023';end if;
 insert into aiwise_private.team_join_requests(user_id,invitation_id) values(auth.uid(),p_id) on conflict(user_id) do nothing;
 return jsonb_build_object('requested',true);
end $$;
create function public.workspace_create_join_link(p_id uuid,p_token text,p_label text) returns uuid language sql security invoker set search_path='' as $$select aiwise_private.create_join_link(p_id,p_token,p_label);$$;
create function public.workspace_request_team_access(p_id uuid,p_token text) returns jsonb language sql security invoker set search_path='' as $$select aiwise_private.request_team_access(p_id,p_token);$$;
revoke all on function aiwise_private.create_join_link(uuid,text,text),aiwise_private.request_team_access(uuid,text),public.workspace_create_join_link(uuid,text,text),public.workspace_request_team_access(uuid,text) from public,anon,authenticated;
grant execute on function aiwise_private.create_join_link(uuid,text,text),aiwise_private.request_team_access(uuid,text),public.workspace_create_join_link(uuid,text,text),public.workspace_request_team_access(uuid,text) to authenticated;

create or replace function aiwise_private.list_team(p_search text,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then
  raise exception 'Administrator permission is required.' using errcode='42501';
 end if;
 if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Invalid team search.' using errcode='22023';
 end if;
 with people as (
  select u.id user_id,u.email,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),'Unnamed account'),80) display_name,
   u.email_confirmed_at is not null confirmed,coalesce(m.role,'member') role,
   coalesce(m.active,false) active,coalesce(m.version,0) version,
   case when m.user_id is null then 'pending' when not m.active then 'inactive' else m.role end access,
   u.created_at,j.requested_at,i.label invitation_name
  from auth.users u left join public.workspace_members m on m.user_id=u.id left join aiwise_private.team_join_requests j on j.user_id=u.id left join aiwise_private.team_invitations i on i.id=j.invitation_id
  where u.deleted_at is null and not coalesce(u.is_anonymous,false) and nullif(u.email,'') is not null
   and (p_search='' or strpos(lower(u.email),lower(p_search))>0 or strpos(lower(coalesce(u.raw_user_meta_data->>'display_name','')),lower(p_search))>0)
 ), page as (select * from people order by (access='pending') desc,(requested_at is not null) desc,requested_at desc nulls last,created_at desc,user_id limit p_limit offset p_offset)
 select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
  'pending_requests',(select count(*) from people where access='pending' and requested_at is not null),'total',(select count(*) from people),'offset',p_offset,'limit',p_limit) into result;
 return result;
end $$;
notify pgrst,'reload schema';
commit;
