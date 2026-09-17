"use client";

import { BankMailModal } from "@/components/finance/BankMailModal";
import { DuesStatusModal } from "@/components/finance/DuesStatusModal";
import { ProofThumbs } from "@/components/finance/ProofPreview";
import { TransactionRail } from "@/components/finance/TransactionRail";
import { DetailSurface } from "@/components/layout/DetailSurface";
import { RailSection } from "@/components/layout/RightRail";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FieldLabel, TextInput } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TaxonomyEditor } from "@/components/ui/TaxonomyEditor";
import { compareTxDesc, parseBankExcelFile } from "@/lib/bankExcel";
import { loadLocalBankMail, saveLocalBankMail } from "@/lib/bankMailClient";
import { TX_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { duesSemester, inSemester, previousSemester } from "@/lib/dues";
import { downloadLedgerXlsx, isProofNumberedTx } from "@/lib/financeExport";
import { formatSignedWon, formatTxWhen, formatWon } from "@/lib/format";
import { isInspectDismissClick } from "@/lib/inspect";
import { txProofs } from "@/lib/proof";
import { useClub } from "@/lib/store";
import type { Transaction, TxType } from "@/lib/types";
import { ChevronDown, Download, Mail, MoreHorizontal, Paperclip, Plus, Upload, Wallet } from "lucide-react";
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"ledger" | "proofs" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bankMailOpen, setBankMailOpen] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!exportOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (exportRef.current?.contains(event.target as Node)) return;
      setExportOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (moreRef.current?.contains(target as Node)) return;
      if (target instanceof Element && target.closest("[data-taxonomy-menu]")) return;
      setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  async function exportLedger() {
    if (periodRows.length === 0) {
      toast("내보낼 거래가 없어요");
      setExportOpen(false);
      return;
    }
    setExporting("ledger");
    try {
      await downloadLedgerXlsx(periodRows, period);
    } catch {
      toast("내역을 내보내지 못했어요");
    } finally {
      setExporting(null);
      setExportOpen(false);
    }
  }

  async function exportProofs() {
    if (!periodRows.some(isProofNumberedTx)) {
      toast("내보낼 거래가 없어요");
      setExportOpen(false);
      return;
    }
    setExporting("proofs");
    try {
      const { downloadProofsDocx } = await import("@/lib/proofDocx");
      await downloadProofsDocx(periodRows, period, periodRange);
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "증빙을 내보내지 못했어요");
    } finally {
      setExporting(null);
      setExportOpen(false);
    }
  }

  function clearPendingExcel() {
    setPendingFile(null);
    setPassword("");
    setPasswordError("");
    setUnlocking(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function importExcel(file: File, excelPassword?: string, triedSaved = false) {
    const fromPasswordModal = Boolean(excelPassword) && !triedSaved;
    if (fromPasswordModal) setUnlocking(true);
    else setUploading(true);
    try {
      const { rows, error, needsPassword } = await parseBankExcelFile(file, excelPassword);
      if (needsPassword) {
        const saved = loadLocalBankMail().excelPassword.trim();
        if (!triedSaved && saved && saved !== excelPassword) {
          await importExcel(file, saved, true);
          return;
        }
        setPendingFile(file);
        setPassword("");
        setPasswordError("");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      if (error) {
        if (triedSaved) {
          setPendingFile(file);
          setPassword("");
          setPasswordError(error);
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        if (fromPasswordModal) {
          setPasswordError(error);
          return;
        }
        toast(error);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const added = importBankTransactions(rows);
      if (fromPasswordModal && rememberPassword && excelPassword?.trim()) {
        saveLocalBankMail({ excelPassword: excelPassword.trim() });
        void fetch("/api/bank-mail/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ excelPassword: excelPassword.trim() }),
        }).catch(() => undefined);
      }
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
      width: "128px",
      render: (row) => (
        <span className="block truncate tabular-nums text-sub">{formatTxWhen(row.occurredOn, row.occurredAt)}</span>
      ),
    },
    {
      key: "type",
      header: "거래유형",
      width: "72px",
      render: (row) => <span className={row.type === "입금" ? "text-up" : "text-down"}>{row.type}</span>,
    },
    {
      key: "institution",
      header: "거래기관",
      width: "80px",
      render: (row) => <span className="block truncate">{row.institution}</span>,
    },
    {
      key: "account",
      header: "계좌번호",
      width: "120px",
      render: (row) => <span className="block truncate text-sub">{row.accountMasked}</span>,
    },
    {
      key: "amount",
      header: "거래금액",
      width: "108px",
      align: "right",
      render: (row) => (
        <span className={cn("block truncate tabular-nums font-medium", row.amount > 0 ? "text-up" : "text-down")}>
          {formatSignedWon(row.amount)}
        </span>
      ),
    },
    {
      key: "balance",
      header: "거래후잔액",
      width: "108px",
      align: "right",
      render: (row) => <span className="block truncate tabular-nums">{formatWon(row.balanceAfter)}</span>,
    },
    {
      key: "title",
      header: "적요",
      width: "132px",
      render: (row) => <span className="block truncate font-medium">{row.title}</span>,
    },
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
      width: "108px",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={row.category}
            aria-label={`${row.title} 카테고리`}
            className="h-7 w-full max-w-full rounded-btn border border-line bg-white px-1.5 text-[12px]"
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
      width: "132px",
      render: (row) => <span className="block truncate text-sub">{row.memo || "-"}</span>,
    },
    {
      key: "proof",
      header: "증빙",
      width: "88px",
      render: (row) => (
        <div className="flex h-7 max-h-7 items-center overflow-hidden">
          <ProofThumbs proofs={txProofs(row)} />
        </div>
      ),
    },
  ];

  const periodChips = (chipClass?: string) =>
    PERIODS.map((item) => (
      <FilterChip
        key={item}
        active={period === item}
        className={cn("w-12 justify-center", chipClass)}
        onClick={() => setPeriod(item)}
      >
        {item}
      </FilterChip>
    ));

  const typeChips = (chipClass?: string) =>
    (["전체", ...TX_TYPES] as const).map((item) => (
      <FilterChip key={item} active={type === item} onClick={() => setType(item)} className={chipClass}>
        {item}
      </FilterChip>
    ));

  const categoryChips = (chipClass?: string) =>
    ["전체", ...txCategories].map((item) => (
      <FilterChip key={item} active={category === item} onClick={() => setCategory(item)} className={chipClass}>
        {item}
      </FilterChip>
    ));

  const emptyLedger = (
    <span>
      조건에 맞는 거래가 없어요.{" "}
      <button type="button" className="text-brand-text" onClick={() => openModal("transaction")}>
        추가하기
      </button>
    </span>
  );

  const excelInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
      className="sr-only"
      aria-label="은행 엑셀 업로드"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void importExcel(file);
      }}
    />
  );

  return (
    <>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onClick={dismissInspected}>
        {excelInput}
        <div data-finance-console className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <section data-finance-kpi className="grid shrink-0 grid-cols-3 border-b border-line-soft">
            <Kpi label="잔액" value={formatWon(balance)} />
            <Kpi label={`수입 (${period})`} value={formatSignedWon(income)} up />
            <Kpi label={`지출 (${period})`} value={formatSignedWon(expense)} />
          </section>

          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line-soft px-5 py-1.5">
            {periodChips()}
            <span className="mx-1 h-3 w-px bg-line" />
            {typeChips()}
            <span className="mx-1 h-3 w-px bg-line" />
            {categoryChips()}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <div ref={exportRef} className="relative">
                <GhostButton
                  className="whitespace-nowrap"
                  disabled={Boolean(exporting)}
                  aria-label="내보내기"
                  aria-expanded={exportOpen}
                  onClick={() => setExportOpen((open) => !open)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting === "ledger" ? "내역 저장 중" : exporting === "proofs" ? "증빙 저장 중" : "내보내기"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </GhostButton>
                {exportOpen ? (
                  <div
                    data-export-menu
                    className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-btn border border-line bg-white py-1 shadow-[0_8px_24px_rgba(25,31,40,0.12)]"
                  >
                    <button
                      type="button"
                      data-export-ledger
                      className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
                      onClick={() => void exportLedger()}
                    >
                      내역 내보내기
                    </button>
                    <button
                      type="button"
                      data-export-proofs
                      className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
                      onClick={() => void exportProofs()}
                    >
                      증빙 내보내기
                    </button>
                  </div>
                ) : null}
              </div>
              <GhostButton className="whitespace-nowrap" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "읽는 중" : "엑셀 업로드"}
              </GhostButton>
              <GhostButton className="whitespace-nowrap" onClick={() => setBankMailOpen(true)}>
                <Mail className="h-3.5 w-3.5" />
                메일 가져오기
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

          <div data-finance-table className="min-h-0 flex-1 overflow-auto px-2 py-2 [scrollbar-gutter:stable] scrollbar-thin">
            <DataTable
              columns={columns}
              rows={filtered}
              resizable
              selectedIds={inspectedTxId ? [inspectedTxId] : undefined}
              onRowClick={handleRowClick}
              empty={emptyLedger}
            />
          </div>
        </div>

        <div data-finance-compact className="flex min-h-0 flex-1 flex-col lg:hidden">
          <div
            data-finance-compact-head
            className="relative flex shrink-0 flex-col gap-2.5 border-b border-line-soft px-4 py-3 md:px-6"
          >
            <h1 className="sr-only">회계</h1>
            <section data-finance-compact-kpi>
              <p className="text-compact-caption text-sub">잔액</p>
              <p className="mt-0.5 truncate text-compact-title font-semibold tabular-nums text-ink">{formatWon(balance)}</p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-compact-caption text-sub">수입 ({period})</p>
                  <p className="truncate text-compact font-semibold tabular-nums text-up">{formatSignedWon(income)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-compact-caption text-sub">지출 ({period})</p>
                  <p className="truncate text-compact font-semibold tabular-nums text-down">{formatSignedWon(expense)}</p>
                </div>
              </div>
            </section>
            <div className="flex items-center gap-2">
              <div data-finance-period className="flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto scrollbar-thin">
                {periodChips("shrink-0")}
              </div>
              <button
                type="button"
                data-finance-add
                aria-label="거래 추가"
                className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation hover:bg-muted"
                onClick={() => openModal("transaction")}
              >
                <Plus className="h-5 w-5" />
              </button>
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  data-finance-more
                  aria-label="더보기"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className="flex h-touch w-touch shrink-0 items-center justify-center rounded-btn text-ink touch-manipulation hover:bg-muted"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {moreOpen ? (
                  <div
                    data-finance-more-menu
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-card border border-line bg-white p-2 shadow-[0_8px_24px_rgba(25,31,40,0.12)]"
                  >
                    <div className="flex flex-col gap-1.5">
                      <TaxonomyEditor
                        variant="button"
                        label="카테고리"
                        items={txCategories}
                        onAdd={addTxCategory}
                        onRemove={removeTxCategory}
                        onMove={moveTxCategory}
                      />
                      <GhostButton
                        className="h-touch w-full text-[13px]"
                        disabled={Boolean(exporting)}
                        onClick={() => {
                          setMoreOpen(false);
                          void exportLedger();
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exporting === "ledger" ? "내역 저장 중" : "내역 내보내기"}
                      </GhostButton>
                      <GhostButton
                        className="h-touch w-full text-[13px]"
                        disabled={Boolean(exporting)}
                        onClick={() => {
                          setMoreOpen(false);
                          void exportProofs();
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exporting === "proofs" ? "증빙 저장 중" : "증빙 내보내기"}
                      </GhostButton>
                      <GhostButton
                        className="h-touch w-full text-[13px]"
                        disabled={uploading}
                        onClick={() => {
                          setMoreOpen(false);
                          fileRef.current?.click();
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploading ? "읽는 중" : "엑셀 업로드"}
                      </GhostButton>
                      <GhostButton
                        className="h-touch w-full text-[13px]"
                        onClick={() => {
                          setMoreOpen(false);
                          setBankMailOpen(true);
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        메일 가져오기
                      </GhostButton>
                      <GhostButton
                        className="h-touch w-full text-[13px]"
                        onClick={() => {
                          setMoreOpen(false);
                          setDuesOpen(true);
                        }}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        단비 납부 여부
                      </GhostButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div data-finance-chips className="-mx-4 flex flex-nowrap gap-1 overflow-x-auto px-4 scrollbar-thin md:-mx-6 md:px-6">
              {typeChips("shrink-0")}
              <span className="mx-1 h-4 w-px shrink-0 self-center bg-line" />
              {categoryChips("shrink-0")}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
            <ul data-finance-list className="divide-y divide-line-soft">
              {filtered.length === 0 ? (
                <li className="px-4 py-16 text-center text-[13px] text-faint md:px-6">{emptyLedger}</li>
              ) : (
                filtered.map((row) => (
                  <TxCompactRow
                    key={row.id}
                    row={row}
                    selected={inspectedTxId === row.id}
                    onClick={() => handleRowClick(row)}
                  />
                ))
              )}
            </ul>
          </div>
        </div>
      </main>

      <DetailSurface
        open={Boolean(inspectedTxId)}
        title={transactions.find((item) => item.id === inspectedTxId)?.title ?? "거래"}
        onClose={() => setInspectedTxId(null)}
      >
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
      </DetailSurface>

      <DuesStatusModal open={duesOpen} onClose={() => setDuesOpen(false)} />
      <BankMailModal
        open={bankMailOpen}
        onClose={() => setBankMailOpen(false)}
        onImported={(rows) => importBankTransactions(rows)}
      />

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
          <label className="mt-3 flex min-h-touch items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={rememberPassword}
              onChange={(event) => setRememberPassword(event.target.checked)}
            />
            이 비밀번호를 저장하고 다음부터 자동으로 열기
          </label>
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

function TxCompactRow({
  row,
  selected,
  onClick,
}: {
  row: Transaction;
  selected: boolean;
  onClick: () => void;
}) {
  const proofs = txProofs(row);
  return (
    <li>
      <button
        type="button"
        data-row-id={row.id}
        data-finance-row
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left touch-manipulation md:px-6",
          selected && "bg-[#F7FBFF]",
        )}
        onClick={onClick}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-compact font-semibold text-ink">{row.title}</span>
            {proofs.length > 0 ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden /> : null}
          </span>
          <span className="mt-0.5 block truncate text-compact-caption text-faint">
            {formatTxWhen(row.occurredOn, row.occurredAt)}
            {row.category ? ` · ${row.category}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block tabular-nums text-compact font-semibold",
              row.amount > 0 ? "text-up" : "text-down",
            )}
          >
            {formatSignedWon(row.amount)}
          </span>
          <span
            className={cn(
              "block text-compact-caption",
              row.type === "입금" ? "text-up" : row.type === "출금" ? "text-down" : "text-faint",
            )}
          >
            {row.type}
          </span>
        </span>
      </button>
    </li>
  );
}
