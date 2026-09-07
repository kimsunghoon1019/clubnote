"use client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { FieldLabel, TextInput } from "@/components/ui/Field";
import { demoLogins, safeNextPath } from "@/lib/session";
import { useClub } from "@/lib/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signOut, currentMember, members, remoteDb, sessionReady } = useClub();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("out") === "1") {
      signOut();
      params.delete("out");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `/login?${rest}` : "/login");
    }
  }, [signOut]);
  const demos = useMemo(() => (remoteDb ? [] : demoLogins(members)), [members, remoteDb]);
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function goNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(safeNextPath(next));
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !sessionReady) return;
    setError("");
    setBusy(true);
    const result = await signIn(studentId, pin);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    goNext();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5">
      <div className="w-[360px]">
        <div className="mb-8 flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="h-6 w-6" aria-hidden>
            <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.2" transform="rotate(45 8 8)" fill="#3182F6" />
          </svg>
          <div>
            <p className="text-[18px] font-bold">클럽노트</p>
            <p className="text-[12px] text-faint">동아리 운영</p>
          </div>
        </div>
        <h1 className="text-[20px] font-semibold">운영진 로그인</h1>
        <p className="mt-1 text-[14px] text-sub">
          {remoteDb
            ? "직책이 있는 회원만 학번 또는 아이디로 들어와요. 데이터는 서버 DB에 저장됩니다."
            : "직책이 있는 회원만 학번 또는 아이디로 들어와요. 단원은 로그인할 수 없어요."}
        </p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <div>
            <FieldLabel>아이디 또는 학번</FieldLabel>
            <TextInput
              type="text"
              autoComplete="username"
              required
              placeholder="학번 또는 아이디"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/\s/g, "").slice(0, 32))}
            />
          </div>
          <div>
            <FieldLabel hint="기본은 전화번호 뒷 4자리">비밀번호</FieldLabel>
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              maxLength={32}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 32))}
            />
          </div>
          <PrimaryButton type="submit" className="h-11 w-full" disabled={busy || !sessionReady}>
            {busy ? "확인 중…" : "로그인"}
          </PrimaryButton>
        </form>
        {error ? <p className="mt-3 text-[13px] text-up">{error}</p> : null}

        {demos.length > 0 ? (
          <div className="mt-5 rounded-card border border-line-soft bg-muted px-3 py-3">
            <p className="text-[12px] font-semibold text-faint">운영진 계정</p>
            <ul className="mt-2 space-y-1.5">
              {demos.map((demo) => (
                <li key={demo.studentId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-btn px-1 py-1 text-left text-[13px] text-ink hover:bg-white"
                    onClick={() => {
                      setStudentId(demo.studentId);
                      setPin(demo.pin);
                      setError("");
                    }}
                  >
                    <span>
                      {demo.name}
                      <span className="ml-1 text-[12px] text-faint">{demo.role}</span>
                    </span>
                    <span className="tabular-nums text-[12px] text-faint">
                      {demo.studentId} · {demo.pin}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {currentMember ? (
          <p className="mt-4 text-[13px] text-sub">
            지금 {currentMember.name} 님으로 들어가 있어요.{" "}
            <Link href="/" className="font-medium text-brand-text">
              홈으로
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
