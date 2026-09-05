export const CLUB_NAME = "한빛 오케스트라";
export const PLACE = "학생회관 404호";
export const OPERATOR_NAME = "김서연";
export const OPERATOR_ROLE = "운영진";

export const DEFAULT_CATEGORIES = ["기악", "보컬", "스태프"];
export const DEFAULT_ROLES = ["회장", "부회장", "총무", "파트장", "회원", "스태프"];
export const GENDER_OPTIONS = ["여", "남"] as const;
export const ATTENDANCE_STATUSES = ["출석", "결석", "지각", "공결"] as const;
export const TX_TYPES = ["입금", "출금", "이체"] as const;
export const TX_CATEGORIES = ["회비", "대관료", "야식", "교통", "의상", "기타"] as const;
export const EVENT_TYPES = ["연습", "정기연습", "공연", "회식", "오디션", "회의"] as const;
export const PRACTICE_DAYS = ["화", "목", "토"] as const;

export const SMS_TEMPLATES = {
  "연습 리마인드": `[한빛 오케스트라] 오늘 저녁 7시 학생회관 404호에서 정기연습이 있어요. 출석 체크 잊지 말고 와 주세요.`,
  "회비 미납": `[한빛 오케스트라] 이번 달 회비가 아직 확인되지 않았어요. 여유 되실 때 총무에게 보내 주세요.`,
  "직접 작성": "",
} as const;

export const STORAGE_KEY = "clubnote-db-v3";
