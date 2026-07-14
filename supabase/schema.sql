-- =========================================================================
-- SCS Student Council Officer Applicant Evaluation System
-- Supabase schema: tables, RLS policies, triggers, seed data, seed accounts
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Safe to re-run: uses "if not exists" / "on conflict" throughout.
-- =========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROFILES  (one row per auth.users, holds username, display name, role)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  role text not null default 'evaluator' check (role in ('commissioner', 'evaluator')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by any signed-in user" on public.profiles;
create policy "Profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'evaluator')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. POSITIONS
-- ---------------------------------------------------------------------
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  max_slots int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.positions enable row level security;

drop policy if exists "Positions are readable by any signed-in user" on public.positions;
create policy "Positions are readable by any signed-in user"
  on public.positions for select
  to authenticated
  using (true);

drop policy if exists "Only commissioners manage positions" on public.positions;
create policy "Only commissioners manage positions"
  on public.positions for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'));

-- ---------------------------------------------------------------------
-- 3. APPLICANTS
-- ---------------------------------------------------------------------
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  email text,
  course text,
  year_level text,
  position_applied_id uuid references public.positions (id) on delete set null,
  position_assigned_id uuid references public.positions (id) on delete set null,
  -- Extra positions the same person also applied for. A person is one row /
  -- one grading sheet no matter how many positions they applied to; any
  -- additional positions beyond position_applied_id are tracked here so the
  -- roster and grading sheet stay merged instead of duplicated.
  other_positions text[] not null default '{}',
  status text not null default 'Pending' check (status in ('Pending', 'Evaluated', 'Qualified', 'Disqualified')),
  created_at timestamptz not null default now()
);

-- Backfill for databases created before this column existed.
alter table public.applicants add column if not exists other_positions text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 3b. MERGE ANY EXISTING DUPLICATE APPLICANTS (same person, multiple rows
-- from applying to multiple positions). Keeps the oldest row per name,
-- folds the other positions into other_positions, moves any evaluations /
-- assignments over to the kept row, and deletes the duplicate rows.
-- Safe to re-run: no-op once no duplicates remain.
-- ---------------------------------------------------------------------
do $$
declare
  grp record;
  keep_id uuid;
  dup_id uuid;
  dup_pos_name text;
begin
  for grp in
    select lower(trim(full_name)) as key, array_agg(id order by created_at) as ids
    from public.applicants
    group by lower(trim(full_name))
    having count(*) > 1
  loop
    keep_id := grp.ids[1];

    for dup_id in select unnest(grp.ids[2:array_length(grp.ids, 1)])
    loop
      select p.name into dup_pos_name
      from public.applicants a
      join public.positions p on p.id = a.position_applied_id
      where a.id = dup_id;

      if dup_pos_name is not null then
        update public.applicants
           set other_positions = array_append(other_positions, dup_pos_name)
         where id = keep_id
           and not (dup_pos_name = any(other_positions));
      end if;

      -- Move evaluators assigned to the duplicate onto the kept applicant.
      insert into public.applicant_evaluators (applicant_id, evaluator_id)
      select keep_id, evaluator_id from public.applicant_evaluators where applicant_id = dup_id
      on conflict (applicant_id, evaluator_id) do nothing;

      -- Move any evaluations already submitted against the duplicate onto the kept applicant,
      -- unless that evaluator already graded the kept applicant.
      update public.evaluations e
         set applicant_id = keep_id
       where e.applicant_id = dup_id
         and not exists (
           select 1 from public.evaluations e2
           where e2.applicant_id = keep_id and e2.evaluator_id = e.evaluator_id
         );

      delete from public.applicants where id = dup_id;
    end loop;
  end loop;
end $$;

-- Enforce "one applicant = one row" going forward (case/space-insensitive on full_name).
create unique index if not exists applicants_full_name_unique_idx
  on public.applicants (lower(trim(full_name)));

alter table public.applicants enable row level security;

