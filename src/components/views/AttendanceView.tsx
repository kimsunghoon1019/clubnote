"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
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
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_META, isPresentStatus } from "@/lib/constants";
import { formatDateKo, formatEventTime, formatWeekday, todayISO } from "@/lib/format";
import {
  categoryAttendance,
  countByStatus,
  isPracticeEvent,
  latestPractice,
  membersForEvent,
  sortMembersByCategory,
} from "@/lib/stats";
import { isInspectDismissClick } from "@/lib/inspect";
import { useClub } from "@/lib/store";
import type { AttendanceStatus, Member } from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

const STATUS_FILTERS: Array<AttendanceStatus | "전체" | "미체크"> = ["전체", ...ATTENDANCE_STATUSES, "미체크"];

export function AttendanceView() {
  const {
    members,
    categories,
    events,
    attendance,
    setAttendanceStatus,
    inspectMember,
    inspectedMemberId,
    openModal,
    toast,
  } = useClub();

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

  const fallback = latestPractice(events, todayISO()) ?? practiceList[practiceList.length - 1];
  const [eventId, setEventId] = useState(fallback?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "전체" | "미체크">("전체");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!practiceList.some((item) => item.id === eventId) && fallback) {
      setEventId(fallback.id);
    }
  }, [practiceList, eventId, fallback]);

  const event = events.find((item) => item.id === eventId) ?? fallback;
  const eventIndex = practiceList.findIndex((item) => item.id === event?.id);

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
      .filter((row) => {
        if (statusFilter === "전체") return true;
        if (statusFilter === "미체크") return !row.status;
        return row.status === statusFilter;
      });
  }, [roster, recordMap, statusFilter]);

  const targetRecords = records.filter((row) => roster.some((m) => m.id === row.memberId));
  const counts = countByStatus(targetRecords);
  const present = roster.filter((member) => {
    const status = recordMap.get(member.id);
    return Boolean(status && isPresentStatus(status));
  }).length;
  const targetCount = roster.length;
  const unchecked = roster.filter((m) => !recordMap.has(m.id)).length;

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId) return;
    if (!isInspectDismissClick(event.target)) return;
    inspectMember(null);
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
            onChange={(status) => {
              if (!event) return;
              setAttendanceStatus(event.id, row.id, status);
            }}
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

  return (
    <>
      <aside className="flex min-h-0 w-[160px] shrink-0 flex-col border-r border-line-soft" onClick={dismissInspected}>
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
        <div className="flex-1 overflow-auto px-2 scrollbar-thin">
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
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-5 py-2">
          <h1 className="text-[15px] font-semibold">출석대상자</h1>
          <span className="text-[13px] text-sub">
            {present}/{targetCount}
          </span>
          <span className="text-[12px] text-faint">
            {formatWeekday(event.date)}요일 · 미체크 {unchecked}명
          </span>
          <GhostButton className="h-8 px-3 text-[12px]" onClick={() => setSheetOpen(true)}>
            출석표 보기
          </GhostButton>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((item) => (
              <FilterChip key={item} active={statusFilter === item} onClick={() => setStatusFilter(item)}>
                {item === "전체" || item === "미체크" ? item : ATTENDANCE_STATUS_META[item].short}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pt-2 scrollbar-thin">
          <DataTable
            columns={columns}
            rows={rows}
            tableClassName="min-w-[920px]"
            selectedIds={inspectedMemberId ? [inspectedMemberId] : []}
            onRowClick={(row) => inspectMember(inspectedMemberId === row.id ? null : row.id)}
            empty={
              <span>
                이 요일 출석 대상자가 없어요. 회원관리에서 연습요일을 켜 주세요.
              </span>
            }
          />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-line-soft bg-white px-5 py-2.5">
          <GhostButton onClick={() => toast("출석이 저장되었어요")}>임시저장</GhostButton>
          <PrimaryButton onClick={() => toast("출석을 마감했어요")}>출석 마감</PrimaryButton>
        </div>
      </main>

      <RightRail>
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <RailSection title="분류 출석현황">
            <ul className="space-y-4">
              {categories.map((category) => {
                const stat = categoryAttendance(category, roster, records);
                return (
                  <li key={category}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-sub">{category}</span>
                      <span className="font-medium text-ink">{stat.rate.toFixed(0)}%</span>
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
      </RightRail>

      <AttendanceSheetModal open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
