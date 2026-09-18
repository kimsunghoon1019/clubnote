"use client";

import { GhostButton } from "@/components/ui/GhostButton";
import { LiveClock } from "@/components/ui/LiveClock";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { DetailSurface } from "@/components/layout/DetailSurface";
import { RailSection } from "@/components/layout/RightRail";
import { CategoryPie, PRACTICE_PIE_DAYS, STAFF_CATEGORIES } from "@/components/members/CategoryPie";
import { ChartInbox } from "@/components/members/ChartInbox";
import { MemberRail } from "@/components/members/MemberRail";
import { cn } from "@/lib/cn";
import { formatDateKo, formatEventTime, formatWeekday, todayISO } from "@/lib/format";
import { todayMemoItems, weekOffsetForDate, type TodayMemo } from "@/lib/notice";
import {
  attendanceStatusMap,
  categoryCounts,
  isActive,
  membersScheduledOn,
  practiceCountsByWeekday,
  upcomingPractice,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";

export function HomeView() {
  const { members, categories, events, attendance, inspectMember, inspectedMemberId, currentMember, toast } =
    useClub();
  const router = useRouter();
  const today = todayISO();
  const recordMap = useMemo(() => attendanceStatusMap(attendance), [attendance]);
  const weekdayCounts = useMemo(() => practiceCountsByWeekday(events, today), [events, today]);
  const heldTotal = weekdayCounts.reduce((sum, row) => sum + row.held, 0);
  const remainingTotal = weekdayCounts.reduce((sum, row) => sum + row.remaining, 0);
  const [practiceWeekOffset, setPracticeWeekOffset] = useState(1);
  const [expectedWeekOffset, setExpectedWeekOffset] = useState<number | null>(null);
  const upcoming = upcomingPractice(events, today);
  const nextEvent = upcoming ?? events.find((e) => e.date >= today) ?? events[events.length - 1];
  const resolvedExpectedWeekOffset =
    expectedWeekOffset ?? (upcoming ? weekOffsetForDate(upcoming.date, today) : 0);
  const practicePies = useMemo(() => {
    const activeMembers = members.filter(isActive);
    const partCategories = categories.filter((name) => !STAFF_CATEGORIES.has(name));
    return PRACTICE_PIE_DAYS.map(({ day, title }) => {
      const dayCounts = categoryCounts(membersScheduledOn(activeMembers, [day]), partCategories);
      return {
        day,
        title,
        counts: dayCounts,
        total: dayCounts.reduce((sum, item) => sum + item.count, 0),
      };
    });
  }, [members, categories]);

  const memos = useMemo(
    () => todayMemoItems(events, members, categories, recordMap, today, practiceWeekOffset, resolvedExpectedWeekOffset),
    [events, members, categories, recordMap, today, practiceWeekOffset, resolvedExpectedWeekOffset],
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
        <section data-home-practice-days className="order-3 border-b border-line-soft px-5 py-4 lg:order-1">
          <div className="mb-3">
            <h2 className="text-[15px] font-semibold">요일별 연습</h2>
            <p className="mt-0.5 text-[12px] text-faint">오늘 기준 · 진행한 연습과 남은 연습</p>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[280px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line-soft text-[12px] text-faint">
                  <th className="py-1.5 pr-3 font-medium" scope="col">
                    <span className="sr-only">구분</span>
                  </th>
                  {weekdayCounts.map((row) => (
                    <th
                      key={row.day}
                      data-practice-day={row.day}
                      scope="col"
                      className="py-1.5 px-2 text-right font-medium"
                    >
                      {row.day}요일
                    </th>
                  ))}
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line-soft">
                  <th scope="row" className="py-2 pr-3 font-medium text-ink">
                    진행
                  </th>
                  {weekdayCounts.map((row) => (
                    <td key={row.day} className="py-2 px-2 text-right tabular-nums text-ink">
                      {row.held}회
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">{heldTotal}회</td>
                </tr>
                <tr className="border-b border-line-soft">
                  <th scope="row" className="py-2 pr-3 font-medium text-ink">
                    남은
                  </th>
                  {weekdayCounts.map((row) => (
                    <td key={row.day} className="py-2 px-2 text-right tabular-nums text-sub">
                      {row.remaining}회
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-sub">{remainingTotal}회</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 pr-3 font-semibold text-ink">
                    합계
                  </th>
                  {weekdayCounts.map((row) => (
                    <td key={row.day} className="py-2 px-2 text-right font-semibold tabular-nums text-ink">
                      {row.total}회
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">
                    {heldTotal + remainingTotal}회
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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

        <section data-home-charts className="order-5 grid border-b border-line-soft lg:order-2 lg:grid-cols-3">
          {practicePies.map((pie, index) => (
            <div
              key={pie.day}
              className={cn(
                "border-b border-line-soft p-5 last:border-b-0 lg:border-b-0",
                index < practicePies.length - 1 && "lg:border-r",
              )}
              data-practice-pie={pie.day}
            >
              <p className="text-[12px] text-sub">{pie.title}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">{pie.total}명</p>
              <div className="mt-3">
                <CategoryPie counts={pie.counts} total={pie.total} />
              </div>
            </div>
          ))}
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
                  memo.weekNav === "practice"
                    ? {
                        kind: "practice",
                        onPrev: () => setPracticeWeekOffset((offset) => offset - 1),
                        onNext: () => setPracticeWeekOffset((offset) => offset + 1),
                      }
                    : memo.weekNav === "expected"
                      ? {
                          kind: "expected",
                          onPrev: () => setExpectedWeekOffset(resolvedExpectedWeekOffset - 1),
                          onNext: () => setExpectedWeekOffset(resolvedExpectedWeekOffset + 1),
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
  weekNav?: { kind: "practice" | "expected"; onPrev: () => void; onNext: () => void };
}) {
  const expectedNav = weekNav?.kind === "expected";
  return (
    <div data-home-memo={memo.id} className="rounded-card border border-line-soft">
      <div className="flex items-start justify-between gap-2 px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{memo.title}</p>
          {weekNav ? (
            <div className="-ml-2 flex items-center">
              <button
                type="button"
                data-practice-week-prev={expectedNav ? undefined : true}
                data-expected-week-prev={expectedNav ? true : undefined}
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
                data-practice-week-next={expectedNav ? undefined : true}
                data-expected-week-next={expectedNav ? true : undefined}
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
