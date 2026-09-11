"use client";

import { FieldLabel, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TX_TYPES } from "@/lib/constants";
import { formatFileBytes } from "@/lib/fileLimits";
import { todayISO } from "@/lib/format";
import { fileToProof } from "@/lib/proof";
import { putProofBlob } from "@/lib/proofDb";
import { useClub } from "@/lib/store";
import type { TxProof, TxType } from "@/lib/types";
import { Paperclip } from "lucide-react";
import { useState } from "react";

type PendingProof = { meta: TxProof; blob: Blob };

export function TransactionModal() {
  const { modal, closeModal, addTransaction, txCategories, toast } = useClub();
  const open = modal === "transaction";
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TxType>("출금");
  const [institution, setInstitution] = useState("카카오뱅크");
  const [account, setAccount] = useState("3333-**-******");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("");
  const [proofs, setProofs] = useState<PendingProof[]>([]);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setAmount("");
    setMemo("");
    setCategory("");
    setProofs([]);
    setType("출금");
  };

  return (
    <Modal open={open} title="거래 추가" onClose={closeModal} width={520}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>적요</FieldLabel>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 5월 대관료" />
        </div>
        <div>
          <FieldLabel>거래유형</FieldLabel>
          <SelectInput value={type} onChange={(e) => setType(e.target.value as TxType)}>
            {TX_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>거래일</FieldLabel>
          <TextInput type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </div>
        <div>
          <FieldLabel>거래기관</FieldLabel>
          <TextInput value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
        <div>
          <FieldLabel>계좌번호</FieldLabel>
          <TextInput value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div className="col-span-2">
          <FieldLabel>거래금액</FieldLabel>
          <TextInput
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="숫자만 입력"
          />
        </div>
        <div className="col-span-2">
          <FieldLabel>카테고리</FieldLabel>
          <div className="mb-2 flex flex-wrap gap-1">
            {txCategories.map((item) => (
              <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
                {item}
              </FilterChip>
            ))}
          </div>
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">카테고리 선택</option>
            {txCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div className="col-span-2">
          <FieldLabel>세부내역</FieldLabel>
          <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="세부내역" />
        </div>
        <div className="col-span-2">
          <FieldLabel>증빙</FieldLabel>
          {proofs.length ? (
            <ul className="mb-2 space-y-1">
              {proofs.map((item) => (
                <li key={item.meta.id} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-sub">
                    {item.meta.name}
                    {item.blob.size ? <span className="ml-1 text-[12px] text-faint">{formatFileBytes(item.blob.size)}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-[12px] text-sub hover:text-up"
                    onClick={() => setProofs((prev) => prev.filter((row) => row.meta.id !== item.meta.id))}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[12px] text-faint">증빙없음</p>
          )}
          <label className="flex h-touch cursor-pointer items-center justify-center gap-2 rounded-btn border border-line px-3 text-compact text-sub hover:bg-muted lg:h-10 lg:text-[13px]">
            <Paperclip className="h-3.5 w-3.5" />
            증빙 추가
            <input
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (!files.length) return;
                void Promise.all(files.map((file) => fileToProof(file)))
                  .then((next) => setProofs((prev) => [...prev, ...next]))
                  .catch((error: unknown) => toast(error instanceof Error ? error.message : "증빙을 읽지 못했어요"));
              }}
            />
          </label>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton disabled={busy} onClick={closeModal}>취소</GhostButton>
        <PrimaryButton
          disabled={!title || !amount || busy}
          onClick={() => {
            const raw = Number(amount);
            const signed = type === "입금" ? raw : -Math.abs(raw);
            void (async () => {
              setBusy(true);
              try {
                for (const item of proofs) {
                  await putProofBlob(item.meta.id, item.blob, { name: item.meta.name, mime: item.meta.mime });
                }
                addTransaction({
                  occurredOn,
                  title,
                  type,
                  institution,
                  accountMasked: account,
                  amount: signed,
                  memo,
                  category,
                  proofs: proofs.map((item) => item.meta),
                });
                toast("거래를 등록했어요");
                reset();
                closeModal();
              } catch (error: unknown) {
                toast(error instanceof Error ? error.message : "증빙을 올리지 못했어요");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? "올리는 중" : "거래 추가"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
