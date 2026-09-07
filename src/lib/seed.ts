import { MEMBER_ROLE, OPERATOR_NAME, OPERATOR_ROLE, PLACE, emptyFineTally } from "./constants";
import { collegeFromMajor, parseISODate, todayISO } from "./format";
import { placeholderImageDataUrl } from "./proof";
import type {
  Attendance,
  ChartNote,
  ClubEvent,
  EventType,
  Gender,
  Group,
  Member,
  PracticeDay,
  Transaction,
} from "./types";

export const groups: Group[] = [
  { id: "g1", name: "그룹1 현악", shortName: "그룹1", part: "현악", sortOrder: 1 },
  { id: "g2", name: "그룹2 관악", shortName: "그룹2", part: "관악", sortOrder: 2 },
  { id: "g3", name: "그룹3 타악·피아노", shortName: "그룹3", part: "타악·피아노", sortOrder: 3 },
  { id: "g4", name: "그룹4 운영스태프", shortName: "그룹4", part: "운영스태프", sortOrder: 4 },
];

type SeedMember = Omit<Member, "id" | "active" | "fineTally"> & { active?: boolean };

function withProfile(
  member: Omit<SeedMember, "college" | "birthDate"> & Partial<Pick<SeedMember, "college" | "birthDate">>,
): SeedMember {
  return {
    ...member,
    college: member.college ?? collegeFromMajor(member.major),
    birthDate: member.birthDate ?? "",
  };
}

/** 연세대 동아리 포털 명단(2026-09-07). 시트에 없는 전공·분류는 비우거나 기본값. */
const roster: Array<{
  name: string;
  gender: Gender;
  age: number;
  studentId: string;
  phone: string;
}> = [
  { name: "김호준", gender: "남", age: 21, studentId: "2024190308", phone: "010-8820-3134" },
  { name: "이재동", gender: "남", age: 24, studentId: "2021197007", phone: "010-4199-3445" },
  { name: "김기수", gender: "남", age: 22, studentId: "2023145077", phone: "010-4124-1254" },
  { name: "손예지", gender: "여", age: 19, studentId: "2026172105", phone: "010-2946-8671" },
  { name: "김준석", gender: "남", age: 21, studentId: "2024142262", phone: "010-9916-8161" },
  { name: "이효수", gender: "남", age: 19, studentId: "2026172112", phone: "010-6760-1426" },
  { name: "이기찬", gender: "남", age: 22, studentId: "2023146125", phone: "010-9513-7943" },
  { name: "이장은", gender: "여", age: 20, studentId: "2025110043", phone: "010-3056-3892" },
  { name: "차민서", gender: "여", age: 24, studentId: "2021123065", phone: "010-5929-5161" },
  { name: "이태우", gender: "남", age: 23, studentId: "2022124045", phone: "010-2520-5993" },
  { name: "김민석", gender: "남", age: 24, studentId: "2021182027", phone: "010-7561-1051" },
  { name: "한건희", gender: "남", age: 23, studentId: "2022146059", phone: "010-2386-8320" },
  { name: "김정헌", gender: "남", age: 24, studentId: "2021145092", phone: "010-2415-6617" },
  { name: "박상학", gender: "남", age: 22, studentId: "2023146123", phone: "010-3927-3176" },
  { name: "최진혁", gender: "남", age: 22, studentId: "2023114026", phone: "010-5710-8763" },
  { name: "정래광", gender: "남", age: 25, studentId: "2020141128", phone: "010-4409-9749" },
  { name: "이재서", gender: "남", age: 24, studentId: "2021121068", phone: "010-9335-5824" },
  { name: "임승우", gender: "남", age: 22, studentId: "2023145031", phone: "010-9692-1711" },
  { name: "이승훈", gender: "남", age: 23, studentId: "2022191092", phone: "010-6868-5833" },
  { name: "이희수", gender: "남", age: 22, studentId: "2023243027", phone: "010-5436-1784" },
  { name: "박종선", gender: "남", age: 22, studentId: "2023143523", phone: "010-8494-7980" },
  { name: "장정인", gender: "여", age: 22, studentId: "2023143514", phone: "010-8209-1670" },
  { name: "최호성", gender: "남", age: 24, studentId: "2021121051", phone: "010-4069-3150" },
  { name: "박도현", gender: "남", age: 25, studentId: "2020182047", phone: "010-9766-4617" },
  { name: "이웅빈", gender: "남", age: 25, studentId: "2020172536", phone: "010-2394-3630" },
  { name: "최재원", gender: "남", age: 22, studentId: "2023146126", phone: "010-2748-2789" },
  { name: "이명수", gender: "남", age: 25, studentId: "2020191027", phone: "010-3303-0240" },
  { name: "박성민", gender: "남", age: 24, studentId: "2021142050", phone: "010-2725-5663" },
  { name: "박리나", gender: "여", age: 20, studentId: "2025172110", phone: "010-5715-3133" },
  { name: "김환욱", gender: "남", age: 25, studentId: "2020147578", phone: "010-7113-2273" },
  { name: "김범석", gender: "남", age: 20, studentId: "2025172109", phone: "010-2534-8886" },
  { name: "장성원", gender: "남", age: 25, studentId: "2020113026", phone: "010-4152-5457" },
];

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

