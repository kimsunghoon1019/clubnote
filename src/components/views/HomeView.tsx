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
import {
  formatDateKo,
  formatDateWeekday,
  formatEventTime,
  formatWeekday,
  formatWon,
  todayISO,
} from "@/lib/format";
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
  type PracticeParticipationRow,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import type { ClubEvent, Member } from "@/lib/types";
import { Copy } from "lucide-react";
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

  const weekAttendance = weekHeld.length === 0 ? "—" : `${weekRate.toFixed(1)}%`;
  const weekCaption = held.length === 0 ? "평균 —" : `평균 ${avgRate.toFixed(1)}%`;
  const nextCaption = nextEvent
    ? [nextEvent.title, formatEventTime(nextEvent), nextEvent.place].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onClick={dismissInspected}>
        <div data-home-console className="hidden min-h-0 flex-1 overflow-auto scrollbar-thin lg:block">
          <section className="grid grid-cols-2 border-b border-line-soft xl:grid-cols-6">
            <KpiCard label="전체 회원수" value={`${members.length}명`} spark={memberSpark} sparkColor="auto" />
            <KpiCard
              label="이번 주 출석률"
              value={weekAttendance}
              caption={weekCaption}
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

          <section className="grid border-b border-line-soft lg:grid-cols-2">
            <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
              <ParticipationChart
                participationByDate={participationByDate}
                selectedId={selectedEvent?.id ?? null}
                onSelect={selectChartRow}
              />
            </div>
            <div className="p-5">
              <CategoryPie
                selectedEvent={selectedEvent}
                selectedJoined={selectedJoined}
                selectedRoster={selectedRoster}
                pieData={pieData}
                pieSlices={pieSlices}
              />
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
        </div>

        <div data-home-compact className="min-h-0 flex-1 overflow-auto overflow-x-hidden scrollbar-thin lg:hidden">
          <div
            data-home-compact-head
            className="relative flex flex-col gap-3 border-b border-line-soft px-4 py-3 md:px-6"
          >
            <h1 className="sr-only">홈</h1>
            <button
              type="button"
              data-home-next-event
              className="min-h-touch w-full rounded-btn py-1 text-left touch-manipulation active:bg-muted"
              onClick={() => router.push("/calendar")}
            >
              <p className="text-compact-caption text-sub">
                {nextEvent?.date === today ? "오늘 일정" : "다가오는 일정"}
              </p>
              <p className="mt-0.5 truncate text-compact-title font-semibold tabular-nums text-ink">
                {nextEvent ? formatDateWeekday(nextEvent.date) : "일정 없음"}
              </p>
              {nextCaption ? <p className="truncate text-compact-caption text-faint">{nextCaption}</p> : null}
            </button>
            <section data-home-compact-kpi className="grid grid-cols-2 gap-x-3 md:grid-cols-4">
              <CompactStat
                stat="members"
                label="회원"
                value={`${members.length}명`}
                onClick={() => router.push("/members")}
              />
              <CompactStat
                stat="attendance"
                label="이번 주 출석"
                value={weekAttendance}
                caption={weekCaption}
                onClick={() => router.push("/attendance")}
              />
              <CompactStat
                stat="balance"
                label="잔액"
                value={formatWon(balance)}
                onClick={() => router.push("/finance")}
              />
              <CompactStat
                stat="dues"
                label="미납 회비"
                value={`${unpaidCount}명`}
                caption={`${dues.semester.label} · 납부 ${paidCount}명`}
                onClick={() => router.push("/finance")}
              />
            </section>
            <CompactStat
              stat="practice"
              label="진행한 연습"
              value={`${held.length}회 · 남은 ${remaining.length}회`}
              caption="오늘 기준"
              onClick={() => router.push("/attendance")}
            />
          </div>

          <section data-home-memos className="border-b border-line-soft px-4 py-4 md:px-6">
            <div className="mb-2">
              <h2 className="text-compact font-semibold">오늘의 멘트</h2>
              <p className="mt-0.5 text-compact-caption text-faint">카톡방에 바로 붙여넣을 수 있어요</p>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2">
              {memos.map((memo) => (
                <CopyMemoCard key={memo.id} memo={memo} onCopy={() => copyMemo(memo.text)} compact />
              ))}
            </div>
          </section>

          <section className="border-b border-line-soft px-4 py-4 md:px-6">
            <ParticipationChart
              participationByDate={participationByDate}
              selectedId={selectedEvent?.id ?? null}
              onSelect={selectChartRow}
              compact
            />
          </section>

          <section className="border-b border-line-soft px-4 py-4 md:px-6">
            <CategoryPie
              selectedEvent={selectedEvent}
              selectedJoined={selectedJoined}
              selectedRoster={selectedRoster}
              pieData={pieData}
              pieSlices={pieSlices}
              compact
            />
          </section>

          <section data-home-inbox className="border-b border-line-soft px-4 py-4 md:px-6">
            <ChartInbox />
          </section>

          <section data-home-calendar className="px-4 py-4 md:px-6">
            <MiniCalendar compact events={events} onSelect={() => router.push("/calendar")} />
          </section>
        </div>
      </main>

      <DetailSurface
        open={Boolean(inspectedMemberId)}
        title={members.find((item) => item.id === inspectedMemberId)?.name ?? "회원"}
        onClose={() => inspectMember(null)}
      >
        <RailSection>
          <LiveClock />
        </RailSection>
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

