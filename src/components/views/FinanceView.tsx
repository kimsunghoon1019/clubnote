"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
import { AiInsightCard } from "@/components/ui/AiInsightCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { Pill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TX_CATEGORIES, TX_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDateDot, formatSignedWon, formatWon } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { Transaction, TxCategory, TxType } from "@/lib/types";
import { Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

const PIE_COLORS = ["#3182F6", "#F04452", "#FFB800", "#4E5968", "#8B95A1", "#1B64DA"];

export function FinanceView() {
  const { transactions, updateTransaction, openModal } = useClub();
  const [period, setPeriod] = useState("전체");
  const [type, setType] = useState<"전체" | TxType>("전체");
  const [category, setCategory] = useState<"전체" | TxCategory>("전체");

  const filtered = useMemo(() => {
    return [...transactions].reverse().filter((row) => {
      if (period === "이번 달" && !row.occurredOn.startsWith("2026-05")) return false;
      if (period === "지난 달" && !row.occurredOn.startsWith("2026-04")) return false;
      if (type !== "전체" && row.type !== type) return false;
      if (category !== "전체" && row.category !== category) return false;
      return true;
    });
  }, [transactions, period, type, category]);

  const monthRows = transactions.filter((row) => row.occurredOn.startsWith("2026-05") || row.occurredOn.startsWith("2026-04"));
  const income = monthRows.filter((r) => r.type === "입금").reduce((s, r) => s + r.amount, 0);
  const expense = monthRows.filter((r) => r.type === "출금").reduce((s, r) => s + r.amount, 0);
  const balance = transactions[transactions.length - 1]?.balanceAfter ?? 0;

  const byCategory = TX_CATEGORIES.map((cat) => ({
    name: cat,
    value: Math.abs(
      transactions.filter((t) => t.category === cat && t.amount < 0).reduce((s, t) => s + t.amount, 0),
    ),
  })).filter((d) => d.value > 0);

  const rentShare = (() => {
    const out = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const rent = transactions.filter((t) => t.category === "대관료").reduce((s, t) => s + Math.abs(t.amount), 0);
    return out ? Math.round((rent / out) * 100) : 0;
  })();

  const proofs = transactions.filter((t) => t.proofName).slice(-3).reverse();

  const columns: Column<Transaction>[] = [
    { key: "title", header: "적요", render: (row) => <span className="font-medium">{row.title}</span> },
    {
      key: "type",
      header: "거래유형",
      render: (row) => <span className={row.type === "입금" ? "text-up" : "text-down"}>{row.type}</span>,
    },
    { key: "institution", header: "거래기관", render: (row) => row.institution },
    { key: "account", header: "계좌번호", render: (row) => <span className="text-sub">{row.accountMasked}</span> },
    {
      key: "amount",
      header: "거래금액",
      align: "right",
      render: (row) => (
        <span className={cn("tabular-nums font-medium", row.amount > 0 ? "text-up" : "text-down")}>
          {formatSignedWon(row.amount)}
        </span>
      ),
    },
    {
      key: "balance",
      header: "거래후잔액",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatWon(row.balanceAfter)}</span>,
    },
    { key: "memo", header: "메모", render: (row) => <span className="max-w-[160px] truncate text-sub">{row.memo || "-"}</span> },
    {
      key: "category",
      header: "카테고리",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={row.category}
            aria-label={`${row.title} 카테고리`}
            className="h-7 rounded-btn border border-line bg-white px-1.5 text-[12px]"
            onChange={(e) => updateTransaction(row.id, { category: e.target.value as TxCategory | "" })}
          >
            <option value="">선택 가능 · AI 추천</option>
            {TX_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "proof",
      header: "증빙",
      render: (row) => (
        <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-sub" onClick={(e) => e.stopPropagation()}>
          <Paperclip className="h-3.5 w-3.5" />
          {row.proofName ? <Pill tone="brand">{row.proofName}</Pill> : <span>파일첨부</span>}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) updateTransaction(row.id, { proofName: file.name });
            }}
          />
        </label>
      ),
    },
  ];

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin">
        <section className="grid grid-cols-3 border-b border-line-soft">
          <Kpi label="잔액" value={formatWon(balance)} />
          <Kpi label="수입 (이번 달)" value={formatSignedWon(income)} up />
          <Kpi label="지출 (이번 달)" value={formatSignedWon(expense)} />
        </section>

        <div className="flex h-12 items-center gap-2 border-b border-line-soft px-5">
          {["전체", "이번 달", "지난 달"].map((item) => (
            <FilterChip key={item} active={period === item} onClick={() => setPeriod(item)}>
              {item}
            </FilterChip>
          ))}
          <span className="mx-1 h-3 w-px bg-line" />
          {(["전체", ...TX_TYPES] as const).map((item) => (
            <FilterChip key={item} active={type === item} onClick={() => setType(item)}>
              {item}
            </FilterChip>
          ))}
          <span className="mx-1 h-3 w-px bg-line" />
          {(["전체", ...TX_CATEGORIES] as const).map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item}
            </FilterChip>
          ))}
          <div className="ml-auto">
            <PrimaryButton onClick={() => openModal("transaction")}>거래 추가</PrimaryButton>
          </div>
        </div>

        <div className="px-2 py-2">
          <DataTable
            columns={columns}
            rows={filtered}
            empty={
              <span>
                조건에 맞는 거래가 없어요.{" "}
                <button type="button" className="text-brand-text" onClick={() => openModal("transaction")}>
                  추가하기
                </button>
              </span>
            }
          />
        </div>
      </main>

      <RightRail>
        <RailSection title="카테고리별 지출">
          <div className="mx-auto h-[168px] w-[168px]">
            <PieChart width={168} height={168}>
              <Pie
                data={byCategory}
                dataKey="value"
                innerRadius={50}
                outerRadius={74}
                paddingAngle={1.5}
                stroke="none"
                isAnimationActive={false}
                cx="50%"
                cy="50%"
              >
                {byCategory.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </div>
          <ul className="mt-2 space-y-1.5">
            {byCategory.map((item, i) => (
              <li key={item.name} className="flex items-center justify-between text-[12px]">
                <span className="inline-flex items-center gap-1.5 text-sub">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  {item.name}
                </span>
                <span>{formatWon(item.value)}</span>
              </li>
            ))}
          </ul>
        </RailSection>
        <RailSection>
          <AiInsightCard text={`이번 달 대관료 비중이 ${rentShare}%로 평소보다 높아요`} />
        </RailSection>
        <RailSection title="최근 증빙">
          {proofs.length === 0 ? (
            <p className="text-[13px] text-faint">첨부된 증빙이 없어요</p>
          ) : (
            <ul className="space-y-2">
              {proofs.map((item) => (
                <li key={item.id} className="rounded-btn border border-line-soft px-3 py-2">
                  <p className="truncate text-[13px] font-medium">{item.proofName}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {item.title} · {formatDateDot(item.occurredOn)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RailSection>
      </RightRail>
    </>
  );
}

function Kpi({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[12px] text-sub">{label}</p>
      <p className={cn("mt-1 text-[22px] font-semibold", up ? "text-up" : label.includes("지출") ? "text-down" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}
