-- =====================================================================
-- chapter_class_scopes_v13_draft.sql
-- PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.
--
-- This first gate creates the canonical chapter -> academic class junction
-- and seeds only five evidence-reviewed JEE Physics mappings. It deliberately
-- does NOT replace get_browse_curriculum or browse_facet_counts yet. The read
-- functions belong in a separately rehearsed second gate after these rows are
-- reviewed on an isolated clone.
-- =====================================================================

begin;

-- Fail closed even if this file is pasted into a SQL editor accidentally.
-- A later approved package must remove this guard explicitly.
do $not_approved$
begin
  raise exception 'NOT APPROVED: chapter class scopes v13 is a review-only draft';
end
$not_approved$;

create table if not exists public.chapter_class_levels (
  chapter_id bigint not null references public.chapters(id) on delete cascade,
  class_level_id bigint not null references public.class_levels(id) on delete cascade,
  source_url text not null,
  scope_note text not null,
  reviewed_on date not null,
  created_at timestamptz not null default now(),
  primary key (chapter_id, class_level_id)
);

comment on table public.chapter_class_levels is
  'Canonical academic class membership for chapters. Course audience tags must not determine this.';

alter table public.chapter_class_levels enable row level security;
create policy "public read canonical chapter classes"
  on public.chapter_class_levels for select using (true);
revoke all on table public.chapter_class_levels from public, anon, authenticated;
grant select on table public.chapter_class_levels to anon, authenticated;

with reviewed(subject_slug, chapter_slug, class_slug, source_url, scope_note) as (
  values
    ('physics', 'kinematics', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Umbrella for Class XI motion in a straight line and motion in a plane'),
    ('physics', 'newtons-laws-of-motion-nlm', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XI Laws of Motion'),
    ('physics', 'work-energy-and-power', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XI Work, Energy and Power'),
    ('physics', 'ray-optics-and-optical-instruments', 'class-12',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XII Ray Optics and Optical Instruments'),
    ('physics', 'modern-physics', 'class-12',
      'https://ncert.nic.in/textbook/pdf/leph2ps.pdf',
      'Umbrella for Class XII dual nature, atoms, nuclei and semiconductor content')
)
insert into public.chapter_class_levels (
  chapter_id, class_level_id, source_url, scope_note, reviewed_on
)
select ch.id, cl.id, reviewed.source_url, reviewed.scope_note, date '2026-08-01'
from reviewed
join public.subjects s on s.slug = reviewed.subject_slug
join public.chapters ch on ch.subject_id = s.id and ch.slug = reviewed.chapter_slug
join public.class_levels cl on cl.slug = reviewed.class_slug
on conflict (chapter_id, class_level_id) do nothing;

do $postflight$
declare
  v_reviewed_count integer;
begin
  select count(*) into v_reviewed_count
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  where ch.slug in (
    'kinematics', 'newtons-laws-of-motion-nlm', 'work-energy-and-power',
    'ray-optics-and-optical-instruments', 'modern-physics'
  );

  if v_reviewed_count <> 5 then
    raise exception 'POSTFLIGHT: expected five reviewed chapter/class rows, got %', v_reviewed_count;
  end if;

  if exists (
    select 1
    from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
    where cl.slug = 'dropper'
  ) then
    raise exception 'POSTFLIGHT: Dropper is a target cohort, not a canonical chapter class';
  end if;
end
$postflight$;

commit;
