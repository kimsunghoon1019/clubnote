-- 클럽노트. SQL editor에서 이 파일만 실행하면 됩니다.
-- 회원·출석·회계·일정·분류는 club_state 한 줄.
-- 증빙·첨부 파일은 Cloudflare R2 (files/<id>)에 둡니다. Postgres에 넣지 마세요.

create table if not exists public.club_state (
  id text primary key default 'default' check (id = 'default'),
  payload jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.club_state enable row level security;

-- 정책 없음: 브라우저는 이 테이블에 직접 붙지 않고, 서버(service role)만 읽고 씁니다.

insert into public.club_state (id, payload, version)
values ('default', '{}'::jsonb, 0)
on conflict (id) do nothing;

-- 예전에 쓰던 base64 파일 테이블. 새 배포에서는 필요 없습니다.
drop table if exists public.club_files;
