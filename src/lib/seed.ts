import { OPERATOR_NAME, PLACE, emptyFineTally } from "./constants";
import { collegeFromMajor, inferredBirthDate, parseISODate, toISODate, todayISO } from "./format";
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
    birthDate: member.birthDate ?? inferredBirthDate(member.age, member.name),
  };
}

const featured: SeedMember[] = [
  withProfile({ groupId: "g1", category: "기악", role: "회장", name: "김서연", gender: "여", age: 23, birthDate: "2003-04-18", studentId: "202312045", major: "음악학과", joinedAt: "2023-03-02", phone: "010-5120-3311", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g2", category: "기악", role: "부회장", name: "박준혁", gender: "남", age: 24, birthDate: "2002-07-09", studentId: "202211088", major: "경영학과", joinedAt: "2022-03-04", phone: "010-6234-1098", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g4", category: "스태프", role: "총무", name: "이하늘", gender: "여", age: 22, birthDate: "2004-02-21", studentId: "202408021", major: "회계학과", joinedAt: "2024-03-08", phone: "010-7741-2203", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g1", category: "기악", role: "파트장", name: "최민지", gender: "여", age: 23, birthDate: "2003-03-11", studentId: "202309112", major: "기악과", joinedAt: "2023-03-02", phone: "010-4412-7780", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g2", category: "기악", role: "파트장", name: "정우성", gender: "남", age: 25, birthDate: "2001-06-02", studentId: "202118334", major: "관현악과", joinedAt: "2021-03-05", phone: "010-3901-5542", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g3", category: "기악", role: "파트장", name: "한소희", gender: "여", age: 22, birthDate: "2004-05-30", studentId: "202405067", major: "피아노과", joinedAt: "2024-03-08", phone: "010-8821-0194", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g1", category: "기악", role: "회원", name: "오세훈", gender: "남", age: 21, birthDate: "2005-08-14", studentId: "202512201", major: "컴퓨터공학과", joinedAt: "2025-03-07", phone: "010-2290-4415", unpaidFee: 30000, practiceDays: ["화"] }),
  withProfile({ groupId: "g1", category: "기악", role: "회원", name: "윤지아", gender: "여", age: 21, birthDate: "2005-01-07", studentId: "202510088", major: "사회학과", joinedAt: "2025-03-07", phone: "010-6612-3387", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g2", category: "기악", role: "회원", name: "강태민", gender: "남", age: 22, birthDate: "2004-03-19", studentId: "202407155", major: "경제학과", joinedAt: "2024-03-08", phone: "010-1184-7720", unpaidFee: 30000, practiceDays: ["화", "목"] }),
  withProfile({ groupId: "g2", category: "보컬", role: "회원", name: "신예린", gender: "여", age: 20, birthDate: "2006-06-25", studentId: "202521043", major: "국어국문학과", joinedAt: "2025-03-07", phone: "010-9055-2146", unpaidFee: 0, practiceDays: ["목", "토"] }),
  withProfile({ groupId: "g3", category: "기악", role: "회원", name: "임도윤", gender: "남", age: 23, birthDate: "2003-08-08", studentId: "202316090", major: "기계공학과", joinedAt: "2023-03-02", phone: "010-3340-6671", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g3", category: "기악", role: "회원", name: "배서아", gender: "여", age: 22, birthDate: "2004-04-16", studentId: "202411278", major: "디자인학과", joinedAt: "2024-03-08", phone: "010-2781-4409", unpaidFee: 0, practiceDays: ["화", "토"] }),
  withProfile({ groupId: "g1", category: "기악", role: "회원", name: "조하준", gender: "남", age: 24, birthDate: "2002-02-28", studentId: "202209044", major: "철학과", joinedAt: "2022-03-04", phone: "010-5502-1193", unpaidFee: 30000, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g4", category: "스태프", role: "스태프", name: "문채원", gender: "여", age: 21, birthDate: "2005-03-03", studentId: "202518332", major: "신문방송학과", joinedAt: "2025-03-07", phone: "010-7723-8801", unpaidFee: 0, practiceDays: ["토"] }),
  withProfile({ groupId: "g2", category: "기악", role: "회원", name: "서준호", gender: "남", age: 23, birthDate: "2003-01-19", studentId: "202314201", major: "전자공학과", joinedAt: "2023-03-02", phone: "010-4419-2208", unpaidFee: 0, practiceDays: ["화", "목", "토"] }),
  withProfile({ groupId: "g4", category: "스태프", role: "스태프", name: "권나연", gender: "여", age: 22, birthDate: "2004-07-12", studentId: "202406119", major: "행정학과", joinedAt: "2024-03-08", phone: "010-9901-3344", unpaidFee: 0, practiceDays: ["토"] }),
];

const extraNames: { name: string; gender: Gender }[] = [
  { name: "김도현", gender: "남" },
  { name: "이수빈", gender: "여" },
  { name: "박지훈", gender: "남" },
  { name: "최유진", gender: "여" },
  { name: "정하람", gender: "여" },
  { name: "한지호", gender: "남" },
  { name: "오민서", gender: "여" },
  { name: "윤성민", gender: "남" },
  { name: "강은채", gender: "여" },
  { name: "신재원", gender: "남" },
  { name: "임하은", gender: "여" },
  { name: "배수호", gender: "남" },
  { name: "조예원", gender: "여" },
  { name: "문지환", gender: "남" },
  { name: "서아린", gender: "여" },
  { name: "권태윤", gender: "남" },
  { name: "장수아", gender: "여" },
  { name: "황민재", gender: "남" },
  { name: "노은서", gender: "여" },
  { name: "유지안", gender: "여" },
  { name: "안도경", gender: "남" },
  { name: "송하린", gender: "여" },
  { name: "백승우", gender: "남" },
  { name: "남지우", gender: "여" },
  { name: "허준서", gender: "남" },
  { name: "전시아", gender: "여" },
  { name: "고태현", gender: "남" },
  { name: "양서윤", gender: "여" },
  { name: "심재민", gender: "남" },
  { name: "하은지", gender: "여" },
  { name: "문성준", gender: "남" },
  { name: "차유나", gender: "여" },
];

const majors = [
  "음악학과",
  "경영학과",
  "컴퓨터공학과",
  "경제학과",
  "국어국문학과",
  "디자인학과",
  "전자공학과",
  "심리학과",
  "화학과",
  "사학과",
  "수학과",
  "영어영문학과",
];

const DAY_SETS: PracticeDay[][] = [["화"], ["화", "목"], ["화", "목", "토"], ["토"], ["화", "토"]];

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

function extraMembers(): SeedMember[] {
  return extraNames.map((item, index) => {
    const groupCycle = index % 10;
    const groupId = groupCycle < 4 ? "g1" : groupCycle < 7 ? "g2" : groupCycle < 9 ? "g3" : "g4";
    const isStaff = groupId === "g4";
    const year = 2021 + (index % 5);
    const age = 20 + (index % 6);
    const joinedYear = Math.min(year, 2025);
    return {
      groupId,
      category: isStaff ? "스태프" : index % 11 === 0 ? "보컬" : "기악",
      role: isStaff ? "스태프" : "회원",
      name: item.name,
      gender: item.gender,
      age,
      studentId: `${year}${pad(10 + index, 3)}${pad(index % 9, 2)}`,
      major: majors[index % majors.length],
      college: collegeFromMajor(majors[index % majors.length]),
      birthDate: inferredBirthDate(age, item.name),
      joinedAt: `${joinedYear}-03-0${(index % 5) + 2}`,
      phone: `010-${pad(2000 + index * 17, 4)}-${pad(1000 + index * 31, 4)}`,
      unpaidFee: 0,
      practiceDays: isStaff ? (["토"] as PracticeDay[]) : DAY_SETS[index % DAY_SETS.length],
    };
  });
}

export const members: Member[] = [...featured, ...extraMembers()].map((member, index) => ({
  ...member,
  id: `m${pad(index + 1, 2)}`,
  active: member.active !== false,
  fineTally: emptyFineTally(),
}));

export const EVENTS_KEEP_FROM = "2026-09-08";

function generatePracticeEvents(): ClubEvent[] {
  const start = parseISODate(EVENTS_KEEP_FROM);
  const end = new Date(2026, 11, 31);
  const list: ClubEvent[] = [];
  const cursor = new Date(start);
  let n = 1;
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 2 || day === 4 || day === 6) {
      const iso = toISODate(cursor);
      const isSat = day === 6;
      list.push({
        id: `p${pad(n, 3)}`,
        date: iso,
        title: "정기연습",
        type: "정기연습",
        place: PLACE,
        preview: isSat ? "주말 전체 합주" : "주중 분강 연습",
        startTime: isSat ? "14:00" : "19:00",
        endTime: isSat ? "17:00" : "21:00",
      });
      n += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return list;
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

export function dropEventsBefore(events: ClubEvent[], attendance: Attendance[], cutoff: string) {
  const kept = events.filter((event) => event.date >= cutoff);
  if (kept.length === events.length) return { events, attendance };
  const ids = new Set(kept.map((event) => event.id));
  return { events: kept, attendance: attendance.filter((row) => ids.has(row.eventId)) };
}

export const attendance: Attendance[] = [];

export const chartNotes: ChartNote[] = [
  {
    id: "n-m01-1",
    memberId: "m01",
    body: "정기연습 리허설 리딩 담당. 1바이올린 보잉 각도 점검.",
    createdAt: "2026-08-18T19:12:00",
    author: OPERATOR_NAME,
  },
  {
    id: "n-m01-2",
    memberId: "m01",
    body: "봄 공연 프로그램 확정. 드보르자크 9번 2악장 템포 조금 내리기로 함.",
    createdAt: "2026-08-25T21:04:00",
    author: OPERATOR_NAME,
  },
  {
    id: "n-m07-1",
    memberId: "m07",
    body: "화요일만 참석. 전공 수업과 목·토 겹침. 화요일 출석은 안정적.",
    createdAt: "2026-09-01T19:40:00",
    author: OPERATOR_NAME,
  },
  {
    id: "n-m13-1",
    memberId: "m13",
    body: "토요일 결석이 반복됨. 파트장에게 공결 여부 확인 요청.",
    createdAt: "2026-08-29T16:20:00",
    author: OPERATOR_NAME,
  },
];

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
