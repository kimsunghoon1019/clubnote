"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_CATEGORIES, DEFAULT_ROLES, OPERATOR_NAME, STORAGE_KEY, normalizeAttendanceStatus } from "./constants";
import {
  attendance as seedAttendance,
  chartNotes as seedNotes,
  events as seedEvents,
  groups as seedGroups,
  members as seedMembers,
  transactions as seedTransactions,
} from "./seed";
import { compareTxAsc, newBankRows, type ParsedBankTx } from "./bankExcel";
import type {
  Attendance,
  AttendanceStatus,
  ChartNote,
  ClubEvent,
  Member,
  PracticeDay,
  Transaction,
} from "./types";

export type ToastItem = { id: string; message: string };
export type ModalKey = "sms" | "transaction" | "event" | "member-add" | null;

type Persisted = {
  members: Member[];
  events: ClubEvent[];
  attendance: Attendance[];
  notes: ChartNote[];
  transactions: Transaction[];
  categories: string[];
  roles: string[];
};

type ClubContextValue = {
  groups: typeof seedGroups;
  members: Member[];
  events: ClubEvent[];
  attendance: Attendance[];
  notes: ChartNote[];
  transactions: Transaction[];
  categories: string[];
  roles: string[];
  selectedMemberIds: string[];
  inspectedMemberId: string | null;
  toasts: ToastItem[];
  modal: ModalKey;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  inspectMember: (id: string | null) => void;
  setAttendanceStatus: (eventId: string, memberId: string, status: AttendanceStatus | null) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  addMember: (input: Omit<Member, "id">) => void;
  removeMembers: (ids: string[]) => void;
  setPracticeDays: (id: string, days: PracticeDay[]) => void;
  addChartNote: (memberId: string, body: string) => void;
  deleteChartNote: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  addRole: (name: string) => void;
  removeRole: (name: string) => void;
  assignCategory: (ids: string[], category: string) => void;
  addTransaction: (input: Omit<Transaction, "id" | "balanceAfter"> & { balanceAfter?: number }) => void;
  importBankTransactions: (incoming: ParsedBankTx[]) => number;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  addEvent: (input: Omit<ClubEvent, "id">) => ClubEvent;
  updateEvent: (id: string, patch: Partial<ClubEvent>) => void;
  deleteEvent: (id: string) => void;
  toast: (message: string) => void;
  dismissToast: (id: string) => void;
  openModal: (key: Exclude<ModalKey, null>) => void;
  closeModal: () => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (!Array.isArray(data.members) || !Array.isArray(data.events) || !Array.isArray(data.attendance)) return null;
    return data;
  } catch {
    return null;
  }
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [events, setEvents] = useState<ClubEvent[]>(seedEvents);
  const [attendance, setAttendance] = useState<Attendance[]>(seedAttendance);
  const [notes, setNotes] = useState<ChartNote[]>(seedNotes);
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inspectedMemberId, setInspectedMemberId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<ModalKey>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const data = loadPersisted();
    if (data) {
      setMembers(
        data.members.map((member) => ({
          ...member,
          active: member.active !== false,
          practiceDays: member.practiceDays ?? ["화", "목", "토"],
        })),
      );
      setEvents(data.events);
      setAttendance(
        data.attendance.flatMap((row) => {
          const status = normalizeAttendanceStatus(String(row.status));
          if (!status) return [];
          return [{ ...row, status }];
        }),
      );
      setNotes(data.notes ?? []);
      setTransactions(data.transactions ?? seedTransactions);
      setCategories(data.categories?.length ? data.categories : DEFAULT_CATEGORIES);
      setRoles(data.roles?.length ? data.roles : DEFAULT_ROLES);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = { members, events, attendance, notes, transactions, categories, roles };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, members, events, attendance, notes, transactions, categories, roles]);

  const toast = useCallback((message: string) => {
    const id = uid("toast");
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedMemberIds(ids);
  }, []);

  const clearSelection = useCallback(() => setSelectedMemberIds([]), []);
  const inspectMember = useCallback((id: string | null) => setInspectedMemberId(id), []);

  const setAttendanceStatus = useCallback(
    (eventId: string, memberId: string, status: AttendanceStatus | null) => {
      setAttendance((prev) => {
        const match = (row: Attendance) => row.eventId === eventId && row.memberId === memberId;
        if (!status) return prev.filter((row) => !match(row));
        const exists = prev.some(match);
        if (exists) {
          return prev.map((row) => (match(row) ? { ...row, status } : row));
        }
        return [...prev, { id: uid("a"), eventId, memberId, status }];
      });
    },
    [],
  );

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    setMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }, []);

  const addMember = useCallback((input: Omit<Member, "id">) => {
    setMembers((prev) => [...prev, { ...input, id: uid("m") }]);
  }, []);

  const removeMembers = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setMembers((prev) => prev.filter((member) => !drop.has(member.id)));
    setAttendance((prev) => prev.filter((row) => !drop.has(row.memberId)));
    setNotes((prev) => prev.filter((note) => !drop.has(note.memberId)));
    setSelectedMemberIds((prev) => prev.filter((id) => !drop.has(id)));
    setInspectedMemberId((current) => (current && drop.has(current) ? null : current));
  }, []);

  const setPracticeDays = useCallback((id: string, days: PracticeDay[]) => {
    setMembers((prev) => prev.map((member) => (member.id === id ? { ...member, practiceDays: days } : member)));
  }, []);

  const addChartNote = useCallback((memberId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setNotes((prev) => [
      {
        id: uid("note"),
        memberId,
        body: trimmed,
        createdAt: new Date().toISOString(),
        author: OPERATOR_NAME,
      },
      ...prev,
    ]);
  }, []);

  const deleteChartNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  const addCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeCategory = useCallback((name: string) => {
    setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, []);

  const addRole = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRoles((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeRole = useCallback((name: string) => {
    setRoles((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, []);

  const assignCategory = useCallback((ids: string[], category: string) => {
    setMembers((prev) => prev.map((member) => (ids.includes(member.id) ? { ...member, category } : member)));
  }, []);

  const addTransaction = useCallback(
    (input: Omit<Transaction, "id" | "balanceAfter"> & { balanceAfter?: number }) => {
      setTransactions((prev) => {
        const last = prev[prev.length - 1];
        const balanceAfter = input.balanceAfter ?? (last?.balanceAfter ?? 0) + input.amount;
        return [...prev, { ...input, id: uid("t"), balanceAfter }].sort(compareTxAsc);
      });
    },
    [],
  );

  const importBankTransactions = useCallback((incoming: ParsedBankTx[]) => {
    const fresh = newBankRows(transactions, incoming);
    if (fresh.length === 0) return 0;
    setTransactions((prev) => {
      const next = newBankRows(prev, incoming);
      if (next.length === 0) return prev;
      return [...prev, ...next.map((row) => ({ ...row, id: uid("t"), category: "" as const }))].sort(compareTxAsc);
    });
    return fresh.length;
  }, [transactions]);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const addEvent = useCallback((input: Omit<ClubEvent, "id">) => {
    const created: ClubEvent = { ...input, id: uid("e") };
    setEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    return created;
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<ClubEvent>) => {
    setEvents((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((row) => row.id !== id));
    setAttendance((prev) => prev.filter((row) => row.eventId !== id));
  }, []);

  const openModal = useCallback((key: Exclude<ModalKey, null>) => setModal(key), []);
  const closeModal = useCallback(() => setModal(null), []);

  const value = useMemo<ClubContextValue>(
    () => ({
      groups: seedGroups,
      members,
      events,
      attendance,
      notes,
      transactions,
      categories,
      roles,
      selectedMemberIds,
      inspectedMemberId,
      toasts,
      modal,
      searchOpen,
      setSearchOpen,
      toggleSelect,
      selectAll,
      clearSelection,
      inspectMember,
      setAttendanceStatus,
      updateMember,
      addMember,
      removeMembers,
      setPracticeDays,
      addChartNote,
      deleteChartNote,
      addCategory,
      removeCategory,
      addRole,
      removeRole,
      assignCategory,
      addTransaction,
      importBankTransactions,
      updateTransaction,
      addEvent,
      updateEvent,
      deleteEvent,
      toast,
      dismissToast,
      openModal,
      closeModal,
    }),
    [
      members,
      events,
      attendance,
      notes,
      transactions,
      categories,
      roles,
      selectedMemberIds,
      inspectedMemberId,
      toasts,
      modal,
      searchOpen,
      toggleSelect,
      selectAll,
      clearSelection,
      inspectMember,
      setAttendanceStatus,
      updateMember,
      addMember,
      removeMembers,
      setPracticeDays,
      addChartNote,
      deleteChartNote,
      addCategory,
      removeCategory,
      addRole,
      removeRole,
      assignCategory,
      addTransaction,
      importBankTransactions,
      updateTransaction,
      addEvent,
      updateEvent,
      deleteEvent,
      toast,
      dismissToast,
      openModal,
      closeModal,
    ],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}


