create table if not exists public.anniversary_content (
  id text primary key check (id = 'main'),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.anniversary_media (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('image', 'video', 'audio')),
  caption text not null default '',
  date text not null default '',
  description text not null default '',
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select on public.anniversary_content, public.anniversary_media to anon, authenticated;
grant insert, update, delete on public.anniversary_content, public.anniversary_media to authenticated;

alter table public.anniversary_content enable row level security;
alter table public.anniversary_media enable row level security;

drop policy if exists "Anyone can view anniversary content" on public.anniversary_content;
create policy "Anyone can view anniversary content"
  on public.anniversary_content for select to anon, authenticated using (true);

drop policy if exists "Signed-in owner can edit anniversary content" on public.anniversary_content;
create policy "Signed-in owner can edit anniversary content"
  on public.anniversary_content for all to authenticated using (true) with check (true);

drop policy if exists "Anyone can view anniversary media" on public.anniversary_media;
create policy "Anyone can view anniversary media"
  on public.anniversary_media for select to anon, authenticated using (true);

drop policy if exists "Signed-in owner can add anniversary media" on public.anniversary_media;
create policy "Signed-in owner can add anniversary media"
  on public.anniversary_media for insert to authenticated with check (true);

drop policy if exists "Signed-in owner can edit anniversary media" on public.anniversary_media;
create policy "Signed-in owner can edit anniversary media"
  on public.anniversary_media for update to authenticated using (true) with check (true);

drop policy if exists "Signed-in owner can remove anniversary media" on public.anniversary_media;
create policy "Signed-in owner can remove anniversary media"
  on public.anniversary_media for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anniversary-media',
  'anniversary-media',
  true,
  83886080,
  array['image/*', 'video/*', 'audio/*']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view anniversary files" on storage.objects;
create policy "Anyone can view anniversary files"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'anniversary-media');

drop policy if exists "Signed-in owner can upload anniversary files" on storage.objects;
create policy "Signed-in owner can upload anniversary files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'anniversary-media');

drop policy if exists "Signed-in owner can update anniversary files" on storage.objects;
create policy "Signed-in owner can update anniversary files"
  on storage.objects for update to authenticated
  using (bucket_id = 'anniversary-media')
  with check (bucket_id = 'anniversary-media');

drop policy if exists "Signed-in owner can remove anniversary files" on storage.objects;
create policy "Signed-in owner can remove anniversary files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'anniversary-media');
