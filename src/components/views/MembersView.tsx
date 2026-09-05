"use client";

import { RightRail, RailSection } from "@/components/layout/RightRail";
import { ChartInbox } from "@/components/members/ChartInbox";
import { MemberRail } from "@/components/members/MemberRail";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChip } from "@/components/ui/FilterChip";
import { GhostButton } from "@/components/ui/GhostButton";
import { PracticeDayToggles } from "@/components/ui/PracticeDayToggles";
import { RolePill } from "@/components/ui/Pill";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { SelectInput } from "@/components/ui/Field";
import { PropertySelect } from "@/components/ui/PropertySelect";
import { LiveClock } from "@/components/ui/LiveClock";
import { TaxonomyEditor } from "@/components/ui/TaxonomyEditor";
import { formatChartStamp, formatDateDot, formatRatio, tenureLabel, tenureMonths } from "@/lib/format";
import { isInspectDismissClick } from "@/lib/inspect";
import { categoryCounts, diligenceScore, participationScore } from "@/lib/stats";
import { useClub } from "@/lib/store";
import type { ChartNote, Member } from "@/lib/types";
import { Download, UserPlus } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { Cell, Pie, PieChart } from "recharts";

const PIE_COLORS = ["#3182F6", "#1B64DA", "#8B95A1", "#4E5968", "#F04452", "#FFB800"];

type SortKey = "이름" | "나이" | "성실도" | "참여도" | "근속기간" | "학번";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir } | null;
type MemberScores = Map<string, { diligence: number; participation: number }>;

const SORT_KEYS: SortKey[] = ["이름", "나이", "성실도", "참여도", "근속기간", "학번"];
const DEFAULT_SORT_KEY: SortKey = "이름";
const SORT_COLUMN: Record<SortKey, string> = {
  이름: "name",
  나이: "age",
  성실도: "diligence",
  참여도: "participation",
  근속기간: "tenure",
  학번: "sid",
};

