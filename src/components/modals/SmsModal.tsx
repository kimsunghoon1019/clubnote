"use client";

import { FieldLabel, SelectInput, TextArea } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SMS_TEMPLATES } from "@/lib/constants";
import { useClub } from "@/lib/store";
import { useMemo, useState } from "react";

type TemplateKey = keyof typeof SMS_TEMPLATES;

export function SmsModal() {
  const { modal, closeModal, members, selectedMemberIds, toast } = useClub();
  const open = modal === "sms";
  const [template, setTemplate] = useState<TemplateKey>("연습 리마인드");
  const [body, setBody] = useState<string>(SMS_TEMPLATES["연습 리마인드"]);

  const recipients = useMemo(() => {
    const ids = selectedMemberIds.length ? selectedMemberIds : members.filter((m) => m.role !== "회원").map((m) => m.id);
    return members.filter((m) => ids.includes(m.id));
  }, [members, selectedMemberIds]);

  if (!open) return null;

  return (
    <Modal open={open} title="문자보내기" onClose={closeModal} width={480}>
      <p className="mb-4 text-[13px] text-sub">
        수신 인원 <span className="font-semibold text-ink">{recipients.length}명</span>
        <span className="ml-2 text-faint">{recipients.slice(0, 4).map((m) => m.name).join(", ")}{recipients.length > 4 ? " 외" : ""}</span>
      </p>
      <FieldLabel>템플릿</FieldLabel>
      <SelectInput
        value={template}
        onChange={(e) => {
          const key = e.target.value as TemplateKey;
          setTemplate(key);
          setBody(SMS_TEMPLATES[key]);
        }}
      >
        {Object.keys(SMS_TEMPLATES).map((key) => (
          <option key={key}>{key}</option>
        ))}
      </SelectInput>
      <div className="h-4" />
      <FieldLabel hint={`${body.length}/200`}>내용</FieldLabel>
      <TextArea value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} />
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={closeModal}>취소</GhostButton>
        <PrimaryButton
          disabled={!body.trim() || recipients.length === 0}
          onClick={() => {
            toast(`${recipients.length}명에게 문자를 보냈어요`);
            closeModal();
          }}
        >
          보내기
        </PrimaryButton>
      </div>
      <p className="mt-3 text-[12px] text-faint">실제 발송은 연결되지 않았어요. 보내면 알림만 표시됩니다.</p>
    </Modal>
  );
}
