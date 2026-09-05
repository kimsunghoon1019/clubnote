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
import { formatDateKo, formatWeekday, formatWon, todayISO } from "@/lib/format";
import { isAbsentStatus } from "@/lib/constants";
import { balanceSpark, eventSpark, memberSpark, unpaidSpark } from "@/lib/seed";
import {
  attendanceStatusMap,
  categoryPresentCounts,
  diligenceScore,
  heldPracticeEvents,
  membersForEvent,
  monthlyHeldPracticeSpark,
  participationScore,
  pooledRosterRate,
  presentMembersForEvent,
  remainingPracticeEvents,
  thisWeekHeldPractices,
  upcomingPractice,
  weeklyAttendanceSpark,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import { CalendarPlus, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968"];
const RECENT_PRACTICE_COUNT = 12;

export function HomeView() {
  const { members, categories, events, attendance, transactions, openModal, inspectMember, inspectedMemberId } = useClub();
  const router = useRouter();
  const today = todayISO();
  const recordMap = useMemo(() => attendanceStatusMap(attendance), [attendance]);
  const held = useMemo(() => heldPracticeEvents(events, today), [events, today]);
  const remaining = useMemo(() => remainingPracticeEvents(events, today), [events, today]);
  const weekHeld = useMemo(() => thisWeekHeldPractices(events, today), [events, today]);
  const recentHeld = held.slice(-RECENT_PRACTICE_COUNT);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent =
    recentHeld.find((event) => event.id === selectedEventId) ?? recentHeld[recentHeld.length - 1] ?? null;
  const selectedPresent = selectedEvent ? presentMembersForEvent(selectedEvent, members, recordMap) : [];
  const selectedRoster = selectedEvent ? membersForEvent(members, selectedEvent) : [];
  const pieData = categoryPresentCounts(selectedPresent, categories);
  const pieSlices = pieData.filter((row) => row.value > 0);
  const weekRate = pooledRosterRate(weekHeld, members, recordMap);
  const avgRate = pooledRosterRate(held, members, recordMap);
  const attendanceSpark = weeklyAttendanceSpark(events, members, recordMap, today);
  const practiceSpark = monthlyHeldPracticeSpark(events, today);
  const participationByDate = recentHeld.map((event) => ({
    id: event.id,
    date: event.date,
    label: `${Number(event.date.slice(5, 7))}/${Number(event.date.slice(8, 10))}`,
    present: presentMembersForEvent(event, members, recordMap).length,
    roster: membersForEvent(members, event).length,
  }));
  const unpaidMembers = members.filter((m) => m.unpaidFee > 0);
  const unpaidSum = unpaidMembers.reduce((sum, m) => sum + m.unpaidFee, 0);
  const nextEvent = upcomingPractice(events, today) ?? events.find((e) => e.date >= today) ?? events[events.length - 1];
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

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId) return;
    if (!isInspectDismissClick(event.target)) return;
    inspectMember(null);
  };

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
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin" onClick={dismissInspected}>
        <section className="grid grid-cols-2 border-b border-line-soft xl:grid-cols-6">
          <KpiCard label="전체 회원수" value={`${members.length}명`} delta={`전주 대비 +2`} deltaUp spark={memberSpark} />
          <KpiCard
            label="이번 주 출석률"
            value={weekHeld.length === 0 ? "—" : `${weekRate.toFixed(1)}%`}
            caption={held.length === 0 ? "평균 —" : `평균 ${avgRate.toFixed(1)}%`}
            spark={attendanceSpark}
            sparkColor="auto"
          />
          <KpiCard
            label="연습"
            value={`${held.length}회 · 남은 ${remaining.length}회`}
            caption="오늘 기준"
            spark={practiceSpark}
          />
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
              <h2 className="text-[15px] font-semibold">날짜별 연습 참여 인원</h2>
              <span className="text-[12px] text-faint">최근 {recentHeld.length}회 · 출석표</span>
            </div>
            {participationByDate.length === 0 ? (
              <p className="flex h-[160px] items-center text-[13px] text-faint">아직 지난 연습이 없어요</p>
            ) : (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={participationByDate}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    onClick={(state) => {
                      const payload = state?.activePayload?.[0]?.payload as { id?: string } | undefined;
                      const byLabel = participationByDate.find((row) => row.label === state?.activeLabel);
                      const id = payload?.id ?? byLabel?.id;
                      if (typeof id === "string") setSelectedEventId(id);
                    }}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={(props: { x: number; y: number; payload: { value: string } }) => {
                        const { x, y, payload } = props;
                        const row = participationByDate.find((item) => item.label === payload.value);
                        const active = row?.id === selectedEvent?.id;
                        return (
                          <text
                            x={x}
                            y={y}
                            dy={12}
                            textAnchor="middle"
                            fontSize={11}
                            fill={active ? "#1B64DA" : "#8b95a1"}
                            fontWeight={active ? 600 : 400}
                            style={{ cursor: "pointer" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (row) setSelectedEventId(row.id);
                            }}
                          >
                            {payload.value}
                          </text>
                        );
                      }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(49, 130, 246, 0.06)" }}
                      contentStyle={{ border: "1px solid #e5e8eb", borderRadius: 12, fontSize: 12 }}
                      formatter={(value, _name, item) => {
                        const roster = Number(item?.payload?.roster ?? 0);
                        return [`${value}명 / 대상 ${roster}명`, "참여"];
                      }}
                      labelFormatter={(_, payload) => {
                        const date = payload?.[0]?.payload?.date as string | undefined;
                        return date ? `${formatDateKo(date)} (${formatWeekday(date)})` : "";
                      }}
                    />
                    <Bar
                      dataKey="present"
                      name="참여"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      minPointSize={3}
                      cursor="pointer"
                      isAnimationActive={false}
                      onClick={(data) => {
                        if (typeof data?.id === "string") setSelectedEventId(data.id);
                      }}
                    >
                      {participationByDate.map((row) => (
                        <Cell
                          key={row.id}
                          fill={row.id === selectedEvent?.id ? "#3182F6" : "#B4C8E8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">분류별 참여 인원</h2>
              <span className="text-[12px] text-faint">
                {selectedEvent
                  ? `${formatDateKo(selectedEvent.date)} (${formatWeekday(selectedEvent.date)}) · ${selectedPresent.length}명`
                  : "날짜를 골라 주세요"}
              </span>
            </div>
            {selectedEvent ? (
              <div className="flex items-center gap-6">
                <div className="flex h-[168px] w-[168px] shrink-0 items-center justify-center">
                  {pieSlices.length === 0 ? (
                    <p className="text-center text-[12px] text-faint">
                      이 날짜에
                      <br />
                      출석한 인원이 없어요
                    </p>
                  ) : (
                    <PieChart width={168} height={168}>
                      <Pie
                        data={pieSlices}
                        dataKey="value"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={1.5}
                        stroke="none"
                        isAnimationActive={false}
                        cx="50%"
                        cy="50%"
                      >
                        {pieSlices.map((entry) => {
                          const colorIndex = pieData.findIndex((row) => row.name === entry.name);
                          return (
                            <Cell
                              key={entry.name}
                              fill={PIE_COLORS[Math.max(0, colorIndex) % PIE_COLORS.length]}
                            />
                          );
                        })}
                      </Pie>
                    </PieChart>
                  )}
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {pieData.map((row, i) => (
                    <li key={row.name} className="flex items-center justify-between text-[13px]">
                      <span className="inline-flex items-center gap-2 text-sub">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: pieSlices.length === 0 ? "#D1D6DB" : PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        {row.name}
                      </span>
                      <span className="font-medium text-ink">{row.value}명</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between text-[12px] text-faint">
                    <span>대상</span>
                    <span>{selectedRoster.length}명</span>
                  </li>
                </ul>
              </div>
            ) : (
              <p className="flex h-[168px] items-center text-[13px] text-faint">연습 날짜가 없어요</p>
            )}
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
          <DataTable
            columns={columns}
            rows={ranked}
            selectedIds={inspectedMemberId ? [inspectedMemberId] : []}
            onRowClick={(row) => inspectMember(inspectedMemberId === row.id ? null : row.id)}
          />
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
