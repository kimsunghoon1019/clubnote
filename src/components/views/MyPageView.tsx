"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
import { Avatar } from "@/components/ui/Avatar";
import { FieldLabel, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { KpiCard } from "@/components/ui/KpiCard";
import { Pill, RolePill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ATTENDANCE_STATUS_META, FINE_STATUSES, PRACTICE_DAYS, emptyFineTally } from "@/lib/constants";
import { duesStatus } from "@/lib/dues";
import { formatDateDot, formatDateWeekday, formatEventTime, formatRatio, tenureLabel } from "@/lib/format";
import { phonePin } from "@/lib/session";
import {
  diligenceScore,
  memberPracticeRecords,
  participationScore,
  upcomingMemberPractices,
} from "@/lib/stats";
import { useClub } from "@/lib/store";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function MyPageView() {
  const { currentMember, members, events, attendance, transactions, categories, duesOverrides, updateMember, toast } =
    useClub();
  const [phone, setPhone] = useState(currentMember?.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);

  useEffect(() => {
    setPhone(currentMember?.phone ?? "");
    setEditingPhone(false);
  }, [currentMember?.id, currentMember?.phone]);

  const member = currentMember;
  const diligence = member ? diligenceScore(member, events, attendance) : 0;
  const participation = member ? participationScore(member, events, attendance) : 0;
  const dues = useMemo(
    () => duesStatus(members, transactions, categories, { overrides: duesOverrides }),
    [members, transactions, categories, duesOverrides],
  );
  const myDues = member ? dues.rows.find((row) => row.id === member.id) : null;
  const history = member ? memberPracticeRecords(member, events, attendance).slice(0, 10) : [];
  const upcoming = member ? upcomingMemberPractices(member, events) : [];

  if (!member) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[14px] text-faint">로그인 정보가 없어요.</p>
      </main>
    );
  }

  const savePhone = () => {
    const next = phone.trim();
    if (!next) {
      toast("연락처를 입력해 주세요");
      return;
    }
    updateMember(member.id, { phone: next });
    setEditingPhone(false);
    toast("연락처를 저장했어요. 다음 로그인은 전화번호 뒷 4자리예요.");
  };

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin">
        <section className="border-b border-line-soft px-5 py-4">
          <p className="text-[12px] text-faint">마이페이지</p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={member.name} size={48} />
            <div>
              <h1 className="flex items-baseline gap-2 text-[20px] font-semibold">
                {member.name}
                <RolePill role={member.role} />
                {member.active === false ? <Pill tone="muted">비활동</Pill> : null}
              </h1>
              <p className="mt-0.5 text-[13px] text-faint">
                <span className="tabular-nums">{member.studentId}</span>
                {member.category ? ` · ${member.category}` : ""}
                {member.major ? ` · ${member.major}` : ""}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 border-b border-line-soft xl:grid-cols-4">
          <KpiCard label="성실도" value={formatRatio(diligence)} caption="내 연습요일 출석" />
          <KpiCard label="참여도" value={formatRatio(participation)} caption="학기 전체 연습 대비" />
          <KpiCard
            label="회비"
            value={myDues?.paid ? "납부" : "미납"}
            caption={dues.semester.label}
            delta={myDues && !myDues.paid ? "확인 필요" : undefined}
            deltaUp={Boolean(myDues && !myDues.paid)}
          />
          <KpiCard
            label="활동"
            value={member.active === false ? "비활동" : "활동"}
            caption={`근속 ${tenureLabel(member.joinedAt)}`}
          />
        </section>

        <section className="grid border-b border-line-soft lg:grid-cols-2">
          <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
            <h2 className="mb-3 text-[15px] font-semibold">내 정보</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
              <Info label="단과대학" value={member.college || "-"} />
              <Info label="전공" value={member.major || "-"} />
              <Info label="성별" value={member.gender} />
              <Info label="나이" value={`${member.age}세`} />
              <Info label="생년월일" value={member.birthDate ? formatDateDot(member.birthDate) : "-"} />
              <Info label="가입" value={formatDateDot(member.joinedAt)} />
              <Info label="학번" value={member.studentId} />
              <Info label="분류" value={member.category} />
            </dl>
            <div className="mt-4">
              <FieldLabel hint={editingPhone ? `저장 후 비밀번호 ${phonePin(phone) || "----"}` : undefined}>
                연락처
              </FieldLabel>
              {editingPhone ? (
                <div className="flex gap-2">
                  <TextInput
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9"
                  />
                  <GhostButton onClick={() => { setPhone(member.phone); setEditingPhone(false); }}>취소</GhostButton>
                  <PrimaryButton onClick={savePhone}>저장</PrimaryButton>
                </div>
              ) : (
                <div className="flex h-9 items-center justify-between rounded-btn border border-line-soft px-3">
                  <span className="text-[14px] tabular-nums">{member.phone || "-"}</span>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-brand-text"
                    onClick={() => {
                      setPhone(member.phone);
                      setEditingPhone(true);
                    }}
                  >
                    수정
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-[12px] text-sub">연습요일</p>
              <div className="inline-flex h-7 overflow-hidden rounded-[6px] border border-line">
                {PRACTICE_DAYS.map((day, index) => {
                  const on = member.practiceDays.includes(day);
                  return (
                    <span
                      key={day}
                      className={`inline-flex min-w-[26px] items-center justify-center px-2 text-[12px] font-medium ${
                        index > 0 ? "border-l border-line" : ""
                      } ${on ? "bg-brand text-white" : "bg-white text-faint"}`}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <ScoreBar label="성실도" value={diligence} />
              <ScoreBar label="참여도" value={participation} color="var(--brand)" />
            </div>
          </div>

          <div className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold">다가오는 연습</h2>
            {member.active === false ? (
              <p className="text-[13px] text-faint">비활동 회원은 출석 명단에 없어요.</p>
            ) : upcoming.length === 0 ? (
              <p className="text-[13px] text-faint">예정된 연습이 없어요.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((event) => (
                  <li key={event.id} className="flex items-center justify-between text-[13px]">
                    <span>
                      <span className="font-medium">{formatDateWeekday(event.date)}</span>
                      <span className="ml-2 text-faint">{event.title}</span>
                    </span>
                    <span className="text-[12px] text-faint">{formatEventTime(event)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="p-5">
          <h2 className="mb-3 text-[15px] font-semibold">최근 출석</h2>
          {history.length === 0 ? (
            <p className="text-[13px] text-faint">아직 출석 기록이 없어요.</p>
          ) : (
            <ul className="divide-y divide-line-soft border-y border-line-soft">
              {history.map(({ event, status }) => {
                const meta = status ? ATTENDANCE_STATUS_META[status] : null;
                return (
                  <li key={event.id} className="flex h-10 items-center justify-between text-[13px]">
                    <span>
                      {formatDateWeekday(event.date)}
                      <span className="ml-2 text-faint">{event.title}</span>
                    </span>
                    <span className="font-medium" style={{ color: meta?.color ?? "#8b95a1" }}>
                      {status ?? "미체크"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5">
            <p className="mb-1.5 text-[12px] text-sub">출결 누계</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-4">
              {FINE_STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-faint">{status}</span>
                  <span className="font-medium tabular-nums">{(member.fineTally ?? emptyFineTally())[status]}회</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <RightRail>
        <RailSection title="계정">
          <p className="text-[13px] text-sub">
            {member.name} 님으로 로그인되어 있어요. 연락처 뒷 4자리가 목업 비밀번호예요.
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
