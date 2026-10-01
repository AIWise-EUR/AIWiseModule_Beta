-- Administrator-issued, revocable invitations. Auth signup and email confirmation stay unchanged.
begin;
create table aiwise_private.team_invitations (
 id uuid primary key, token_hash bytea not null unique, label text not null check(length(label) between 1 and 100),
 role text not null check(role in ('member','admin')), eligibility text not null check(eligibility in ('email','domain','any')),
 target text not null, max_uses integer not null check(max_uses between 1 and 50), uses integer not null default 0 check(uses>=0 and uses<=max_uses),
 days integer not null check(days in (1,7,30)), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
 check(role<>'admin' or (eligibility='email' and max_uses=1))
);
create index team_invitations_creator on aiwise_private.team_invitations(created_by);
create table aiwise_private.team_invitation_acceptances (
 invitation_id uuid not null references aiwise_private.team_invitations(id),user_id uuid not null references auth.users(id),
 accepted_at timestamptz not null default now(),role text not null check(role in ('member','admin')),
 primary key(invitation_id,user_id)
);
create index team_invitation_acceptances_user on aiwise_private.team_invitation_acceptances(user_id);
alter table aiwise_private.team_invitations enable row level security;
alter table aiwise_private.team_invitation_acceptances enable row level security;
revoke all on aiwise_private.team_invitations,aiwise_private.team_invitation_acceptances from public,anon,authenticated;

