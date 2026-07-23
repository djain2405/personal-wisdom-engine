-- Personal Wisdom Engine initial schema
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  ai_provider text default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.identity_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dream_identity text,
  values text,
  goals text,
  current_habits text,
  challenges text,
  life_areas text,
  suggested_actions_history jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  title text not null,
  path text not null,
  raw_text text,
  status text not null default 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, path)
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  ordinal int not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table public.principles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  explanation text,
  category text,
  examples text[] default '{}',
  action_steps text[] default '{}',
  questions text[] default '{}',
  related_principle_ids uuid[] default '{}',
  confidence_score float not null default 0.5,
  frequency_score float not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.principle_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  principle_id uuid not null references public.principles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  excerpt text,
  weight float not null default 1,
  created_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  principle_id uuid references public.principles(id) on delete set null,
  title text not null,
  description text,
  category text,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  principle_id uuid references public.principles(id) on delete set null,
  text text not null,
  attribution text,
  created_at timestamptz not null default now()
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  principle_id uuid references public.principles(id) on delete set null,
  title text not null,
  description text,
  status text default 'open',
  created_at timestamptz not null default now()
);

create table public.journal_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  principle_id uuid references public.principles(id) on delete set null,
  prompt text not null,
  category text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'chat',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null default current_date,
  todays_identity text,
  keystone_habit text,
  principle_to_practice text,
  principle_id uuid references public.principles(id) on delete set null,
  challenge text,
  reflection_question text,
  evening_prompt text,
  priorities text,
  mindset_reminder text,
  mantra text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, brief_date)
);

create table public.evening_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null default current_date,
  narrative text not null,
  wins text,
  patterns text,
  identity_reinforce text,
  tomorrow text,
  analysis_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  wins text,
  lessons text,
  patterns text,
  repeated_mistakes text,
  recurring_thoughts text,
  best_principles text,
  focus_next text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  identity_shifts text,
  growth text,
  habit_trends text,
  emotional_trends text,
  what_improved text,
  what_needs_work text,
  recommended_principles text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start)
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_date date not null default current_date,
  energy text,
  time_available text,
  goals text,
  plan text,
  raw_json jsonb,
  created_at timestamptz not null default now()
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create index documents_user_id_idx on public.documents(user_id);
create index documents_status_idx on public.documents(user_id, status);
create index document_chunks_document_id_idx on public.document_chunks(document_id);
create index principles_user_id_idx on public.principles(user_id);
create index principles_category_idx on public.principles(user_id, category);
create index principles_scores_idx on public.principles(user_id, confidence_score desc, frequency_score desc);
create index principle_sources_principle_id_idx on public.principle_sources(principle_id);
create index habits_user_id_idx on public.habits(user_id);
create index quotes_user_id_idx on public.quotes(user_id);
create index conversations_user_id_idx on public.conversations(user_id);
create index messages_conversation_id_idx on public.messages(conversation_id);
create index daily_briefs_user_date_idx on public.daily_briefs(user_id, brief_date desc);
create index evening_reviews_user_date_idx on public.evening_reviews(user_id, review_date desc);
create index weekly_reviews_user_id_idx on public.weekly_reviews(user_id);
create index monthly_reports_user_id_idx on public.monthly_reports(user_id);
create index embeddings_user_entity_idx on public.embeddings(user_id, entity_type);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger identity_memory_updated_at before update on public.identity_memory
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger principles_updated_at before update on public.principles
  for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
create trigger daily_briefs_updated_at before update on public.daily_briefs
  for each row execute function public.set_updated_at();
create trigger evening_reviews_updated_at before update on public.evening_reviews
  for each row execute function public.set_updated_at();
create trigger weekly_reviews_updated_at before update on public.weekly_reviews
  for each row execute function public.set_updated_at();
create trigger monthly_reports_updated_at before update on public.monthly_reports
  for each row execute function public.set_updated_at();
create trigger embeddings_updated_at before update on public.embeddings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.identity_memory (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.identity_memory enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.principles enable row level security;
alter table public.principle_sources enable row level security;
alter table public.habits enable row level security;
alter table public.quotes enable row level security;
alter table public.action_items enable row level security;
alter table public.journal_prompts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.evening_reviews enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.routines enable row level security;
alter table public.embeddings enable row level security;

create policy profiles_select on public.profiles for select using (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);

create policy identity_memory_all on public.identity_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy documents_all on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy document_chunks_all on public.document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy principles_all on public.principles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy principle_sources_all on public.principle_sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habits_all on public.habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy quotes_all on public.quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy action_items_all on public.action_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy journal_prompts_all on public.journal_prompts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy conversations_all on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy messages_all on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy daily_briefs_all on public.daily_briefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy evening_reviews_all on public.evening_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy weekly_reviews_all on public.weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy monthly_reports_all on public.monthly_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routines_all on public.routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy embeddings_all on public.embeddings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 5,
  filter_entity_type text default null
)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  where e.user_id = match_user_id
    and e.embedding is not null
    and (filter_entity_type is null or e.entity_type = filter_entity_type)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
