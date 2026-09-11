"use client";

import { DetailSurface } from "@/components/layout/DetailSurface";
import { RailSection } from "@/components/layout/RightRail";
import { MemberRail } from "@/components/members/MemberRail";
import { AttendanceSheetModal } from "@/components/modals/AttendanceSheetModal";
import { AttendanceToggle, StatusMixBar } from "@/components/ui/AttendanceToggle";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RolePill } from "@/components/ui/Pill";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { isAttendanceClosed } from "@/lib/attendanceSheet";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_META, isPresentStatus } from "@/lib/constants";
import { formatDateKo, formatEventTime, formatWeekday, todayISO } from "@/lib/format";
import {
  categoryAttendance,
  countByStatus,
  isPracticeEvent,
  latestPractice,
  membersForEvent,
  sortMembersByCategory,
  upcomingPractice,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { memberPhotoSrc } from "@/lib/proof";
import { useClub } from "@/lib/store";
import type { AttendanceStatus, Member } from "@/lib/types";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

export function AttendanceView() {
  const {
    members,
    categories,
    events,
    attendance,
    setAttendanceStatus,
    closeAttendance,
    inspectMember,
    inspectedMemberId,
    openModal,
    toast,
  } = useClub();
  const router = useRouter();

  const practiceList = useMemo(() => {
    const today = todayISO();
    const list = events.filter(isPracticeEvent);
    const upcoming = list
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const past = list
      .filter((item) => item.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    return [...upcoming, ...past];
  }, [events]);

  const fallback =
    upcomingPractice(events, todayISO()) ?? latestPractice(events, todayISO()) ?? practiceList[0];
  const [eventId, setEventId] = useState(fallback?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const saveFlashTimer = useRef(0);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!practiceList.some((item) => item.id === eventId) && fallback) {
      setEventId(fallback.id);
    }
  }, [practiceList, eventId, fallback]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectionAnchorId(null);
    inspectMember(null);
    setDateOpen(false);
  }, [eventId, inspectMember]);

  useEffect(() => {
    if (!dateOpen) return;
    const onPointer = (click: PointerEvent) => {
      if (datePickerRef.current?.contains(click.target as Node)) return;
      setDateOpen(false);
    };
    const onKey = (key: KeyboardEvent) => {
      if (key.key === "Escape") setDateOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [dateOpen]);

  useEffect(() => {
    if (categoryFilter !== "전체" && !categories.includes(categoryFilter)) {
      setCategoryFilter("전체");
    }
  }, [categories, categoryFilter]);

  useEffect(() => () => window.clearTimeout(saveFlashTimer.current), []);

  const event = events.find((item) => item.id === eventId) ?? fallback;
  const eventIndex = practiceList.findIndex((item) => item.id === event?.id);
  const chronoList = useMemo(
    () =>
      events
        .filter(isPracticeEvent)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [events],
  );
  const chronoIndex = chronoList.findIndex((item) => item.id === event?.id);
  const prevPractice = chronoIndex > 0 ? chronoList[chronoIndex - 1] : null;
  const nextPractice =
    chronoIndex >= 0 && chronoIndex < chronoList.length - 1 ? chronoList[chronoIndex + 1] : null;

  const roster = useMemo(
    () => (event ? sortMembersByCategory(membersForEvent(members, event), categories) : []),
    [members, event, categories],
  );
  const records = attendance.filter((row) => event && row.eventId === event.id);
  const recordMap = new Map(records.map((row) => [row.memberId, row.status]));

  const rows = useMemo(() => {
    return roster
      .map((member) => ({
        ...member,
        status: recordMap.get(member.id) as AttendanceStatus | undefined,
      }))
      .filter((row) => categoryFilter === "전체" || row.category === categoryFilter);
  }, [roster, recordMap, categoryFilter]);

  const targetRecords = records.filter((row) => roster.some((m) => m.id === row.memberId));
  const counts = countByStatus(targetRecords);
  const present = roster.filter((member) => {
    const status = recordMap.get(member.id);
    return Boolean(status && isPresentStatus(status));
  }).length;
  const targetCount = roster.length;
  const unchecked = roster.filter((m) => !recordMap.has(m.id)).length;

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId && selectedIds.length === 0) return;
    if (!isInspectDismissClick(event.target)) return;
    inspectMember(null);
    setSelectedIds([]);
    setSelectionAnchorId(null);
  };

  const handleRowClick = (row: Member, click: MouseEvent<HTMLTableRowElement>) => {
    const additive = click.ctrlKey || click.metaKey;
    const ranged = click.shiftKey;
    const ids = rows.map((item) => item.id);

    if (ranged) {
      const end = ids.indexOf(row.id);
      const startId = selectionAnchorId && ids.includes(selectionAnchorId) ? selectionAnchorId : row.id;
      const start = ids.indexOf(startId);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      const rangeIds = ids.slice(from, to + 1);
      setSelectedIds(additive ? [...new Set([...selectedIds, ...rangeIds])] : rangeIds);
      inspectMember(null);
      return;
    }

    if (additive) {
      setSelectedIds((prev) =>
        prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
      );
      setSelectionAnchorId(row.id);
      inspectMember(null);
      return;
    }

    if (
      inspectedMemberId === row.id &&
      (selectedIds.length === 0 || (selectedIds.length === 1 && selectedIds[0] === row.id))
    ) {
      inspectMember(null);
      setSelectedIds([]);
      setSelectionAnchorId(null);
      return;
    }

    setSelectionAnchorId(row.id);
    inspectMember(row.id);
    setSelectedIds([row.id]);
  };

  const handleCompactRowClick = (row: Member) => {
    if (
      inspectedMemberId === row.id &&
      (selectedIds.length === 0 || (selectedIds.length === 1 && selectedIds[0] === row.id))
    ) {
      inspectMember(null);
      setSelectedIds([]);
      setSelectionAnchorId(null);
      return;
    }
    setSelectionAnchorId(row.id);
    inspectMember(row.id);
    setSelectedIds([row.id]);
  };

  const applyAttendance = (memberId: string, status: AttendanceStatus | null) => {
    if (!event) return;
    const rosterIds = new Set(roster.map((member) => member.id));
    const targets =
      selectedIds.includes(memberId) && selectedIds.length > 1
        ? selectedIds.filter((id) => rosterIds.has(id))
        : [memberId];
    for (const id of targets) {
      setAttendanceStatus(event.id, id, status);
    }
  };

  const handleSave = () => {
    if (!event) return;
    closeAttendance(event.id);
    setSaveFlash(true);
    window.clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = window.setTimeout(() => setSaveFlash(false), 720);
    toast("출석이 저장됐어요");
  };

  const goBack = () => {
    try {
      const ref = document.referrer;
      if (ref) {
        const url = new URL(ref);
        if (url.origin === window.location.origin && url.pathname !== "/attendance") {
          router.back();
          return;
        }
      }
    } catch {
      /* fall through */
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  const columns: Column<Member & { status?: AttendanceStatus }>[] = [
    { key: "category", header: "분류", render: (row) => <span className="text-sub">{row.category}</span> },
    { key: "role", header: "직책", render: (row) => <RolePill role={row.role} /> },
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
    {
      key: "days",
      header: "연습요일",
      render: (row) => <span className="text-[12px] text-sub">{row.practiceDays.join(" ")}</span>,
    },
    {
      key: "status",
      header: "출결",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <AttendanceToggle
            name={row.name}
            value={row.status}
            onChange={(status) => applyAttendance(row.id, status)}
          />
        </div>
      ),
    },
  ];

  if (!event) {
    return (
      <main className="flex flex-1 items-center justify-center text-[13px] text-faint">
        연습 일정이 없어요. 캘린더에서 정기연습을 추가해 주세요.
      </main>
    );
  }

  const emptyRoster =
    categoryFilter === "전체"
      ? "이 요일 출석 대상자가 없어요. 회원관리에서 연습요일을 켜 주세요."
      : "이 분류에 출석 대상자가 없어요.";

  const categoryTabs = (chipClassName?: string) =>
    ["전체", ...categories].map((tab) => (
      <FilterChip
        key={tab}
        active={categoryFilter === tab}
        className={chipClassName}
        onClick={() => {
          setCategoryFilter(tab);
          setSelectedIds([]);
          setSelectionAnchorId(null);
          inspectMember(null);
        }}
      >
        {tab}
      </FilterChip>
    ));

  return (
    <>
      <aside
        data-attendance-date-rail
        className="hidden min-h-0 w-[160px] shrink-0 flex-col border-r border-line-soft lg:flex"
        onClick={dismissInspected}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <p className="text-[13px] font-semibold">연습날짜</p>
          <div className="flex flex-col">
            <button
              type="button"
              aria-label="이전 연습일"
              className="text-faint hover:text-ink"
              onClick={() => {
                if (eventIndex > 0) setEventId(practiceList[eventIndex - 1].id);
              }}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="다음 연습일"
              className="text-faint hover:text-ink"
              onClick={() => {
                if (eventIndex < practiceList.length - 1) setEventId(practiceList[eventIndex + 1].id);
              }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-2 pt-1.5 pb-1.5 scrollbar-thin">
          {practiceList.map((item) => {
            const active = item.id === event.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setEventId(item.id)}
                className={cn(
                  "mb-1 w-full rounded-btn px-2.5 py-2 text-left",
                  active ? "ring-1 ring-brand" : "hover:bg-muted",
                )}
              >
                <p className={cn("text-[13px] font-medium", active ? "text-brand-text" : "text-ink")}>
                  {formatDateKo(item.date)}
                </p>
                <p className="text-[11px] text-faint">
                  {formatWeekday(item.date)} {formatEventTime(item)}
                  {isAttendanceClosed(item) ? " · 마감" : ""}
                </p>
              </button>
            );
          })}
        </div>
        <div className="border-t border-line-soft p-2">
          <GhostButton className="w-full text-[12px]" onClick={() => openModal("event")}>
            일정 추가
          </GhostButton>
        </div>
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onClick={dismissInspected}>
        <div className="hidden min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-5 py-2 lg:flex">
          <h1 className="text-[15px] font-semibold">출석대상자</h1>
          <span className="text-[13px] text-sub">
            {present}/{targetCount}
          </span>
          <span className="text-[12px] text-faint">
            {formatWeekday(event.date)}요일 · 미체크 {unchecked}명
            {selectedIds.length > 1 ? ` · ${selectedIds.length}명 선택` : ""}
          </span>
          <GhostButton className="h-8 px-3 text-[12px]" onClick={() => setSheetOpen(true)}>
            출석표 보기
          </GhostButton>
          <div className="ml-auto flex flex-wrap items-center gap-1">{categoryTabs()}</div>
        </div>

        <div
          data-attendance-compact-head
          className="relative flex shrink-0 flex-col gap-2.5 border-b border-line-soft px-4 py-3 lg:hidden"
        >
          <h1 className="sr-only">출석대상자</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-attendance-prev
              aria-label="이전 연습일"
              disabled={!prevPractice}
              className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation disabled:text-faint"
              onClick={() => {
                if (prevPractice) setEventId(prevPractice.id);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div ref={datePickerRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                data-attendance-date-picker
                aria-haspopup="listbox"
                aria-expanded={dateOpen}
                aria-label="연습날짜 선택"
                className="flex min-h-touch w-full items-center justify-between gap-2 rounded-btn border border-line px-3 py-2 text-left touch-manipulation"
                onClick={() => setDateOpen((open) => !open)}
              >
              <span className="min-w-0">
                <span className="block truncate text-compact font-semibold text-ink">
                  {formatDateKo(event.date)} ({formatWeekday(event.date)})
                </span>
                <span className="block truncate text-compact-caption text-faint">
                  {formatEventTime(event)}
                  {isAttendanceClosed(event) ? " · 마감" : ""}
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-faint transition-transform", dateOpen && "rotate-180")} />
            </button>
            {dateOpen ? (
              <div
                data-attendance-date-sheet
                role="listbox"
                aria-label="연습날짜"
                className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-[min(420px,60vh)] overflow-auto rounded-card border border-line bg-white py-1.5 scrollbar-thin"
              >
                {practiceList.map((item) => {
                  const active = item.id === event.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex min-h-touch w-full flex-col justify-center px-3 py-2 text-left touch-manipulation",
                        active ? "bg-brand-soft" : "hover:bg-muted",
                      )}
                      onClick={() => {
                        setEventId(item.id);
                        setDateOpen(false);
                      }}
                    >
                      <span className={cn("text-compact font-medium", active ? "text-brand-text" : "text-ink")}>
                        {formatDateKo(item.date)}
                      </span>
                      <span className="text-compact-caption text-faint">
                        {formatWeekday(item.date)} {formatEventTime(item)}
                        {isAttendanceClosed(item) ? " · 마감" : ""}
                      </span>
                    </button>
                  );
                })}
                <div className="border-t border-line-soft p-2">
                  <GhostButton
                    className="h-touch w-full text-[13px]"
                    onClick={() => {
                      setDateOpen(false);
                      openModal("event");
                    }}
                  >
                    일정 추가
                  </GhostButton>
                </div>
              </div>
            ) : null}
            </div>
            <button
              type="button"
              data-attendance-next
              aria-label="다음 연습일"
              disabled={!nextPractice}
              className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation disabled:text-faint"
              onClick={() => {
                if (nextPractice) setEventId(nextPractice.id);
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-compact-caption text-sub">
              출석 {present}/{targetCount} · 미체크 {unchecked}명
            </p>
            <button
              type="button"
              data-attendance-sheet
              className="inline-flex h-touch shrink-0 items-center justify-center rounded-btn border border-line bg-white px-3 text-[13px] font-semibold text-ink touch-manipulation hover:bg-muted"
              onClick={() => setSheetOpen(true)}
            >
              출석표 보기
            </button>
          </div>
          <StatusMixBar counts={counts} unchecked={unchecked} />
          <div className="-mx-4 flex flex-nowrap gap-1 overflow-x-auto px-4 scrollbar-thin">
            {categoryTabs("shrink-0")}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <div data-attendance-table className="hidden px-2 pt-2 lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              tableClassName="min-w-[920px]"
              selectedIds={selectedIds}
              onRowClick={handleRowClick}
              empty={<span>{emptyRoster}</span>}
            />
          </div>
          <ul data-attendance-list className="divide-y divide-line-soft lg:hidden">
            {rows.length === 0 ? (
              <li className="px-4 py-16 text-center text-[13px] text-faint">{emptyRoster}</li>
            ) : (
              rows.map((row) => {
                const selected = selectedIds.includes(row.id);
                return (
                  <li key={row.id}>
                    <div
                      data-row-id={row.id}
                      data-attendance-row
                      className={cn("flex flex-col gap-2.5 px-4 py-3", selected && "bg-[#F7FBFF]")}
                    >
                      <button
                        type="button"
                        data-attendance-identity
                        className="flex min-h-touch items-center gap-3 text-left touch-manipulation"
                        onClick={() => handleCompactRowClick(row)}
                      >
                        <Avatar name={row.name} size={40} src={memberPhotoSrc(row)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-compact font-semibold text-ink">{row.name}</span>
                          <span className="block truncate text-compact-caption text-faint">
                            {row.category} · {row.role}
                          </span>
                        </span>
                      </button>
                      <AttendanceToggle
                        fill
                        name={row.name}
                        value={row.status}
                        onChange={(status) => applyAttendance(row.id, status)}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <div
          data-attendance-save
          className="flex shrink-0 items-center justify-between gap-2 border-t border-line-soft bg-white px-4 py-2 lg:justify-end lg:px-5 lg:py-2.5"
        >
          <button
            type="button"
            data-attendance-back
            className="inline-flex h-touch min-w-touch items-center gap-0.5 rounded-btn px-2 text-[13px] font-semibold text-ink touch-manipulation hover:bg-muted lg:hidden"
            onClick={goBack}
          >
            <ChevronLeft className="h-5 w-5" />
            뒤로
          </button>
          <PrimaryButton
            className={cn(
              "h-9 min-w-[64px] origin-center px-4 touch-manipulation active:scale-90 lg:min-w-[88px]",
              saveFlash && "animate-save-press",
            )}
            onClick={handleSave}
          >
            {saveFlash ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                저장됨
              </>
            ) : (
              "저장"
            )}
          </PrimaryButton>
        </div>
      </main>

      <DetailSurface
        open={Boolean(inspectedMemberId)}
        title={members.find((item) => item.id === inspectedMemberId)?.name ?? "회원"}
        onClose={() => inspectMember(null)}
      >
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <RailSection title="분류별 출석현황">
            <ul className="space-y-4">
              {categories.map((category) => {
                const stat = categoryAttendance(category, roster, records);
                return (
                  <li key={category}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-sub">{category}</span>
                      <span className="font-medium text-ink">{stat.shown}명</span>
                    </div>
                    <StatusMixBar counts={stat.counts} unchecked={stat.unchecked} />
                    <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-faint">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <li key={status} className="inline-flex items-center gap-1">
                          <StatusDot status={status} />
                          {ATTENDANCE_STATUS_META[status].short} {stat.counts[status]}
                        </li>
                      ))}
                      <li className="inline-flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D1D6DB]" />
                        미체크 {stat.unchecked}
                      </li>
                    </ul>
                  </li>
                );
              })}
            </ul>
          </RailSection>
        )}
      </DetailSurface>

      <AttendanceSheetModal open={sheetOpen} onClose={() => setSheetOpen(false)} focusEventId={event.id} />
    </>
  );
}