drop policy if exists "Applicants are readable by any signed-in user" on public.applicants;
create policy "Applicants are readable by any signed-in user"
  on public.applicants for select
  to authenticated
  using (true);

drop policy if exists "Only commissioners manage applicants" on public.applicants;
create policy "Only commissioners manage applicants"
  on public.applicants for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'));

-- ---------------------------------------------------------------------
-- 4. APPLICANT_EVALUATORS  (many-to-many: which evaluators an applicant is assigned to)
-- ---------------------------------------------------------------------
create table if not exists public.applicant_evaluators (
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (applicant_id, evaluator_id)
);

alter table public.applicant_evaluators enable row level security;

drop policy if exists "Assignments are readable by any signed-in user" on public.applicant_evaluators;
create policy "Assignments are readable by any signed-in user"
  on public.applicant_evaluators for select
  to authenticated
  using (true);

drop policy if exists "Only commissioners manage assignments" on public.applicant_evaluators;
create policy "Only commissioners manage assignments"
  on public.applicant_evaluators for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'));

-- ---------------------------------------------------------------------
-- 5. EVALUATIONS  (one row per applicant per evaluator)
-- ---------------------------------------------------------------------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  -- References profiles (not auth.users) so the API can embed the evaluator's
  -- display name directly via a PostgREST join (auth.users isn't exposed to the API).
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  leadership smallint not null check (leadership between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  role_knowledge smallint not null check (role_knowledge between 1 and 5),
  problem_solving smallint not null check (problem_solving between 1 and 5),
  commitment smallint not null check (commitment between 1 and 5),
  professionalism smallint not null check (professionalism between 1 and 5),
  recommendation text not null check (
    recommendation in ('Highly Recommended', 'Recommended', 'Recommended with Reservations', 'Not Recommended')
  ),
  notes text,
  -- Which of the applicant's applied-for positions the panelist recommends
  -- them for (subset of position_applied + other_positions, stored by name).
  recommended_positions text[] not null default '{}',
  -- Optional: a position the panelist recommends instead/in addition, that
  -- the applicant did NOT originally apply for.
  recommended_other_position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, evaluator_id)
);

alter table public.evaluations enable row level security;

alter table public.evaluations add column if not exists recommended_positions text[] not null default '{}';
alter table public.evaluations add column if not exists recommended_other_position text;

drop policy if exists "Evaluations are readable by any signed-in user" on public.evaluations;
create policy "Evaluations are readable by any signed-in user"
  on public.evaluations for select
  to authenticated
  using (true);

drop policy if exists "Evaluators insert their own evaluation" on public.evaluations;
create policy "Evaluators insert their own evaluation"
  on public.evaluations for insert
  to authenticated
  with check (evaluator_id = auth.uid());

drop policy if exists "Evaluators update their own evaluation" on public.evaluations;
create policy "Evaluators update their own evaluation"
  on public.evaluations for update
  to authenticated
  using (evaluator_id = auth.uid())
  with check (evaluator_id = auth.uid());

-- Lets the Commissioner panel clear a bad/duplicate/mistaken score sheet
-- straight from the evaluation screen, without needing DB access.
drop policy if exists "Commissioners can clear any evaluation" on public.evaluations;
create policy "Commissioners can clear any evaluation"
  on public.evaluations for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'commissioner'));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists evaluations_set_updated_at on public.evaluations;
create trigger evaluations_set_updated_at
  before update on public.evaluations
  for each row execute procedure public.set_updated_at();

-- Auto-flip an applicant's status to "Evaluated" once at least one score sheet exists
create or replace function public.mark_applicant_evaluated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.applicants
     set status = 'Evaluated'
   where id = new.applicant_id
     and status = 'Pending';
  return new;
end;
$$;

drop trigger if exists evaluations_mark_evaluated on public.evaluations;
create trigger evaluations_mark_evaluated
  after insert on public.evaluations
  for each row execute procedure public.mark_applicant_evaluated();

