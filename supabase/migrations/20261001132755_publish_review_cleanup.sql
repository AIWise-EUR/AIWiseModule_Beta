-- Fix final Publish approval under Supabase safe-update protection.
-- Replaces the function only; this script does not publish or delete review data.
begin;
create or replace function aiwise_private.approve_release(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.workspace_releases; v public.workspace_beta_versions; ctx jsonb; manifest jsonb; display text; stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 if not (select enabled from aiwise_private.release_settings where singleton) then raise exception 'Publishing is not enabled';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
 select * into r from public.workspace_releases where id=p_id for update;
 if not found then raise exception 'Release not found';end if;
 if r.status in ('queued','processing','committed') then return;end if;
 if r.status<>'prepared' then raise exception 'Prepare a new release or retry the failed commit';end if;
 if r.candidate_content is null then raise exception 'Prepare the accumulated Beta content again.' using errcode='22023';end if;
 if exists(select 1 from public.workspace_releases where id<>p_id and status in ('queued','processing')) then raise exception 'A release is still publishing.' using errcode='55000';end if;
 ctx:=aiwise_private.beta_review_context(null);
 if r.candidate_fingerprint is distinct from ctx->>'fingerprint' or r.candidate_content is distinct from ctx->'current_content' then raise exception 'Approved content changed. Prepare the release again.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-version-sequence',0));
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=auth.uid();
 stamp:=clock_timestamp();
 insert into public.workspace_beta_versions(id,title,summary,author_id,author_name,content,created_at,published_at)
 values(p_id,to_char(stamp at time zone 'UTC','YYYY-MM-DD'),'Published from accumulated approved Beta content.',auth.uid(),display,r.candidate_content,stamp,stamp) returning * into v;
 insert into public.workspace_beta_checks(version_id,course,chapter,locale,item_key,reviewed,reviewer_id,reviewer_name,updated_at)
 select v.id,c.course,c.chapter,c.locale,c.item_key,c.reviewed,c.reviewer_id,c.reviewer_name,c.updated_at
 from jsonb_populate_recordset(null::aiwise_private.beta_draft_checks,ctx->'checks') c;
 update public.workspace_beta_memos set version_id=v.id where version_id is null;
 -- The cycle lock prevents new review writes until publication completes.
 -- Retire only checks recorded before this publication; saved checks remain in workspace_beta_checks.
 delete from aiwise_private.beta_draft_checks where updated_at <= stamp;
 manifest:=(r.files->>'published-content.json')::jsonb;
 manifest:=manifest||jsonb_build_object('version_number',v.number,'version_created_at',stamp);
 update public.workspace_releases set version_id=v.id,version_number=v.number,version_title=v.title,
 files=jsonb_set(files,'{published-content.json}',to_jsonb(manifest::text||E'\n')),status='queued',approved_by=auth.uid(),approved_at=stamp,updated_at=stamp where id=p_id;
end $$;
notify pgrst,'reload schema';
commit;