create function aiwise_private.create_invitation(p_id uuid,p_token text,p_label text,p_role text,p_eligibility text,p_target text,p_days integer,p_max_uses integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare old aiwise_private.team_invitations; target text:=lower(btrim(coalesce(p_target,''))); digest bytea;
begin
 lock table public.workspace_members in share row exclusive mode;
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_label is null or length(btrim(p_label)) not between 1 and 100
 or p_role is null or p_role not in ('member','admin') or p_eligibility is null or p_eligibility not in ('email','domain','any')
 or p_days is null or p_days not in (1,7,30) or p_max_uses is null or p_max_uses not between 1 and 50 then raise exception 'Choose valid invitation settings.' using errcode='22023';end if;
 if (p_eligibility='email' and (length(target)>254 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 or (p_eligibility='domain' and (length(target)>253 or target !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$' or target like '%..%'))
 or (p_eligibility='any' and target<>'') then raise exception 'Enter a valid email address or email domain.' using errcode='22023';end if;
 if p_role='admin' and (p_eligibility<>'email' or p_max_uses<>1) then raise exception 'Administrator invitations require one specified email address and one use.' using errcode='22023';end if;
 digest:=sha256(convert_to(p_token,'UTF8'));
 select * into old from aiwise_private.team_invitations where id=p_id;
 if found then
  if old.created_by<>auth.uid() or old.token_hash<>digest or old.label<>btrim(p_label) or old.role<>p_role or old.eligibility<>p_eligibility or old.target<>target or old.days<>p_days or old.max_uses<>p_max_uses then raise exception 'Invitation request changed. Create a new link.' using errcode='22023';end if;
  return old.id;
 end if;
 insert into aiwise_private.team_invitations(id,token_hash,label,role,eligibility,target,days,max_uses,created_by,expires_at)
 values(p_id,digest,btrim(p_label),p_role,p_eligibility,target,p_days,p_max_uses,auth.uid(),now()+make_interval(days=>p_days));return p_id;
end $$;
create function aiwise_private.list_invitations(p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid page.' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
  select i.id,i.label,i.role,i.eligibility,i.target,i.uses,i.max_uses,i.created_at,i.expires_at,i.revoked_at,
  case when i.revoked_at is not null then 'revoked' when not coalesce(m.active and m.role='admin',false) then 'issuer_inactive' when i.expires_at<=now() then 'expired' when i.uses>=i.max_uses then 'used' else 'active' end status
  from aiwise_private.team_invitations i left join public.workspace_members m on m.user_id=i.created_by
  order by i.created_at desc,i.id limit p_limit offset p_offset
 ) r;
 return jsonb_build_object('invitations',result,'total',(select count(*) from aiwise_private.team_invitations));
end $$;
create function aiwise_private.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 lock table public.workspace_members in share row exclusive mode;
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 update aiwise_private.team_invitations set revoked_at=coalesce(revoked_at,now()) where id=p_id;
 if not found then raise exception 'Invitation not found.' using errcode='22023';end if;
end $$;

-- Only a signed-in, confirmed account holding the secret can inspect eligibility.
create function aiwise_private.invitation_details(p_id uuid,p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i aiwise_private.team_invitations; mail text; reason text; access public.workspace_members; accepted boolean;
begin
 if auth.uid() is null then raise exception 'Sign in to review this invitation.' using errcode='42501';end if;
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and not coalesce(is_anonymous,false);
 if mail is null then raise exception 'Confirm your email and sign in first.' using errcode='42501';end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'This invitation is not available.' using errcode='22023';end if;
 select * into i from aiwise_private.team_invitations where id=p_id and token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then raise exception 'This invitation is not available.' using errcode='22023';end if;
 select * into access from public.workspace_members where user_id=auth.uid();
 accepted:=exists(select 1 from aiwise_private.team_invitation_acceptances where invitation_id=i.id and user_id=auth.uid());
 reason:=case when access.user_id is not null and not access.active then 'paused'
 when accepted then 'accepted'
 when i.revoked_at is not null then 'revoked'
 when not exists(select 1 from public.workspace_members where user_id=i.created_by and active and role='admin') then 'issuer_inactive'
 when i.expires_at<=now() then 'expired' when i.uses>=i.max_uses then 'used'
 when i.eligibility='email' and mail<>i.target then 'wrong_email'
 when i.eligibility='domain' and split_part(mail,'@',2)<>i.target then 'wrong_domain' else 'eligible' end;
 return jsonb_build_object('label',i.label,'role',i.role,'status',reason,'expires_at',i.expires_at,'remaining',greatest(0,i.max_uses-i.uses),'eligibility',i.eligibility,
 'domain',case when i.eligibility='domain' then i.target end,'current_role',case when access.active then access.role end);
end $$;
create function aiwise_private.accept_invitation(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare info jsonb; i aiwise_private.team_invitations; old public.workspace_members; saved public.workspace_members; assigned text;
begin
 -- Same lock order as manual access edits: issuer demotion, pausing and link redemption are serialized.
 lock table public.workspace_members in share row exclusive mode;
 info:=aiwise_private.invitation_details(p_id,p_token);
 if info->>'status'='accepted' then return jsonb_build_object('role',info->>'current_role','accepted',true);end if;
 if info->>'status'<>'eligible' then raise exception 'This invitation cannot be accepted (%).',info->>'status' using errcode='22023';end if;
 select * into i from aiwise_private.team_invitations where id=p_id for update;
 select * into old from public.workspace_members where user_id=auth.uid();
 assigned:=case when old.active and old.role='admin' then 'admin' else i.role end;
 insert into public.workspace_members(user_id,role,active,version) values(auth.uid(),assigned,true,1)
 on conflict(user_id) do update set role=excluded.role,active=true,version=workspace_members.version+1 returning * into saved;
 insert into aiwise_private.team_invitation_acceptances(invitation_id,user_id,role) values(i.id,auth.uid(),assigned);
 update aiwise_private.team_invitations set uses=uses+1 where id=i.id;
 insert into aiwise_private.team_access_log(actor_id,user_id,previous_role,previous_active,new_role,new_active,member_version)
 values(i.created_by,auth.uid(),old.role,old.active,saved.role,saved.active,saved.version);
 return jsonb_build_object('role',saved.role,'accepted',true);
end $$;
create function public.workspace_create_invitation(p_id uuid,p_token text,p_label text,p_role text,p_eligibility text,p_target text,p_days integer,p_max_uses integer) returns uuid language sql security invoker set search_path='' as $$select aiwise_private.create_invitation(p_id,p_token,p_label,p_role,p_eligibility,p_target,p_days,p_max_uses);$$;
create function public.workspace_list_invitations(p_offset integer default 0,p_limit integer default 20) returns jsonb language sql stable security invoker set search_path='' as $$select aiwise_private.list_invitations(p_offset,p_limit);$$;
create function public.workspace_revoke_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$select aiwise_private.revoke_invitation(p_id);$$;
create function public.workspace_invitation_details(p_id uuid,p_token text) returns jsonb language sql stable security invoker set search_path='' as $$select aiwise_private.invitation_details(p_id,p_token);$$;
create function public.workspace_accept_invitation(p_id uuid,p_token text) returns jsonb language sql security invoker set search_path='' as $$select aiwise_private.accept_invitation(p_id,p_token);$$;
revoke all on function aiwise_private.create_invitation(uuid,text,text,text,text,text,integer,integer),aiwise_private.list_invitations(integer,integer),aiwise_private.revoke_invitation(uuid),aiwise_private.invitation_details(uuid,text),aiwise_private.accept_invitation(uuid,text),public.workspace_create_invitation(uuid,text,text,text,text,text,integer,integer),public.workspace_list_invitations(integer,integer),public.workspace_revoke_invitation(uuid),public.workspace_invitation_details(uuid,text),public.workspace_accept_invitation(uuid,text) from public,anon,authenticated;
grant execute on function aiwise_private.create_invitation(uuid,text,text,text,text,text,integer,integer),aiwise_private.list_invitations(integer,integer),aiwise_private.revoke_invitation(uuid),aiwise_private.invitation_details(uuid,text),aiwise_private.accept_invitation(uuid,text),public.workspace_create_invitation(uuid,text,text,text,text,text,integer,integer),public.workspace_list_invitations(integer,integer),public.workspace_revoke_invitation(uuid),public.workspace_invitation_details(uuid,text),public.workspace_accept_invitation(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
