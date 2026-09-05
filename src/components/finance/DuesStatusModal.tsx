"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { Modal } from "@/components/ui/Modal";
import { duesStatus, formatDuesPeriod, type DuesRow } from "@/lib/dues";
import { formatWon } from "@/lib/format";
import { useClub } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";

type Filter = "전체" | "미납" | "납부";

export function DuesStatusModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { members, transactions, categories } = useClub();
  const [filter, setFilter] = useState<Filter>("전체");

  useEffect(() => {
    if (open) setFilter("전체");
  }, [open]);

  const { semester, rows } = useMemo(
    () => duesStatus(members, transactions, categories),
    [members, transactions, categories],
  );

  const paidCount = rows.filter((row) => row.paid).length;
  const unpaidCount = rows.length - paidCount;
  const visible = filter === "전체" ? rows : rows.filter((row) => (filter === "납부" ? row.paid : !row.paid));

  const columns: Column<DuesRow>[] = [
    { key: "name", header: "이름", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "category", header: "분류", render: (row) => <span className="text-sub">{row.category}</span> },
    { key: "role", header: "직책", render: (row) => <span className="text-sub">{row.role}</span> },
    {
      key: "paid",
      header: "납부여부",
      render: (row) => (
        <span className={row.paid ? "font-medium text-brand-text" : "font-medium text-up"}>
          {row.paid ? "납부" : "미납"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "납부금액",
      align: "right",
      render: (row) => (
        <span className={row.paid ? "tabular-nums" : "tabular-nums text-faint"}>
          {row.paid ? formatWon(row.paidAmount) : "-"}
        </span>
      ),
    },
    {
      key: "title",
      header: "적요",
      render: (row) => (
        <span className="block max-w-[220px] truncate text-sub" title={row.titles.join(", ")}>
          {row.titles.join(", ") || "-"}
        </span>
      ),
    },
  ];

  return (
    <Modal open={open} title="단비 납부 여부" onClose={onClose} width={760} align="top">
      <p className="text-[13px] text-sub">
        {semester.label} · {formatDuesPeriod(semester)} 입금 적요에서 이름을 찾아 맞춥니다.
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