-- ---------------------------------------------------------------------
-- 6. SEED DATA — SCS Student Council officer positions (canonical slate)
-- ---------------------------------------------------------------------
insert into public.positions (name, description, max_slots, sort_order) values
  ('President', 'Leads the organization and represents it to school administration.', 1, 1),
  ('Executive Secretary', 'Maintains official records, minutes, and council communications.', 1, 2),
  ('Deputy Secretary', 'Assists the Executive Secretary with records and correspondence.', 1, 3),
  ('Administrative Aide 1', 'Provides administrative and clerical support.', 1, 4),
  ('Administrative Aide 2', 'Provides administrative and clerical support.', 1, 5),
  ('Administrative Aide 3', 'Provides administrative and clerical support.', 1, 6),
  ('VP for Operations', 'Oversees day-to-day operations and logistics execution.', 1, 7),
  ('Planning Director', 'Leads event and activity planning.', 1, 8),
  ('Supply and Logistics Officer', 'Manages supplies and event logistics.', 1, 9),
  ('Creatives Director', 'Leads the creatives team and creative direction.', 1, 10),
  ('Graphic Designer 1', 'Produces graphics and visual design materials.', 1, 11),
  ('Graphic Designer 2', 'Produces graphics and visual design materials.', 1, 12),
  ('Graphic Designer 3', 'Produces graphics and visual design materials.', 1, 13),
  ('Video Production Officer', 'Leads video production and editing.', 1, 14),
  ('Photographer', 'Covers event photography.', 1, 15),
  ('Videographer', 'Covers event videography.', 1, 16),
  ('VP for Internal Affairs', 'Oversees internal member coordination and welfare.', 1, 17),
  ('Quality Assurance Director', 'Reviews output quality across committees.', 1, 18),
  ('DPA Compliance Officer', 'Ensures compliance with data privacy regulations.', 1, 19),
  ('Finance Director', 'Oversees council funds, budgets, and financial planning.', 1, 20),
  ('Accounting Officer', 'Manages financial transactions and accounting records.', 1, 21),
  ('VP for External Affairs', 'Handles partnerships and external representation.', 1, 22),
  ('Social Media Director', 'Oversees social media output and branding.', 1, 23),
  ('Social Media Manager', 'Manages day-to-day social media accounts and content.', 1, 24),
  ('Platform Manager', 'Manages digital platforms and online tools.', 1, 25),
  ('Public Relations Director', 'Leads public relations and external communications.', 1, 26),
  ('BSCS Governor', 'Represents the BSCS student body.', 1, 27),
  ('BSIT Governor', 'Represents the BSIT student body.', 1, 28),
  ('BSIS Governor', 'Represents the BSIS student body.', 1, 29)
on conflict (name) do nothing;

-- Rename pass for databases that already seeded the old "Graphics Artist N"
-- titles, so existing rows/foreign keys are relabeled instead of orphaned.
update public.positions set name = 'Graphic Designer 1' where name = 'Graphics Artist 1';
update public.positions set name = 'Graphic Designer 2' where name = 'Graphics Artist 2';
update public.positions set name = 'Graphic Designer 3' where name = 'Graphics Artist 3';

