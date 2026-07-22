# Task Board

A Kanban board with drag-and-drop, guest accounts, team assignments, comments, and per-task activity history. React + TypeScript on the front, Supabase for data and auth.

**Live demo:** https://taskboard-qm5gph3kk-marcusher.vercel.app/

## Features

**Board** — Four columns (To Do, In Progress, In Review, Done). Drag cards between columns or reorder within one; status saves on drop.

**Guest accounts** — An anonymous Supabase session is created on first visit and persisted in `localStorage`. Every row is scoped to that user and enforced by Row Level Security, so one guest can never see another's board.

**Team members** — Create members with a name and color, assign several to a task, see their initials on the card.

**Comments** — Open any task for a threaded discussion with relative timestamps.

**Activity log** — Status moves, renames, priority changes, due-date edits, assignments, and label changes are all recorded and shown newest-first.

**Labels** — Create colored labels, tag tasks, and filter the board by one or more of them.

**Due dates** — Cards show a badge that turns amber within two days and red once overdue.

**Search and filters** — Filter by title/description text, priority, assignee (including unassigned), and labels.

**Board stats** — Total, completed with percentage, and overdue counts in the header.

## Setup

Requires Node 18+.

```bash
git clone <your-repo-url>
cd taskboard
npm install
```

**1. Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is enough).

**2. Run the schema.** Open the SQL Editor in your project dashboard, paste the contents of `supabase/schema.sql`, and run it. This creates all seven tables, indexes, triggers, and RLS policies.

**3. Enable anonymous sign-in.** In the dashboard, go to **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**. Without this the app cannot create guest sessions.

**4. Add your keys.**

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**. Use the anon/public key only — never the service role key.

**5. Run it.**

```bash
npm run dev
```

## Deploying

Any static host works. On Vercel, Netlify, or Cloudflare Pages: build command `npm run build`, output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the host's dashboard, then redeploy.

## Security

The anon key is designed to be public and ships in the browser bundle. What actually protects the data is Row Level Security: every one of the seven tables has RLS enabled with owner-only policies checking `auth.uid() = user_id` on select, insert, update, and delete. A forged request with another user's ID returns nothing.

`.env` is gitignored. No service role key appears anywhere in the codebase.

## Structure

```
src/
  lib/
    supabase.ts      client + guest session bootstrap
    types.ts         domain types, column config, palettes
    dates.ts         due-date urgency, relative time, initials
  hooks/
    useBoard.ts      all board state, optimistic updates, activity logging
  components/
    Column.tsx       droppable column with capacity bar
    TaskCard.tsx     draggable card
    NewTaskModal.tsx task creation
    TaskPanel.tsx    detail panel: editing, comments, activity
    ManageModal.tsx  team and label management
    Icons.tsx        inline SVG set
  App.tsx            DnD context, filtering, stats, layout
supabase/
  schema.sql         full schema with RLS
```
