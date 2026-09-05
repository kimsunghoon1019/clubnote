"use client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextInput } from "@/components/ui/Field";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const configured = hasSupabaseEnv();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!configured) {
      router.push("/");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
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
        <h1 className="text-[20px] font-semibold">이메일로 로그인</h1>
        <p className="mt-1 text-[14px] text-sub">운영진 계정으로 매직링크를 보내 드려요.</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <TextInput
            type="email"
            required
            placeholder="you@university.ac.kr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PrimaryButton type="submit" className="w-full h-11">
            {configured ? "매직링크 보내기" : "목업으로 들어가기"}
          </PrimaryButton>
        </form>
        {sent ? <p className="mt-3 text-[13px] text-brand-text">메일함을 확인해 주세요. 링크는 잠시 후 만료돼요.</p> : null}
        {error ? <p className="mt-3 text-[13px] text-up">{error}</p> : null}
        {!configured ? (
          <p className="mt-4 text-[12px] text-faint">
            로컬 목업 모드예요. Supabase 환경변수를 넣으면 매직링크 로그인이 켜집니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
