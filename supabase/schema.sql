-- ============================================================
-- Task Board — full schema
-- Run this in the Supabase SQL Editor.
-- Every table is owner-scoped via user_id and protected by RLS.
-- ============================================================

-- ---------- enums ----------
create type task_status   as enum ('todo', 'in_progress', 'in_review', 'done');
create type task_priority as enum ('low', 'normal', 'high');

-- ---------- team members ----------
create table public.members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  color      text not null default '#D9A441',
  created_at timestamptz not null default now()
);

-- ---------- labels ----------
create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 30),
  color      text not null default '#7C8AA5',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- tasks ----------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'normal',
  due_date    date,
  -- fractional index: lets a card be reordered by rewriting one row
  position    double precision not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- task <-> member (many-to-many) ----------
create table public.task_assignees (
  task_id   uuid not null references public.tasks(id)   on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  user_id   uuid not null references auth.users(id)     on delete cascade,
  primary key (task_id, member_id)
);

-- ---------- task <-> label (many-to-many) ----------
create table public.task_labels (
  task_id  uuid not null references public.tasks(id)  on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  user_id  uuid not null references auth.users(id)    on delete cascade,
  primary key (task_id, label_id)
);

-- ---------- comments ----------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ---------- activity log ----------
create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  kind       text not null,   -- created | status | renamed | priority | due_date | assigned | unassigned | labeled | unlabeled
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index tasks_board_idx      on public.tasks (user_id, status, position);
create index tasks_due_idx        on public.tasks (user_id, due_date) where due_date is not null;
create index comments_task_idx    on public.comments (task_id, created_at desc);
create index activity_task_idx    on public.activity (task_id, created_at desc);
create index assignees_task_idx   on public.task_assignees (task_id);
create index labels_task_idx      on public.task_labels (task_id);
create index members_user_idx     on public.members (user_id, created_at);

-- ---------- keep updated_at honest ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- log task creation server-side ----------
create or replace function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity (task_id, user_id, kind, detail)
  values (new.id, new.user_id, 'created', jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger tasks_log_created
  after insert on public.tasks
  for each row execute function public.log_task_created();

-- ============================================================
-- Row Level Security
-- Owner-only on every table. A guest can never read or write
-- another guest's rows, even with a forged request.
-- ============================================================

alter table public.tasks           enable row level security;
alter table public.members         enable row level security;
alter table public.labels          enable row level security;
alter table public.task_assignees  enable row level security;
alter table public.task_labels     enable row level security;
alter table public.comments        enable row level security;
alter table public.activity        enable row level security;

-- tasks
create policy "own tasks: select" on public.tasks
  for select using (auth.uid() = user_id);
create policy "own tasks: insert" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "own tasks: update" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks: delete" on public.tasks
  for delete using (auth.uid() = user_id);

-- members
create policy "own members: select" on public.members
  for select using (auth.uid() = user_id);
create policy "own members: insert" on public.members
  for insert with check (auth.uid() = user_id);
create policy "own members: update" on public.members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own members: delete" on public.members
  for delete using (auth.uid() = user_id);

-- labels
create policy "own labels: select" on public.labels
  for select using (auth.uid() = user_id);
create policy "own labels: insert" on public.labels
  for insert with check (auth.uid() = user_id);
create policy "own labels: update" on public.labels
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own labels: delete" on public.labels
  for delete using (auth.uid() = user_id);

-- task_assignees
create policy "own assignees: select" on public.task_assignees
  for select using (auth.uid() = user_id);
create policy "own assignees: insert" on public.task_assignees
  for insert with check (auth.uid() = user_id);
create policy "own assignees: delete" on public.task_assignees
  for delete using (auth.uid() = user_id);

-- task_labels
create policy "own task labels: select" on public.task_labels
  for select using (auth.uid() = user_id);
create policy "own task labels: insert" on public.task_labels
  for insert with check (auth.uid() = user_id);
create policy "own task labels: delete" on public.task_labels
  for delete using (auth.uid() = user_id);

-- comments
create policy "own comments: select" on public.comments
  for select using (auth.uid() = user_id);
create policy "own comments: insert" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "own comments: delete" on public.comments
  for delete using (auth.uid() = user_id);

-- activity (append-only from the client's perspective)
create policy "own activity: select" on public.activity
  for select using (auth.uid() = user_id);
create policy "own activity: insert" on public.activity
  for insert with check (auth.uid() = user_id);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity;
