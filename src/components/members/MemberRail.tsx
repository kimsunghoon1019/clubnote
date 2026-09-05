"use client";

import { ChartNotes } from "@/components/ui/ChartNotes";
import { Avatar } from "@/components/ui/Avatar";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { RolePill } from "@/components/ui/Pill";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { FieldLabel, SelectInput, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { FINE_STATUSES, GENDER_OPTIONS, emptyFineTally } from "@/lib/constants";
import { ageFromBirthDate, collegeFromMajor, formatDateDot, tenureLabel } from "@/lib/format";
import { diligenceScore, participationScore } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { Gender } from "@/lib/types";
import { Pencil, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";

type MemberDraft = {
  name: string;
  age: string;
  birthDate: string;
  studentId: string;
  major: string;
  college: string;
  phone: string;
  gender: Gender;
  category: string;
  role: string;
};

function draftFrom(member: {
  name: string;
  age: number;
  birthDate: string;
  studentId: string;
  major: string;
  college: string;
  phone: string;
  gender: Gender;
  category: string;
  role: string;
}): MemberDraft {
  return {
    name: member.name,
    age: String(member.age),
    birthDate: member.birthDate,
    studentId: member.studentId,
    major: member.major,
    college: member.college,
    phone: member.phone,
    gender: member.gender,
    category: member.category,
    role: member.role,
  };
}

export function MemberRail({ memberId }: { memberId: string }) {
  const {
    members,
    events,
    attendance,
    notes,
    categories,
    roles,
    updateMember,
    setPracticeDays,
    addChartNote,
    deleteChartNote,
    inspectMember,
    selectedMemberIds,
    removeMembers,
    toast,
  } = useClub();
  const member = members.find((item) => item.id === memberId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MemberDraft | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
  }, [memberId]);

  if (!member) return null;

  const diligence = diligenceScore(member, events, attendance);
  const participation = participationScore(member, events, attendance);
  const memberNotes = notes.filter((note) => note.memberId === member.id);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Avatar name={member.name} size={40} />
          <div>
            <p className="text-[15px] font-semibold">{member.name}</p>
            <p className="text-[12px] text-faint">
              <span className="tabular-nums">{member.studentId}</span> · {member.major}
            </p>
          </div>
        </div>
        <button type="button" className="text-[12px] text-faint hover:text-ink" onClick={() => inspectMember(null)}>
          닫기
        </button>
      </div>

      <div className="mb-4 flex items-center gap-1.5">
        <RolePill role={member.role} />
        {member.active === false ? (
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[#F2F4F6] px-2 text-[11px] font-medium text-sub">
            비활동
          </span>
        ) : null}
      </div>

      {editing && draft ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <FieldLabel>이름</FieldLabel>
            <TextInput
              className="h-8 text-[13px]"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>분류</FieldLabel>
            <SelectInput
              className="h-8 text-[13px]"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>직책</FieldLabel>
            <SelectInput
              className="h-8 text-[13px]"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            >
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>나이</FieldLabel>
            <TextInput
              className="h-8 text-[13px]"
              inputMode="numeric"
              value={draft.age}
              onChange={(e) => setDraft({ ...draft, age: e.target.value.replace(/[^\d]/g, "") })}
            />
          </div>
          <div>
            <FieldLabel>생년월일</FieldLabel>
            <TextInput
              className="h-8 text-[13px] tabular-nums"
              type="date"
              value={draft.birthDate}
              onChange={(e) => {
                const birthDate = e.target.value;
                setDraft({
                  ...draft,
                  birthDate,
                  age: birthDate ? String(ageFromBirthDate(birthDate)) : draft.age,
                });
              }}
            />
          </div>
          <div>
            <FieldLabel>성별</FieldLabel>
            <SelectInput
              className="h-8 text-[13px]"
              value={draft.gender}
              onChange={(e) => setDraft({ ...draft, gender: e.target.value as Gender })}
            >
              {GENDER_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>학번</FieldLabel>
            <TextInput
              className="h-8 text-[13px] tabular-nums"
              inputMode="numeric"
              maxLength={10}
              value={draft.studentId}
              onChange={(e) => setDraft({ ...draft, studentId: e.target.value.replace(/[^\d]/g, "").slice(0, 10) })}
            />
          </div>
          <div>
            <FieldLabel>단과대학</FieldLabel>
            <TextInput
              className="h-8 text-[13px]"
              value={draft.college}
              onChange={(e) => setDraft({ ...draft, college: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>전공</FieldLabel>
            <TextInput
              className="h-8 text-[13px]"
              value={draft.major}
              onChange={(e) => {
                const major = e.target.value;
                const inferred = collegeFromMajor(major);
                setDraft({
                  ...draft,
                  major,
                  college: inferred || draft.college,
                });
              }}
            />
          </div>
          <div className="col-span-2">
            <FieldLabel>연락처</FieldLabel>
            <TextInput
              className="h-8 text-[13px]"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          <Info label="단과대학" value={member.college || "-"} />
          <Info label="전공" value={member.major} />
          <Info label="분류" value={member.category} />
          <Info label="성별" value={member.gender} />
          <Info label="나이" value={`${member.age}세`} />
          <Info label="생년월일" value={member.birthDate ? formatDateDot(member.birthDate) : "-"} />
          <Info label="근속" value={tenureLabel(member.joinedAt)} />
          <Info label="학번" value={member.studentId} />
          <Info label="가입" value={formatDateDot(member.joinedAt)} />
          <Info label="연락처" value={member.phone || "-"} />
        </dl>
      )}

      <div className="mb-4 space-y-2">
        <ScoreBar label="성실도" value={diligence} />
        <ScoreBar label="참여도" value={participation} color="var(--brand)" />
        <p className="text-[11px] leading-4 text-faint">
          성실도는 본인 연습요일 출석, 참여도는 학기 전체 연습 대비 참여예요.
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[12px] text-sub">출결 누계</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
          {FINE_STATUSES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-2">
              <span className="whitespace-nowrap text-faint">{status}</span>
              <span className="font-medium tabular-nums text-ink">{(member.fineTally ?? emptyFineTally())[status]}회</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1.5 text-[12px] text-sub">연습요일</p>
          <PracticeDayToggles value={member.practiceDays} onChange={(days) => setPracticeDays(member.id, days)} />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] text-sub">활동</p>
          <div className="inline-flex h-7 overflow-hidden rounded-[6px] border border-line">
            <button
              type="button"
              aria-pressed={member.active !== false}
              className={`min-w-[40px] px-2 text-[12px] font-medium ${member.active !== false ? "bg-brand text-white" : "bg-white text-faint hover:bg-muted"}`}
              onClick={() => updateMember(member.id, { active: true })}
            >
              활동
            </button>
            <button
              type="button"
              aria-pressed={member.active === false}
              className={`min-w-[48px] border-l border-line px-2 text-[12px] font-medium ${member.active === false ? "bg-[#4E5968] text-white" : "bg-white text-faint hover:bg-muted"}`}
              onClick={() => updateMember(member.id, { active: false })}
            >
              비활동
            </button>
          </div>
        </div>
      </div>

      <ChartNotes
        notes={memberNotes}
        onAdd={(body) => addChartNote(member.id, body)}
        onDelete={deleteChartNote}
      />

      <div className="mt-5 flex gap-2 border-t border-line-soft pt-4">
        {editing ? (
          <>
            <GhostButton className="flex-1" onClick={() => { setEditing(false); setDraft(null); }}>
              취소
            </GhostButton>
            <PrimaryButton
              className="flex-1"
              disabled={!draft?.name.trim()}
              onClick={() => {
                if (!draft) return;
                updateMember(member.id, {
                  name: draft.name.trim(),
                  age: draft.birthDate ? ageFromBirthDate(draft.birthDate) : Number(draft.age) || member.age,
                  birthDate: draft.birthDate,
                  studentId: draft.studentId.trim() || member.studentId,
                  major: draft.major.trim() || member.major,
                  college: draft.college.trim() || collegeFromMajor(draft.major) || member.college,
                  phone: draft.phone.trim(),
                  gender: draft.gender,
                  category: draft.category,
                  role: draft.role,
                });
                setEditing(false);
                setDraft(null);
                toast("회원 정보를 수정했어요");
              }}
            >
              저장
            </PrimaryButton>
          </>
        ) : (
          <>
            <GhostButton
              className="flex-1"
              onClick={() => {
                setDraft(draftFrom(member));
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </GhostButton>
            <GhostButton
              className="flex-1 text-up hover:bg-[#FFF1F1]"
              onClick={() => {
                const ids = selectedMemberIds.length > 0 ? selectedMemberIds : [member.id];
                const names = members.filter((item) => ids.includes(item.id)).map((item) => item.name);
                const label = ids.length === 1 ? `${names[0]} 님` : `선택한 ${ids.length}명`;
                if (!window.confirm(`${label}을 동아리에서 내보낼까요? 출석·차트 기록도 함께 삭제돼요.`)) return;
                removeMembers(ids);
                toast(`${label}을 내보냈어요`);
              }}
            >
              <UserMinus className="h-3.5 w-3.5" />
              {selectedMemberIds.length > 1 ? `선택 ${selectedMemberIds.length}명` : "내보내기"}
            </GhostButton>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
