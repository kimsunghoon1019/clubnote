"use client";

import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { duesStatus, formatDuesPeriod, type DuesRow } from "@/lib/dues";
import { formatWon } from "@/lib/format";
import { memberPhotoSrc } from "@/lib/proof";
import { useClub } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";

type Filter = "전체" | "미납" | "납부";

export function DuesStatusModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, transactions, categories, duesOverrides, setDuesOverride } = useClub();
  const [filter, setFilter] = useState<Filter>("전체");

  useEffect(() => {
    if (open) setFilter("전체");
  }, [open]);

  const { semester, rows } = useMemo(
    () => duesStatus(members, transactions, categories, { overrides: duesOverrides }),
    [members, transactions, categories, duesOverrides],
  );

  const paidCount = rows.filter((row) => row.paid).length;
  const unpaidCount = rows.length - paidCount;
  const visible = filter === "전체" ? rows : rows.filter((row) => (filter === "납부" ? row.paid : !row.paid));

  function setPaid(row: DuesRow, next: "납부" | "미납") {
    const paid = next === "납부";
    setDuesOverride(row.id, semester.start, paid === row.autoPaid ? null : paid);
  }

  const columns: Column<DuesRow>[] = [
    { key: "name", header: "이름", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "category", header: "분류", render: (row) => <span className="text-sub">{row.category}</span> },
    { key: "role", header: "직책", render: (row) => <span className="text-sub">{row.role}</span> },
    {
      key: "paid",
      header: "납부여부",
      width: "92px",
      render: (row) => (
        <select
          aria-label={`${row.name} 납부여부`}
          value={row.paid ? "납부" : "미납"}
          onChange={(event) => setPaid(row, event.target.value as "납부" | "미납")}
          className={cn(
            "h-7 w-[72px] rounded-btn border border-line bg-white px-1.5 text-[13px] font-medium",
            row.paid ? "text-brand-text" : "text-up",
          )}
        >
          <option value="미납">미납</option>
          <option value="납부">납부</option>
        </select>
      ),
    },
    {
      key: "amount",
      header: "납부금액",
      align: "right",
      render: (row) => (
        <span className={row.paid && row.paidAmount > 0 ? "tabular-nums" : "tabular-nums text-faint"}>
          {row.paid && row.paidAmount > 0 ? formatWon(row.paidAmount) : "-"}
        </span>
      ),
    },
    {
      key: "title",
      header: "적요",
      render: (row) => {
        const label = row.titles.join(", ") || (row.manual && row.paid ? "수동" : "-");
        return (
          <span className="block max-w-[220px] truncate text-sub" title={label}>
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <Modal open={open} title="단비 납부 여부" onClose={onClose} width={760} align="top">
      <p className="text-[13px] text-sub max-lg:text-compact-caption">
        {semester.label} · {formatDuesPeriod(semester)} 입금 적요에 이름이 들어 있으면 납부로 표시합니다. 다른 이름으로
        보낸 경우 납부여부를 직접 바꿀 수 있어요.
      </p>
      <div
        data-dues-chips
        className="mt-3 flex items-center gap-2 max-lg:-mx-4 max-lg:overflow-x-auto max-lg:px-4 max-lg:scrollbar-thin"
      >
        {(["전체", "미납", "납부"] as const).map((item) => (
          <FilterChip
            key={item}
            active={filter === item}
            className="shrink-0 touch-manipulation"
            onClick={() => setFilter(item)}
          >
            {item}
            {item === "미납" ? ` ${unpaidCount}` : item === "납부" ? ` ${paidCount}` : ` ${rows.length}`}
          </FilterChip>
        ))}
      </div>
      <ul data-dues-list className="-mx-4 mt-3 divide-y divide-line-soft lg:hidden">
        {visible.length === 0 ? (
          <li className="px-4 py-16 text-center text-compact-caption text-faint">해당하는 단원이 없어요</li>
        ) : (
          visible.map((row) => {
            const member = members.find((item) => item.id === row.id);
            const caption = row.titles.join(", ") || (row.manual && row.paid ? "수동" : "");
            return (
              <li key={row.id}>
                <div data-dues-row data-row-id={row.id} className="flex flex-col gap-2.5 px-4 py-3">
                  <div className="flex min-h-touch items-center gap-3">
                    <Avatar name={row.name} size={40} src={member ? memberPhotoSrc(member) : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-compact font-semibold text-ink">{row.name}</span>
                      <span className="block truncate text-compact-caption text-faint">
                        {row.category} · {row.role}
                      </span>
                    </span>
                    {row.paid && row.paidAmount > 0 ? (
                      <span className="shrink-0 tabular-nums text-compact font-semibold text-ink">
                        {formatWon(row.paidAmount)}
                      </span>
                    ) : null}
                  </div>
                  <DuesPaidToggle name={row.name} paid={row.paid} onChange={(next) => setPaid(row, next)} />
                  {caption ? (
                    <p className="truncate text-compact-caption text-faint" title={caption}>
                      {caption}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div data-dues-table className="mt-3 hidden lg:block">
        <DataTable
          columns={columns}
          rows={visible}
          tableClassName="min-w-0 w-full"
          empty="해당하는 단원이 없어요"
        />
      </div>
    </Modal>
  );
}

function DuesPaidToggle({
  name,
  paid,
  onChange,
}: {
  name: string;
  paid: boolean;
  onChange: (next: "납부" | "미납") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${name} 납부여부`}
      data-dues-paid
      className="flex h-touch w-full overflow-hidden rounded-[10px] border border-line bg-white"
    >
      {(["미납", "납부"] as const).map((option, index) => {
        const active = paid ? option === "납부" : option === "미납";
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-touch min-w-0 flex-1 items-center justify-center text-compact font-semibold touch-manipulation",
              index > 0 && "border-l border-line",
              active ? (option === "납부" ? "bg-brand text-white" : "bg-up text-white") : "text-faint hover:bg-muted",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
