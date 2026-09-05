"use client";

import { FieldLabel, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TX_CATEGORIES, TX_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { TxCategory, TxType } from "@/lib/types";
import { Paperclip } from "lucide-react";
import { useState } from "react";

export function TransactionModal() {
  const { modal, closeModal, addTransaction, toast } = useClub();
  const open = modal === "transaction";
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TxType>("출금");
  const [institution, setInstitution] = useState("카카오뱅크");
  const [account, setAccount] = useState("3333-**-******");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState<TxCategory | "">("");
  const [proofName, setProofName] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setAmount("");
    setMemo("");
    setCategory("");
    setProofName("");
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
          <FieldLabel hint="선택 가능 · AI 추천">카테고리</FieldLabel>
          <div className="mb-2 flex flex-wrap gap-1">
            {TX_CATEGORIES.map((item) => (
              <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
                {item}
              </FilterChip>
            ))}
          </div>
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value as TxCategory | "")}>
            <option value="">카테고리 선택</option>
            {TX_CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div className="col-span-2">
          <FieldLabel>메모</FieldLabel>
          <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div className="col-span-2">
          <FieldLabel>증빙</FieldLabel>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-btn border border-line px-3 text-[13px] text-sub hover:bg-muted">
            <Paperclip className="h-3.5 w-3.5" />
            {proofName || "파일첨부"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => setProofName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={closeModal}>취소</GhostButton>
        <PrimaryButton
          disabled={!title || !amount}
          onClick={() => {
            const raw = Number(amount);
            const signed = type === "입금" ? raw : -Math.abs(raw);
            addTransaction({
              occurredOn,
              title,
              type,
              institution,
              accountMasked: account,
              amount: signed,
              memo,
              category,
              proofName: proofName || undefined,
            });
            toast("거래를 등록했어요");
            reset();
            closeModal();
          }}
        >
          거래 추가
        </PrimaryButton>
      </div>
    </Modal>
  );
}
