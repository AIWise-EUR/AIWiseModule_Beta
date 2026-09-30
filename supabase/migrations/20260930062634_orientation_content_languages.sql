-- Add content languages without changing account roles or existing English IDs.
-- Run once after the Common Studio and Beta feedback migrations.
begin;
alter table public.workspace_content_sources add column locale text not null default 'en' check (locale in ('en','nl'));
alter table public.workspace_submissions add column locale text not null default 'en' check (locale in ('en','nl'));
alter table public.workspace_submissions add column catalog_version smallint not null default 1;
alter table public.workspace_submissions add column source_release uuid references public.workspace_submissions(id);
alter table public.workspace_beta_content add column locale text not null default 'en' check (locale in ('en','nl'));
alter table public.workspace_beta_content add column source_release uuid references public.workspace_submissions(id);
alter table public.workspace_submissions drop constraint workspace_submissions_course_chapter_fkey;
alter table public.workspace_beta_content drop constraint workspace_beta_content_course_chapter_fkey;
alter table public.workspace_content_sources drop constraint workspace_content_sources_pkey;
alter table public.workspace_beta_content drop constraint workspace_beta_content_pkey;
alter table public.workspace_content_sources add primary key(course,chapter,locale);
alter table public.workspace_beta_content add primary key(course,chapter,locale);
alter table public.workspace_submissions add foreign key(course,chapter,locale) references public.workspace_content_sources(course,chapter,locale);
alter table public.workspace_beta_content add foreign key(course,chapter,locale) references public.workspace_content_sources(course,chapter,locale);
alter table public.workspace_content_sources drop constraint workspace_content_sources_course_check;
alter table public.workspace_content_sources add constraint workspace_content_sources_course_check check(course in ('common','aws1','ped','other'));
alter table public.workspace_content_sources drop constraint workspace_content_sources_chapter_check;
alter table public.workspace_content_sources add constraint workspace_content_sources_chapter_check
 check ((course='common' and chapter in ('c1','c2','c3','map')) or (course in ('aws1','ped','other') and chapter in ('c2','c3')));
create index workspace_submissions_source_release on public.workspace_submissions(source_release);
create index workspace_beta_source_release on public.workspace_beta_content(source_release);
create index workspace_submissions_scope on public.workspace_submissions(course,chapter,locale);
-- Source baselines contain only public module copy, never drafts or author metadata.
-- Public, read-only access lets both language editors start from the exact server baseline.
grant select on public.workspace_content_sources to anon,authenticated;
create policy source_reads_public_module_copy on public.workspace_content_sources for select to anon,authenticated using (true);

