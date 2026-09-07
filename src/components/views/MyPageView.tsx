"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
import { Avatar } from "@/components/ui/Avatar";
import { FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { Pill, RolePill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { dataUrlToBlob, fileToAvatarDataUrl, memberPhotoSrc } from "@/lib/proof";
import { putProofBlob } from "@/lib/proofDb";
import { loginIdTaken, phonePin } from "@/lib/session";
import { useClub } from "@/lib/store";
import type { Member } from "@/lib/types";
import { Camera, LogOut } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

export function MyPageView() {
  const { currentMember, members, updateMember, toast, remoteDb } = useClub();

  if (!currentMember) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[14px] text-faint">로그인 정보가 없어요.</p>
      </main>
    );
  }

  return (
    <MyPageEditor
      key={currentMember.id}
      member={currentMember}
      members={members}
      updateMember={updateMember}
      toast={toast}
      remoteDb={remoteDb}
    />
  );
}

function MyPageEditor({
  member,
  members,
  updateMember,
  toast,
  remoteDb,
}: {
  member: Member;
  members: Member[];
  updateMember: (id: string, patch: Partial<Member>) => void;
  toast: (message: string) => void;
  remoteDb: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(memberPhotoSrc(member) ?? "");
  const [photoId, setPhotoId] = useState(member.photoId ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [loginId, setLoginId] = useState(member.loginId?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const defaultPin = phonePin(phone) || phonePin(member.phone);
  const hasCustomPassword = Boolean(member.password?.trim());

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setPhoto(dataUrl);
      if (remoteDb) {
        const blob = dataUrlToBlob(dataUrl);
        const id = `photo-${member.id}-${Date.now().toString(36)}`;
        await putProofBlob(id, blob, { name: file.name, mime: blob.type || "image/jpeg" });
        setPhotoId(id);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "사진을 읽지 못했어요");
    }
  }

  function save() {
    const nextPhone = phone.trim();
    if (!nextPhone) {
      toast("연락처를 입력해 주세요");
      return;
    }
    const nextLogin = loginId.trim() || member.studentId;
    if (loginIdTaken(members, nextLogin, member.id)) {
      toast("이미 쓰는 아이디예요");
      return;
    }
    const nextPassword = password.trim();
    if (nextPassword || passwordConfirm.trim()) {
      if (nextPassword.length < 4) {
        toast("비밀번호는 4자 이상으로 해 주세요");
        return;
      }
      if (nextPassword !== passwordConfirm.trim()) {
        toast("비밀번호 확인이 같지 않아요");
        return;
      }
    }
    updateMember(member.id, {
      phone: nextPhone,
      bio: bio.trim(),
      photoDataUrl: photo.startsWith("data:") ? photo : "",
      photoId: photoId || undefined,
      loginId: nextLogin === member.studentId ? "" : nextLogin,
      ...(nextPassword ? { password: nextPassword } : {}),
    });
    setPassword("");
    setPasswordConfirm("");
    toast("내 정보를 저장했어요");
  }

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin">
        <section className="border-b border-line-soft px-5 py-4">
          <p className="text-[12px] text-faint">마이페이지 · 내 정보 수정</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="relative shrink-0"
              onClick={() => fileRef.current?.click()}
              aria-label="프로필 사진 변경"
            >
              <Avatar name={member.name} size={56} src={photo} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-brand text-white">
                <Camera className="h-3 w-3" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div>
              <h1 className="flex items-baseline gap-2 text-[20px] font-semibold">
                {member.name}
                <RolePill role={member.role} />
                {member.active === false ? <Pill tone="muted">비활동</Pill> : null}
              </h1>
              <p className="mt-0.5 text-[13px] text-faint">
                <span className="tabular-nums">{member.studentId}</span>
                {member.category ? ` · ${member.category}` : ""}
              </p>
              {bio.trim() ? <p className="mt-1 text-[13px] text-sub">{bio.trim()}</p> : null}
            </div>
          </div>
        </section>

        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <section className="grid border-b border-line-soft lg:grid-cols-2">
            <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
              <h2 className="mb-3 text-[15px] font-semibold">프로필</h2>
              <div>
                <FieldLabel hint="이미지 파일">프로필 사진</FieldLabel>
                <div className="flex items-center gap-2">
                  <GhostButton type="button" onClick={() => fileRef.current?.click()}>
                    사진 올리기
                  </GhostButton>
                  {photo ? (
                    <GhostButton type="button" onClick={() => setPhoto("")} className="text-up hover:bg-[#FFF1F1]">
                      삭제
                    </GhostButton>
                  ) : null}
                </div>
              </div>
              <div className="mt-4">
                <FieldLabel hint={`${bio.trim().length}/40`}>한줄멘트</FieldLabel>
                <TextArea
                  rows={2}
                  maxLength={40}
                  placeholder="나를 한 줄로 소개해 주세요"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 40))}
                  className="min-h-[72px]"
                />
              </div>
              <div className="mt-4">
                <FieldLabel>연락처</FieldLabel>
                <TextInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  autoComplete="off"
                  className="h-9"
                />
                {!hasCustomPassword ? (
                  <p className="mt-1.5 text-[12px] text-faint">
                    비밀번호를 바꾸지 않으면 뒷 4자리 {defaultPin || "----"} 로 로그인해요.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold">계정</h2>
              <div>
                <FieldLabel hint="비우면 학번으로 로그인">아이디</FieldLabel>
                <TextInput
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.replace(/\s/g, "").slice(0, 32))}
                  placeholder={member.studentId}
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className="mt-4">
                <FieldLabel hint={hasCustomPassword ? "저장된 비밀번호가 있어요" : "기본은 전화번호 뒷 4자리"}>
                  새 비밀번호
                </FieldLabel>
                <TextInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 32))}
                  placeholder="바꾸려면 입력"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className="mt-4">
                <FieldLabel>비밀번호 확인</FieldLabel>
                <TextInput
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value.slice(0, 32))}
                  placeholder="한 번 더"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              {hasCustomPassword ? (
                <button
                  type="button"
                  className="mt-3 text-[12px] font-medium text-brand-text"
                  onClick={() => {
                    updateMember(member.id, { password: "" });
                    setPassword("");
                    setPasswordConfirm("");
                    toast("비밀번호를 전화번호 뒷 4자리로 되돌렸어요");
                  }}
                >
                  기본 비밀번호로 되돌리기
                </button>
              ) : null}
            </div>
          </section>

          <section className="flex items-center justify-end gap-2 px-5 py-4">
            <GhostButton
              type="button"
              onClick={() => {
                setPhoto(memberPhotoSrc(member) ?? "");
                setPhotoId(member.photoId ?? "");
                setBio(member.bio ?? "");
                setPhone(member.phone);
                setLoginId(member.loginId?.trim() ?? "");
                setPassword("");
                setPasswordConfirm("");
              }}
            >
              취소
            </GhostButton>
            <PrimaryButton type="submit">저장</PrimaryButton>
          </section>
        </form>
      </main>

      <RightRail>
        <RailSection title="계정">
          <p className="text-[13px] text-sub">
            {member.name} 님으로 로그인되어 있어요. 아이디·비밀번호·사진을 여기서 바꿔 주세요.
          </p>
          <Link
            href="/login?out=1"
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-btn border border-line bg-white px-3.5 text-[13px] font-semibold text-up hover:bg-[#FFF1F1]"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </Link>
        </RailSection>
      </RightRail>
    </>
  );
}