function cycleSort(current: SortState, key: SortKey): SortState {
  if (current?.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function compareMembers(a: Member, b: Member, key: SortKey, scores: MemberScores) {
  if (key === "이름") return a.name.localeCompare(b.name, "ko");
  if (key === "나이") return a.age - b.age;
  if (key === "성실도") return (scores.get(a.id)?.diligence ?? 0) - (scores.get(b.id)?.diligence ?? 0);
  if (key === "참여도") return (scores.get(a.id)?.participation ?? 0) - (scores.get(b.id)?.participation ?? 0);
  if (key === "근속기간") return tenureMonths(a.joinedAt) - tenureMonths(b.joinedAt);
  return a.studentId.localeCompare(b.studentId);
}

function sortColumnKey(columnKey: string): SortKey | undefined {
  return SORT_KEYS.find((key) => SORT_COLUMN[key] === columnKey);
}

const MEMBER_CSV_HEADER = [
  "분류",
  "직책",
  "이름",
  "나이",
  "성별",
  "생년월일",
  "단과대학",
  "전공",
  "학번",
  "가입일",
  "근속기간",
  "연락처",
  "연습요일",
  "활동여부",
  "성실도",
  "참여도",
  "차트",
] as const;

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function chartCsvText(memberId: string, notes: ChartNote[]) {
  return notes
    .filter((note) => note.memberId === memberId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((note) => `${formatChartStamp(note.createdAt)} · ${note.author}\n${note.body}`)
    .join("\n\n");
}

function buildMemberCsv(members: Member[], notes: ChartNote[], scores: MemberScores) {
  const rows = members.map((member) => {
    const score = scores.get(member.id);
    return [
      member.category,
      member.role,
      member.name,
      member.age,
      member.gender,
      member.birthDate ? formatDateDot(member.birthDate) : "",
      member.college || "",
      member.major,
      member.studentId,
      formatDateDot(member.joinedAt),
      tenureLabel(member.joinedAt),
      member.phone || "",
      member.practiceDays.join("/"),
      member.active !== false ? "활동" : "비활동",
      formatRatio(score?.diligence ?? 0),
      formatRatio(score?.participation ?? 0),
      chartCsvText(member.id, notes),
    ]
      .map(csvCell)
      .join(",");
  });
  return [MEMBER_CSV_HEADER.join(","), ...rows].join("\n");
}

export function MembersView() {
  const {
    members,
    events,
    attendance,
    notes,
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
    moveCategory,
    addRole,
    removeRole,
    moveRole,
    assignCategory,
    removeMembers,
    roles,
    openModal,
    toast,
  } = useClub();

  const [categoryTab, setCategoryTab] = useState("전체");
  const [sort, setSort] = useState<SortState>(null);
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
    const key = sort?.key ?? DEFAULT_SORT_KEY;
    const dir = sort?.dir ?? "asc";
    const copy = [...filtered];
    copy.sort((a, b) => {
      const raw = compareMembers(a, b, key, scores);
      const signed = dir === "desc" ? -raw : raw;
      return signed || a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id);
    });
    return copy;
  }, [filtered, sort, scores]);

  const selectedEnabled = selectedMemberIds.length > 0;
  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  const dismissInspected = (event: MouseEvent<HTMLElement>) => {
    if (!inspectedMemberId && selectedMemberIds.length === 0) return;
    if (!isInspectDismissClick(event.target)) return;
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

    if (
      inspectedMemberId === row.id &&
      (selectedMemberIds.length === 0 || (selectedMemberIds.length === 1 && selectedMemberIds[0] === row.id))
    ) {
      inspectMember(null);
      clearSelection();
      setSelectionAnchorId(null);
      return;
    }

    setSelectionAnchorId(row.id);
    inspectMember(row.id);
    selectAll([row.id]);
  };

  const exportCsv = () => {
    const targets = selectedEnabled ? selectedMembers : sorted;
    const csv = buildMemberCsv(targets, notes, scores);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
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
        <TaxonomyEditor
          label="분류"
          items={categories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onMove={moveCategory}
        />
      ),
      render: (row) => (
        <PropertySelect value={row.category} options={categories} onChange={(value) => updateMember(row.id, { category: value })}>
          <span className="text-sub">{row.category}</span>
        </PropertySelect>
      ),
    },
    {
      key: "role",
      header: (
        <TaxonomyEditor label="직책" items={roles} onAdd={addRole} onRemove={removeRole} onMove={moveRole} />
      ),
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
    { key: "age", header: "나이", sortable: true, render: (row) => `${row.age}` },
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
      sortable: true,
      render: (row) => <ScoreBar value={scores.get(row.id)?.diligence ?? 0} />,
    },
    {
      key: "participation",
      header: "참여도",
      sortable: true,
      render: (row) => <ScoreBar value={scores.get(row.id)?.participation ?? 0} color="var(--brand)" />,
    },
    { key: "tenure", header: "근속기간", sortable: true, render: (row) => tenureLabel(row.joinedAt) },
    { key: "major", header: "전공", render: (row) => <span className="text-sub">{row.major}</span> },
    { key: "sid", header: "학번", sortable: true, render: (row) => <span className="tabular-nums">{row.studentId}</span> },
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
            {SORT_KEYS.map((key) => {
              const active = sort ? sort.key === key : key === DEFAULT_SORT_KEY;
              const dirMark = sort?.key === key ? (sort.dir === "asc" ? "▲" : "▼") : null;
              return (
                <FilterChip key={key} active={active} onClick={() => setSort((current) => cycleSort(current, key))}>
                  <span className="inline-flex items-center gap-1">
                    {key}
                    {dirMark ? <span className="text-[10px]">{dirMark}</span> : null}
                  </span>
                </FilterChip>
              );
            })}
          </div>
        </div>

        <div className="px-2 py-2">
          <DataTable
            columns={columns}
            rows={sorted}
            sortKey={sort ? SORT_COLUMN[sort.key] : undefined}
            sortDir={sort?.dir}
            onSort={(columnKey) => {
              const key = sortColumnKey(columnKey);
              if (key) setSort((current) => cycleSort(current, key));
            }}
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
            <RailSection>
              <ChartInbox />
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
