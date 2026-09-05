"use client";

import { GhostButton } from "@/components/ui/GhostButton";
import { KpiCard } from "@/components/ui/KpiCard";
import { LiveClock } from "@/components/ui/LiveClock";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { RightRail, RailSection } from "@/components/layout/RightRail";
import { MemberRail } from "@/components/members/MemberRail";
import { latestTransaction } from "@/lib/bankExcel";
import { formatDateKo, formatWeekday, formatWon, todayISO } from "@/lib/format";
import { todayMemoItems, type TodayMemo } from "@/lib/notice";
import { balanceSpark, eventSpark, memberSpark, unpaidSpark } from "@/lib/seed";
import {
  attendanceStatusMap,
  categoryPresentCounts,
  heldPracticeEvents,
  membersForEvent,
  monthlyHeldPracticeSpark,
  pooledRosterRate,
  presentMembersForEvent,
  remainingPracticeEvents,
  thisWeekHeldPractices,
  upcomingPractice,
  upcomingPracticeEvents,
  weeklyAttendanceSpark,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import { Copy } from "lucide-react";
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
  const { members, categories, events, attendance, transactions, inspectMember, inspectedMemberId, toast } = useClub();
  const router = useRouter();
  const today = todayISO();
  const recordMap = useMemo(() => attendanceStatusMap(attendance), [attendance]);
  const held = useMemo(() => heldPracticeEvents(events, today), [events, today]);
  const remaining = useMemo(() => remainingPracticeEvents(events, today), [events, today]);
  const weekHeld = useMemo(() => thisWeekHeldPractices(events, today), [events, today]);
  const fromToday = useMemo(
    () => upcomingPracticeEvents(events, today).slice(0, RECENT_PRACTICE_COUNT),
    [events, today],
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = fromToday.find((event) => event.id === selectedEventId) ?? fromToday[0] ?? null;
  const selectedPresent = selectedEvent ? presentMembersForEvent(selectedEvent, members, recordMap) : [];
  const selectedRoster = selectedEvent ? membersForEvent(members, selectedEvent) : [];
  const pieData = categoryPresentCounts(selectedPresent, categories);
  const pieSlices = pieData.filter((row) => row.value > 0);
  const weekRate = pooledRosterRate(weekHeld, members, recordMap);
  const avgRate = pooledRosterRate(held, members, recordMap);
  const attendanceSpark = weeklyAttendanceSpark(events, members, recordMap, today);
  const practiceSpark = monthlyHeldPracticeSpark(events, today);
  const participationByDate = fromToday.map((event) => ({
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

  const memos = useMemo(
    () => todayMemoItems(events, members, categories, recordMap, today),
    [events, members, categories, recordMap, today],
  );

  const copyMemo = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("멘트를 복사했어요");
    } catch {
      toast("복사에 실패했어요");
    }
  };

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId) return;
    if (!isInspectDismissClick(event.target)) return;
    inspectMember(null);
  };

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
            label="진행한 연습"
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
              <span className="text-[12px] text-faint">오늘부터 {fromToday.length}회 · 출석표</span>
            </div>
            {participationByDate.length === 0 ? (
              <p className="flex h-[160px] items-center text-[13px] text-faint">오늘 이후 연습이 없어요</p>
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

        <section className="min-w-0 border-b border-line-soft px-5 py-4">
          <div className="mb-2">
            <h2 className="text-[15px] font-semibold">오늘의 멘트</h2>
            <p className="mt-0.5 text-[12px] text-faint">카톡방에 바로 붙여넣을 수 있어요</p>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-2">
            {memos.map((memo) => (
              <CopyMemoCard key={memo.id} memo={memo} onCopy={() => copyMemo(memo.text)} />
            ))}
          </div>
        </section>
      </main>

      <RightRail>
        <RailSection>
          <LiveClock />
        </RailSection>
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <RailSection>
            <MiniCalendar compact events={events} onSelect={() => router.push("/calendar")} />
          </RailSection>
        )}
      </RightRail>
    </>
  );
}

function CopyMemoCard({ memo, onCopy }: { memo: TodayMemo; onCopy: () => void }) {
  return (
    <div className="rounded-card border border-line-soft">
      <div className="flex items-start justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{memo.title}</p>
          {memo.caption ? <p className="text-[12px] text-faint">{memo.caption}</p> : null}
        </div>
        <GhostButton className="h-8 shrink-0 px-2.5 text-[12px]" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
          복사
        </GhostButton>
      </div>
      <pre className="whitespace-pre-wrap break-keep border-t border-line-soft bg-muted px-3.5 py-2 text-[13px] leading-5 text-ink">
        {memo.text}
      </pre>
    </div>
  );
}
