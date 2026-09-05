"use client";

import { FieldLabel, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EVENT_TYPES, PLACE } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { EventType } from "@/lib/types";
import { Paperclip } from "lucide-react";
import { useEffect, useState } from "react";

export function EventModal() {
  const { modal, closeModal, addEvent, toast } = useClub();
  const open = modal === "event";
  const [title, setTitle] = useState("정기연습");
  const [type, setType] = useState<EventType>("정기연습");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [place, setPlace] = useState(PLACE);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setTitle("정기연습");
    setType("정기연습");
    setStartTime("19:00");
    setEndTime("21:00");
    setPlace(PLACE);
    setPreview("");
    setFileName("");
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} title="일정 생성" onClose={closeModal}>
      <div className="space-y-3">
        <div>
          <FieldLabel>제목</FieldLabel>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>유형</FieldLabel>
            <SelectInput
              value={type}
              onChange={(e) => {
                const next = e.target.value as EventType;
                setType(next);
                if ((next === "연습" || next === "정기연습") && !title) setTitle("정기연습");
              }}
            >
              {EVENT_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>날짜</FieldLabel>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <FieldLabel>시작</FieldLabel>
            <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <FieldLabel>종료</FieldLabel>
            <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel>장소</FieldLabel>
          <TextInput value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
        <div>
          <FieldLabel>예고</FieldLabel>
          <TextArea value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="한 줄 예고" />
        </div>
        <div>
          <FieldLabel>첨부파일</FieldLabel>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-btn border border-line px-3 text-[13px] text-sub hover:bg-muted">
            <Paperclip className="h-3.5 w-3.5" />
            {fileName || "파일첨부"}
            <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
          </label>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={closeModal}>취소</GhostButton>
        <PrimaryButton
          disabled={!title || !date}
          onClick={() => {
            addEvent({
              date,
              title,
              type,
              place,
              preview,
              startTime,
              endTime,
              attachmentName: fileName || undefined,
            });
            toast(type === "정기연습" || type === "연습" ? "연습 일정을 만들었어요. 출석체크에 바로 반영돼요." : "일정을 만들었어요");
            closeModal();
          }}
        >
          일정 생성
        </PrimaryButton>
      </div>
    </Modal>
  );
}
