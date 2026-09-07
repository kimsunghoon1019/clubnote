# 클럽노트 (ClubNote)

글리클럽 운영 콘솔. 출석·회원·회계·일정을 한 화면에서 봅니다.

## 저장소

배포하면 **브라우저가 아니라 Supabase Postgres 한곳**이 원본입니다.

| 환경 | 원본 |
| --- | --- |
| 로컬 `npm run dev` (환경변수 없음) | 이 브라우저 `localStorage` `clubnote-db-v5` + IndexedDB 증빙 |
| Vercel + Supabase 키 | `club_state` (JSON 한 줄) + `club_files` (증빙·첨부) |

운영진이 회원·분류·직책·출석·회계·일정을 바꾸면 같은 DB를 보는 모든 기기에 반영됩니다. 첫 로그인 때 이 브라우저에 남아 있던 로컬 데이터가 있으면 서버가 비어 있을 때만 한 번 올립니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`

환경변수가 없으면 예전처럼 이 컴퓨터에만 저장됩니다. 첫 방문은 최호성(회장)으로 들어갑니다.

## 스택

- Next.js App Router + Tailwind + Pretendard
- Recharts
- Supabase Postgres (서비스 롤, 브라우저에 키를 넣지 않음)
- Vercel Hobby

## 배포

1. GitHub 레포에 푸시
2. [supabase.com](https://supabase.com) New project (Seoul 또는 Tokyo)
3. SQL editor에서 `supabase/schema.sql` 실행 (`seed.sql`은 비어 있음. 앱이 첫 로그인 때 명단 시드를 넣음)
4. Project Settings → API에서 **Project URL**과 **service_role** 키 복사. anon 키는 쓰지 않습니다.
5. [vercel.com](https://vercel.com) Import, 환경변수 등록 후 Deploy
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용. `NEXT_PUBLIC_` 붙이지 마세요)
   - 선택: `CLUB_SESSION_SECRET`
6. 배포 주소로 들어가 최호성 학번 `2021121051` + 전화 뒷 4자리로 로그인

문자 발송은 1단계 목업입니다. 학기말 CSV는 회원관리 → 내보내기로 받습니다.

## 페이지

| 경로 | 화면 |
| --- | --- |
| `/` | 홈 · KPI, 그룹 구성, 출석 요약 |
| `/members` | 회원관리 |
| `/attendance` | 출석체크 |
| `/finance` | 회계 |
| `/calendar` | 캘린더 |
| `/mypage` | 마이페이지 |
| `/login` | 학번/아이디 + 비밀번호 |