const DEFAULT_PRACTICE: PracticeDay[] = ["화", "목", "토"];

const featured: SeedMember[] = roster.map((row) =>
  withProfile({
    groupId: "g1",
    category: "기악",
    role: row.name === OPERATOR_NAME ? OPERATOR_ROLE : MEMBER_ROLE,
    major: "",
    unpaidFee: 0,
    practiceDays: DEFAULT_PRACTICE,
    joinedAt: "",
    ...row,
  }),
);

export const members: Member[] = featured.map((member, index) => ({
  ...member,
  id: `m${pad(index + 1, 2)}`,
  active: member.active !== false,
  fineTally: emptyFineTally(),
}));

export const EVENTS_KEEP_FROM = "2026-09-08";

function generatePracticeEvents(): ClubEvent[] {
  return [
    {
      id: "p001",
      date: EVENTS_KEEP_FROM,
      title: "정기연습",
      type: "정기연습",
      place: PLACE,
      preview: "주중 분강 연습",
      startTime: "19:00",
      endTime: "21:00",
    },
  ];
}

const extraEvents: ClubEvent[] = [
  {
    id: "e-show",
    date: "2026-09-18",
    endDate: "2026-09-20",
    title: "정기공연",
    type: "공연",
    place: PLACE,
    preview: "금–일 공연",
    startTime: "18:00",
    endTime: "21:00",
  },
];

export const events: ClubEvent[] = [...extraEvents, ...generatePracticeEvents()].sort((a, b) =>
  a.date.localeCompare(b.date),
);

/** 예전 토요일 정기연습 14:00–17:00을 10:00–13:00으로 맞춘다. */
export function migrateSaturdayPracticeHours(events: ClubEvent[]) {
  return events.map((event) => {
    if (event.type !== "연습" && event.type !== "정기연습") return event;
    if (parseISODate(event.date).getDay() !== 6) return event;
    if (event.startTime !== "14:00" || event.endTime !== "17:00") return event;
    return { ...event, startTime: "10:00", endTime: "13:00" };
  });
}

export function dropEventsBefore(events: ClubEvent[], attendance: Attendance[], cutoff: string) {
  const kept = events.filter((event) => event.date >= cutoff);
  if (kept.length === events.length) return { events, attendance };
  const ids = new Set(kept.map((event) => event.id));
  return { events: kept, attendance: attendance.filter((row) => ids.has(row.eventId)) };
}

/** keepDate가 아닌 연습 일정을 한 번 걷어낸다. */
export function dropPracticeEventsExcept(events: ClubEvent[], attendance: Attendance[], keepDate: string) {
  const kept = events.filter((event) => {
    if (event.type !== "연습" && event.type !== "정기연습") return true;
    return event.date === keepDate;
  });
  if (kept.length === events.length) return { events, attendance };
  const ids = new Set(kept.map((event) => event.id));
  return { events: kept, attendance: attendance.filter((row) => ids.has(row.eventId)) };
}

