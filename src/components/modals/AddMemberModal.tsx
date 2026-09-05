"use client";

import { FieldLabel, SelectInput, TextInput } from "@/components/ui/Field";
import { GhostButton } from "@/components/ui/GhostButton";
import { Modal } from "@/components/ui/Modal";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { GENDER_OPTIONS } from "@/lib/constants";
import { ageFromBirthDate, collegeFromMajor, inferredBirthDate, todayISO } from "@/lib/format";
import { useClub } from "@/lib/store";
import type { Gender, PracticeDay } from "@/lib/types";
import { useState } from "react";

export function AddMemberModal() {
  const { modal, closeModal, addMember, categories, roles, groups, toast } = useClub();
  const open = modal === "member-add";
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "기악");
  const [role, setRole] = useState(roles.includes("회원") ? "회원" : roles[0] ?? "회원");
  const [gender, setGender] = useState<Gender>("여");
  const [age, setAge] = useState("21");
  const [birthDate, setBirthDate] = useState("");
  const [studentId, setStudentId] = useState("");
  const [major, setMajor] = useState("");
  const [college, setCollege] = useState("");
  const [phone, setPhone] = useState("");
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>(["화", "목", "토"]);

  if (!open) return null;

  const reset = () => {
    setName("");
    setAge("21");
    setBirthDate("");
    setStudentId("");
    setMajor("");
    setCollege("");
    setPhone("");
    setPracticeDays(["화", "목", "토"]);
  };

  return (
    <Modal open={open} title="회원 추가" onClose={closeModal} width={480}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>이름</FieldLabel>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
        </div>
        <div>
          <FieldLabel>분류</FieldLabel>
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>직책</FieldLabel>
          <SelectInput value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>성별</FieldLabel>
          <SelectInput value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            {GENDER_OPTIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>학번</FieldLabel>
          <TextInput value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="202512345" />
        </div>
        <div>
          <FieldLabel>나이</FieldLabel>
          <TextInput inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <div>
          <FieldLabel>생년월일</FieldLabel>
          <TextInput
            type="date"
            className="tabular-nums"
            value={birthDate}
            onChange={(e) => {
              const next = e.target.value;
              setBirthDate(next);
              if (next) setAge(String(ageFromBirthDate(next)));
            }}
          />
        </div>
        <div>
          <FieldLabel>전공</FieldLabel>
          <TextInput
            value={major}
            onChange={(e) => {
              const next = e.target.value;
              setMajor(next);
              const inferred = collegeFromMajor(next);
              if (inferred) setCollege(inferred);
            }}
          />
        </div>
        <div>
          <FieldLabel>단과대학</FieldLabel>
          <TextInput value={college} onChange={(e) => setCollege(e.target.value)} placeholder="음악대학" />
        </div>
        <div className="col-span-2">
          <FieldLabel>연락처</FieldLabel>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>
        <div className="col-span-2">
          <FieldLabel>연습요일</FieldLabel>
          <PracticeDayToggles value={practiceDays} onChange={setPracticeDays} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={closeModal}>취소</GhostButton>
        <PrimaryButton
          disabled={!name.trim()}
          onClick={() => {
            addMember({
              groupId: groups[0]?.id ?? "g1",
              category,
              role,
              name: name.trim(),
              gender,
              age: birthDate ? ageFromBirthDate(birthDate) : Number(age) || 20,
              birthDate: birthDate || inferredBirthDate(Number(age) || 20, name.trim()),
              studentId: studentId || `${new Date().getFullYear()}00000`,
              major: major || "-",
              college: college.trim() || collegeFromMajor(major) || "-",
              joinedAt: todayISO(),
              phone,
              unpaidFee: 0,
              practiceDays,
              active: true,
            });
            toast(`${name.trim()} 님을 추가했어요`);
            reset();
            closeModal();
          }}
        >
          회원 추가
        </PrimaryButton>
      </div>
    </Modal>
  );
}
