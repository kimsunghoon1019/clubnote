# 클럽노트 (ClubNote)

한빛 오케스트라 운영 콘솔. 출석·회원·회계·일정을 한 화면에서 봅니다.

로컬은 Supabase 없이 더미 데이터로 바로 열립니다. 배포본은 Vercel + Supabase Free를 씁니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`

- 기본 화면은 로그인된 운영진 목업입니다. 헤더 프로필 `운영진 · 김서연`
- `/login` 에서 매직링크 UI를 확인할 수 있습니다. 환경변수가 없으면 `목업으로 들어가기`

## 스택

- Next.js App Router + Tailwind + Pretendard
- Recharts (라인/도넛)
- Supabase (Postgres + Auth 매직링크 + Storage)
- Vercel Hobby

## 배포 (무료)

1. GitHub 레포에 푸시
2. [supabase.com](https://supabase.com) New project (Seoul 또는 Tokyo)
3. SQL editor에서 `supabase/schema.sql` → `supabase/seed.sql` 실행
4. Authentication → Providers → Email 매직링크 활성화
5. Storage 버킷 `proofs`, `event-files` 생성
6. [vercel.com](https://vercel.com) Import, 환경변수 등록 후 Deploy
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - 서비스롤 키는 브라우저에 넣지 마세요
7. Supabase Authentication → URL Configuration의 Site URL을 배포 주소로 변경
8. 운영진 이메일을 초대한 뒤 `profiles.role = 'admin'` 으로 바꿉니다
9. GitHub Actions secret에 같은 URL/ANON KEY를 넣고 주 1회 핑 (방학 일시정지 방지)

문자 발송은 1단계 목업입니다. 학기말 CSV는 회원관리 → 내보내기로 받습니다.

## 페이지

| 경로 | 화면 |
| --- | --- |
| `/` | 홈 · KPI, 그룹 구성, 출석 요약 |
| `/members` | 회원관리 |
| `/attendance` | 출석체크 |
| `/finance` | 회계 |
| `/calendar` | 캘린더 |
| `/login` | 매직링크 로그인 |
