"use client";

import { DuesStatusModal } from "@/components/finance/DuesStatusModal";
import { ProofThumbs } from "@/components/finance/ProofPreview";
import { TransactionRail } from "@/components/finance/TransactionRail";
import { RightRail, RailSection } from "@/components/layout/RightRail";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FieldLabel, TextInput } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TaxonomyEditor } from "@/components/ui/TaxonomyEditor";
import { compareTxDesc, parseBankExcelFile } from "@/lib/bankExcel";
import { TX_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { duesSemester, inSemester, previousSemester } from "@/lib/dues";
import { formatSignedWon, formatTxWhen, formatWon } from "@/lib/format";
import { isInspectDismissClick } from "@/lib/inspect";
import { txProofs } from "@/lib/proof";
import { useClub } from "@/lib/store";
import type { Transaction, TxType } from "@/lib/types";
import { Upload, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Cell, Pie, PieChart } from "recharts";

const PIE_COLORS = ["#3182F6", "#F04452", "#FFB800", "#4E5968", "#8B95A1", "#1B64DA"];
const PERIODS = ["당기", "전기", "전체"] as const;
type Period = (typeof PERIODS)[number];

export function FinanceView() {
  const {
    transactions,
    txCategories,
    updateTransaction,
    addTxCategory,
    removeTxCategory,
    moveTxCategory,
    openModal,
    importBankTransactions,
    toast,
  } = useClub();
  const [period, setPeriod] = useState<Period>("당기");
  const [type, setType] = useState<"전체" | TxType>("전체");
  const [category, setCategory] = useState("전체");
  const [inspectedTxId, setInspectedTxId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [duesOpen, setDuesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(() => [...transactions].sort(compareTxDesc), [transactions]);
  const currentSemester = useMemo(() => duesSemester(), []);
  const priorSemester = useMemo(() => previousSemester(), []);

  const periodRange = period === "당기" ? currentSemester : period === "전기" ? priorSemester : null;

  const filtered = useMemo(() => {
    return ordered.filter((row) => {
      if (periodRange && !inSemester(row.occurredOn, periodRange)) return false;
      if (type !== "전체" && row.type !== type) return false;
      if (category !== "전체" && row.category !== category) return false;
      return true;
    });
  }, [ordered, periodRange, type, category]);

  const periodRows = useMemo(
    () => (periodRange ? transactions.filter((row) => inSemester(row.occurredOn, periodRange)) : transactions),
    [transactions, periodRange],
  );
  const income = periodRows.filter((r) => r.type === "입금").reduce((s, r) => s + r.amount, 0);
  const expense = periodRows.filter((r) => r.type === "출금").reduce((s, r) => s + r.amount, 0);
  const balance = ordered[0]?.balanceAfter ?? 0;

  useEffect(() => {
    if (category !== "전체" && !txCategories.includes(category)) setCategory("전체");
  }, [category, txCategories]);

  useEffect(() => {
    if (inspectedTxId && !transactions.some((row) => row.id === inspectedTxId)) setInspectedTxId(null);
  }, [inspectedTxId, transactions]);

  function clearPendingExcel() {
    setPendingFile(null);
    setPassword("");
    setPasswordError("");
    setUnlocking(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function importExcel(file: File, excelPassword?: string) {
    const fromPasswordModal = Boolean(excelPassword);
    if (fromPasswordModal) setUnlocking(true);
    else setUploading(true);
    try {
      const { rows, error, needsPassword } = await parseBankExcelFile(file, excelPassword);
      if (needsPassword) {
        setPendingFile(file);
        setPassword("");
        setPasswordError("");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      if (error) {
        if (fromPasswordModal) {
          setPasswordError(error);
          return;
        }
        toast(error);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const added = importBankTransactions(rows);
      toast(added === 0 ? "이미 있는 내역이에요. 새로 추가된 거래가 없어요" : `은행 엑셀에서 ${added}건을 추가했어요`);
      clearPendingExcel();
    } catch {
      if (fromPasswordModal) setPasswordError("엑셀 파일을 읽지 못했어요");
      else toast("엑셀 파일을 읽지 못했어요");
    } finally {
      setUploading(false);
      setUnlocking(false);
    }
  }

  const byCategory = useMemo(() => {
    const names = [...txCategories];
    for (const row of transactions) {
      if (row.category && !names.includes(row.category)) names.push(row.category);
    }
    return names
      .map((cat) => ({
        name: cat,
        value: Math.abs(
          transactions.filter((t) => t.category === cat && t.amount < 0).reduce((s, t) => s + t.amount, 0),
        ),
      }))
      .filter((d) => d.value > 0);
  }, [transactions, txCategories]);

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedTxId) return;
    if (!isInspectDismissClick(event.target)) return;
    setInspectedTxId(null);
  };

  const handleRowClick = (row: Transaction) => {
    setInspectedTxId((current) => (current === row.id ? null : row.id));
  };

  const columns: Column<Transaction>[] = [
    {
      key: "when",
      header: "거래일시",
      render: (row) => <span className="tabular-nums text-sub">{formatTxWhen(row.occurredOn, row.occurredAt)}</span>,
    },
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
    { key: "title", header: "적요", render: (row) => <span className="font-medium">{row.title}</span> },
    {
      key: "category",
      header: (
        <TaxonomyEditor
          label="카테고리"
          items={txCategories}
          onAdd={addTxCategory}
          onRemove={removeTxCategory}
          onMove={moveTxCategory}
        />
      ),
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={row.category}
            aria-label={`${row.title} 카테고리`}
            className="h-7 rounded-btn border border-line bg-white px-1.5 text-[12px]"
            onChange={(e) => updateTransaction(row.id, { category: e.target.value })}
          >
            <option value="">선택</option>
            {txCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "memo",
      header: "세부내역",
      render: (row) => <span className="max-w-[200px] truncate text-sub">{row.memo || "-"}</span>,
    },
    {
      key: "proof",
      header: "증빙",
      render: (row) => (
        <div className="flex h-7 max-h-7 items-center overflow-hidden">
          <ProofThumbs proofs={txProofs(row)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable] scrollbar-thin" onClick={dismissInspected}>
        <section className="grid shrink-0 grid-cols-3 border-b border-line-soft">
          <Kpi label="잔액" value={formatWon(balance)} />
          <Kpi label={`수입 (${period})`} value={formatSignedWon(income)} up />
          <Kpi label={`지출 (${period})`} value={formatSignedWon(expense)} />
        </section>

        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line-soft px-5 py-1.5">
          {PERIODS.map((item) => (
            <FilterChip
              key={item}
              active={period === item}
              className="w-12 justify-center"
              onClick={() => setPeriod(item)}
            >
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
          {["전체", ...txCategories].map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item}
            </FilterChip>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              aria-label="은행 엑셀 업로드"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importExcel(file);
              }}
            />
            <GhostButton className="whitespace-nowrap" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "읽는 중" : "엑셀 업로드"}
            </GhostButton>
            <GhostButton className="whitespace-nowrap" onClick={() => setDuesOpen(true)}>
              <Wallet className="h-3.5 w-3.5" />
              단비 납부 여부
            </GhostButton>
            <PrimaryButton className="whitespace-nowrap" onClick={() => openModal("transaction")}>
              거래 추가
            </PrimaryButton>
          </div>
        </div>

        <div className="px-2 py-2">
          <DataTable
            columns={columns}
            rows={filtered}
            selectedIds={inspectedTxId ? [inspectedTxId] : undefined}
            onRowClick={handleRowClick}
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
        {inspectedTxId ? (
          <TransactionRail txId={inspectedTxId} onClose={() => setInspectedTxId(null)} />
        ) : (
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
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {item.name}
                  </span>
                  <span>{formatWon(item.value)}</span>
                </li>
              ))}
            </ul>
          </RailSection>
        )}
      </RightRail>

      <DuesStatusModal open={duesOpen} onClose={() => setDuesOpen(false)} />

      <Modal open={Boolean(pendingFile)} title="엑셀 비밀번호" onClose={clearPendingExcel} width={400}>
        <p className="text-[14px] leading-6 text-ink">비밀번호가 걸려있나요? 걸려있다면 알려주세요.</p>
        {pendingFile ? <p className="mt-1 truncate text-[12px] text-faint">{pendingFile.name}</p> : null}
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pendingFile || !password.trim()) return;
            void importExcel(pendingFile, password.trim());
          }}
        >
          <FieldLabel>비밀번호</FieldLabel>
          <TextInput
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            placeholder="엑셀 비밀번호"
            autoComplete="off"
          />
          {passwordError ? <p className="mt-1.5 text-[12px] text-down">{passwordError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton type="button" onClick={clearPendingExcel}>
              취소
            </GhostButton>
            <PrimaryButton type="submit" disabled={!password.trim() || unlocking}>
              {unlocking ? "여는 중" : "열기"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Kpi({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="h-4 truncate text-[12px] leading-4 text-sub">{label}</p>
      <p
        className={cn(
          "mt-1 h-7 truncate text-[22px] font-semibold leading-7 tabular-nums",
          up ? "text-up" : label.includes("지출") ? "text-down" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