-- ---------------------------------------------------------------------
-- 7. SEED LOGIN ACCOUNTS
-- The app logs in with a username (not an email). Each username below is
-- mapped internally to a synthetic email of the form "<username>@scs.local"
-- purely so Supabase Auth (which requires an email) has something to key
-- on — the user never sees or types that email.
--
--   Username     Password       Role          Name
--   admin        SCS20262027    commissioner  Lance De Leon
--   Evaluator1   SCS20262027    evaluator     Lance De Leon
--   Evaluator2   SCS20262027    evaluator     Sherrie Borbon
--   Evaluator3   SCS20262027    evaluator     Danilo Buenaventura
--   Evaluator4   SCS20262027    evaluator     Aira Dela Cruz
--
-- This block creates the auth.users rows directly (with an already-
-- encrypted password) plus their matching profiles row. It is safe to
-- re-run: existing usernames are skipped.
-- ---------------------------------------------------------------------
do $$
declare
  accounts jsonb := '[
    {"username": "admin",      "password": "SCS20262027", "role": "commissioner", "full_name": "Lance De Leon"},
    {"username": "Evaluator1", "password": "SCS20262027", "role": "evaluator",    "full_name": "Lance De Leon"},
    {"username": "Evaluator2", "password": "SCS20262027", "role": "evaluator",    "full_name": "Sherrie Borbon"},
    {"username": "Evaluator3", "password": "SCS20262027", "role": "evaluator",    "full_name": "Danilo Buenaventura"},
    {"username": "Evaluator4", "password": "SCS20262027", "role": "evaluator",    "full_name": "Aira Dela Cruz"}
  ]'::jsonb;
  acct jsonb;
  new_user_id uuid;
  synth_email text;
begin
  for acct in select * from jsonb_array_elements(accounts) loop
    synth_email := lower(acct ->> 'username') || '@scs.local';

    if exists (select 1 from public.profiles where username = acct ->> 'username') then
      continue;
    end if;

    new_user_id := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      synth_email,
      crypt(acct ->> 'password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'username', acct ->> 'username',
        'full_name', acct ->> 'full_name',
        'role', acct ->> 'role'
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Password-grant login also requires a matching auth.identities row for
    -- the "email" provider; without it Supabase Auth returns 400 Bad Request.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      new_user_id,
      new_user_id::text,
      jsonb_build_object('sub', new_user_id::text, 'email', synth_email),
      'email',
      now(),
      now(),
      now()
    );

    insert into public.profiles (id, username, full_name, role)
    values (new_user_id, acct ->> 'username', acct ->> 'full_name', acct ->> 'role')
    on conflict (id) do update
      set username = excluded.username, full_name = excluded.full_name, role = excluded.role;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7b. REPAIR PASS — backfills the auth.identities row for any account that
