"use client";

import { AiInsightCard } from "@/components/ui/AiInsightCard";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { GhostButton } from "@/components/ui/GhostButton";
import { KpiCard } from "@/components/ui/KpiCard";
import { MiniWeek } from "@/components/ui/MiniCalendar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { RightRail, RailSection } from "@/components/layout/RightRail";
import { MemberRail } from "@/components/members/MemberRail";
import { latestTransaction } from "@/lib/bankExcel";
import { formatDateKo, formatWon, todayISO } from "@/lib/format";
import { CLUB_NAME, isAbsentStatus } from "@/lib/constants";
import {
  attendanceSpark,
  balanceSpark,
  eventSpark,
  memberSpark,
  memberTrend,
  practiceSpark,
  unpaidSpark,
} from "@/lib/seed";
import {
  categoryCounts,
  diligenceScore,
  latestPractice,
  membersForEvent,
  participationScore,
  practiceEvents,
  rosterAttendanceRate,
  upcomingPractice,
} from "@/lib/stats";
import { useClub } from "@/lib/store";
import { CalendarPlus, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968"];

export function HomeView() {
  const { members, categories, events, attendance, transactions, openModal, inspectMember, inspectedMemberId } = useClub();
  const router = useRouter();
  const today = todayISO();
  const featuredEvent = latestPractice(events, today);
  const featured = attendance.filter((row) => featuredEvent && row.eventId === featuredEvent.id);
  const rate = rosterAttendanceRate(featuredEvent ? membersForEvent(members, featuredEvent) : [], featured);
  const unpaidMembers = members.filter((m) => m.unpaidFee > 0);
  const unpaidSum = unpaidMembers.reduce((sum, m) => sum + m.unpaidFee, 0);
  const nextEvent = upcomingPractice(events, today) ?? events.find((e) => e.date >= today) ?? events[events.length - 1];
  const practiceCount = practiceEvents(events).filter((e) => e.date <= today).length;
  const groupData = categoryCounts(members, categories).map((g) => ({ name: g.name, value: g.count, part: "" }));
  const balance = latestTransaction(transactions)?.balanceAfter ?? 0;

  const ranked = [...members]
    .map((member) => ({
      ...member,
      diligence: diligenceScore(member, events, attendance),
      participation: participationScore(member, events, attendance),
    }))
    .sort((a, b) => b.diligence - a.diligence || b.participation - a.participation)
    .slice(0, 10);

  const watch = [...members]
    .map((member) => {
      const rows = attendance.filter((row) => row.memberId === member.id);
      const recentAbsent = rows.filter((row) => isAbsentStatus(row.status)).length;
      return { ...member, recentAbsent, diligence: diligenceScore(member, events, attendance) };
    })
    .sort((a, b) => b.recentAbsent - a.recentAbsent || a.diligence - b.diligence)
    .slice(0, 5);

  const columns: Column<(typeof ranked)[number]>[] = [
    {
      key: "name",
      header: "이름",
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={row.name} size={24} />
          <span className="font-medium">{row.name}</span>
        </span>
      ),
    },
    { key: "role", header: "직책", render: (row) => <span className="text-sub">{row.role}</span> },
    {
      key: "diligence",
      header: "성실도",
      render: (row) => <ScoreBar value={row.diligence} />,
    },
    {
      key: "participation",
      header: "참여도",
      render: (row) => <ScoreBar value={row.participation} color="var(--brand)" />,
    },
  ];

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin">
        <section className="grid grid-cols-2 border-b border-line-soft xl:grid-cols-6">
          <KpiCard label="전체 회원수" value={`${members.length}명`} delta={`전주 대비 +2`} deltaUp spark={memberSpark} />
          <KpiCard label="이번 주 출석률" value={`${rate.toFixed(1)}%`} spark={attendanceSpark} sparkColor="auto" />
          <KpiCard label="이번 달 연습" value={`${practiceCount}회`} spark={practiceSpark} caption="3월부터 누적 연습" />
          <KpiCard label="통장 잔액" value={formatWon(balance)} spark={balanceSpark} sparkColor="var(--up)" />
          <KpiCard
            label="미납 회비"
            value={`${unpaidMembers.length}명 · ${formatWon(unpaidSum)}`}
            spark={unpaidSpark}
            sparkColor="var(--down)"
          />
          <KpiCard
            label="다가오는 일정"
            value={nextEvent ? formatDateKo(nextEvent.date) : "-"}
            caption={nextEvent ? nextEvent.title : ""}
            spark={eventSpark}
          />
        </section>

        <section className="grid border-b border-line-soft lg:grid-cols-2">
          <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">분류별 회원 구성</h2>
              <span className="text-[12px] text-faint">{CLUB_NAME}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-[168px] w-[168px] shrink-0">
                <PieChart width={168} height={168}>
                  <Pie
                    data={groupData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={74}
                    paddingAngle={1.5}
                    stroke="none"
                    isAnimationActive={false}
                    cx="50%"
                    cy="50%"
                  >
                    {groupData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {groupData.map((g, i) => (
                  <li key={g.name} className="flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2 text-sub">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      {g.name}
                    </span>
                    <span className="font-medium text-ink">{g.value}명</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">회원수 추이</h2>
              <span className="text-[12px] text-faint">최근 3개월</span>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memberTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[40, 50]} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #e5e8eb", borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [`${value}명`, "회원수"]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">오늘/최근 출석 요약</h2>
            <button type="button" className="text-[13px] text-brand-text" onClick={() => router.push("/attendance")}>
              출석체크 보기
            </button>
          </div>
          <p className="mb-3 text-[12px] text-faint">성실도 높은 순 · 상위 10명 · {formatDateKo(today)} 기준</p>
          <DataTable columns={columns} rows={ranked} onRowClick={(row) => inspectMember(row.id)} />
        </section>
      </main>

      <RightRail>
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <>
            <RailSection>
              <AiInsightCard text="주중 연습 참석률이 지난달 대비 4.1% 올랐어요" />
            </RailSection>
            <RailSection title="관심 회원 TOP 5" action={<span className="text-[12px] text-faint">성실도/최근 결석</span>}>
              <ul>
                {watch.map((member, index) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-btn px-1 py-2 text-left hover:bg-muted"
                      onClick={() => inspectMember(member.id)}
                    >
                      <span className="w-4 text-[12px] text-faint">{index + 1}</span>
                      <Avatar name={member.name} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{member.name}</span>
                        <span className="block text-[11px] text-faint">최근 결석 {member.recentAbsent}회</span>
                      </span>
                      <span className="text-[12px] font-medium text-up">{member.diligence.toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </RailSection>
            <RailSection>
              <MiniWeek events={events} onSelect={() => router.push("/calendar")} />
            </RailSection>
            <RailSection title="바로가기">
              <div className="grid gap-2">
                <PrimaryButton onClick={() => openModal("sms")}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  문자보내기
                </PrimaryButton>
                <GhostButton onClick={() => openModal("event")}>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  일정생성
                </GhostButton>
                <GhostButton onClick={() => openModal("transaction")}>
                  <Plus className="h-3.5 w-3.5" />
                  거래등록
                </GhostButton>
              </div>
            </RailSection>
          </>
        )}
      </RightRail>
    </>
  );
}
