"use client";

import { formatChartStamp } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { ChartNote } from "@/lib/types";
import { useState } from "react";

export function ChartNotes({
  notes,
  onAdd,
  onDelete,
}: {
  notes: ChartNote[];
  onAdd: (body: string) => void;
  onDelete: (id: string) => void;
}) {
  const { currentMember } = useClub();
  const author = currentMember?.name.trim() ?? "";
  const [draft, setDraft] = useState("");
  const ordered = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">차트</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="기록을 입력하고 Enter"
        className="min-h-[72px] w-full resize-none rounded-btn border border-line px-3 py-2 text-[13px] leading-5 placeholder:text-faint focus:border-brand"
      />
      <p className="mt-1 text-[11px] text-faint">
        {author
          ? `저장하면 시각과 작성자(${author})가 붙어요. Shift+Enter로 줄바꿈.`
          : "저장 시각과 작성자가 자동으로 붙어요. Shift+Enter로 줄바꿈."}
      </p>
      <ol className="mt-3 space-y-3">
        {ordered.length === 0 ? (
          <li className="text-[12px] text-faint">아직 기록이 없어요</li>
        ) : (
          ordered.map((note) => (
            <li key={note.id} className="border-l-2 border-brand-soft pl-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] text-faint">
                  {formatChartStamp(note.createdAt)}
                  {note.author ? (
                    <>
                      {" · "}
                      <span className="font-medium text-sub">{note.author}</span>
                    </>
                  ) : null}
                </p>
                <button type="button" className="text-[11px] text-faint hover:text-up" onClick={() => onDelete(note.id)}>
                  삭제
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-ink">{note.body}</p>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