-- was created by an earlier version of this script (before the identities
-- insert above existed). Fixes "400 Bad Request" on login for accounts
-- that already exist. Safe to re-run.
-- ---------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select au.id, au.email
    from auth.users au
    join public.profiles p on p.id = au.id
    where au.email like '%@scs.local'
      and not exists (
        select 1 from auth.identities ai where ai.user_id = au.id and ai.provider = 'email'
      )
  loop
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      u.id,
      u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email),
      'email',
      now(),
      now(),
      now()
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. ADDING MORE ACCOUNTS LATER
-- Re-run step 7's block with a new accounts array (or use the Supabase
-- Auth dashboard: Authentication > Users > Add user, email
-- "<username>@scs.local", then set that user's role/username by running:
--
--   update public.profiles set role = 'evaluator', username = 'Evaluator5',
--     full_name = 'Full Name Here'
--   where id = (select id from auth.users where email = 'evaluator5@scs.local');
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 9. (removed) — the extra positions block that used to live here has
-- been merged into the canonical slate in section 6 above, using the
-- exact 28-position list. Nothing to do here anymore.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 10. OFFICER APPLICANTS + INTERVIEW TABLE ASSIGNMENTS
-- Each applicant is inserted once per position they applied for (a few
-- people applied to more than one position). "tables" are the interview
-- table numbers from the roster, mapped straight onto the Evaluator1-4
-- accounts (Table 1 -> Evaluator1, ... Table 4 -> Evaluator4), so each
-- applicant is auto-assigned to the matching evaluator(s) for grading.
-- Safe to re-run: skips a (name, position) pair that already exists.
-- ---------------------------------------------------------------------
do $$
declare
  rows jsonb := '[
    {"name":"Zeddrix Norial",              "position":"Planning Director",              "tables":[1]},
    {"name":"Zeddrix Norial",              "position":"Supply and Logistics Officer",   "tables":[1]},
    {"name":"Mykee Justine Crisostomo",    "position":"Platform Manager",               "tables":[2]},
    {"name":"Althea Krissa Tagao",         "position":"Creatives Director",             "tables":[3]},
    {"name":"Yessha Mae Alviar",           "position":"Graphic Designer 1",             "tables":[1]},
    {"name":"Ija Iriel Tarun",             "position":"Social Media Manager",           "tables":[2]},
    {"name":"John Benedict Reyes",         "position":"Supply and Logistics Officer",   "tables":[3]},
    {"name":"Kurt Sebastian Batino",       "position":"VP for Operations",              "tables":[1]},
    {"name":"Kurt Sebastian Batino",       "position":"Quality Assurance Director",     "tables":[1]},
    {"name":"Allisson Mae Cosip",          "position":"Planning Director",              "tables":[2]},
    {"name":"Alexis Mae Castillo",         "position":"Photographer",                   "tables":[3]},
    {"name":"Alexis Mae Castillo",         "position":"Social Media Director",          "tables":[3]},
    {"name":"Alexis Mae Castillo",         "position":"BSIT Governor",                  "tables":[3]},
    {"name":"Willona Abbey Rempillo",      "position":"VP for Internal Affairs",        "tables":[1,2,3,4]},
    {"name":"Gabriel Roque",               "position":"President",                      "tables":[1,2,3,4]},
    {"name":"Sophia Yven Daluyo",          "position":"VP for External Affairs",        "tables":[1,2,3,4]},
    {"name":"Ted Carlo Arestado",          "position":"VP for Operations",              "tables":[1,2,3,4]},
    {"name":"Bryan Albert Reyes",          "position":"Graphic Designer 2",             "tables":[1]},
    {"name":"John Caleb Cayetano",         "position":"Video Production Officer",       "tables":[2]},
    {"name":"John Caleb Cayetano",         "position":"Photographer",                   "tables":[2]},
    {"name":"John Caleb Cayetano",         "position":"Videographer",                   "tables":[2]},
    {"name":"Amir Wagas",                  "position":"Supply and Logistics Officer",   "tables":[3]},
    {"name":"Althea Kim Macasadia",        "position":"Planning Director",              "tables":[1]},
    {"name":"Althea Kim Macasadia",        "position":"Public Relations Director",      "tables":[1]},
    {"name":"Althea Kim Macasadia",        "position":"BSIT Governor",                  "tables":[1]},
    {"name":"Paul David Luis Vargas",      "position":"Photographer",                   "tables":[2]},
    {"name":"John Richie Belleza",         "position":"Creatives Director",             "tables":[3]},
    {"name":"John Richie Belleza",         "position":"Video Production Officer",       "tables":[3]},
    {"name":"John Richie Belleza",         "position":"Photographer",                   "tables":[3]},
    {"name":"Mark Spencer Cubacub",        "position":"Supply and Logistics Officer",   "tables":[1]},
    {"name":"Mark Spencer Cubacub",        "position":"BSIT Governor",                  "tables":[1]},
    {"name":"Charles Justin Javier",       "position":"Public Relations Director",      "tables":[2]},
    {"name":"Gerome Cleon Rodriguez",      "position":"Graphic Designer 3",             "tables":[3]},
    {"name":"Gerome Cleon Rodriguez",      "position":"Social Media Director",          "tables":[3]},
    {"name":"Gerome Cleon Rodriguez",      "position":"BSCS Governor",                  "tables":[3]},
    {"name":"Peneil Francis Cayaco",       "position":"DPA Compliance Officer",         "tables":[1]},
    {"name":"Steven Randolf Bigal",        "position":"Administrative Aide 1",          "tables":[2]},
    {"name":"Mary Nicole Angela De Vera",  "position":"Photographer",                   "tables":[3]},
    {"name":"Merwin Generoso",             "position":"Video Production Officer",       "tables":[1]},
    {"name":"Kyle Aimier Manza",           "position":"Supply and Logistics Officer",   "tables":[2]},
    {"name":"Kyle Aimier Manza",           "position":"Photographer",                   "tables":[2]},
    {"name":"Micaella Joy Vargas",         "position":"BSIT Governor",                  "tables":[3]},
    {"name":"Kenneth Malabarbar",          "position":"BSIS Governor",                  "tables":[1]},
    {"name":"Vince Gian Onte",             "position":"BSCS Governor",                  "tables":[2]},
    {"name":"Franchezka Nazareno",         "position":"Administrative Aide 2",          "tables":[3]},
    {"name":"Hann Dareen Bacsa",           "position":"Administrative Aide 3",          "tables":[1]},
    {"name":"Randlyn Faith Monares",       "position":"Administrative Aide 1",          "tables":[2]}
  ]'::jsonb;
  r jsonb;
  pos_id uuid;
  app_id uuid;
  tbl int;
  evaluator_username text;
  v_evaluator_id uuid;
  pos_name text;
