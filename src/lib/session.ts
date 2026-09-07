import { MEMBER_ROLE, OPERATOR_NAME, OPERATOR_STUDENT_ID } from "./constants";
import type { Member } from "./types";

export const SESSION_KEY = "clubnote-session-v1";

export type SessionState = { status: "in"; memberId: string } | { status: "out" };

const REGULAR_ROLES = new Set([MEMBER_ROLE, "회원"]);

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function phonePin(phone: string) {
  return digitsOnly(phone).slice(-4);
}

export function normalizeStudentId(value: string) {
  return digitsOnly(value);
}

export function normalizeLoginId(value: string) {
  return value.trim();
}

export function canLogin(member: Member) {
  const role = member.role.trim();
  return Boolean(role) && !REGULAR_ROLES.has(role);
}

export function isOperatorMember(member: Pick<Member, "name" | "studentId">) {
  return member.name === OPERATOR_NAME || normalizeStudentId(member.studentId) === OPERATOR_STUDENT_ID;
}

export function memberLoginId(member: Member) {
  return normalizeLoginId(member.loginId ?? "") || member.studentId;
}

export function memberPassword(member: Member) {
  return member.password?.trim() || phonePin(member.phone);
}

export function defaultSessionMemberId(members: Member[]) {
  const officers = members.filter(canLogin);
  return officers.find((member) => isOperatorMember(member))?.id ?? officers[0]?.id ?? null;
}

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SessionState>;
    if (data.status === "out") return { status: "out" };
    if (data.status === "in" && typeof data.memberId === "string" && data.memberId) {
      return { status: "in", memberId: data.memberId };
    }
    return null;
  } catch {
    return null;
  }
}

export function persistSession(state: SessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function findMemberByStudentId(members: Member[], studentId: string) {
  const id = normalizeStudentId(studentId);
  if (!id) return null;
  return members.find((member) => normalizeStudentId(member.studentId) === id) ?? null;
}

export function findMemberByLogin(members: Member[], login: string) {
  const id = normalizeLoginId(login);
  if (!id) return null;
  const byLogin = members.find((member) => normalizeLoginId(member.loginId ?? "") === id);
  if (byLogin) return byLogin;
  return findMemberByStudentId(members, id);
}

export function loginIdTaken(members: Member[], loginId: string, exceptId: string) {
  const id = normalizeLoginId(loginId);
  if (!id) return false;
  const digits = normalizeStudentId(id);
  return members.some((member) => {
    if (member.id === exceptId) return false;
    if (normalizeLoginId(member.loginId ?? "") === id) return true;
    return Boolean(digits) && normalizeStudentId(member.studentId) === digits;
  });
}

export function authenticateMember(members: Member[], login: string, pin: string) {
  const member = findMemberByLogin(members, login);
  if (!member) return { ok: false as const, error: "학번 또는 아이디를 확인해 주세요." };
  if (!canLogin(member)) {
    return { ok: false as const, error: "단원은 로그인할 수 없어요. 직책이 있는 회원만 들어올 수 있어요." };
  }
  const expected = memberPassword(member);
  if (!expected || expected !== pin.trim()) {
    return { ok: false as const, error: "비밀번호가 맞지 않아요." };
  }
  return { ok: true as const, member };
}

export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}
