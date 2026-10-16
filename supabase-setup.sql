-- Run once in the Supabase SQL Editor. This creates the public pinboard data
-- and allows only accounts listed in public.editors to change it.

create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 90),
  region text not null default '' check (char_length(region) <= 90),
  description text not null default '' check (char_length(description) <= 1200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  storage_path text not null unique,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists photos_place_id_idx on public.photos(place_id);

alter table public.editors enable row level security;
alter table public.places enable row level security;
alter table public.photos enable row level security;

grant select on public.places, public.photos to anon, authenticated;
grant insert, update, delete on public.places, public.photos to authenticated;
grant select on public.editors to authenticated;

create policy "Editor can see own access" on public.editors
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Everyone can read places" on public.places
  for select to anon, authenticated using (true);
create policy "Editors can add places" on public.places
  for insert to authenticated with check (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  ));
create policy "Editors can change places" on public.places
  for update to authenticated using (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  ));
create policy "Editors can remove places" on public.places
  for delete to authenticated using (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  ));

create policy "Everyone can read photos" on public.photos
  for select to anon, authenticated using (true);
create policy "Editors can add photos" on public.photos
  for insert to authenticated with check (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  ));
create policy "Editors can remove photos" on public.photos
  for delete to authenticated using (exists (
    select 1 from public.editors where user_id = (select auth.uid())
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('travel-photos', 'travel-photos', true, 10485760, array['image/webp'])
on conflict (id) do nothing;

create policy "Editors can upload travel photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'travel-photos' and exists (
      select 1 from public.editors where user_id = (select auth.uid())
    )
  );
create policy "Editors can see travel photo records" on storage.objects
  for select to authenticated using (
    bucket_id = 'travel-photos' and exists (
      select 1 from public.editors where user_id = (select auth.uid())
    )
  );
create policy "Editors can remove travel photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'travel-photos' and exists (
      select 1 from public.editors where user_id = (select auth.uid())
    )
  );

-- After creating the editor under Authentication > Users, run this separately
-- with her actual user ID from that page:
-- insert into public.editors (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