begin
  -- One row per unique applicant NAME (not per position). If someone applied
  -- to multiple positions, the first one becomes position_applied_id and the
  -- rest are folded into other_positions, so there is exactly one grading
  -- sheet per person no matter how many positions they applied for.
  for r in select * from jsonb_array_elements(rows) loop
    pos_name := r ->> 'position';
    select id into pos_id from public.positions where name = pos_name;
    if pos_id is null then
      raise notice 'Skipping %: position "%" not found', r ->> 'name', pos_name;
      continue;
    end if;

    select id into app_id from public.applicants where lower(trim(full_name)) = lower(trim(r ->> 'name'));

    if app_id is null then
      insert into public.applicants (full_name, position_applied_id, position_assigned_id, status)
      values (r ->> 'name', pos_id, pos_id, 'Pending')
      returning id into app_id;
    elsif not exists (
      select 1 from public.applicants
      where id = app_id and (position_applied_id = pos_id or pos_name = any(other_positions))
    ) then
      update public.applicants
         set other_positions = array_append(other_positions, pos_name)
       where id = app_id;
    end if;

    for tbl in select jsonb_array_elements_text(r -> 'tables')::int loop
      evaluator_username := 'Evaluator' || tbl;
      select id into v_evaluator_id from public.profiles where username = evaluator_username;
      if v_evaluator_id is not null then
        insert into public.applicant_evaluators (applicant_id, evaluator_id)
        values (app_id, v_evaluator_id)
        on conflict (applicant_id, evaluator_id) do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10b. REPAIR PASS — fixes two applicants whose applied-for position
-- changed in the latest roster update, for databases that already ran
-- an earlier version of section 10. Safe to re-run.
--   - Althea Kim Macasadia: BSCS Governor -> BSIT Governor
--   - Ija Iriel Tarun: Platform Manager -> Social Media Manager
-- ---------------------------------------------------------------------
do $$
declare
  bsit_id uuid;
  smm_id uuid;
begin
  select id into bsit_id from public.positions where name = 'BSIT Governor';
  if bsit_id is not null then
    update public.applicants
       set other_positions = array_remove(other_positions, 'BSCS Governor')
     where lower(trim(full_name)) = lower(trim('Althea Kim Macasadia'))
       and 'BSCS Governor' = any(other_positions);

    update public.applicants
       set other_positions = array_append(other_positions, 'BSIT Governor')
     where lower(trim(full_name)) = lower(trim('Althea Kim Macasadia'))
       and not ('BSIT Governor' = any(other_positions))
       and position_applied_id <> bsit_id;
  end if;

  select id into smm_id from public.positions where name = 'Social Media Manager';
  if smm_id is not null then
    update public.applicants
       set position_applied_id = smm_id,
           position_assigned_id = case when position_assigned_id = position_applied_id then smm_id else position_assigned_id end
     where lower(trim(full_name)) = lower(trim('Ija Iriel Tarun'));
  end if;
end $$;

