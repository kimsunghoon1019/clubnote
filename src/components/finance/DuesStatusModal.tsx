"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { duesStatus, formatDuesPeriod, type DuesRow } from "@/lib/dues";
import { formatWon } from "@/lib/format";
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
      render: (row) => (
        <span className="inline-flex items-center gap-1">
          <select
            aria-label={`${row.name} 납부여부`}
            value={row.paid ? "납부" : "미납"}
            onChange={(event) => setPaid(row, event.target.value as "납부" | "미납")}
            className={cn(
              "h-7 rounded-btn border border-line bg-white px-1.5 text-[13px] font-medium",
              row.paid ? "text-brand-text" : "text-up",
            )}
          >
            <option value="미납">미납</option>
            <option value="납부">납부</option>
          </select>
          {row.manual ? <span className="text-[11px] text-faint">수동</span> : null}
        </span>
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
      <p className="text-[13px] text-sub">
        {semester.label} · {formatDuesPeriod(semester)} 입금 적요에 이름이 들어 있으면 납부로 표시합니다. 다른 이름으로
        보낸 경우 납부여부를 직접 바꿀 수 있어요.
      </p>
      <div className="mt-3 flex items-center gap-2">
        {(["전체", "미납", "납부"] as const).map((item) => (
          <FilterChip key={item} active={filter === item} onClick={() => setFilter(item)}>
            {item}
            {item === "미납" ? ` ${unpaidCount}` : item === "납부" ? ` ${paidCount}` : ` ${rows.length}`}
          </FilterChip>
        ))}
      </div>
      <div className="mt-3">
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
