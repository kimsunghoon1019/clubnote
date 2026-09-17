"use client";

import { ChartNotes } from "@/components/ui/ChartNotes";
import { Avatar } from "@/components/ui/Avatar";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { TextInput } from "@/components/ui/Field";
import { PropertySelect } from "@/components/ui/PropertySelect";
import { GhostButton } from "@/components/ui/GhostButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { tallyMemberPresents } from "@/lib/attendanceSheet";
import { FINE_STATUSES, GENDER_OPTIONS, emptyFineTally } from "@/lib/constants";
import { ageFromBirthDate, collegeFromMajor, formatDateDot, tenureLabel } from "@/lib/format";
import { memberPhotoSrc } from "@/lib/proof";
import { diligenceScore, participationScore } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { Gender } from "@/lib/types";
import { Pencil, UserMinus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
  joinedAt: string;
};

const EDIT_CLASS = "h-touch px-2 text-compact lg:!h-8 lg:!px-2 lg:!text-[13px]";

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
  joinedAt: string;
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
    joinedAt: member.joinedAt,
  };
}

function withCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
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
  const presentCount = tallyMemberPresents(member, events, attendance);
  const memberNotes = notes.filter((note) => note.memberId === member.id);
  const shown = editing && draft ? draft : null;
  const patch = (next: Partial<MemberDraft>) => setDraft((current) => (current ? { ...current, ...next } : current));

  return (
    <div data-member-rail={member.id}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={shown?.name ?? member.name} size={40} src={memberPhotoSrc(member)} />
          <div className="min-w-0 flex-1">
            {shown ? (
              <div className="flex items-center gap-1.5">
                <TextInput
                  aria-label="이름"
                  className={`${EDIT_CLASS} min-w-0 flex-1 font-semibold lg:!text-[15px]`}
                  value={shown.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
                <PropertySelect
                  aria-label="직책"
                  className={`${EDIT_CLASS} !w-[104px] shrink-0`}
                  value={shown.role}
                  options={withCurrent(roles, shown.role)}
                  onChange={(value) => patch({ role: value })}
                />
              </div>
            ) : (
              <p className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold">{member.name}</span>
                {" "}
                <span className="text-[12px] font-normal text-sub">{member.role}</span>
                {member.active === false ? (
                  <>
                    {" "}
                    <span className="text-[12px] font-normal text-faint">비활동</span>
                  </>
                ) : null}
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-faint">
              <span className="tabular-nums">{shown?.studentId ?? member.studentId}</span>
              {" · "}
              {shown?.major ?? member.major}
              {shown && member.active === false ? (
                <>
                  {" · "}
                  <span>비활동</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <button type="button" className="hidden text-[12px] text-faint hover:text-ink lg:inline" onClick={() => inspectMember(null)}>
          닫기
        </button>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <Info label="단과대학">
          {shown ? (
            <TextInput aria-label="단과대학" className={EDIT_CLASS} value={shown.college} onChange={(e) => patch({ college: e.target.value })} />
          ) : (
            member.college || "-"
          )}
        </Info>
        <Info label="전공">
          {shown ? (
            <TextInput
              aria-label="전공"
              className={EDIT_CLASS}
              value={shown.major}
              onChange={(e) => {
                const major = e.target.value;
                const inferred = collegeFromMajor(major);
                patch({ major, college: inferred || shown.college });
              }}
            />
          ) : (
            member.major
          )}
        </Info>
        <Info label="분류">
          {shown ? (
            <PropertySelect
              aria-label="분류"
              className={EDIT_CLASS}
              value={shown.category}
              options={withCurrent(categories, shown.category)}
              onChange={(value) => patch({ category: value })}
            />
          ) : (
            member.category
          )}
        </Info>
        <Info label="성별">
          {shown ? (
            <PropertySelect
              aria-label="성별"
              className={EDIT_CLASS}
              value={shown.gender}
              options={[...GENDER_OPTIONS]}
              onChange={(value) => patch({ gender: value as Gender })}
            />
          ) : (
            member.gender
          )}
        </Info>
        <Info label="나이">
          {shown ? (
            <span className="flex items-center gap-1">
              <TextInput
                aria-label="나이"
                className={EDIT_CLASS}
                inputMode="numeric"
                value={shown.age}
                onChange={(e) => patch({ age: e.target.value.replace(/[^\d]/g, "") })}
              />
              <span className="shrink-0 text-sub">세</span>
            </span>
          ) : (
            `${member.age}세`
          )}
        </Info>
        <Info label="생년월일">
          {shown ? (
            <TextInput
              aria-label="생년월일"
              className={`${EDIT_CLASS} tabular-nums`}
              type="date"
              value={shown.birthDate}
              onChange={(e) => {
                const birthDate = e.target.value;
                patch({
                  birthDate,
                  age: birthDate ? String(ageFromBirthDate(birthDate)) : shown.age,
                });
              }}
            />
          ) : member.birthDate ? (
            formatDateDot(member.birthDate)
          ) : (
            "-"
          )}
        </Info>
        <Info label="근속" value={tenureLabel(shown?.joinedAt ?? member.joinedAt)} />
        <Info label="학번">
          {shown ? (
            <TextInput
              aria-label="학번"
              className={`${EDIT_CLASS} tabular-nums`}
              inputMode="numeric"
              maxLength={10}
              value={shown.studentId}
              onChange={(e) => patch({ studentId: e.target.value.replace(/[^\d]/g, "").slice(0, 10) })}
            />
          ) : (
            member.studentId
          )}
        </Info>
        <Info label="가입">
          {shown ? (
            <TextInput
              aria-label="가입"
              className={`${EDIT_CLASS} tabular-nums`}
              type="date"
              value={shown.joinedAt}
              onChange={(e) => patch({ joinedAt: e.target.value })}
            />
          ) : member.joinedAt ? (
            formatDateDot(member.joinedAt)
          ) : (
            "-"
          )}
        </Info>
        <Info label="연락처">
          {shown ? (
            <TextInput aria-label="연락처" className={EDIT_CLASS} value={shown.phone} onChange={(e) => patch({ phone: e.target.value })} />
          ) : (
            member.phone || "-"
          )}
        </Info>
      </dl>

      <div className="mb-4 space-y-2">
        <ScoreBar label="성실도" value={diligence} />
        <ScoreBar label="참여도" value={participation} color="var(--brand)" />
        <p className="text-[11px] leading-4 text-faint">
          성실도는 본인 연습요일 출석, 참여도는 학기 전체 연습 대비 참여예요.
        </p>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-[12px] text-sub">출결 누계</p>
          <p className="text-[12px] text-sub">
            출석 <span className="font-medium tabular-nums text-ink">{presentCount}회</span>
          </p>
        </div>
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
                  joinedAt: draft.joinedAt,
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

function Info({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="min-w-0 text-ink">{children ?? value}</dd>
    </div>
  );
}
