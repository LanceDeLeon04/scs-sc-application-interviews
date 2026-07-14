# SCS Officer Evaluation System

A web app for the School of Computer Studies Student Council interview panel to
evaluate Student Council Officer applicants (A.Y. 2026–2027) against a
standardized, weighted rubric — from applicant list, to per-applicant
evaluation sheet, to an automatically ranked summary per position.

Built with **React + TypeScript + Vite**, **Tailwind CSS**, and **Supabase**
(Postgres + Auth). Deploys to **Vercel** from **GitHub**.

## Features

- **Landing page** — public overview of the process and criteria
- **Panel sign-in** — Supabase email/password auth
- **Applicants list** — search, filter by position and status, add applicants,
  and reassign an applicant to a different position than the one they applied for
- **Evaluation sheet per applicant** — six weighted criteria (Leadership 25%,
  Communication 20%, Role Knowledge 20%, Problem Solving 15%, Commitment 10%,
  Professionalism 10%), 1–5 rating scale, overall recommendation, notes —
  auto-computes each panelist's weighted score out of 100
- **Summary & ranking** — average weighted score per applicant across all
  panelists, ranked within each position, with a top-score chart

## 1. Prerequisites

- Node.js 18+
- A free Supabase project (supabase.com)
- A GitHub account and a Vercel account (for deployment)

## 2. Set up Supabase

1. Create a new project at supabase.com/dashboard.
2. Open **SQL Editor -> New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates:
   - `profiles` (panelist accounts + role)
   - `positions` (seeded with the 8 typical SCS officer positions)
   - `applicants`
   - `evaluations`
   - Row Level Security policies and helper triggers
3. Go to **Authentication -> Users -> Add user** and create one account per
   panelist (email + password). Each gets a `profiles` row automatically
   (default role `panelist`).
4. To give someone admin rights (add applicants, reassign positions, manage
   status), run in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'your-admin-email@example.com');
   ```
5. Go to **Settings -> API** and copy your **Project URL** and **anon public key**.

## 3. Run locally

```bash
npm install
cp .env.example .env
# then edit .env and paste your Supabase URL + anon key
npm run dev
```

Visit `http://localhost:5173`.

## 4. Deploy via GitHub + Vercel

1. Push this project to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SCS Officer Evaluation System"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. Go to vercel.com/new and import that GitHub repository.
3. Vercel auto-detects the Vite framework preset. Before deploying, add the
   environment variables (**Settings -> Environment Variables**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. Every push to `main` will redeploy automatically.

`vercel.json` is already included with the SPA rewrite rule so client-side
routing (`/applicants`, `/evaluate/:id`, `/summary`) works on refresh.

## Project structure

```
src/
  components/     Navbar, StatusBadge, RatingInput, ReassignModal, Seal, ProtectedRoute
  context/        AuthContext (Supabase session + profile/role)
  lib/            supabase client, data-access functions (api.ts)
  pages/          Landing, Login, Applicants, Evaluate, Summary
  types.ts        Shared types + the criteria/weight/rating-scale definitions
supabase/
  schema.sql      Full database schema, RLS policies, triggers, seed positions
```

## Customizing the criteria or positions

- Criteria, weights, and the rating scale live in `src/types.ts` (`CRITERIA`,
  `RATING_SCALE`, `RECOMMENDATIONS`) — edit there if the panel's rubric changes.
- Positions are just rows in the `positions` table — add, rename, or adjust
  `max_slots` directly in Supabase (**Table Editor -> positions**) or via SQL.

## Roles

- **Panelist** (default): can view applicants, submit/edit their own
  evaluation per applicant, and view the summary/ranking.
- **Admin**: everything a panelist can do, plus adding applicants,
  reassigning an applicant's position, and changing applicant status.
