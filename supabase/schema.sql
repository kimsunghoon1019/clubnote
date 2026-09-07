-- 클럽노트 단일 DB. SQL editor에서 이 파일만 실행하면 됩니다.
-- 회원·출석·회계·일정·분류는 club_state 한 줄, 증빙·첨부 파일은 club_files.

create table if not exists public.club_state (
  id text primary key default 'default' check (id = 'default'),
  payload jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.club_files (
  id text primary key,
  name text not null,
  mime text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.club_state enable row level security;
alter table public.club_files enable row level security;

-- 정책 없음: 브라우저는 이 테이블에 직접 붙지 않고, 서버(service role)만 읽고 씁니다.

insert into public.club_state (id, payload, version)
values ('default', '{}'::jsonb, 0)
on conflict (id) do nothing;
