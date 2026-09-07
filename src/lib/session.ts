import { OPERATOR_NAME } from "./constants";
import type { Member } from "./types";

export const SESSION_KEY = "clubnote-session-v1";

export type SessionState = { status: "in"; memberId: string } | { status: "out" };

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function phonePin(phone: string) {
  return digitsOnly(phone).slice(-4);
}

export function normalizeStudentId(value: string) {
  return digitsOnly(value);
}

export function defaultSessionMemberId(members: Member[]) {
  return members.find((member) => member.name === OPERATOR_NAME)?.id ?? members[0]?.id ?? null;
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

export function authenticateMember(members: Member[], studentId: string, pin: string) {
  const member = findMemberByStudentId(members, studentId);
  if (!member) return { ok: false as const, error: "학번을 확인해 주세요." };
  const expected = phonePin(member.phone);
  if (!expected || expected !== digitsOnly(pin)) {
    return { ok: false as const, error: "비밀번호가 맞지 않아요." };
  }
  return { ok: true as const, member };
}

export function demoLogins(members: Member[]) {
  const preferred = members.find((member) => member.name === OPERATOR_NAME);
  const rest = members.filter((member) => member.id !== preferred?.id);
  return [preferred, ...rest]
    .filter((member): member is Member => Boolean(member))
    .slice(0, 2)
    .map((member) => ({
      name: member.name,
      role: member.role,
      studentId: member.studentId,
      pin: phonePin(member.phone),
    }));
}

export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}