-- Earlier offline catalogs split HTML entities into adjacent text fields. Browsers
-- coalesce them. Preserve edited fragments while moving those blocks to one schema.
create or replace function aiwise_private.normalize_common_copy(chapter text,value jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare mappings jsonb := $mapping${"c1": {"c1.block-4": {"old": 34, "fields": {"Diagram label 1": [{"key": "Diagram label 1"}], "Diagram label 2": [{"key": "Diagram label 2"}], "Diagram label 3": [{"key": "Diagram label 3"}], "Diagram label 4": [{"key": "Diagram label 4"}], "Diagram label 5": [{"key": "Diagram label 5"}], "Diagram label 6": [{"key": "Diagram label 6"}], "Diagram label 7": [{"key": "Diagram label 7"}], "Diagram label 8": [{"key": "Diagram label 8"}], "Diagram label 9": [{"key": "Diagram label 9"}], "Diagram label 10": [{"key": "Diagram label 10"}], "Diagram label 11": [{"key": "Diagram label 11"}], "Diagram label 12": [{"key": "Diagram label 12"}], "Diagram label 13": [{"key": "Diagram label 13"}], "Diagram label 14": [{"key": "Diagram label 14"}], "Diagram label 15": [{"key": "Diagram label 15"}], "Diagram label 16": [{"key": "Diagram label 16"}], "Diagram label 17": [{"key": "Diagram label 17"}], "Diagram label 18": [{"key": "Diagram label 18"}], "Diagram label 19": [{"key": "Diagram label 19"}, {"key": "Diagram label 20"}], "Diagram label 20": [{"key": "Diagram label 21"}], "Diagram label 21": [{"key": "Diagram label 22"}], "Diagram label 22": [{"key": "Diagram label 23"}], "Diagram label 23": [{"key": "Diagram label 24"}], "Diagram label 24": [{"key": "Diagram label 25"}], "Diagram label 25": [{"key": "Diagram label 26"}], "Diagram label 26": [{"key": "Diagram label 27"}], "Diagram label 27": [{"key": "Diagram label 28"}], "Diagram label 28": [{"key": "Diagram label 29"}], "Diagram label 29": [{"key": "Diagram label 30"}], "Diagram label 30": [{"key": "Diagram label 31"}], "Emphasis 1": [{"key": "Emphasis 1"}], "Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}]}}}, "c2": {"c2.block-15": {"old": 27, "fields": {"Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}], "Text 3": [{"key": "Text 3"}], "Text 4": [{"key": "Text 4"}], "Text 5": [{"key": "Text 5"}], "Text 6": [{"key": "Text 6"}], "Text 7": [{"key": "Text 7"}], "Text 8": [{"key": "Text 8"}], "Text 9": [{"key": "Text 9"}], "Text 10": [{"key": "Text 10"}], "Text 11": [{"key": "Text 11"}], "Text 12": [{"key": "Text 12"}], "Text 13": [{"key": "Text 13"}], "Text 14": [{"key": "Text 14"}], "Text 15": [{"key": "Text 15"}], "Text 16": [{"key": "Text 16"}], "Text 17": [{"key": "Text 17"}, {"key": "Text 18"}, {"key": "Text 19"}], "Text 18": [{"key": "Text 20"}], "Text 19": [{"key": "Text 21"}], "Text 20": [{"key": "Text 22"}], "Text 21": [{"key": "Text 23"}], "Text 22": [{"key": "Text 24"}], "Text 23": [{"key": "Text 25"}], "Text 24": [{"key": "Text 26"}], "Text 25": [{"key": "Text 27"}]}}, "c2.block-31": {"old": 54, "fields": {"Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}], "Text 3": [{"key": "Text 3"}], "Text 4": [{"key": "Text 4"}], "Text 5": [{"key": "Text 5"}], "Text 6": [{"key": "Text 6"}], "Text 7": [{"key": "Text 7"}], "Text 8": [{"key": "Text 8"}], "Text 9": [{"key": "Text 9"}], "Text 10": [{"key": "Text 10"}], "Text 11": [{"key": "Text 11"}], "Text 12": [{"key": "Text 12"}, {"key": "Text 13"}, {"key": "Text 14"}], "Text 13": [{"key": "Text 15"}], "Text 14": [{"key": "Text 16"}], "Text 15": [{"key": "Text 17"}], "Text 16": [{"key": "Text 18"}], "Text 17": [{"key": "Text 19"}, {"key": "Text 20"}, {"key": "Text 21"}], "Text 18": [{"key": "Text 22"}], "Text 19": [{"key": "Text 23"}], "Text 20": [{"key": "Text 24"}, {"key": "Text 25"}, {"key": "Text 26"}], "Text 21": [{"key": "Text 27"}], "Text 22": [{"key": "Text 28"}], "Text 23": [{"key": "Text 29"}, {"key": "Text 30"}, {"key": "Text 31"}], "Text 24": [{"key": "Text 32"}], "Text 25": [{"key": "Text 33"}], "Text 26": [{"key": "Text 34"}], "Text 27": [{"key": "Text 35"}], "Text 28": [{"key": "Text 36"}], "Text 29": [{"key": "Text 37"}], "Text 30": [{"key": "Text 38"}], "Text 31": [{"key": "Text 39"}], "Text 32": [{"key": "Text 40"}, {"key": "Text 41"}, {"key": "Text 42"}], "Text 33": [{"key": "Text 43"}], "Text 34": [{"key": "Text 44"}], "Text 35": [{"key": "Text 45"}, {"key": "Text 46"}, {"key": "Text 47"}], "Text 36": [{"key": "Text 48"}], "Text 37": [{"key": "Text 49"}], "Text 38": [{"key": "Text 50"}, {"key": "Text 51"}, {"key": "Text 52"}], "Text 39": [{"key": "Text 53"}], "Text 40": [{"key": "Text 54"}]}}, "c2.block-37": {"old": 31, "fields": {"Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}], "Diagram label 1": [{"key": "Diagram label 1"}], "Diagram label 2": [{"key": "Diagram label 2"}], "Diagram label 3": [{"key": "Diagram label 3"}], "Diagram label 4": [{"key": "Diagram label 4"}], "Diagram label 5": [{"key": "Diagram label 5"}], "Diagram label 6": [{"key": "Diagram label 6"}], "Diagram label 7": [{"key": "Diagram label 7"}], "Diagram label 8": [{"key": "Diagram label 8"}], "Diagram label 9": [{"key": "Diagram label 9"}], "Diagram label 10": [{"key": "Diagram label 10"}], "Diagram label 11": [{"key": "Diagram label 11"}], "Diagram label 12": [{"key": "Diagram label 12"}], "Diagram label 13": [{"key": "Diagram label 13"}], "Diagram label 14": [{"key": "Diagram label 14"}], "Diagram label 15": [{"key": "Diagram label 15"}], "Diagram label 16": [{"key": "Diagram label 16"}], "Diagram label 17": [{"key": "Diagram label 17"}], "Diagram label 18": [{"key": "Diagram label 18"}], "Diagram label 19": [{"key": "Diagram label 19"}], "Diagram label 20": [{"key": "Diagram label 20"}], "Diagram label 21": [{"key": "Diagram label 21"}], "Diagram label 22": [{"key": "Diagram label 22"}], "Diagram label 23": [{"key": "Diagram label 23"}], "Diagram label 24": [{"key": "Diagram label 24"}], "Diagram label 25": [{"key": "Diagram label 25"}], "Diagram label 26": [{"key": "Diagram label 26"}], "Diagram label 27": [{"key": "Diagram label 27"}, {"key": "Diagram label 28"}, {"key": "Diagram label 29"}]}}, "c2.block-44": {"old": 5, "fields": {"Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}, {"key": "Text 3"}, {"key": "Text 4"}], "Text 3": [{"key": "Text 5"}]}}}, "c3": {"c3.block-40": {"old": 8, "fields": {"Text 1": [{"key": "Text 1"}], "Text 2": [{"key": "Text 2"}], "Text 3": [{"key": "Text 3"}], "List text 1": [{"text": " "}, {"text": " "}, {"key": "List text 1"}], "Text 4": [{"key": "Text 4"}], "List text 2": [{"text": " "}, {"text": " "}, {"key": "List text 2"}], "Text 5": [{"key": "Text 5"}], "List text 3": [{"text": " "}, {"text": " "}, {"key": "List text 3"}]}}, "c3.block-44": {"old": 3, "fields": {"Text 1": [{"key": "Text 1"}], "Link text 1": [{"key": "Link text 1"}, {"text": " "}, {"key": "Link text 2"}]}}, "c3.block-50": {"old": 49, "fields": {"Text 1": [{"key": "Text 1"}, {"key": "Text 2"}, {"key": "Text 3"}], "Text 2": [{"key": "Text 4"}], "Text 3": [{"key": "Text 5"}, {"key": "Text 6"}, {"key": "Text 7"}], "Text 4": [{"key": "Text 8"}, {"key": "Text 9"}, {"key": "Text 10"}], "Text 5": [{"key": "Text 11"}], "Text 6": [{"key": "Text 12"}, {"key": "Text 13"}, {"key": "Text 14"}], "Text 7": [{"key": "Text 15"}, {"key": "Text 16"}, {"key": "Text 17"}], "Text 8": [{"key": "Text 18"}], "Text 9": [{"key": "Text 19"}, {"key": "Text 20"}, {"key": "Text 21"}], "Text 10": [{"key": "Text 22"}, {"key": "Text 23"}, {"key": "Text 24"}], "Text 11": [{"key": "Text 25"}], "Text 12": [{"key": "Text 26"}, {"key": "Text 27"}, {"key": "Text 28"}], "Text 13": [{"key": "Text 29"}, {"key": "Text 30"}, {"key": "Text 31"}], "Text 14": [{"key": "Text 32"}], "Text 15": [{"key": "Text 33"}, {"key": "Text 34"}, {"key": "Text 35"}], "Text 16": [{"key": "Text 36"}, {"key": "Text 37"}, {"key": "Text 38"}], "Text 17": [{"key": "Text 39"}], "Text 18": [{"key": "Text 40"}, {"key": "Text 41"}, {"key": "Text 42"}], "Text 19": [{"key": "Text 43"}, {"key": "Text 44"}, {"key": "Text 45"}], "Text 20": [{"key": "Text 46"}], "Text 21": [{"key": "Text 47"}, {"key": "Text 48"}, {"key": "Text 49"}]}}}}$mapping$::jsonb;
 block text; spec jsonb; field text; parts jsonb; part jsonb; text_value text; updated jsonb;
begin
 for block,spec in select * from jsonb_each(coalesce(mappings->chapter,'{}'::jsonb)) loop
  if value ? block and (select count(*) from jsonb_object_keys(value->block))=(spec->>'old')::integer then
   updated='{}'::jsonb;
   for field,parts in select * from jsonb_each(spec->'fields') loop
    text_value='';
    for part in select jsonb_array_elements(parts) loop
     if part ? 'key' and jsonb_typeof(value->block->(part->>'key')) is distinct from 'string' then raise exception 'Common text schema changed; review this copy before migration.'; end if;
     text_value=text_value || case when part ? 'key' then value->block->>(part->>'key') else part->>'text' end;
    end loop;
    updated=updated || jsonb_build_object(field,text_value);
   end loop;
   value=jsonb_set(value,array[block],updated);
  end if;
 end loop;
 return value;
end;
$$;
revoke all on function aiwise_private.normalize_common_copy(text,jsonb) from public,anon,authenticated;
update public.workspace_content_sources set slots=aiwise_private.normalize_common_copy(chapter,slots) where course='common';
update public.workspace_beta_content set slots=aiwise_private.normalize_common_copy(chapter,slots) where course='common';

-- Supplement English catalogs without overwriting approved text or old submitted copies.
insert into public.workspace_content_sources(course,chapter,locale,slots) values ('common','c1','en',$copy${
  "c1.extra-0": {
    "Text 1": "AI-Wise",
    "Text 2": "Core Blocks",
    "Text 3": " › C1 · What is GenAI?\n  ",
    "alt 1": "Erasmus University Rotterdam"
  },
  "c1.extra-1": {
    "Text 1": "Core Blocks Navigation"
  },
  "c1.extra-2": {
    "Text 1": "C1 · Core Block"
  },
  "c1.extra-3": {
    "Text 1": "Section 1"
  },
  "c1.extra-4": {
    "Text 1": "Section 2"
  },
  "c1.extra-5": {
    "Text 1": "Section 3"
  },
  "c1.extra-6": {
    "Text 1": "↑"
  },
  "c1.extra-7": {
    "Text 1": "↓"
  },
  "c1.extra-8": {
    "Text 1": "Core Blocks",
    "Text 2": "← Back to Home"
  },
  "c1.extra-9": {
    "Text 1": "← Back to Home"
  },
  "c1.extra-10": {
    "Text 1": "Next"
  },
  "c1.extra-11": {
    "Text 1": "C2 · What is AI for us?"
  },
  "c1.extra-12": {
    "Text 1": "Continue to C2 →"
  },
  "c1.extra-13": {
    "Navigation c1 1": "C1: What is AI?",
    "Navigation c2 1": "C2: What is AI for us?",
    "Navigation c3 1": "C3: How do we use AI?",
    "Navigation c1 section 1 1": "History & Development",
    "Navigation c1 section 2 1": "Anatomy of GenAI",
    "Navigation c1 section 3 1": "GenAI Output Traits",
    "Navigation c2 section 1 1": "AI vs Human Intelligence",
    "Navigation c2 section 2 1": "Human vs GenAI",
    "Navigation c2 section 3 1": "Collaboration Framework",
    "Navigation c3 section 1 1": "Prompt",
    "Navigation c3 section 2 1": "Critique",
    "Navigation c3 section 3 1": "Integrate",
    "subsections 1": "subsections toggle",
    "slide 1": "Go to slide",
    "example 1": "Example",
    "of 1": "of",
    "thinking 1": "What you are actually thinking",
    "typing 1": "What you type",
    "processing 1": "How the model actually processes this",
    "adopt 1": "Adopt",
    "modify 1": "Modify",
    "discard 1": "Discard",
    "self 1": "Self",
    "ai 1": "AI",
    "team 1": "Team",
    "copy 1": "Copy",
    "copied 1": "Copied",
    "course 1": "Course",
    "change 1": "Change",
    "choose course 1": "Choose your course",
    "course help 1": "AI-Wise adapts its examples, explanations, and prompt templates to your course. You can change this at any time.",
    "feedback 1": "Feedback",
    "send feedback 1": "Send feedback",
    "close feedback 1": "Close feedback",
    "feedback question 1": "What's on your mind?",
    "feedback placeholder 1": "Share a thought, suggestion, or issue...",
    "feedback thanks 1": "Thank you — your feedback has been noted."
  },
  "c1.extra-14": {
    "Page title 1": "AI-Wise · C1: What is GenAI?"
  },
  "c1.extra-15": {
    "title 1": "GenAI System Map"
  }
}$copy$::jsonb)
on conflict(course,chapter,locale) do update set slots=excluded.slots || workspace_content_sources.slots;
insert into public.workspace_content_sources(course,chapter,locale,slots) values ('common','c2','en',$copy${
  "c2.extra-0": {
    "Text 1": "AI-Wise",
    "Text 2": "Core Blocks",
    "Text 3": " › C2 · What is AI for us?\n  ",
    "alt 1": "Erasmus University Rotterdam"
  },
  "c2.extra-1": {
    "Text 1": "Core Blocks Navigation"
  },
  "c2.extra-2": {
    "Text 1": "C2 · Core Block"
  },
  "c2.extra-3": {
    "Text 1": "Section 1"
  },
  "c2.extra-4": {
    "Text 1": "Section 2"
  },
  "c2.extra-5": {
    "Text 1": "Section 3"
  },
  "c2.extra-6": {
    "Text 1": "Core Blocks",
    "Text 2": "← Back to Home"
  },
  "c2.extra-7": {
    "Text 1": "← C1 · What is GenAI?"
  },
  "c2.extra-8": {
    "Text 1": "Next"
  },
  "c2.extra-9": {
    "Text 1": "C3 · How to Engage"
  },
  "c2.extra-10": {
    "Text 1": "\n    Continue to C3 →\n  "
  },
  "c2.extra-11": {
    "Navigation c1 1": "C1: What is AI?",
    "Navigation c2 1": "C2: What is AI for us?",
    "Navigation c3 1": "C3: How do we use AI?",
    "Navigation c1 section 1 1": "History & Development",
    "Navigation c1 section 2 1": "Anatomy of GenAI",
    "Navigation c1 section 3 1": "GenAI Output Traits",
    "Navigation c2 section 1 1": "AI vs Human Intelligence",
    "Navigation c2 section 2 1": "Human vs GenAI",
    "Navigation c2 section 3 1": "Collaboration Framework",
    "Navigation c3 section 1 1": "Prompt",
    "Navigation c3 section 2 1": "Critique",
    "Navigation c3 section 3 1": "Integrate",
    "subsections 1": "subsections toggle",
    "slide 1": "Go to slide",
    "example 1": "Example",
    "of 1": "of",
    "thinking 1": "What you are actually thinking",
    "typing 1": "What you type",
    "processing 1": "How the model actually processes this",
    "adopt 1": "Adopt",
    "modify 1": "Modify",
    "discard 1": "Discard",
    "self 1": "Self",
    "ai 1": "AI",
    "team 1": "Team",
    "copy 1": "Copy",
    "copied 1": "Copied",
    "course 1": "Course",
    "change 1": "Change",
    "choose course 1": "Choose your course",
    "course help 1": "AI-Wise adapts its examples, explanations, and prompt templates to your course. You can change this at any time.",
    "feedback 1": "Feedback",
    "send feedback 1": "Send feedback",
    "close feedback 1": "Close feedback",
    "feedback question 1": "What's on your mind?",
    "feedback placeholder 1": "Share a thought, suggestion, or issue...",
    "feedback thanks 1": "Thank you — your feedback has been noted."
  },
  "c2.extra-12": {
    "Page title 1": "AI-Wise · C2: What is AI for us?"
  },
  "c2.extra-13": {
    "aria-label 1": "Previous"
  },
  "c2.extra-14": {
    "aria-label 1": "Next"
  },
  "c2.extra-15": {
    "aria-label 1": "SAT Framework: four alternating Self-AI and Self-Team cycles producing an accelerating growth curve, with human anchor icons at every transition"
  },
  "c2.extra-16": {
    "aria-label 1": "Self-AI loop: Self Intent, AI Operationalize, Self Judge, AI Refine"
  },
  "c2.extra-17": {
    "aria-label 1": "Self-Team loop: Self Present, Team Feedback, Self Integrate, Team Expand"
  }
}$copy$::jsonb)
on conflict(course,chapter,locale) do update set slots=excluded.slots || workspace_content_sources.slots;
insert into public.workspace_content_sources(course,chapter,locale,slots) values ('common','c3','en',$copy${
  "c3.extra-0": {
    "Text 1": "AI-Wise",
    "Text 2": "Core Blocks",
    "Text 3": " › C3 · How Do We Use AI?\n  ",
    "alt 1": "Erasmus University Rotterdam"
  },
  "c3.extra-1": {
    "Text 1": "Core Blocks Navigation"
  },
  "c3.extra-2": {
    "Text 1": "C3 · Core Block"
  },
  "c3.extra-3": {
    "Text 1": "1"
  },
  "c3.extra-4": {
    "Text 1": "→"
  },
  "c3.extra-5": {
    "Text 1": "2"
  },
  "c3.extra-6": {
    "Text 1": "→"
  },
  "c3.extra-7": {
    "Text 1": "3"
  },
  "c3.extra-8": {
    "Text 1": "Section 1 · Prompt"
  },
  "c3.extra-9": {
    "Text 1": "1"
  },
  "c3.extra-10": {
    "Text 1": "2"
  },
  "c3.extra-11": {
    "Text 1": "3"
  },
  "c3.extra-12": {
    "Text 1": "4"
  },
  "c3.extra-13": {
    "Text 1": "5"
  },
  "c3.extra-14": {
    "Text 1": "6"
  },
  "c3.extra-15": {
    "Text 1": "1"
  },
  "c3.extra-16": {
    "Text 1": "2"
  },
  "c3.extra-17": {
    "Text 1": "3"
  },
  "c3.extra-18": {
    "Text 1": "4"
  },
  "c3.extra-19": {
    "Text 1": "5"
  },
  "c3.extra-20": {
    "Text 1": "6"
  },
  "c3.extra-21": {
    "Text 1": "Section 2 · Critique"
  },
  "c3.extra-22": {
    "Text 1": "1"
  },
  "c3.extra-23": {
    "Text 1": "2"
  },
  "c3.extra-24": {
    "Text 1": "3"
  },
  "c3.extra-25": {
    "Text 1": "4"
  },
  "c3.extra-26": {
    "Text 1": "← Prev"
  },
  "c3.extra-27": {
    "Text 1": "Next →"
  },
  "c3.extra-28": {
    "Text 1": "Section 3 · Integrate"
  },
  "c3.extra-29": {
    "Text 1": "1"
  },
  "c3.extra-30": {
    "Text 1": "2"
  },
  "c3.extra-31": {
    "Text 1": "3"
  },
  "c3.extra-32": {
    "Text 1": "4"
  },
  "c3.extra-33": {
    "Text 1": "← Prev"
  },
  "c3.extra-34": {
    "Text 1": "Next →"
  },
  "c3.extra-35": {
    "Text 1": "double click to stop the alert"
  },
  "c3.extra-36": {
    "Text 1": "Closing · Template"
  },
  "c3.extra-37": {
    "Text 1": "Copy"
  },
  "c3.extra-38": {
    "Text 1": "Core Blocks",
    "Text 2": "← Back to Home"
  },
  "c3.extra-39": {
    "Text 1": "← C2 · What is AI for us?"
  },
  "c3.extra-40": {
    "Text 1": "Next"
  },
  "c3.extra-41": {
    "Text 1": "GenAI in AWS I"
  },
  "c3.extra-42": {
    "Text 1": "Continue →"
  },
  "c3.extra-43": {
    "Navigation c1 1": "C1: What is AI?",
    "Navigation c2 1": "C2: What is AI for us?",
    "Navigation c3 1": "C3: How do we use AI?",
    "Navigation c1 section 1 1": "History & Development",
    "Navigation c1 section 2 1": "Anatomy of GenAI",
    "Navigation c1 section 3 1": "GenAI Output Traits",
    "Navigation c2 section 1 1": "AI vs Human Intelligence",
    "Navigation c2 section 2 1": "Human vs GenAI",
    "Navigation c2 section 3 1": "Collaboration Framework",
    "Navigation c3 section 1 1": "Prompt",
    "Navigation c3 section 2 1": "Critique",
    "Navigation c3 section 3 1": "Integrate",
    "subsections 1": "subsections toggle",
    "slide 1": "Go to slide",
    "example 1": "Example",
    "of 1": "of",
    "thinking 1": "What you are actually thinking",
    "typing 1": "What you type",
    "processing 1": "How the model actually processes this",
    "adopt 1": "Adopt",
    "modify 1": "Modify",
    "discard 1": "Discard",
    "self 1": "Self",
    "ai 1": "AI",
    "team 1": "Team",
    "copy 1": "Copy",
    "copied 1": "Copied",
    "course 1": "Course",
    "change 1": "Change",
    "choose course 1": "Choose your course",
    "course help 1": "AI-Wise adapts its examples, explanations, and prompt templates to your course. You can change this at any time.",
    "feedback 1": "Feedback",
    "send feedback 1": "Send feedback",
    "close feedback 1": "Close feedback",
    "feedback question 1": "What's on your mind?",
    "feedback placeholder 1": "Share a thought, suggestion, or issue...",
    "feedback thanks 1": "Thank you — your feedback has been noted."
  },
  "c3.extra-44": {
    "Page title 1": "AI-Wise · C3: How Do We Use AI?"
  },
  "c3.extra-45": {
    "aria-label 1": "Copy prompt template"
  }
}$copy$::jsonb)
on conflict(course,chapter,locale) do update set slots=excluded.slots || workspace_content_sources.slots;
insert into public.workspace_content_sources(course,chapter,locale,slots) values ('common','map','en',$copy${
  "map.extra-0": {
    "Text 1": "GenAI System Map"
  },
  "map.extra-1": {
    "Text 1": "Full System"
  },
  "map.extra-2": {
    "Text 1": "Training Cycle"
  },
  "map.extra-3": {
    "Text 1": "Inference Cycle"
  },
  "map.extra-4": {
    "Text 1": "Reset"
  },
  "map.extra-5": {
    "Text 1": "Pinch or ⌘ / Ctrl + scroll to zoom · Drag to pan · Hover to inspect"
  },
  "map.extra-6": {
    "Text 1": "Nodes"
  },
  "map.extra-7": {
    "Text 1": "\n    Physical (cube)\n  "
  },
  "map.extra-8": {
    "Text 1": "\n    AI Company\n  "
  },
  "map.extra-9": {
    "Text 1": "\n    Training component\n  "
  },
  "map.extra-10": {
    "Text 1": "\n    Inference component\n  "
  },
  "map.extra-11": {
    "Text 1": "\n    Training data subtype\n  "
  },
  "map.extra-12": {
    "Text 1": "\n    Algorithm (bridge)\n  "
  },
  "map.extra-13": {
    "Text 1": "Connections"
  },
  "map.extra-14": {
    "Text 1": "\n    Physical / data flow\n  "
  },
  "map.extra-15": {
    "Text 1": "\n    Feedback loop\n  "
  },
  "map.extra-16": {
    "Text 1": "\n    Governance\n  "
  },
  "map.extra-17": {
    "Label 1": "User",
    "Category 1": "Physical",
    "Description 1": "The human who types prompts and receives responses. The starting and ending point of every inference cycle."
  },
  "map.extra-18": {
    "Label 1": "Local Device",
    "Category 1": "Physical",
    "Description 1": "Your laptop or phone. Only the interface — sends prompts and displays responses. No computation happens here."
  },
  "map.extra-19": {
    "Label 1": "Cloud Server\nData Centre",
    "Category 1": "Physical",
    "Description 1": "Remote GPU clusters in physical buildings. This is where all computation actually runs — vast electrical infrastructure."
  },
  "map.extra-20": {
    "Label 1": "AI Company",
    "Category 1": "AI Company",
    "Description 1": "e.g. OpenAI, Anthropic, Google DeepMind. Controls training data selection, model architecture, and alignment decisions."
  },
  "map.extra-21": {
    "Label 1": "Training Data",
    "Category 1": "Training",
    "Description 1": "Billions of tokens from diverse sources, collected and curated before training begins."
  },
  "map.extra-22": {
    "Label 1": "Tokenisation",
    "Category 1": "Training",
    "Description 1": "Text split into subword units and converted to numbers. Language becomes a numerical sequence."
  },
  "map.extra-23": {
    "Label 1": "Positional\nEncoding",
    "Category 1": "Training",
    "Description 1": "Transformers process tokens in parallel and have no inherent sense of order. Positional encodings inject sequence position into each token."
  },
  "map.extra-24": {
    "Label 1": "Algorithm\n+ Weights",
    "Category 1": "Bridge",
    "Description 1": "The transformer architecture. During training, weights adjust continuously. During inference, weights are frozen. Same architecture — different mode."
  },
  "map.extra-25": {
    "Label 1": "Loss +\nBackprop",
    "Category 1": "Training",
    "Description 1": "Prediction error is calculated and propagated back through the network. Weights are adjusted. This loop repeats billions of times."
  },
  "map.extra-26": {
    "Label 1": "Fine-tuning\n/ RLHF",
    "Category 1": "Training",
    "Description 1": "Human evaluators rate outputs. The model is trained toward helpfulness and accuracy. Consented user input feeds here, shaping alignment."
  },
  "map.extra-27": {
    "Label 1": "Web Crawl",
    "Category 1": "Training Data",
    "Description 1": "Publicly indexed web pages. Common Crawl is the primary source — the majority of training volume by token count."
  },
  "map.extra-28": {
    "Label 1": "Books",
    "Category 1": "Training Data",
    "Description 1": "Digitised books and long-form text. BooksCorpus, Project Gutenberg. Gives the model coherent long-range structure."
  },
  "map.extra-29": {
    "Label 1": "Academic\nPapers",
    "Category 1": "Training Data",
    "Description 1": "arXiv, PubMed, academic databases. Domain-specific knowledge and scientific reasoning."
  },
  "map.extra-30": {
    "Label 1": "Code\nRepositories",
    "Category 1": "Training Data",
    "Description 1": "GitHub and similar. Programming corpora giving the model structured logical reasoning ability."
  },
  "map.extra-31": {
    "Label 1": "Encyclopaedic\nCurated",
    "Category 1": "Training Data",
    "Description 1": "Wikipedia, news archives, structured reference material. High quality, reliable baseline knowledge."
  },
  "map.extra-32": {
    "Label 1": "Licensed\nData",
    "Category 1": "Training Data",
    "Description 1": "Data purchased or licensed from third-party publishers, news organisations, and data providers."
  },
  "map.extra-33": {
    "Label 1": "User Prompt",
    "Category 1": "Inference",
    "Description 1": "You type a message. Natural language enters the system. Your device sends it to the server via the internet."
  },
  "map.extra-34": {
    "Label 1": "Tokenisation",
    "Category 1": "Inference",
    "Description 1": "Your prompt is split using the same token format as training. From this point, your message is a sequence of numbers."
  },
  "map.extra-35": {
    "Label 1": "Positional\nEncoding",
    "Category 1": "Inference",
    "Description 1": "Token order is encoded before entering the transformer. Same step as training."
  },
  "map.extra-36": {
    "Label 1": "Logits /\nSoftmax",
    "Category 1": "Inference",
    "Description 1": "The final layer scores every token in the vocabulary. Softmax converts scores into a probability distribution — likelihoods, not answers."
  },
  "map.extra-37": {
    "Label 1": "Output\nSampling",
    "Category 1": "Inference",
    "Description 1": "A token is selected probabilistically. Same prompt can produce different responses — generation is not deterministic by default."
  },
  "map.extra-38": {
    "Label 1": "Response /\nInterface",
    "Category 1": "Inference",
    "Description 1": "Tokens decoded back into language. This is the first moment language exists again — everything before this was numbers."
  },
  "map.extra-39": {
    "internet 1": "Internet",
    "same architecture 1": "same architecture",
    "different mode 1": "different mode",
    "training cycle 1": "TRAINING CYCLE",
    "inference cycle 1": "INFERENCE CYCLE"
  },
  "map.extra-40": {
    "Page title 1": "AI-Wise · GenAI System Map"
  }
}$copy$::jsonb)
on conflict(course,chapter,locale) do update set slots=excluded.slots || workspace_content_sources.slots;
update public.workspace_beta_content b set slots=s.slots || b.slots
from public.workspace_content_sources s where s.course=b.course and s.chapter=b.chapter and s.locale=b.locale and b.course='common';
-- The existing Others module inherits the repository AWS1 defaults, independently of AWS1 releases.
insert into public.workspace_content_sources(course,chapter,locale,slots) select 'other',chapter,'en',slots from public.workspace_content_sources where course='aws1' and locale='en';
-- Dutch starts as explicitly untranslated English source; these are NOT approved releases.
insert into public.workspace_content_sources(course,chapter,locale,slots)
 select s.course,s.chapter,'nl',coalesce(b.slots,s.slots) from public.workspace_content_sources s
 left join public.workspace_beta_content b on b.course=s.course and b.chapter=s.chapter and b.locale='en'
 where s.locale='en';

create or replace function aiwise_private.submit_localized_content(
 p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,
 p_base_release uuid,p_saved_at timestamptz,p_summary text,p_locale text,p_source_release uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.workspace_submissions; baseline jsonb; current_release uuid; result uuid; author text; english_release uuid;
begin
 if public.workspace_role() is null then raise exception 'Active team membership is required.' using errcode='42501'; end if;
 if p_locale is null or p_locale not in ('en','nl') then raise exception 'Unsupported content language.'; end if;
 if p_client_id is null then raise exception 'A submission ID is required.'; end if;
 -- Serialize retries per account and client ID before the idempotency lookup.
 perform pg_advisory_xact_lock(hashtextextended(uid::text || p_client_id::text,0));
 select * into existing from public.workspace_submissions where author_id=uid and client_id=p_client_id;
 if found then
  if existing.locale is distinct from p_locale or existing.source_release is distinct from p_source_release or existing.course is distinct from p_course or existing.chapter is distinct from p_chapter or existing.slots is distinct from p_slots then raise exception 'Submission ID already belongs to another content copy.'; end if;
  return existing.id;
 end if;
 if p_locale='nl' then
  perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || p_course || ':' || p_chapter || ':en',0));
  select submission_id into english_release from public.workspace_beta_content where course=p_course and chapter=p_chapter and locale='en';
  if english_release is distinct from p_source_release then raise exception 'English source changed. Review the latest source before submitting.'; end if;
 elsif p_source_release is not null then raise exception 'English content cannot reference a translation source.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || p_course || ':' || p_chapter || ':' || p_locale,0));
 select slots into baseline from public.workspace_content_sources where course=p_course and chapter=p_chapter and locale=p_locale;
 if baseline is null then raise exception 'Unsupported course or chapter.'; end if;
 select submission_id,slots into current_release,baseline from public.workspace_beta_content where course=p_course and chapter=p_chapter and locale=p_locale;
 if not found then select slots into baseline from public.workspace_content_sources where course=p_course and chapter=p_chapter and locale=p_locale; end if;
 if current_release is distinct from p_base_release or baseline is distinct from p_base_slots then raise exception 'Beta has changed. Reload Studio and reapply your edits before submitting.'; end if;
 if p_slots is null or octet_length(p_slots::text)>2000000 or not public.workspace_valid_content(p_slots,baseline) then raise exception 'The submitted content does not match the supported slot structure.'; end if;
 if p_saved_at is null or p_summary is null or length(btrim(p_summary)) not between 1 and 12000 then raise exception 'A saved draft and change summary are required.'; end if;
 select coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),80),''),'Team member') into author from auth.users where id=uid;
 insert into public.workspace_submissions(client_id,course,chapter,author_id,author_name,summary,slots,base_slots,base_release,saved_at,locale,source_release,catalog_version)
 values(p_client_id,p_course,p_chapter,uid,author,btrim(p_summary),p_slots,p_base_slots,p_base_release,p_saved_at,p_locale,p_source_release,2) returning id into result;
 return result;
