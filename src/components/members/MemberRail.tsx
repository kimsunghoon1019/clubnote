"use client";

import { ChartNotes } from "@/components/ui/ChartNotes";
import { Avatar } from "@/components/ui/Avatar";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { RolePill } from "@/components/ui/Pill";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { SelectInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { formatDateDot, studentYear, tenureLabel } from "@/lib/format";
import { diligenceScore, participationScore } from "@/lib/stats";
import { useClub } from "@/lib/store";
import { UserMinus } from "lucide-react";

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
              {studentYear(member.studentId)} · {member.major}
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

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <Info label="분류" value={member.category} />
        <Info label="성별" value={member.gender} />
        <Info label="나이" value={`${member.age}세`} />
        <Info label="근속" value={tenureLabel(member.joinedAt)} />
        <Info label="학번" value={member.studentId} />
        <Info label="가입" value={formatDateDot(member.joinedAt)} />
        <div className="col-span-2">
          <Info label="연락처" value={member.phone || "-"} />
        </div>
      </dl>

      <div className="mb-4 space-y-2">
        <ScoreBar label="성실도" value={diligence} />
        <ScoreBar label="참여도" value={participation} color="var(--brand)" />
        <p className="text-[11px] leading-4 text-faint">
          성실도는 본인 연습요일 출석, 참여도는 학기 전체 연습 대비 참여예요.
        </p>
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

      <div className="mb-3 space-y-2">
        <SelectInput value={member.role} onChange={(e) => updateMember(member.id, { role: e.target.value })}>
          {roles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </SelectInput>
        <SelectInput value={member.category} onChange={(e) => updateMember(member.id, { category: e.target.value })}>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </SelectInput>
      </div>

      <ChartNotes
        notes={memberNotes}
        onAdd={(body) => addChartNote(member.id, body)}
        onDelete={deleteChartNote}
      />

      <div className="mt-5 border-t border-line-soft pt-4">
        <GhostButton
          className="w-full text-up hover:bg-[#FFF1F1]"
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
          {selectedMemberIds.length > 1 ? `선택 ${selectedMemberIds.length}명 내보내기` : "동아리에서 내보내기"}
        </GhostButton>
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
