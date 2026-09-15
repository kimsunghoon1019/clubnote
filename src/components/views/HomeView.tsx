"use client";

import { GhostButton } from "@/components/ui/GhostButton";
import { KpiCard } from "@/components/ui/KpiCard";
import { LiveClock } from "@/components/ui/LiveClock";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { DetailSurface } from "@/components/layout/DetailSurface";
import { RailSection } from "@/components/layout/RightRail";
import { ChartInbox } from "@/components/members/ChartInbox";
import { MemberRail } from "@/components/members/MemberRail";
import { latestTransaction, transactionBalanceSpark } from "@/lib/bankExcel";
import { duesStatus } from "@/lib/dues";
import { formatDateKo, formatEventTime, formatWeekday, formatWon, todayISO } from "@/lib/format";
import { todayMemoItems, type TodayMemo } from "@/lib/notice";
import {
  attendanceStatusMap,
  categoryPresentCounts,
  centeredPracticeParticipation,
  heldPracticeEvents,
  joinedMembersForEvent,
  memberCountSpark,
  membersForEvent,
  monthlyHeldPracticeSpark,
  pooledRosterRate,
  remainingPracticeEvents,
  thisWeekHeldPractices,
  upcomingPractice,
  weeklyAttendanceSpark,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968"];
const JOINED_BAR = "#3182F6";
const ROSTER_BAR = "#B4C8E8";
const RECENT_PRACTICE_COUNT = 12;

export function HomeView() {
  const {
    members,
    categories,
    events,
    attendance,
    transactions,
    duesOverrides,
    inspectMember,
    inspectedMemberId,
    currentMember,
    toast,
  } = useClub();
  const router = useRouter();
  const today = todayISO();
  const recordMap = useMemo(() => attendanceStatusMap(attendance), [attendance]);
  const held = useMemo(() => heldPracticeEvents(events, today), [events, today]);
  const remaining = useMemo(() => remainingPracticeEvents(events, today), [events, today]);
  const weekHeld = useMemo(() => thisWeekHeldPractices(events, today), [events, today]);
  const participationByDate = useMemo(
    () => centeredPracticeParticipation(events, members, recordMap, today, RECENT_PRACTICE_COUNT),
    [events, members, recordMap, today],
  );
  const selectableRows = participationByDate.filter((row) => !row.isPad && !row.isPlaceholder);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [practiceWeekOffset, setPracticeWeekOffset] = useState(1);
  const fallbackEventId =
    selectableRows.find((row) => row.isToday)?.id ??
    selectableRows.find((row) => row.date >= today)?.id ??
    selectableRows.at(-1)?.id ??
    null;
  const selectedEvent =
    events.find((event) => event.id === selectedEventId && selectableRows.some((row) => row.id === event.id)) ??
    events.find((event) => event.id === fallbackEventId) ??
    null;
  const selectedJoined = selectedEvent ? joinedMembersForEvent(selectedEvent, members, recordMap, today) : [];
  const selectedRoster = selectedEvent ? membersForEvent(members, selectedEvent) : [];
  const pieData = categoryPresentCounts(selectedJoined, categories);
  const pieSlices = pieData.filter((row) => row.value > 0);
  const weekRate = pooledRosterRate(weekHeld, members, recordMap);
  const avgRate = pooledRosterRate(held, members, recordMap);
  const attendanceSpark = weeklyAttendanceSpark(events, members, recordMap, today);
  const practiceSpark = monthlyHeldPracticeSpark(events, today);

  const selectChartRow = (id?: string) => {
    if (!id) return;
    if (!selectableRows.some((row) => row.id === id)) return;
    setSelectedEventId(id);
  };
  const nextEvent = upcomingPractice(events, today) ?? events.find((e) => e.date >= today) ?? events[events.length - 1];
  const balance = latestTransaction(transactions)?.balanceAfter ?? 0;
  const balanceSpark = useMemo(() => transactionBalanceSpark(transactions), [transactions]);
  const memberSpark = useMemo(() => memberCountSpark(members, today), [members, today]);
  const dues = useMemo(
    () => duesStatus(members, transactions, categories, { today, overrides: duesOverrides }),
    [members, transactions, categories, today, duesOverrides],
  );
  const unpaidCount = dues.rows.filter((row) => !row.paid).length;
  const paidCount = dues.rows.length - unpaidCount;

  const memos = useMemo(
    () => todayMemoItems(events, members, categories, recordMap, today, practiceWeekOffset),
    [events, members, categories, recordMap, today, practiceWeekOffset],
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto scrollbar-thin" onClick={dismissInspected}>
        <section data-home-greeting className="order-1 border-b border-line-soft px-5 py-4 lg:hidden">
          <p className="text-compact-title font-semibold">{currentMember?.name} 님</p>
          <div className="mt-1">
            <LiveClock />
          </div>
        </section>
        <section data-home-kpi className="order-3 grid grid-cols-2 border-b border-line-soft lg:order-1 xl:grid-cols-6">
          <KpiCard label="전체 회원수" value={`${members.length}명`} spark={memberSpark} sparkColor="auto" />
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
          <KpiCard label="통장 잔액" value={formatWon(balance)} spark={balanceSpark} sparkColor="auto" />
          <KpiCard
            label="미납 회비"
            value={`${unpaidCount}명`}
            caption={`${dues.semester.label} · 납부 ${paidCount}명`}
          />
          <KpiCard
            label="다가오는 일정"
            value={nextEvent ? formatDateKo(nextEvent.date) : "-"}
            caption={nextEvent ? nextEvent.title : ""}
          />
        </section>

        {nextEvent ? (
          <section data-home-next-event className="order-4 border-b border-line-soft px-5 py-4 lg:hidden">
            <p className="text-compact-caption text-sub">다음 연습</p>
            <p className="mt-1 text-compact-title font-semibold">{formatDateKo(nextEvent.date)}</p>
            <p className="text-compact-caption text-sub">
              {formatWeekday(nextEvent.date)} · {formatEventTime(nextEvent)} · {nextEvent.place}
            </p>
          </section>
        ) : null}

        <section data-home-charts className="order-5 grid border-b border-line-soft lg:order-2 lg:grid-cols-2">
          <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">날짜별 연습 참여 인원</h2>
              <div className="flex items-center gap-3 text-[12px] text-faint">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: JOINED_BAR }} />
                  참여
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: ROSTER_BAR }} />
                  대상
                </span>
              </div>
            </div>
            {selectableRows.length === 0 && !participationByDate.some((row) => row.isToday) ? (
              <p className="flex h-[160px] items-center text-[13px] text-faint">연습 일정이 없어요</p>
            ) : (
              <div className="h-[120px] lg:h-[160px]" data-chart="participation">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={participationByDate}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    onClick={(state) => {
                      const payload = state?.activePayload?.[0]?.payload as { id?: string } | undefined;
                      const byId = participationByDate.find((row) => row.id === state?.activeLabel);
                      selectChartRow(payload?.id ?? byId?.id);
                    }}
                  >
                    <XAxis
                      dataKey="id"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={(props: { x: number; y: number; payload: { value: string } }) => {
                        const { x, y, payload } = props;
                        const row = participationByDate.find((item) => item.id === payload.value);
                        if (!row || row.isPad) return <g />;
                        const active = row.id === selectedEvent?.id;
                        const todayMark = row.isToday;
                        return (
                          <text
                            x={x}
                            y={y}
                            dy={12}
                            textAnchor="middle"
                            fontSize={11}
                            fill={active || todayMark ? "#1B64DA" : "#8b95a1"}
                            fontWeight={active || todayMark ? 600 : 400}
                            style={{ cursor: row.isPlaceholder ? "default" : "pointer" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectChartRow(row.id);
                            }}
                          >
                            {row.label}
                          </text>
                        );
                      }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b95a1" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(49, 130, 246, 0.06)" }}
                      content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as
                          | { date?: string; roster?: number; joined?: number; isPad?: boolean; isPlaceholder?: boolean }
                          | undefined;
                        if (!active || !row || row.isPad || row.isPlaceholder || !row.date) return null;
                        return (
                          <div className="rounded-card border border-line-soft bg-white px-3 py-2 text-[12px] shadow-sm">
                            <p className="font-medium text-ink">
                              {formatDateKo(row.date)} ({formatWeekday(row.date)})
                            </p>
                            <p className="mt-1 text-sub">대상 {row.roster ?? 0}명</p>
                            <p className="text-sub">참여 {row.joined ?? 0}명</p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="joined"
                      name="참여"
                      stackId="part"
                      fill={JOINED_BAR}
                      maxBarSize={28}
                      cursor="pointer"
                      isAnimationActive={false}
                      shape={(props: {
                        x?: number;
                        y?: number;
                        width?: number;
                        height?: number;
                        fill?: string;
                        payload?: { rest?: number };
                      }) => {
                        const rest = Number(props.payload?.rest ?? 0);
                        return (
                          <Rectangle
                            x={props.x}
                            y={props.y}
                            width={props.width}
                            height={props.height}
                            fill={props.fill}
                            radius={rest === 0 ? [4, 4, 0, 0] : 0}
                          />
                        );
                      }}
                      onClick={(data) => selectChartRow(typeof data?.id === "string" ? data.id : undefined)}
                    />
                    <Bar
                      dataKey="rest"
                      name="대상"
                      stackId="part"
                      fill={ROSTER_BAR}
                      maxBarSize={28}
                      cursor="pointer"
                      isAnimationActive={false}
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => selectChartRow(typeof data?.id === "string" ? data.id : undefined)}
                    />
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
                  ? `${formatDateKo(selectedEvent.date)} (${formatWeekday(selectedEvent.date)}) · ${selectedJoined.length}명`
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
                      참여 인원이 없어요
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
            {selectedJoined.length > 0 ? (
              <ul className="mt-4 space-y-2 lg:hidden">
                {selectedJoined.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      className="flex min-h-touch w-full items-center justify-between text-left text-compact"
                      onClick={() => inspectMember(member.id)}
                    >
                      <span>{member.name}</span>
                      <span className="text-compact-caption text-sub">{member.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        <section data-home-memos className="order-2 min-w-0 border-b border-line-soft px-5 py-4 lg:order-3">
          <div className="mb-2">
            <h2 className="text-[15px] font-semibold">오늘의 멘트</h2>
            <p className="mt-0.5 text-[12px] text-faint">카톡방에 바로 붙여넣을 수 있어요</p>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-2">
            {memos.map((memo) => (
              <CopyMemoCard
                key={memo.id}
                memo={memo}
                onCopy={() => copyMemo(memo.text)}
                weekNav={
                  memo.id === "week-practice"
                    ? {
                        onPrev: () => setPracticeWeekOffset((offset) => offset - 1),
                        onNext: () => setPracticeWeekOffset((offset) => offset + 1),
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      </main>

      <DetailSurface
        open={Boolean(inspectedMemberId)}
        title={members.find((item) => item.id === inspectedMemberId)?.name}
        onClose={() => inspectMember(null)}
      >
        <div className="hidden lg:block">
          <RailSection>
            <LiveClock />
          </RailSection>
        </div>
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <>
            <RailSection>
              <ChartInbox />
            </RailSection>
            <RailSection>
              <MiniCalendar compact events={events} onSelect={() => router.push("/calendar")} />
            </RailSection>
          </>
        )}
      </DetailSurface>
    </>
  );
}

function CopyMemoCard({
  memo,
  onCopy,
  weekNav,
}: {
  memo: TodayMemo;
  onCopy: () => void;
  weekNav?: { onPrev: () => void; onNext: () => void };
}) {
  return (
    <div data-home-memo={memo.id} className="rounded-card border border-line-soft">
      <div className="flex items-start justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{memo.title}</p>
          {weekNav ? (
            <div className="-ml-2 flex items-center">
              <button
                type="button"
                data-practice-week-prev
                aria-label="이전 주"
                className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation hover:bg-muted lg:h-8 lg:w-8"
                onClick={weekNav.onPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {memo.caption ? (
                <p className="min-w-0 flex-1 truncate text-center text-[12px] text-faint">{memo.caption}</p>
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                data-practice-week-next
                aria-label="다음 주"
                className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation hover:bg-muted lg:h-8 lg:w-8"
                onClick={weekNav.onNext}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : memo.caption ? (
            <p className="text-[12px] text-faint">{memo.caption}</p>
          ) : null}
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
