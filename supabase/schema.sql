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
  status text not null default 'Pending' check (status in ('Pending', 'Evaluated', 'Qualified', 'Disqualified')),
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, evaluator_id)
);

alter table public.evaluations enable row level security;

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
-- 6. SEED DATA — typical SCS Student Council officer positions
-- ---------------------------------------------------------------------
insert into public.positions (name, description, max_slots, sort_order) values
  ('President', 'Leads the council and represents the student body to school administration.', 1, 1),
  ('Vice President', 'Assists the President and oversees committee operations.', 1, 2),
  ('Secretary', 'Maintains records, minutes, and official council communications.', 1, 3),
  ('Treasurer', 'Manages council funds, budgets, and financial reports.', 1, 4),
  ('Auditor', 'Reviews financial transactions and ensures fiscal accountability.', 1, 5),
  ('Public Information Officer', 'Handles publicity, announcements, and social media presence.', 1, 6),
  ('Business Manager', 'Oversees fundraising activities and council merchandise.', 1, 7),
  ('Sergeant-at-Arms', 'Maintains order during meetings and council events.', 2, 8)
on conflict (name) do nothing;

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
-- 9. OFFICER APPLICANT POSITIONS
-- Extra positions for this batch of applicants (kept alongside the
-- original Student Council slate from section 5 — harmless if unused).
-- ---------------------------------------------------------------------
insert into public.positions (name, description, max_slots, sort_order) values
  ('President', 'Leads the organization and represents it to school administration.', 1, 20),
  ('VP for Internal Affairs', 'Oversees internal member coordination and welfare.', 1, 21),
  ('VP for External Affairs', 'Handles partnerships and external representation.', 1, 22),
  ('VP for Operations', 'Oversees day-to-day operations and logistics execution.', 1, 23),
  ('Planning Director', 'Leads event and activity planning.', 1, 24),
  ('Platform Manager', 'Manages digital platforms and online tools.', 1, 25),
  ('Creatives Director', 'Leads the creatives team and creative direction.', 1, 26),
  ('Graphic Designer', 'Produces graphics and visual design materials.', 2, 27),
  ('Social Media Manager', 'Manages social media strategy and content calendar.', 1, 28),
  ('Social Media Director', 'Oversees social media output and branding.', 1, 29),
  ('Quality Assurance Director', 'Reviews output quality across committees.', 1, 30),
  ('Public Relations Director', 'Leads public relations and external communications.', 1, 31),
  ('Photographer', 'Covers event photography.', 3, 32),
  ('Videographer', 'Covers event videography.', 1, 33),
  ('Video Production Officer', 'Leads video production and editing.', 2, 34),
  ('Supply and Logistics Officer', 'Manages supplies and event logistics.', 4, 35),
  ('Administrative Aide', 'Provides administrative and clerical support.', 3, 36),
  ('DPA Compliance Officer', 'Ensures compliance with data privacy regulations.', 1, 37),
  ('BSIT Governor', 'Represents the BSIT student body.', 1, 38),
  ('BSCS Governor', 'Represents the BSCS student body.', 1, 39),
  ('BSIS Governor', 'Represents the BSIS student body.', 1, 40)
on conflict (name) do nothing;

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
    {"name":"Yessha Mae Alviar",           "position":"Graphic Designer",               "tables":[1]},
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
    {"name":"Bryan Albert Reyes",          "position":"Graphic Designer",               "tables":[1]},
    {"name":"John Caleb Cayetano",         "position":"Video Production Officer",       "tables":[2]},
    {"name":"John Caleb Cayetano",         "position":"Photographer",                   "tables":[2]},
    {"name":"John Caleb Cayetano",         "position":"Videographer",                   "tables":[2]},
    {"name":"Amir Wagas",                  "position":"Supply and Logistics Officer",   "tables":[3]},
    {"name":"Althea Kim Macasadia",        "position":"Planning Director",              "tables":[1]},
    {"name":"Althea Kim Macasadia",        "position":"Public Relations Director",      "tables":[1]},
    {"name":"Althea Kim Macasadia",        "position":"BSCS Governor",                  "tables":[1]},
    {"name":"Paul David Luis Vargas",      "position":"Photographer",                   "tables":[2]},
    {"name":"John Richie Belleza",         "position":"Creatives Director",             "tables":[3]},
    {"name":"John Richie Belleza",         "position":"Video Production Officer",       "tables":[3]},
    {"name":"John Richie Belleza",         "position":"Photographer",                   "tables":[3]},
    {"name":"Mark Spencer Cubacub",        "position":"Supply and Logistics Officer",   "tables":[1]},
    {"name":"Mark Spencer Cubacub",        "position":"BSIT Governor",                  "tables":[1]},
    {"name":"Charles Justin Javier",       "position":"Public Relations Director",      "tables":[2]},
    {"name":"Gerome Cleon Rodriguez",      "position":"Graphic Designer",               "tables":[3]},
    {"name":"Gerome Cleon Rodriguez",      "position":"Social Media Director",          "tables":[3]},
    {"name":"Gerome Cleon Rodriguez",      "position":"BSCS Governor",                  "tables":[3]},
    {"name":"Peneil Francis Cayaco",       "position":"DPA Compliance Officer",         "tables":[1]},
    {"name":"Steven Randolf Bigal",        "position":"Administrative Aide",            "tables":[2]},
    {"name":"Mary Nicole Angela De Vera",  "position":"Photographer",                   "tables":[3]},
    {"name":"Merwin Generoso",             "position":"Video Production Officer",       "tables":[1]},
    {"name":"Kyle Aimier Manza",           "position":"Supply and Logistics Officer",   "tables":[2]},
    {"name":"Kyle Aimier Manza",           "position":"Photographer",                   "tables":[2]},
    {"name":"Micaella Joy Vargas",         "position":"BSIT Governor",                  "tables":[3]},
    {"name":"Kenneth Malabarbar",          "position":"BSIS Governor",                  "tables":[1]},
    {"name":"Vince Gian Onte",             "position":"BSCS Governor",                  "tables":[2]},
    {"name":"Franchezka Nazareno",         "position":"Administrative Aide",            "tables":[3]},
    {"name":"Hann Dareen Bacsa",           "position":"Administrative Aide",            "tables":[1]},
    {"name":"Randlyn Faith Monares",       "position":"Administrative Aide",            "tables":[2]}
  ]'::jsonb;
  r jsonb;
  pos_id uuid;
  app_id uuid;
  tbl int;
  evaluator_username text;
  v_evaluator_id uuid;
begin
  for r in select * from jsonb_array_elements(rows) loop
    select id into pos_id from public.positions where name = r ->> 'position';
    if pos_id is null then
      raise notice 'Skipping %: position "%" not found', r ->> 'name', r ->> 'position';
      continue;
    end if;

    if exists (
      select 1 from public.applicants
      where full_name = r ->> 'name' and position_applied_id = pos_id
    ) then
      continue;
    end if;

    insert into public.applicants (full_name, position_applied_id, position_assigned_id, status)
    values (r ->> 'name', pos_id, pos_id, 'Pending')
    returning id into app_id;

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

