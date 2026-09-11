"use client";

import { PendingFileList } from "@/components/calendar/EventAttachments";
import { DateTimeRangeField, type DateTimeRangeValue } from "@/components/ui/DateTimeRangeField";
import { FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { InlineTaxonomySelect } from "@/components/ui/InlineTaxonomySelect";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { PLACE } from "@/lib/constants";
import { defaultPracticeRange, todayISO } from "@/lib/format";
import { useClub } from "@/lib/store";
import { useEffect, useState } from "react";

function defaultRange(date = todayISO()): DateTimeRangeValue {
  const times = defaultPracticeRange(date);
  return {
    startDate: date,
    endDate: date,
    startTime: times.startTime,
    endTime: times.endTime,
    allDay: false,
  };
}

export function EventModal() {
  const {
    modal,
    closeModal,
    addEvent,
    addEventAttachment,
    toast,
    eventTypes,
    places,
    addEventType,
    removeEventType,
    addPlace,
    removePlace,
    eventModalDate,
  } = useClub();
  const open = modal === "event";
  const [title, setTitle] = useState("정기연습");
  const [type, setType] = useState("정기연습");
  const [range, setRange] = useState<DateTimeRangeValue>(defaultRange);
  const [place, setPlace] = useState(PLACE);
  const [preview, setPreview] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const date = eventModalDate || todayISO();
    setTitle("정기연습");
    setType("정기연습");
    setRange(defaultRange(date));
    setPlace(PLACE);
    setPreview("");
    setFiles([]);
  }, [open, eventModalDate]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      title="일정 생성"
      onClose={closeModal}
      width={480}
      align="top"
      footer={
        <div className="flex justify-end gap-2">
          <GhostButton disabled={busy} onClick={closeModal}>취소</GhostButton>
          <PrimaryButton
            disabled={!title || !range.startDate || busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                const created = addEvent({
                  date: range.startDate,
                  endDate: range.endDate !== range.startDate ? range.endDate : undefined,
                  title,
                  type,
                  place,
                  preview,
                  startTime: range.startTime,
                  endTime: range.endTime,
                  allDay: range.allDay,
                });
                try {
                  for (const file of files) {
                    await addEventAttachment(created.id, file);
                  }
                } catch (error: unknown) {
                  toast(error instanceof Error ? error.message : "첨부파일을 읽지 못했어요");
                }
                toast(
                  type === "정기연습" || type === "연습"
                    ? "연습 일정을 만들었어요. 출석체크에 바로 반영돼요."
                    : "일정을 만들었어요",
                );
                setBusy(false);
                closeModal();
              })();
            }}
          >
            {busy ? "올리는 중" : "일정 생성"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <FieldLabel>제목</FieldLabel>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <FieldLabel>유형</FieldLabel>
          <InlineTaxonomySelect
            value={type}
            items={eventTypes.includes(type) ? eventTypes : [...eventTypes, type]}
            addLabel="유형 추가"
            placeholder="유형 선택"
            onChange={(next) => {
              setType(next);
              if ((next === "연습" || next === "정기연습") && !title) setTitle("정기연습");
            }}
            onAdd={addEventType}
            onRemove={removeEventType}
          />
        </div>
        <div>
          <FieldLabel>일시</FieldLabel>
          <DateTimeRangeField
            value={range}
            onChange={(next) => {
              if (next.startDate === range.startDate) {
                setRange(next);
                return;
              }
              const prevDefault = defaultPracticeRange(range.startDate);
              const stillDefault =
                range.startTime === prevDefault.startTime && range.endTime === prevDefault.endTime;
              if (!stillDefault) {
                setRange(next);
                return;
              }
              const times = defaultPracticeRange(next.startDate);
              setRange({ ...next, startTime: times.startTime, endTime: times.endTime });
            }}
          />
        </div>
        <div>
          <FieldLabel>장소</FieldLabel>
          <InlineTaxonomySelect
            value={place}
            items={places.includes(place) ? places : [...places, place]}
            addLabel="장소 추가"
            placeholder="장소 선택"
            onChange={setPlace}
            onAdd={addPlace}
            onRemove={removePlace}
          />
        </div>
        <div>
          <FieldLabel>메모</FieldLabel>
          <TextArea value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="한 줄 메모" />
        </div>
        <div>
          <FieldLabel>첨부파일</FieldLabel>
          <PendingFileList files={files} onChange={setFiles} />
        </div>
      </div>
    </Modal>
  );
}
