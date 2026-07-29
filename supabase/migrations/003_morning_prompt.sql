alter table public.morning_checkins
  add column if not exists reflection_prompt text;
