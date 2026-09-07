"use client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { FieldLabel, TextInput } from "@/components/ui/Field";
import { demoLogins, safeNextPath } from "@/lib/session";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { useClub } from "@/lib/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signOut, currentMember, members } = useClub();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("out") === "1") {
      signOut();
      params.delete("out");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `/login?${rest}` : "/login");
    }
  }, [signOut]);
  const demos = useMemo(() => demoLogins(members), [members]);
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [magicError, setMagicError] = useState("");
  const configured = hasSupabaseEnv();

  function goNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(safeNextPath(next));
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = signIn(studentId, pin);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    goNext();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicError("");
    if (!configured) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (sendError) {
      setMagicError(sendError.message);
      return;
    }
    setSent(true);
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
        <h1 className="text-[20px] font-semibold">학번으로 로그인</h1>
        <p className="mt-1 text-[14px] text-sub">내 학번과 전화번호 뒷 4자리로 들어와요.</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <div>
            <FieldLabel>학번</FieldLabel>
            <TextInput
              type="text"
              inputMode="numeric"
              autoComplete="username"
              required
              placeholder="학번 10자리"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <div>
            <FieldLabel hint="전화번호 뒷 4자리">비밀번호</FieldLabel>
            <TextInput
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <PrimaryButton type="submit" className="h-11 w-full">
            로그인
          </PrimaryButton>
        </form>
        {error ? <p className="mt-3 text-[13px] text-up">{error}</p> : null}

        {demos.length > 0 ? (
          <div className="mt-5 rounded-card border border-line-soft bg-muted px-3 py-3">
            <p className="text-[12px] font-semibold text-faint">목업 계정</p>
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

        {configured ? (
          <div className="mt-8 border-t border-line-soft pt-6">
            <h2 className="text-[14px] font-semibold">운영진 매직링크</h2>
            <p className="mt-1 text-[12px] text-faint">등록된 이메일로 로그인 링크를 보내 드려요.</p>
            <form className="mt-3 space-y-3" onSubmit={sendMagicLink}>
              <TextInput
                type="email"
                required
                placeholder="you@university.ac.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PrimaryButton type="submit" className="h-11 w-full">
                매직링크 보내기
              </PrimaryButton>
            </form>
            {sent ? <p className="mt-3 text-[13px] text-brand-text">메일함을 확인해 주세요. 링크는 잠시 후 만료돼요.</p> : null}
            {magicError ? <p className="mt-3 text-[13px] text-up">{magicError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
