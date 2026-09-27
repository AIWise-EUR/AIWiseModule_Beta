-- Run only in a disposable test database after the membership migration.
-- All test accounts and rows are rolled back. No email is sent.
begin;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'member-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'member-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nonmember@example.test');
insert into public.workspace_members (user_id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  if (select count(*) from public.workspace_members) <> 1 then
    raise exception 'A member must see only their own row';
  end if;
  if exists (select 1 from public.workspace_members where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'Another member must not be visible';
  end if;
end $$;

do $$ begin
  begin
    insert into public.workspace_members (user_id) values ('33333333-3333-4333-8333-333333333333');
    raise exception 'Client membership insertion was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspace_members set active = false;
    raise exception 'Client membership modification was allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.workspace_members;
    raise exception 'Client membership deletion was allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
do $$ begin
  if exists (select 1 from public.workspace_members) then raise exception 'Nonmember can see memberships'; end if;
end $$;

reset role;
update public.workspace_members set active = false where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  if exists (select 1 from public.workspace_members) then raise exception 'Revoked membership remains visible'; end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.workspace_members;
    raise exception 'Anonymous membership access was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
