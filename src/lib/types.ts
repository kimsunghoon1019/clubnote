export type Gender = "여" | "남";
export type AttendanceStatus = "출석" | "통보지각" | "미통보지각" | "통보결석" | "미통보결석";
export type TxType = "입금" | "출금" | "이체";
export type EventType = string;
export type TxCategory = "회비" | "대관료" | "야식" | "교통" | "의상" | "기타";
export type PracticeDay = "화" | "목" | "토";

export type Group = {
  id: string;
  name: string;
  shortName: string;
  part: string;
  sortOrder: number;
};

export type Member = {
  id: string;
  groupId: string;
  category: string;
  role: string;
  name: string;
  gender: Gender;
  age: number;
  birthDate: string;
  studentId: string;
  major: string;
  college: string;
  joinedAt: string;
  phone: string;
  unpaidFee: number;
  practiceDays: PracticeDay[];
  active: boolean;
};

export type ChartNote = {
  id: string;
  memberId: string;
  body: string;
  createdAt: string;
  author: string;
};

export type ClubEvent = {
  id: string;
  date: string;
  endDate?: string;
  title: string;
  type: EventType;
  place: string;
  preview: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  attachmentName?: string;
};

export type Attendance = {
  id: string;
  eventId: string;
  memberId: string;
  status: AttendanceStatus;
};

export type Transaction = {
  id: string;
  occurredOn: string;
  occurredAt?: string;
  title: string;
  type: TxType;
  institution: string;
  accountMasked: string;
  amount: number;
  balanceAfter: number;
  memo: string;
  category: string;
  proofName?: string;
};

export type NavKey = "home" | "members" | "attendance" | "finance" | "calendar";
