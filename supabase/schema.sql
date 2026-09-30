-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Creates the projects table and a private "videos" storage bucket, each locked to its owner.

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Untitled video',
  phrases jsonb not null default '[]'::jsonb,
  styles jsonb not null default '{}'::jsonb,
  detected_language text,
  engine text,
  thumbnail text,
  duration double precision,
  video_path text,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects" on public.projects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Videos live at videos/<user id>/<project id>.
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own videos" on storage.objects;
create policy "Users manage their own videos" on storage.objects
  for all to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
