"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { cn } from "@/lib/cn";
import { memberPhotoSrc } from "@/lib/proof";
import { sortMembersByCategory } from "@/lib/stats";
import type { Member } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function AddAttendanceMemberModal({
  open,
  onClose,
  members,
  categories,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  categories: string[];
  onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIds([]);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim();
    const filtered = q
      ? members.filter((member) => `${member.name}${member.category}${member.role}${member.studentId}`.includes(q))
      : members;
    return sortMembersByCategory(filtered, categories);
  }, [members, categories, query]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      title="출석 대상 추가"
      onClose={onClose}
      width={420}
      footer={
        <div className="flex items-center justify-end gap-2">
          <PrimaryButton
            className="h-touch min-w-[88px] px-4 lg:h-9"
            disabled={selectedIds.length === 0}
            onClick={() => {
              onAdd(selectedIds);
              onClose();
            }}
          >
            {selectedIds.length > 0 ? `${selectedIds.length}명 추가` : "추가"}
          </PrimaryButton>
        </div>
      }
    >
      <p className="text-[13px] text-sub">이 요일 연습 대상이 아닌 활동 회원을 출석 명단에 넣어요. 추가하면 출석으로 표시돼요.</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="이름, 분류, 학번"
        className="mt-3 h-touch w-full rounded-btn border border-line bg-white px-3 text-compact outline-none placeholder:text-faint lg:h-10 lg:text-[14px]"
      />
      {visible.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-faint">
          {members.length === 0 ? "추가로 넣을 회원이 없어요." : "검색 결과가 없어요."}
        </p>
      ) : (
        <ul className="-mx-5 mt-2 divide-y divide-line-soft">
          {visible.map((member) => {
            const selected = selectedIds.includes(member.id);
            return (
              <li key={member.id}>
                <button
                  type="button"
                  data-add-attendance-member={member.id}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-touch w-full items-center gap-3 px-5 py-2.5 text-left touch-manipulation",
                    selected ? "bg-[#F7FBFF]" : "hover:bg-muted",
                  )}
                  onClick={() => toggle(member.id)}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                      selected ? "border-brand bg-brand text-white" : "border-line bg-white",
                    )}
                    aria-hidden
                  >
                    {selected ? (
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                        <path d="M3.5 8.2 6.4 11l6.1-6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <Avatar name={member.name} size={36} src={memberPhotoSrc(member)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-compact font-semibold text-ink">{member.name}</span>
                    <span className="block truncate text-compact-caption text-faint">
                      {member.category} · {member.role}
                      {member.practiceDays.length > 0 ? ` · ${member.practiceDays.join(" ")}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