end;
$$;

create or replace function aiwise_private.decide_localized_content(p_id uuid,p_revision integer,p_status text,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.workspace_submissions; current_release uuid; reviewer text; english_release uuid; baseline jsonb;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','revision','rejected') or p_reason is null or length(btrim(p_reason)) not between 1 and 12000 then raise exception 'Choose a decision and enter a reason.'; end if;
 select * into r from public.workspace_submissions where id=p_id for update;
 if not found or r.status <> 'pending' or r.revision is distinct from p_revision then raise exception 'This request already changed. Refresh before reviewing.'; end if;
 if p_status='approved' then
  if r.locale='nl' then
   perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || r.course || ':' || r.chapter || ':en',0));
   select submission_id into english_release from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale='en';
   if english_release is distinct from r.source_release then raise exception 'English source changed. Request a translation revision.'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || r.course || ':' || r.chapter || ':' || r.locale,0));
  select submission_id into current_release from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale=r.locale;
  if current_release is distinct from r.base_release then raise exception 'A newer version is already in Beta. Request revision instead of overwriting it.'; end if;
  select coalesce(b.slots,s.slots) into baseline from public.workspace_content_sources s
   left join public.workspace_beta_content b on b.course=s.course and b.chapter=s.chapter and b.locale=s.locale
   where s.course=r.course and s.chapter=r.chapter and s.locale=r.locale;
  if r.course='common' and r.catalog_version=1 then r.slots=aiwise_private.normalize_common_copy(r.chapter,r.slots); end if;
  -- Legacy Common submissions keep their immutable content; new supplemental fields retain current defaults.
  if not public.workspace_valid_content(baseline || r.slots,baseline) then raise exception 'Content structure changed. Request revision.'; end if;
  insert into public.workspace_beta_content(course,chapter,locale,submission_id,slots,source_release)
   values(r.course,r.chapter,r.locale,r.id,baseline || r.slots,r.source_release)
   on conflict(course,chapter,locale) do update set submission_id=excluded.submission_id,slots=excluded.slots,source_release=excluded.source_release,approved_at=now();
 end if;
 select coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),80),''),'Administrator') into reviewer from auth.users where id=auth.uid();
 update public.workspace_submissions set status=p_status,revision=revision+1,reviewer_id=auth.uid(),reviewer_name=reviewer,decision_reason=btrim(p_reason),decided_at=now() where id=p_id;
 return p_id;
