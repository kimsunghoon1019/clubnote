import type { AttendanceStatus } from "./types";

export const CLUB_NAME = "글리클럽";
export const PLACE = "학생회관 404호";
export const OPERATOR_NAME = "김서연";
export const OPERATOR_ROLE = "운영진";

export const DEFAULT_CATEGORIES = ["기악", "보컬", "스태프"];
export const DEFAULT_ROLES = ["회장", "부회장", "총무", "파트장", "회원", "스태프"];
export const GENDER_OPTIONS = ["여", "남"] as const;

export const ATTENDANCE_STATUSES = ["출석", "미통보지각", "통보지각", "통보결석", "미통보결석"] as const;

export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { color: string; lines: [string] | [string, string]; short: string }
> = {
  출석: { color: "#12B76A", lines: ["출석"], short: "출석" },
  미통보지각: { color: "#85D13A", lines: ["미통보", "지각"], short: "미지각" },
  통보지각: { color: "#FFB800", lines: ["통보", "지각"], short: "통지각" },
  통보결석: { color: "#FF8A3D", lines: ["통보", "결석"], short: "통결석" },
  미통보결석: { color: "#F04452", lines: ["미통보", "결석"], short: "미결석" },
};

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export function normalizeAttendanceStatus(status: string): AttendanceStatus | null {
  if (isAttendanceStatus(status)) return status;
  if (status === "지각") return "미통보지각";
  if (status === "결석") return "미통보결석";
  if (status === "공결") return "통보결석";
  return null;
}

export function isPresentStatus(status: AttendanceStatus) {
  return status === "출석" || status === "미통보지각" || status === "통보지각";
}

export function isAbsentStatus(status: AttendanceStatus) {
  return status === "통보결석" || status === "미통보결석";
}

export const TX_TYPES = ["입금", "출금", "이체"] as const;
export const TX_CATEGORIES = ["회비", "대관료", "야식", "교통", "의상", "기타"] as const;
export const EVENT_TYPES = ["연습", "정기연습", "공연", "회식", "오디션", "회의"] as const;
export const DEFAULT_PLACES = ["학생회관 404호", "학생회관 301호"];
export const PRACTICE_DAYS = ["화", "목", "토"] as const;

export const SMS_TEMPLATES = {
  "연습 리마인드": `[${CLUB_NAME}] 오늘 저녁 7시 학생회관 404호에서 정기연습이 있어요. 출석 체크 잊지 말고 와 주세요.`,
  "회비 미납": `[${CLUB_NAME}] 이번 달 회비가 아직 확인되지 않았어요. 여유 되실 때 총무에게 보내 주세요.`,
  "직접 작성": "",
} as const;

export const STORAGE_KEY = "clubnote-db-v3";
