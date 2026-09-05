"use client";

import { DateTimeRangeField, type DateTimeRangeValue } from "@/components/ui/DateTimeRangeField";
import { GhostButton } from "@/components/ui/GhostButton";
import { Pill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EVENT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import {
  formatDateKo,
  formatEventTime,
  formatWeekday,
  parseISODate,
  toISODate,
  todayISO,
} from "@/lib/format";
import { practiceNoticeText } from "@/lib/notice";
import { isPracticeEvent } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { ClubEvent, EventType } from "@/lib/types";
import { ChevronLeft, ChevronRight, Copy, Paperclip, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TYPE_TONE: Record<EventType, "brand" | "warn" | "muted" | "up" | "default"> = {
  연습: "default",
  정기연습: "brand",
  공연: "up",
  회식: "warn",
  오디션: "brand",
  회의: "muted",
};

export function CalendarView() {
  const { events, updateEvent, deleteEvent, openModal, toast } = useClub();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => parseISODate(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { iso: string | null; day: number | null }[] = [
    ...Array.from({ length: startPad }, () => ({ iso: null, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const iso = toISODate(new Date(year, monthIndex, i + 1));
      return { iso, day: i + 1 };
    }),
  ];
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });

  const byDate = useMemo(() => {
    const map = new Map<string, ClubEvent[]>();
    events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [events]);

  const selectedEvents = selected ? byDate.get(selected) ?? [] : [];
  const active = selectedEvents.find((e) => e.id === activeId) ?? selectedEvents[0];
  const notice = practiceNoticeText(events, today);

  const shiftMonth = (delta: number) => {
    setCursor(new Date(year, monthIndex + delta, 1));
  };

  const goToday = () => {
    setCursor(parseISODate(today));
    setSelected(null);
    setActiveId(null);
    setEditing(false);
  };

  const resetPanel = () => {
    setSelected(null);
    setActiveId(null);
    setEditing(false);
  };

  const copyNotice = async () => {
    try {
      await navigator.clipboard.writeText(notice);
      toast("공지 멘트를 복사했어요");
    } catch {
      toast("복사에 실패했어요");
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <main
        className="min-h-0 min-w-0 flex-[7] overflow-auto p-5 scrollbar-thin"
        onClick={resetPanel}
      >
        <div className="mb-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-btn p-1 hover:bg-muted" onClick={() => shiftMonth(-1)} aria-label="이전 달">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[18px] font-semibold">
              {year}년 {monthIndex + 1}월
            </h1>
            <button type="button" className="rounded-btn p-1 hover:bg-muted" onClick={() => shiftMonth(1)} aria-label="다음 달">
              <ChevronRight className="h-4 w-4" />
            </button>
            <GhostButton className="ml-1 h-8 px-2.5 text-[12px]" onClick={goToday}>
              오늘
            </GhostButton>
          </div>
          <PrimaryButton onClick={() => openModal("event")}>일정 생성</PrimaryButton>
        </div>

        <div className="grid grid-cols-7 border-l border-t border-line-soft" onClick={(e) => e.stopPropagation()}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b border-r border-line-soft bg-muted px-2 py-2 text-[12px] text-faint">
              {d}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell.iso) {
              return (
                <button
                  key={`e-${index}`}
                  type="button"
                  className="min-h-[92px] border-b border-r border-line-soft bg-[#fcfcfd]"
                  onClick={resetPanel}
                  aria-label="빈 칸"
                />
              );
            }
            const isToday = cell.iso === today;
            const isSelected = cell.iso === selected;
            const dayEvents = byDate.get(cell.iso) ?? [];
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => {
                  setSelected(cell.iso);
                  setActiveId(dayEvents[0]?.id ?? null);
                  setEditing(false);
                }}
                className={cn(
                  "min-h-[92px] border-b border-r border-line-soft p-1.5 text-left hover:bg-muted",
                  isSelected && "bg-[#F7FBFF]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]",
                    isToday && "bg-brand font-semibold text-white",
                    !isToday && "text-ink",
                  )}
                >
                  {cell.day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="block truncate rounded-[6px] bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand-text"
                    >
                      {event.allDay ? event.title.replace("정기", "") : `${event.startTime} ${event.title.replace("정기", "")}`}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <aside className="flex min-h-0 w-[32%] min-w-[300px] max-w-[360px] flex-col border-l border-line-soft">
        <div className="flex-1 overflow-auto px-5 py-5 scrollbar-thin">
          {selected ? (
            <>
              <p className="text-[28px] font-semibold leading-8">{formatDateKo(selected)}</p>
              <p className="mt-1 text-[13px] text-faint">{formatWeekday(selected)}요일</p>

              {selectedEvents.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setActiveId(event.id)}
                      className={cn(
                        "rounded-chip px-2 py-1 text-[12px]",
                        (active?.id ?? "") === event.id ? "bg-brand-soft text-brand-text" : "bg-muted text-sub",
                      )}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              ) : null}

              {active ? (
                <div className="mt-5">
                  {editing ? (
                    <EditEvent
                      event={active}
                      onSave={(patch) => {
                        updateEvent(active.id, patch);
                        setEditing(false);
                        toast("일정을 수정했어요");
                      }}
                      onCancel={() => setEditing(false)}
                    />
                  ) : (
                    <>
                      <h2 className="text-[18px] font-semibold">{active.title}</h2>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {active.preview ? <Pill tone="muted">예고</Pill> : null}
                        <Pill tone={TYPE_TONE[active.type]}>{active.type}</Pill>
                        {isPracticeEvent(active) ? <Pill tone="brand">출석대상</Pill> : null}
                      </div>
                      <p className="mt-3 text-[13px] text-sub">
                        {formatEventTime(active)} · {active.place}
                      </p>
                      {active.preview ? <p className="mt-2 text-[14px] leading-6 text-ink">{active.preview}</p> : null}
                      <div className="mt-5 rounded-btn border border-dashed border-line px-3 py-3">
                        <p className="text-[12px] text-faint">첨부파일</p>
                        {active.attachmentName ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[13px]">
                            <Paperclip className="h-3.5 w-3.5" />
                            {active.attachmentName}
                          </p>
                        ) : (
                          <p className="mt-1 text-[13px] text-faint">첨부된 파일이 없어요</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-8 text-[13px] text-faint">
                  이 날짜에 일정이 없어요.{" "}
                  <button type="button" className="text-brand-text" onClick={() => openModal("event")}>
                    추가하기
                  </button>
                </p>
              )}
            </>
          ) : (
            <NoticePanel text={notice} onCopy={copyNotice} />
          )}
        </div>
        <div className="flex gap-2 border-t border-line-soft px-5 py-3">
          <PrimaryButton className="flex-1" onClick={() => openModal("event")}>
            일정 생성
          </PrimaryButton>
          <GhostButton className="flex-1" disabled={!active || !selected} onClick={() => setEditing(true)}>
            수정
          </GhostButton>
          <GhostButton
            className="px-3"
            disabled={!active || !selected}
            onClick={() => {
              if (!active) return;
              if (!window.confirm(`「${active.title}」 일정을 삭제할까요?`)) return;
              deleteEvent(active.id);
              toast("일정을 삭제했어요");
              setEditing(false);
              setActiveId(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GhostButton>
        </div>
      </aside>
    </div>
  );
}

function NoticePanel({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold">카톡 공지</p>
        <GhostButton className="h-8 px-2.5 text-[12px]" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
          복사
        </GhostButton>
      </div>
      <p className="mb-3 text-[12px] text-faint">이번 주 연습을 인식해 카톡에 바로 붙여넣을 수 있어요.</p>
      <pre className="whitespace-pre-wrap rounded-card border border-line-soft bg-muted px-3.5 py-3 text-[13px] leading-6 text-ink">
        {text}
      </pre>
    </div>
  );
}

function EditEvent({
  event,
  onSave,
  onCancel,
}: {
  event: ClubEvent;
  onSave: (patch: Partial<ClubEvent>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState(event.type);
  const [place, setPlace] = useState(event.place);
  const [preview, setPreview] = useState(event.preview);
  const [range, setRange] = useState<DateTimeRangeValue>({
    startDate: event.date,
    endDate: event.endDate ?? event.date,
    startTime: event.startTime || "19:00",
    endTime: event.endTime || "21:00",
    allDay: Boolean(event.allDay),
  });
  return (
    <div className="space-y-2">
      <input className="h-10 w-full rounded-btn border border-line px-3 text-[14px]" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select className="h-10 w-full rounded-btn border border-line px-3 text-[14px]" value={type} onChange={(e) => setType(e.target.value as EventType)}>
        {EVENT_TYPES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <DateTimeRangeField value={range} onChange={setRange} />
      <input className="h-10 w-full rounded-btn border border-line px-3 text-[14px]" value={place} onChange={(e) => setPlace(e.target.value)} />
      <textarea className="min-h-[72px] w-full rounded-btn border border-line px-3 py-2 text-[14px]" value={preview} onChange={(e) => setPreview(e.target.value)} />
      <div className="flex gap-2">
        <PrimaryButton
          onClick={() =>
            onSave({
              title,
              type,
              place,
              preview,
              startTime: range.startTime,
              endTime: range.endTime,
              date: range.startDate,
              endDate: range.endDate !== range.startDate ? range.endDate : undefined,
              allDay: range.allDay,
            })
          }
        >
          저장
        </PrimaryButton>
        <GhostButton onClick={onCancel}>취소</GhostButton>
      </div>
    </div>
  );
}