end;
$$;
revoke all on function aiwise_private.submit_localized_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid),aiwise_private.decide_localized_content(uuid,integer,text,text) from public,anon,authenticated;
grant usage on schema aiwise_private to authenticated;
grant execute on function aiwise_private.submit_localized_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid),aiwise_private.decide_localized_content(uuid,integer,text,text) to authenticated;
-- These public invoker wrappers expose only the guarded operations above.
create or replace function public.workspace_submit_localized_content(
 p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,p_base_release uuid,p_saved_at timestamptz,p_summary text,p_locale text,p_source_release uuid
) returns uuid language sql security invoker set search_path='' as $$
 select aiwise_private.submit_localized_content(p_client_id,p_course,p_chapter,p_slots,p_base_slots,p_base_release,p_saved_at,p_summary,p_locale,p_source_release);
$$;
create or replace function public.workspace_submit_content(
 p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,p_base_release uuid,p_saved_at timestamptz,p_summary text
) returns uuid language sql security invoker set search_path='' as $$
 select aiwise_private.submit_localized_content(p_client_id,p_course,p_chapter,p_slots,p_base_slots,p_base_release,p_saved_at,p_summary,'en',null);
$$;
create or replace function public.workspace_decide_content(p_id uuid,p_revision integer,p_status text,p_reason text)
 returns uuid language sql security invoker set search_path='' as $$ select aiwise_private.decide_localized_content(p_id,p_revision,p_status,p_reason); $$;
revoke all on function public.workspace_submit_localized_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid),public.workspace_submit_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text),public.workspace_decide_content(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.workspace_submit_localized_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid),public.workspace_submit_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text),public.workspace_decide_content(uuid,integer,text,text) to authenticated;
-- Old English feedback keys stay unchanged. Dutch keys have a canonical lang suffix.
alter table public.workspace_beta_memos drop constraint workspace_beta_memos_page_check;
alter table public.workspace_beta_memos add constraint workspace_beta_memos_page_check
 check (length(page)<=512 and page ~ '^(common/[a-z0-9-]+\.html|course-specific/[a-z0-9_-]+/[a-zA-Z0-9_.()-]+\.html)(\?course=(aws1|ped|other)(&lang=nl)?|\?lang=nl)?$');
notify pgrst,'reload schema';
commit;
