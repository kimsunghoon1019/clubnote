-- 클럽노트 schema + RLS
-- Supabase SQL editor에서 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamptz default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id),
  category text,
  role text,
  name text not null,
  gender text,
  age int,
  birth_date date,
  student_id text,
  major text,
  college text,
  joined_at date,
  phone text,
  unpaid_fee int default 0,
  practice_days text[] default array['화','목','토'],
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.members add column if not exists birth_date date;
alter table public.members add column if not exists college text;
alter table public.members add column if not exists late_notified int default 0;
alter table public.members add column if not exists late_unnotified int default 0;
alter table public.members add column if not exists absent_notified int default 0;
alter table public.members add column if not exists absent_unnotified int default 0;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  end_date date,
  title text not null,
  type text,
  place text,
  preview text,
  start_time text default '19:00',
  end_time text default '21:00',
  all_day boolean default false,
  attachment_path text
);

create table if not exists public.weather_days (
  date date primary key,
  code int not null,
  tmax numeric not null,
  fetched_at timestamptz default now()
);

create table if not exists public.chart_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  body text not null,
  author text,
  created_at timestamptz default now()
);

create table if not exists public.taxonomies (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('category', 'role')) not null,
  name text not null,
  unique (kind, name)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  status text check (status in ('출석','통보지각','미통보지각','통보결석','미통보결석')),
  unique (event_id, member_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  title text not null,
  type text check (type in ('입금','출금','이체')),
  institution text,
  account_masked text,
  amount int not null,
  balance_after int,
  memo text,
  category text,
  proof_path text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.weather_days enable row level security;
alter table public.attendance enable row level security;
alter table public.transactions enable row level security;
alter table public.chart_notes enable row level security;
alter table public.taxonomies enable row level security;

create policy "로그인 사용자 읽기" on public.groups for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.members for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.events for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.weather_days for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.attendance for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.transactions for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.chart_notes for select to authenticated using (true);
create policy "로그인 사용자 읽기" on public.taxonomies for select to authenticated using (true);
create policy "본인 프로필 읽기" on public.profiles for select to authenticated using (auth.uid() = id);

create policy "운영진 쓰기" on public.groups for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.members for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.events for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.weather_days for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.attendance for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.transactions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.chart_notes for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "운영진 쓰기" on public.taxonomies for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Storage: Dashboard에서 proofs, event-files 버킷을 private로 생성하세요.
-- 로그인 사용자 select, admin만 insert/update/delete.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
