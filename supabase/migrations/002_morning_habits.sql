create table public.morning_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  intention text,
  becoming_identity text,
  gratitude text[] not null default '{}',
  reflection text,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create table public.tracked_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_habit_id uuid not null references public.tracked_habits(id) on delete cascade,
  log_date date not null default current_date,
  done boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, tracked_habit_id, log_date)
);

create index morning_checkins_user_date_idx
  on public.morning_checkins(user_id, checkin_date desc);
create index tracked_habits_user_sort_idx
  on public.tracked_habits(user_id, active, sort_order);
create index habit_logs_user_date_idx
  on public.habit_logs(user_id, log_date desc);
create index habit_logs_habit_date_idx
  on public.habit_logs(tracked_habit_id, log_date desc);

create trigger morning_checkins_updated_at
  before update on public.morning_checkins
  for each row execute function public.set_updated_at();
create trigger tracked_habits_updated_at
  before update on public.tracked_habits
  for each row execute function public.set_updated_at();

alter table public.morning_checkins enable row level security;
alter table public.tracked_habits enable row level security;
alter table public.habit_logs enable row level security;

create policy morning_checkins_all on public.morning_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tracked_habits_all on public.tracked_habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habit_logs_all on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