export const attendance: Attendance[] = [];

export const chartNotes: ChartNote[] = [];

export const transactions: Transaction[] = [
  { id: "t01", occurredOn: "2026-04-03", title: "4월 회비 입금", type: "입금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: 420000, balanceAfter: 1_145_000, memo: "48명 중 14명 선입금", category: "회비" },
  { id: "t02", occurredOn: "2026-04-07", title: "학생회관 대관료", type: "출금", institution: "신한", accountMasked: "110-***-******", amount: -150000, balanceAfter: 995000, memo: "4월 연습실 4회", category: "대관료", proofs: [{ id: "pf-t02", name: "대관료_4월.pdf", mime: "application/pdf" }], proofDataUrl: placeholderImageDataUrl("대관료", "4월 연습실 4회") },
  { id: "t03", occurredOn: "2026-04-11", title: "연습 후 야식", type: "출금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: -28400, balanceAfter: 966600, memo: "김밥·음료 32인분", category: "야식", proofs: [{ id: "pf-t03", name: "야식_0411.jpg", mime: "image/jpeg" }], proofDataUrl: placeholderImageDataUrl("야식", "김밥·음료 32인분") },
  { id: "t04", occurredOn: "2026-04-16", title: "악보 인쇄", type: "출금", institution: "신한", accountMasked: "110-***-******", amount: -12800, balanceAfter: 953800, memo: "파트보 추가 인쇄", category: "기타" },
  { id: "t05", occurredOn: "2026-04-20", title: "버스 대절 계약금", type: "출금", institution: "신한", accountMasked: "110-***-******", amount: -85000, balanceAfter: 868800, memo: "봄 공연 이동", category: "교통", proofs: [{ id: "pf-t05", name: "버스대절_계약.pdf", mime: "application/pdf" }], proofDataUrl: placeholderImageDataUrl("버스 대절", "봄 공연 이동") },
  { id: "t06", occurredOn: "2026-04-24", title: "공연 의상 대여", type: "출금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: -45000, balanceAfter: 823800, memo: "블랙 정장 8벌", category: "의상" },
  { id: "t07", occurredOn: "2026-04-28", title: "동문 후원금", type: "입금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: 200000, balanceAfter: 1_023_800, memo: "19학번 동문회", category: "기타" },
  { id: "t08", occurredOn: "2026-04-30", title: "피아노 조율", type: "출금", institution: "신한", accountMasked: "110-***-******", amount: -60000, balanceAfter: 963800, memo: "대강당 연습용", category: "기타" },
  { id: "t09", occurredOn: "2026-05-01", title: "5월 회비 입금", type: "입금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: 360000, balanceAfter: 1_323_800, memo: "12명 입금 확인", category: "회비" },
  { id: "t10", occurredOn: "2026-05-02", title: "현수막·포스터", type: "출금", institution: "카카오뱅크", accountMasked: "3333-**-******", amount: -39800, balanceAfter: 1_284_000, memo: "정문 현수막 1, 포스터 40", category: "기타", proofs: [{ id: "pf-t10", name: "현수막_견적.pdf", mime: "application/pdf" }], proofDataUrl: placeholderImageDataUrl("현수막 견적", "정문 현수막 1, 포스터 40") },
];

export const attendanceSpark = [86.2, 88.0, 87.4, 90.1, 91.6, 89.8, 93.1, 92.4];
export const practiceSpark = [4, 5, 5, 6, 5, 6];

export const notifications = [
  { id: "n1", title: "오늘 연습 출석을 아직 마감하지 않았어요", time: "12분 전" },
  { id: "n2", title: "회비 미납 3명 · 90,000원", time: "1시간 전" },
  { id: "n3", title: "대관료 증빙 파일이 아직 비어 있는 거래가 있어요", time: "어제" },
];

export function seedToday() {
  return todayISO();
}

export type { EventType };
