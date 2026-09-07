# ClubNote

글리클럽 동아리 운영 콘솔. Next.js App Router + Tailwind + Pretendard.
로컬(환경변수 없음) DB는 `localStorage` 키 `clubnote-db-v5`.
배포는 Supabase 테이블 `club_state`(앱 JSON) + Cloudflare R2(프로필 사진·증빙·첨부)가 원본. API는 Vercel 서울(`icn1`). `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET` 필요.

## 제품

- 한국어 UI, 데스크톱(~1440px). Toss 증권 느낌(흰 콘솔, 브랜드 `#3182F6`, 상승=빨강 `#f04452`). 로고·상표 복제 금지.
- 페이지: 홈, 회원관리, 출석체크, 회계, 캘린더, 마이페이지.
- 로그인은 직책이 있는 회원만. 단원(구 회원)은 불가. 학번 또는 아이디 + 비밀번호(기본 전화번호 뒷 4자리). 기본 관리자는 최호성(학번 2021121051). 로컬 세션 `clubnote-session-v1`, 배포는 httpOnly 쿠키. 로컬 첫 방문은 최호성. 배포는 로그인 필요. 로그아웃하면 `/login`.
- 마이페이지에서 본인 사진·한줄멘트·아이디·비밀번호·연락처를 수정한다.
- 회원 상세는 오른쪽 레일(~300px). 분류/직책 추가는 테이블 헤더에서.
- 연습요일 화|목|토. 출석 명단은 그날 스케줄 + **활동** 회원만.
- 성실도 = 본인 연습요일 출석. 참여도 = 학기 전체 연습 대비 참여. 둘 다 0–1.
- 비활동은 명단에 남고 출석에서 빠진다. `동아리에서 내보내기`가 실제 삭제.
- SMS는 토스트 목업. 배포 CRUD는 Next API가 서비스 롤로 Postgres에 저장한다. 브라우저는 Supabase에 직접 붙지 않는다.
