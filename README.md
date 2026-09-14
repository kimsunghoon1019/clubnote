# 클럽노트 (ClubNote)

글리클럽 운영 콘솔. 출석·회원·회계·일정을 한 화면에서 봅니다.

## 저장소

배포하면 **이 브라우저가 아니라 서버**가 원본입니다.

| 환경 | 원본 |
| --- | --- |
| 로컬 `npm run dev` (환경변수 없음) | 이 브라우저 `localStorage` `clubnote-db-v5` + IndexedDB 증빙 |
| Vercel 배포 | Supabase `club_state` (회원·출석·회계·일정 JSON) + Cloudflare R2 (프로필 사진·영수증·PDF·첨부) |

운영진이 회원·분류·직책·출석·회계·일정을 바꾸면 같은 DB를 보는 모든 기기에 반영됩니다. 첫 로그인 때 이 브라우저에 남아 있던 로컬 데이터가 있으면 서버가 비어 있을 때만 한 번 올립니다.

프로필 사진·영수증·첨부는 Cloudflare R2에 두고, 회원·출석·회계·일정 JSON만 Supabase에 둡니다. 저장 API는 서울(icn1)에서 돌아갑니다.

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
- Cloudflare R2 (비공개 버킷, 로그인 API로만 읽음)
- Vercel Hobby

## 배포 (처음부터)

계정 세 개가 필요합니다. **GitHub, Supabase, Cloudflare, Vercel.** 코드는 이 레포에 이미 붙어 있습니다.

끝나면 배포 주소에서 `/api/db/health` 가 `{"remote":true,"ready":true,"files":true}` 이어야 합니다.

### 1. GitHub에 올리기

이 폴더에 원격이 아직 없으면:

1. [github.com/new](https://github.com/new) 에서 private 레포 만들기 (예: `clubnote`)
2. 이 컴퓨터에서:

```bash
git remote add origin https://github.com/본인계정/clubnote.git
git push -u origin master
```

### 2. Supabase (데이터)

1. [supabase.com](https://supabase.com) 가입 → **New project**
2. 이름 `clubnote`, 지역 **Northeast Asia (Seoul)** 또는 Tokyo, DB 비밀번호는 저장해 두기
3. 프로젝트가 켜지면 왼쪽 **SQL Editor** → New query → `supabase/schema.sql` 내용 전부 붙여 넣고 **Run**
4. **Project Settings → API**
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` **secret** → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon` `public` 키는 쓰지 않습니다. 브라우저에 넣지 마세요.

`seed.sql`은 실행하지 않아도 됩니다. 첫 로그인 때 앱이 명단 시드를 넣습니다.

### 3. Cloudflare R2 (파일)

1. [dash.cloudflare.com](https://dash.cloudflare.com) 가입
2. 왼쪽 **R2 Object Storage** → 결제 수단 안 넣어도 무료 10GB까지 됩니다. (넣으면 10GB 초과 시 과금)
3. **Create bucket**
   - 이름: `clubnote` (소문자)
   - 위치: Automatic
   - **Public access 끄기** (기본값 유지)
4. R2 개요 오른쪽 **Account ID** 복사 → `R2_ACCOUNT_ID`
5. **Manage R2 API Tokens** → **Create Account API token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `clubnote`만
   - TTL: Forever
   - Create 후 **Access Key ID** / **Secret Access Key** 를 한 번만 보여 줍니다. 바로 복사
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
6. `R2_BUCKET` = `clubnote`

버킷을 인터넷에 공개하지 마세요. 캘린더 첨부는 파일당 5GB까지 올립니다. 큰 파일은 Vercel 한도를 피해 조각으로 올리거나, R2 CORS가 있으면 브라우저가 R2로 바로 올립니다. CORS를 켜 두면 큰 파일이 더 빨라집니다. R2 버킷 **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

### 4. Vercel에 붙이기

1. [vercel.com](https://vercel.com) 가입 → **Add New → Project** → GitHub `clubnote` Import
2. Framework Preset: Next.js 그대로
3. **Environment Variables** 에 아래를 모두 넣고 Deploy

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 비밀키 |
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_ACCESS_KEY_ID` | R2 토큰 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 토큰 Secret Access Key |
| `R2_BUCKET` | `clubnote` |
| `CLUB_SESSION_SECRET` | (선택) 긴 무작위 문자열. 없으면 service_role로 세션 서명 |

4. Deploy 끝나면 주소가 나옵니다. 예: `https://clubnote.vercel.app`
5. GitHub `master`에 푸시하면 그 주소가 자동으로 다시 배포됩니다
6. 그 주소 뒤에 `/api/db/health` 를 붙여 확인

```json
{"remote":true,"ready":true,"files":true}
```

- `remote:false` → Vercel 환경변수가 없거나 다시 배포가 안 됨. 변수 저장 후 **Redeploy**
- `ready:false` → Supabase URL/키 오타, 또는 `schema.sql` 미실행
- `files:false` → R2 계정/버킷/토큰 오타, 또는 버킷 이름 불일치. `filesError` 메시지를 봅니다

변수를 나중에 고치면 **Deployments → ⋯ → Redeploy** 해야 반영됩니다.

### 5. 첫 로그인

배포 주소는 자동 로그인이 없습니다.

서버가 비어 있으면 시드 명단이 들어갑니다. 이 브라우저 `localStorage`에 테너1 같은 로컬 수정이 남아 있으면 **그때 한 번** 서버로 올라갑니다. 그래서 예전에 쓰던 크롬에서 먼저 로그인하는 것이 좋습니다.

로그인 후 회계에서 영수증 하나, 캘린더에서 첨부 하나를 올려 보고 새로고침 뒤에도 열리는지 확인하세요.

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
