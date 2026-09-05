"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
import { MemberRail } from "@/components/members/MemberRail";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { RolePill } from "@/components/ui/Pill";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { SelectInput } from "@/components/ui/Field";
import { PropertySelect } from "@/components/ui/PropertySelect";
import { TaxonomyEditor } from "@/components/ui/TaxonomyEditor";
import { tenureLabel, tenureMonths, todayISO } from "@/lib/format";
import { categoryCounts, diligenceScore, participationScore } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { Member } from "@/lib/types";
import { Download, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Cell, Pie, PieChart } from "recharts";

const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968", "#F04452", "#FFB800"];

type SortKey = "이름" | "나이" | "성실도" | "참여도" | "근속기간" | "학번";

export function MembersView() {
  const {
    members,
    events,
    attendance,
    categories,
    selectedMemberIds,
    inspectedMemberId,
    toggleSelect,
    selectAll,
    clearSelection,
    inspectMember,
    setPracticeDays,
    updateMember,
    addCategory,
    removeCategory,
    addRole,
    removeRole,
    assignCategory,
    removeMembers,
    roles,
    openModal,
    toast,
  } = useClub();

  const [categoryTab, setCategoryTab] = useState("전체");
  const [sortKey, setSortKey] = useState<SortKey>("이름");
  const [assignTo, setAssignTo] = useState(categories[0] ?? "");
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);

  const counts = categoryCounts(members, categories);
  const scores = useMemo(() => {
    const map = new Map<string, { diligence: number; participation: number }>();
    members.forEach((member) => {
      map.set(member.id, {
        diligence: diligenceScore(member, events, attendance),
        participation: participationScore(member, events, attendance),
      });
    });
    return map;
  }, [members, events, attendance]);

  const filtered = useMemo(() => {
    if (categoryTab === "전체") return members;
    return members.filter((m) => m.category === categoryTab);
  }, [members, categoryTab]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "이름") return a.name.localeCompare(b.name, "ko");
      if (sortKey === "나이") return b.age - a.age;
      if (sortKey === "성실도") return (scores.get(b.id)?.diligence ?? 0) - (scores.get(a.id)?.diligence ?? 0);
      if (sortKey === "참여도") return (scores.get(b.id)?.participation ?? 0) - (scores.get(a.id)?.participation ?? 0);
      if (sortKey === "근속기간") return tenureMonths(b.joinedAt) - tenureMonths(a.joinedAt);
      return a.studentId.localeCompare(b.studentId);
    });
    return copy;
  }, [filtered, sortKey, scores]);

  const selectedEnabled = selectedMemberIds.length > 0;
  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId && selectedMemberIds.length === 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("tr, button, a, input, select, textarea, label, [role='dialog']")) return;
    inspectMember(null);
    clearSelection();
    setSelectionAnchorId(null);
  };

  const handleRowClick = (row: Member, event: MouseEvent<HTMLTableRowElement>) => {
    const additive = event.ctrlKey || event.metaKey;
    const ranged = event.shiftKey;
    const ids = sorted.map((item) => item.id);

    if (ranged) {
      const end = ids.indexOf(row.id);
      const startId = selectionAnchorId && ids.includes(selectionAnchorId) ? selectionAnchorId : row.id;
      const start = ids.indexOf(startId);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      const rangeIds = ids.slice(from, to + 1);
      selectAll(additive ? [...new Set([...selectedMemberIds, ...rangeIds])] : rangeIds);
      inspectMember(null);
      return;
    }

    if (additive) {
      toggleSelect(row.id);
      setSelectionAnchorId(row.id);
      inspectMember(null);
      return;
    }

    setSelectionAnchorId(row.id);
    inspectMember(row.id);
    selectAll([row.id]);
  };

  const exportCsv = () => {
    const rows = (selectedEnabled ? selectedMembers : sorted).map((m) => {
      const score = scores.get(m.id);
      return [
        m.category,
        m.role,
        m.name,
        m.age,
        m.gender,
        m.practiceDays.join("/"),
        (score?.diligence ?? 0).toFixed(2),
        (score?.participation ?? 0).toFixed(2),
        tenureLabel(m.joinedAt),
        m.major,
        m.studentId,
      ].join(",");
    });
    const header = "분류,직책,이름,나이,성별,연습요일,성실도,참여도,근속기간,전공,학번";
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "클럽노트_회원.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV를 내려받았어요");
  };

  const columns: Column<Member>[] = [
    {
      key: "category",
      header: (
        <TaxonomyEditor label="분류" items={categories} onAdd={addCategory} onRemove={removeCategory} />
      ),
      render: (row) => (
        <PropertySelect value={row.category} options={categories} onChange={(value) => updateMember(row.id, { category: value })}>
          <span className="text-sub">{row.category}</span>
        </PropertySelect>
      ),
    },
    {
      key: "role",
      header: <TaxonomyEditor label="직책" items={roles} onAdd={addRole} onRemove={removeRole} />,
      render: (row) => (
        <PropertySelect value={row.role} options={roles} onChange={(value) => updateMember(row.id, { role: value })}>
          <RolePill role={row.role} />
        </PropertySelect>
      ),
    },
    {
      key: "name",
      header: "이름",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={row.name} size={24} />
          <span className="font-medium">{row.name}</span>
          {row.active === false ? (
            <span className="rounded-[6px] bg-[#F2F4F6] px-1.5 py-0.5 text-[11px] font-medium text-sub">비활동</span>
          ) : null}
        </span>
      ),
    },
    { key: "age", header: "나이", render: (row) => `${row.age}` },
    { key: "gender", header: "성별", render: (row) => row.gender },
    {
      key: "days",
      header: "연습요일",
      render: (row) => (
        <PracticeDayToggles size="sm" value={row.practiceDays} onChange={(days) => setPracticeDays(row.id, days)} />
      ),
    },
    {
      key: "diligence",
      header: "성실도",
      render: (row) => <ScoreBar value={scores.get(row.id)?.diligence ?? 0} />,
    },
    {
      key: "participation",
      header: "참여도",
      render: (row) => <ScoreBar value={scores.get(row.id)?.participation ?? 0} color="var(--brand)" />,
    },
    { key: "tenure", header: "근속기간", render: (row) => tenureLabel(row.joinedAt) },
    { key: "major", header: "전공", render: (row) => <span className="text-sub">{row.major}</span> },
    { key: "sid", header: "학번", render: (row) => <span className="tabular-nums">{row.studentId}</span> },
  ];

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin" onClick={dismissInspected}>
        <section className="grid grid-cols-2 border-b border-line-soft md:grid-cols-3">
          <div className="row-span-2 flex flex-col justify-between border-b border-r border-line-soft p-4 md:border-b-0">
            <div>
              <p className="text-[12px] text-sub">회원수</p>
              <p className="mt-1 text-[28px] font-semibold leading-8">{members.length}</p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12px] text-sub">분류 비율</p>
              <div className="flex items-center gap-3">
                <PieChart width={88} height={88}>
                  <Pie
                    data={counts.filter((item) => item.count > 0)}
                    dataKey="count"
                    innerRadius={26}
                    outerRadius={40}
                    paddingAngle={1.5}
                    stroke="none"
                    isAnimationActive={false}
                    cx="50%"
                    cy="50%"
                  >
                    {counts
                      .filter((item) => item.count > 0)
                      .map((entry) => {
                        const i = counts.findIndex((item) => item.name === entry.name);
                        return <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />;
                      })}
                  </Pie>
                </PieChart>
                <ul className="min-w-0 flex-1 space-y-1">
                  {counts.map((item, i) => (
                    <li key={item.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-sub">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="tabular-nums text-ink">
                        {members.length ? Math.round((item.count / members.length) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          {counts.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setCategoryTab(item.name)}
              className="border-b border-r border-line-soft p-4 text-left last:border-r-0 hover:bg-muted"
            >
              <p className="text-[12px] text-sub">{item.name} 회원수</p>
              <p className="mt-1 text-[20px] font-semibold">{item.count}명</p>
            </button>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-2">
          {["전체", ...categories].map((tab) => (
            <FilterChip key={tab} active={categoryTab === tab} onClick={() => setCategoryTab(tab)}>
              {tab}
            </FilterChip>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[12px] text-faint">정렬</span>
            {(["이름", "나이", "성실도", "참여도", "근속기간", "학번"] as SortKey[]).map((key) => (
              <FilterChip key={key} active={sortKey === key} onClick={() => setSortKey(key)}>
                {key}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="px-2 py-2">
          <DataTable
            columns={columns}
            rows={sorted}
            selectedIds={selectedMemberIds}
            onToggle={toggleSelect}
            onToggleAll={() => {
              if (sorted.every((row) => selectedMemberIds.includes(row.id))) clearSelection();
              else selectAll(sorted.map((row) => row.id));
            }}
            onRowClick={handleRowClick}
            empty={
              <span>
                이 분류에 회원이 없어요.{" "}
                <button type="button" className="text-brand-text" onClick={() => setCategoryTab("전체")}>
                  전체 보기
                </button>
              </span>
            }
          />
        </div>
      </main>

      <RightRail>
        {inspectedMemberId ? (
          <MemberRail memberId={inspectedMemberId} />
        ) : (
          <>
            <RailSection>
              <LiveClock />
            </RailSection>
            <RailSection title="캘린더">
              <MiniCalendar events={events} month={todayISO()} />
            </RailSection>
            <RailSection>
              <GhostButton className="w-full" onClick={() => openModal("member-add")}>
                <UserPlus className="h-3.5 w-3.5" />
                회원 추가
              </GhostButton>
            </RailSection>
            <RailSection title="분류">
              <SelectInput value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SelectInput>
              <GhostButton
                className="mt-2 w-full"
                disabled={!selectedEnabled}
                onClick={() => {
                  assignCategory(selectedMemberIds, assignTo);
                  toast(`${selectedMemberIds.length}명을 ${assignTo}(으)로 옮겼어요`);
                }}
              >
                선택 회원 분류 배정
              </GhostButton>
            </RailSection>
            <RailSection>
              <GhostButton
                className="w-full text-up hover:bg-[#FFF1F1]"
                disabled={!selectedEnabled}
                onClick={() => {
                  const names = selectedMembers.map((item) => item.name);
                  const label = selectedMembers.length === 1 ? `${names[0]} 님` : `선택한 ${selectedMembers.length}명`;
                  if (!window.confirm(`${label}을 동아리에서 내보낼까요? 출석·차트 기록도 함께 삭제돼요.`)) return;
                  removeMembers(selectedMemberIds);
                  toast(`${label}을 내보냈어요`);
                }}
              >
                선택 회원 내보내기
              </GhostButton>
              {!selectedEnabled ? (
                <p className="mt-1.5 text-[12px] text-faint">체크한 회원을 동아리에서 내보낼 수 있어요</p>
              ) : null}
              <GhostButton className="mt-2 w-full" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                CSV 내려받기
              </GhostButton>
            </RailSection>
          </>
        )}
      </RightRail>
    </>
  );
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    let interval = 0;
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  if (!now) {
    return <div className="h-[52px]" aria-hidden />;
  }

  const week = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const period = now.getHours() < 12 ? "오전" : "오후";
  const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <div>
      <p className="text-[12px] text-faint">
        {y}.{m}.{d} ({week})
      </p>
      <p className="mt-0.5 text-[22px] font-semibold leading-7 tabular-nums tracking-tight">
        {period} {hour12}:{mm}:{ss}
      </p>
    </div>
  );
}