function CompactStat({
  stat,
  label,
  value,
  caption,
  onClick,
}: {
  stat: string;
  label: string;
  value: string;
  caption?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-home-stat={stat}
      className="min-h-touch min-w-0 rounded-btn py-1.5 text-left touch-manipulation active:bg-muted"
      onClick={onClick}
    >
      <p className="text-compact-caption text-sub">{label}</p>
      <p className="mt-0.5 truncate text-compact font-semibold tabular-nums text-ink">{value}</p>
      {caption ? <p className="truncate text-compact-caption text-faint">{caption}</p> : null}
    </button>
  );
}

function ParticipationChart({
  participationByDate,
  selectedId,
  onSelect,
  compact,
}: {
  participationByDate: PracticeParticipationRow[];
  selectedId: string | null;
  onSelect: (id?: string) => void;
  compact?: boolean;
}) {
  const selectable = participationByDate.some((row) => !row.isPad && !row.isPlaceholder);
  const hasToday = participationByDate.some((row) => row.isToday);
  const height = compact ? "h-[140px]" : "h-[160px]";

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={compact ? "text-compact font-semibold" : "text-[15px] font-semibold"}>날짜별 연습 참여 인원</h2>
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
      {!selectable && !hasToday ? (
        <p className={`flex ${height} items-center text-[13px] text-faint`}>연습 일정이 없어요</p>
      ) : (
        <div className={height} data-chart="participation">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={participationByDate}
              margin={{ top: 8, right: 8, left: compact ? -28 : -20, bottom: 0 }}
              onClick={(state) => {
                const payload = state?.activePayload?.[0]?.payload as { id?: string } | undefined;
                const byId = participationByDate.find((row) => row.id === state?.activeLabel);
                onSelect(payload?.id ?? byId?.id);
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
                  const active = row.id === selectedId;
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
                        onSelect(row.id);
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
                maxBarSize={compact ? 22 : 28}
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
                onClick={(data) => onSelect(typeof data?.id === "string" ? data.id : undefined)}
              />
              <Bar
                dataKey="rest"
                name="대상"
                stackId="part"
                fill={ROSTER_BAR}
                maxBarSize={compact ? 22 : 28}
                cursor="pointer"
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
                onClick={(data) => onSelect(typeof data?.id === "string" ? data.id : undefined)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function CategoryPie({
  selectedEvent,
  selectedJoined,
  selectedRoster,
  pieData,
  pieSlices,
  compact,
}: {
  selectedEvent: ClubEvent | null;
  selectedJoined: Member[];
  selectedRoster: Member[];
  pieData: { name: string; value: number }[];
  pieSlices: { name: string; value: number }[];
  compact?: boolean;
}) {
  const size = compact ? 136 : 168;
  const inner = compact ? 40 : 50;
  const outer = compact ? 60 : 74;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={compact ? "text-compact font-semibold" : "text-[15px] font-semibold"}>분류별 참여 인원</h2>
        <span className="min-w-0 truncate text-[12px] text-faint">
          {selectedEvent
            ? `${formatDateKo(selectedEvent.date)} (${formatWeekday(selectedEvent.date)}) · ${selectedJoined.length}명`
            : "날짜를 골라 주세요"}
        </span>
      </div>
      {selectedEvent ? (
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
            {pieSlices.length === 0 ? (
              <p className="text-center text-[12px] text-faint">
                이 날짜에
                <br />
                참여 인원이 없어요
              </p>
            ) : (
              <PieChart width={size} height={size}>
                <Pie
                  data={pieSlices}
                  dataKey="value"
                  innerRadius={inner}
                  outerRadius={outer}
                  paddingAngle={1.5}
                  stroke="none"
                  isAnimationActive={false}
                  cx="50%"
                  cy="50%"
                >
                  {pieSlices.map((entry) => {
                    const colorIndex = pieData.findIndex((row) => row.name === entry.name);
                    return (
                      <Cell key={entry.name} fill={PIE_COLORS[Math.max(0, colorIndex) % PIE_COLORS.length]} />
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
    </>
  );
}

function CopyMemoCard({ memo, onCopy, compact }: { memo: TodayMemo; onCopy: () => void; compact?: boolean }) {
  return (
    <div className="rounded-card border border-line-soft" data-home-memo={memo.id}>
      <div className="flex items-start justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0">
          <p className={compact ? "text-compact-caption font-semibold" : "text-[13px] font-semibold"}>{memo.title}</p>
          {memo.caption ? <p className="text-[12px] text-faint">{memo.caption}</p> : null}
        </div>
        <GhostButton
          className={compact ? "h-touch shrink-0 px-3 text-[13px] touch-manipulation" : "h-8 shrink-0 px-2.5 text-[12px]"}
          onClick={onCopy}
        >
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
