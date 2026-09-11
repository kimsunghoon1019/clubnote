"use client";

import { ProofThumb } from "@/components/finance/ProofPreview";
import { FieldLabel, SelectInput, TextArea } from "@/components/ui/Field";
import { formatFileBytes } from "@/lib/fileLimits";
import { formatSignedWon, formatTxWhen, formatWon } from "@/lib/format";
import { txProofs } from "@/lib/proof";
import { useClub } from "@/lib/store";
import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";

export function TransactionRail({ txId, onClose }: { txId: string; onClose: () => void }) {
  const { transactions, txCategories, updateTransaction, addTransactionProof, removeTransactionProof, toast } =
    useClub();
  const tx = transactions.find((item) => item.id === txId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  if (!tx) return null;

  const proofs = txProofs(tx);

  async function attach(files: File[]) {
    try {
      for (const file of files) {
        setUploading(file.name);
        setProgress(0);
        await addTransactionProof(txId, file, (ratio) => setProgress(ratio));
      }
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "증빙을 읽지 못했어요");
    } finally {
      setUploading(null);
      setProgress(0);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{tx.title}</p>
          <p className="mt-0.5 text-[12px] text-faint">{formatTxWhen(tx.occurredOn, tx.occurredAt)}</p>
        </div>
        <button type="button" className="hidden shrink-0 text-[12px] text-faint hover:text-ink lg:inline" onClick={onClose}>
          닫기
        </button>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <Info label="거래유형" value={tx.type} valueClass={tx.type === "입금" ? "text-up" : "text-down"} />
        <Info
          label="거래금액"
          value={formatSignedWon(tx.amount)}
          valueClass={`tabular-nums ${tx.amount > 0 ? "text-up" : "text-down"}`}
        />
        <Info label="거래기관" value={tx.institution || "-"} />
        <Info label="계좌번호" value={tx.accountMasked || "-"} />
        <Info label="거래후잔액" value={formatWon(tx.balanceAfter)} valueClass="tabular-nums text-ink" />
      </dl>

      <div className="mb-3">
        <FieldLabel>카테고리</FieldLabel>
        <SelectInput
          className="h-8 text-[13px]"
          value={tx.category}
          aria-label="거래 카테고리"
          onChange={(e) => updateTransaction(tx.id, { category: e.target.value })}
        >
          <option value="">선택</option>
          {txCategories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SelectInput>
      </div>

      <div className="mb-3">
        <FieldLabel>세부내역</FieldLabel>
        <TextArea
          className="min-h-[72px] text-[13px]"
          value={tx.memo}
          placeholder="세부내역"
          aria-label="거래 세부내역"
          onChange={(e) => updateTransaction(tx.id, { memo: e.target.value })}
        />
      </div>

      <div>
        <FieldLabel>증빙</FieldLabel>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          aria-label="증빙 첨부"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void attach(files);
          }}
        />
        {proofs.length ? (
          <div className="space-y-2">
            {proofs.map((proof) => (
              <div key={proof.id}>
                <ProofThumb proof={proof} size="rail" />
                <div className="mt-1 flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-sub" title={proof.bytes ? `${proof.name} ${formatFileBytes(proof.bytes)}` : proof.name}>
                    {proof.name}
                    {proof.bytes ? <span className="ml-1 text-faint">{formatFileBytes(proof.bytes)}</span> : null}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-[12px] text-sub hover:text-up"
                    onClick={() => void removeTransactionProof(tx.id, proof.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-faint">증빙없음</p>
        )}
        {uploading ? (
          <p className="mt-1.5 text-[12px] text-sub" data-proof-progress>
            {uploading} 올리는 중 {Math.round(progress * 100)}%
          </p>
        ) : null}
        <button
          type="button"
          disabled={Boolean(uploading)}
          className="mt-2 flex h-touch w-full items-center justify-center gap-1.5 rounded-btn border border-line text-compact text-sub hover:bg-muted disabled:opacity-50 lg:h-9 lg:text-[13px]"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          증빙 추가
        </button>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className={valueClass ?? "text-ink"}>{value}</dd>
    </div>
  );
}
