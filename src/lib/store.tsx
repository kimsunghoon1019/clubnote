"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PLACES,
  DEFAULT_ROLES,
  EVENT_TYPES,
  OPERATOR_NAME,
  STORAGE_KEY,
  TX_CATEGORIES,
  emptyFineTally,
  normalizeAttendanceStatus,
} from "./constants";
import { closePastPracticeEvents, withFineTallies } from "./attendanceSheet";
import { collegeFromMajor, inferredBirthDate, msUntilNextLocalMidnight, todayISO } from "./format";
import { isPracticeEvent } from "./stats";
import {
  attendance as seedAttendance,
  chartNotes as seedNotes,
  dropEventsBefore,
  EVENTS_KEEP_FROM,
  events as seedEvents,
  groups as seedGroups,
  members as seedMembers,
  transactions as seedTransactions,
} from "./seed";
import {
  loadSinchonWeather,
  mergeWeatherDays,
  needsMorningWeatherFetch,
  nextSixAMSeoul,
  normalizeWeatherDays,
  seoulISODate,
  WEATHER_PAST_DAYS,
  type WeatherDay,
} from "./weather";
import { compareTxAsc, newBankRows, type ParsedBankTx } from "./bankExcel";
import {
  dataUrlToBlob,
  eventAttachments,
  fileToProof,
  persistableEvent,
  persistableTransaction,
  txProofs,
} from "./proof";
import { deleteProofBlob, getProofBlob, putProofBlob } from "./proofDb";
import { createClient } from "./supabase/client";
import type {
  Attendance,
  AttendanceStatus,
  ChartNote,
  ClubEvent,
  DuesOverride,
  Member,
  PracticeDay,
  Transaction,
} from "./types";

const LOCAL_ACCOUNT_ID = "local";
type ChartSeenByAccount = Record<string, string[]>;

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
  eventTypes: string[];
  places: string[];
  txCategories?: string[];
  chartSeenByAccount?: ChartSeenByAccount;
  weatherDays?: WeatherDay[];
  weatherFetchedAt?: string;
  eventsClearedBefore?: string;
  duesOverrides?: DuesOverride[];
};

type ClubContextValue = {
  groups: typeof seedGroups;
  members: Member[];
  events: ClubEvent[];
  weatherDays: WeatherDay[];
  attendance: Attendance[];
  notes: ChartNote[];
  transactions: Transaction[];
  categories: string[];
  roles: string[];
  eventTypes: string[];
  places: string[];
  txCategories: string[];
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
  closeAttendance: (eventId: string) => boolean;
  updateMember: (id: string, patch: Partial<Member>) => void;
  addMember: (input: Omit<Member, "id" | "fineTally">) => void;
  removeMembers: (ids: string[]) => void;
  setPracticeDays: (id: string, days: PracticeDay[]) => void;
  addChartNote: (memberId: string, body: string) => void;
  deleteChartNote: (id: string) => void;
  accountId: string;
  chartSeenByAccount: ChartSeenByAccount;
  acknowledgeChartNote: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  moveCategory: (from: number, to: number) => void;
  addRole: (name: string) => void;
  removeRole: (name: string) => void;
  moveRole: (from: number, to: number) => void;
  addEventType: (name: string) => void;
  removeEventType: (name: string) => void;
  addPlace: (name: string) => void;
  removePlace: (name: string) => void;
  addTxCategory: (name: string) => void;
  removeTxCategory: (name: string) => void;
  moveTxCategory: (from: number, to: number) => void;
  assignCategory: (ids: string[], category: string) => void;
  addTransaction: (input: Omit<Transaction, "id" | "balanceAfter"> & { balanceAfter?: number }) => void;
  importBankTransactions: (incoming: ParsedBankTx[]) => number;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  addTransactionProof: (id: string, file: File) => Promise<void>;
  removeTransactionProof: (id: string, proofId: string) => Promise<void>;
  addEvent: (input: Omit<ClubEvent, "id">) => ClubEvent;
  updateEvent: (id: string, patch: Partial<ClubEvent>) => void;
  addEventAttachment: (id: string, file: File) => Promise<void>;
  removeEventAttachment: (id: string, attachmentId: string) => Promise<void>;
  deleteEvent: (id: string) => void;
  toast: (message: string) => void;
  dismissToast: (id: string) => void;
  eventModalDate: string | null;
  openModal: (key: Exclude<ModalKey, null>, payload?: { date?: string }) => void;
  closeModal: () => void;
  duesOverrides: DuesOverride[];
  setDuesOverride: (memberId: string, semesterStart: string, paid: boolean | null) => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeProofsDuringHydrate(prev: Transaction[], hydrated: Transaction[]): Transaction[] {
  const current = new Map(prev.map((row) => [row.id, row]));
  return hydrated.map((row) => {
    const live = current.get(row.id);
    if (!live) return row;
    const have = new Set(txProofs(row).map((item) => item.id));
    const extra = txProofs(live).filter((item) => !have.has(item.id));
    return extra.length ? { ...row, proofs: [...txProofs(row), ...extra] } : row;
  });
}

async function hydrateTransactionProofs(rows: Transaction[]): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (const row of rows) {
    const proofs = txProofs(row);
    for (let i = 0; i < proofs.length; i += 1) {
      const proof = proofs[i];
      if (await getProofBlob(proof.id)) continue;
      if (i === 0 && row.proofDataUrl) {
        await putProofBlob(proof.id, dataUrlToBlob(row.proofDataUrl));
        continue;
      }
      const seed = seedTransactions.find((item) => item.id === row.id);
      if (!seed?.proofDataUrl) continue;
      const seedProofs = txProofs(seed);
      const seedMatch = seedProofs.find((item) => item.id === proof.id) ?? (i === 0 ? seedProofs[0] : undefined);
      if (seedMatch) await putProofBlob(proof.id, dataUrlToBlob(seed.proofDataUrl));
    }
    const { proofName: _name, proofMime: _mime, proofDataUrl: _data, ...rest } = row;
    out.push({ ...rest, proofs });
  }
  return out;
}

function normalizeDuesOverrides(raw: unknown): DuesOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: DuesOverride[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<DuesOverride>;
    if (typeof item.memberId !== "string" || !item.memberId) continue;
    if (typeof item.semesterStart !== "string" || !item.semesterStart) continue;
    if (typeof item.paid !== "boolean") continue;
    out.push({ memberId: item.memberId, semesterStart: item.semesterStart, paid: item.paid });
  }
  return out;
}

function normalizeChartSeen(raw: unknown): ChartSeenByAccount {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ChartSeenByAccount = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    out[key] = value.filter((id): id is string => typeof id === "string");
  }
  return out;
}

function omitSeenIds(map: ChartSeenByAccount, drop: Set<string>): ChartSeenByAccount {
  if (drop.size === 0) return map;
  let changed = false;
  const next: ChartSeenByAccount = {};
  for (const [key, ids] of Object.entries(map)) {
    const kept = ids.filter((id) => !drop.has(id));
    if (kept.length !== ids.length) changed = true;
    next[key] = kept;
  }
  return changed ? next : map;
}

function uniqueNames(...groups: Array<string[] | readonly string[]>) {
  const out: string[] = [];
  for (const group of groups) {
    for (const value of group) {
      const trimmed = value.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

function moveName(list: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function normalizeMember(member: Member): Member {
  return {
    ...member,
    active: member.active !== false,
    practiceDays: member.practiceDays ?? ["화", "목", "토"],
    college: typeof member.college === "string" ? member.college : collegeFromMajor(member.major),
    birthDate: typeof member.birthDate === "string" ? member.birthDate : inferredBirthDate(member.age, member.id || member.name),
    fineTally: member.fineTally ?? emptyFineTally(),
  };
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
  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>([]);
  const [weatherFetchedAt, setWeatherFetchedAt] = useState("");
  const [eventsClearedBefore, setEventsClearedBefore] = useState(EVENTS_KEEP_FROM);
  const [attendance, setAttendance] = useState<Attendance[]>(seedAttendance);
  const [notes, setNotes] = useState<ChartNote[]>(seedNotes);
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [eventTypes, setEventTypes] = useState<string[]>([...EVENT_TYPES]);
  const [places, setPlaces] = useState<string[]>(DEFAULT_PLACES);
  const [txCategories, setTxCategories] = useState<string[]>([...TX_CATEGORIES]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inspectedMemberId, setInspectedMemberId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<ModalKey>(null);
  const [eventModalDate, setEventModalDate] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState(LOCAL_ACCOUNT_ID);
  const [chartSeenByAccount, setChartSeenByAccount] = useState<ChartSeenByAccount>({});
  const [duesOverrides, setDuesOverrides] = useState<DuesOverride[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const data = loadPersisted();
      const txs = await hydrateTransactionProofs(data?.transactions ?? seedTransactions);
      if (!alive) return;
      if (data) {
        const attendanceRows = data.attendance.flatMap((row) => {
          const status = normalizeAttendanceStatus(String(row.status));
          if (!status) return [];
          return [{ ...row, status }];
        });
        const cutoff = data.eventsClearedBefore ?? "";
        const loaded =
          cutoff < EVENTS_KEEP_FROM
            ? dropEventsBefore(data.events, attendanceRows, EVENTS_KEEP_FROM)
            : { events: data.events, attendance: attendanceRows };
        setEvents(loaded.events.map(persistableEvent));
        setAttendance(loaded.attendance);
        setMembers(withFineTallies(data.members.map(normalizeMember), loaded.events, loaded.attendance));
        setEventsClearedBefore(EVENTS_KEEP_FROM);
        setWeatherDays(normalizeWeatherDays(data.weatherDays));
        setWeatherFetchedAt(typeof data.weatherFetchedAt === "string" ? data.weatherFetchedAt : "");
        setNotes(data.notes ?? []);
        setCategories(data.categories?.length ? data.categories : DEFAULT_CATEGORIES);
        setRoles(data.roles?.length ? data.roles : DEFAULT_ROLES);
        setEventTypes(
          uniqueNames(
            EVENT_TYPES,
            data.eventTypes ?? [],
            (data.events ?? []).map((event) => event.type),
          ),
        );
        setPlaces(
          uniqueNames(
            DEFAULT_PLACES,
            data.places ?? [],
            (data.events ?? []).map((event) => event.place),
          ),
        );
        setTxCategories(
          uniqueNames(
            data.txCategories?.length ? data.txCategories : TX_CATEGORIES,
            (data.transactions ?? []).map((row) => row.category),
          ),
        );
        setChartSeenByAccount(normalizeChartSeen(data.chartSeenByAccount));
        setDuesOverrides(normalizeDuesOverrides(data.duesOverrides));
      }
      setTransactions((prev) => mergeProofsDuringHydrate(prev, txs));
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setAccountId(LOCAL_ACCOUNT_ID);
      return;
    }
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setAccountId(data.user?.id ?? LOCAL_ACCOUNT_ID);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountId(session?.user?.id ?? LOCAL_ACCOUNT_ID);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = {
      members: withFineTallies(members, events, attendance),
      events: events.map(persistableEvent),
      attendance,
      notes,
      transactions: transactions.map(persistableTransaction),
      categories,
      roles,
      eventTypes,
      places,
      txCategories,
      chartSeenByAccount,
      weatherDays,
      weatherFetchedAt,
      eventsClearedBefore,
      duesOverrides,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota: keep in-memory state */
    }
  }, [ready, members, events, attendance, notes, transactions, categories, roles, eventTypes, places, txCategories, chartSeenByAccount, weatherDays, weatherFetchedAt, eventsClearedBefore, duesOverrides]);

  const practiceDaysKey = members.map((member) => `${member.id}:${member.practiceDays.join(",")}`).join("|");
  useEffect(() => {
    if (!ready) return;
    setMembers((prev) => withFineTallies(prev, events, attendance));
  }, [ready, events, attendance, practiceDaysKey]);

  useEffect(() => {
    if (!ready) return;
    const run = () => setEvents((prev) => closePastPracticeEvents(prev));
    run();
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        run();
        schedule();
      }, Math.min(msUntilNextLocalMidnight(), 86_400_000));
    };
    schedule();
    const onWake = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [ready]);

  const weatherDaysRef = useRef(weatherDays);
  weatherDaysRef.current = weatherDays;
  const weatherFetchedAtRef = useRef(weatherFetchedAt);
  weatherFetchedAtRef.current = weatherFetchedAt;

  useEffect(() => {
    if (!ready) return;
    let timer = 0;
    const ac = new AbortController();
    let alive = true;

    const schedule = () => {
      window.clearTimeout(timer);
      if (!alive) return;
      const delay = Math.max(1_000, nextSixAMSeoul().getTime() - Date.now());
      timer = window.setTimeout(() => {
        void run();
      }, Math.min(delay, 86_400_000));
    };

    const run = async () => {
      if (!alive) return;
      if (!needsMorningWeatherFetch(weatherFetchedAtRef.current)) {
        schedule();
        return;
      }
      try {
        const pastDays = weatherDaysRef.current.length === 0 ? WEATHER_PAST_DAYS : 0;
        const days = await loadSinchonWeather(ac.signal, pastDays);
        if (!alive || ac.signal.aborted) return;
        if (days.length === 0) {
          timer = window.setTimeout(() => {
            void run();
          }, 30 * 60 * 1000);
          return;
        }
        setWeatherDays((prev) => mergeWeatherDays(prev, days, seoulISODate()));
        setWeatherFetchedAt(new Date().toISOString());
        schedule();
      } catch {
        if (!alive || ac.signal.aborted) return;
        timer = window.setTimeout(() => {
          void run();
        }, 30 * 60 * 1000);
      }
    };

    void run();
    const onWake = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      alive = false;
      ac.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [ready]);

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

  const closeAttendance = useCallback((eventId: string) => {
    let didClose = false;
    setEvents((prev) => {
      const event = prev.find((item) => item.id === eventId);
      if (!event || !isPracticeEvent(event) || event.attendanceClosedAt) return prev;
      didClose = true;
      const at = new Date().toISOString();
      return prev.map((item) => (item.id === eventId ? { ...item, attendanceClosedAt: at } : item));
    });
    return didClose;
  }, []);

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    setMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }, []);

  const addMember = useCallback((input: Omit<Member, "id" | "fineTally">) => {
    setMembers((prev) => [...prev, normalizeMember({ ...input, id: uid("m"), fineTally: emptyFineTally() })]);
  }, []);

  const removeMembers = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    const dropNoteIds = notes.filter((note) => drop.has(note.memberId)).map((note) => note.id);
    setMembers((prev) => prev.filter((member) => !drop.has(member.id)));
    setAttendance((prev) => prev.filter((row) => !drop.has(row.memberId)));
    setNotes((prev) => prev.filter((note) => !drop.has(note.memberId)));
    if (dropNoteIds.length) {
      setChartSeenByAccount((prev) => omitSeenIds(prev, new Set(dropNoteIds)));
    }
    setSelectedMemberIds((prev) => prev.filter((id) => !drop.has(id)));
    setInspectedMemberId((current) => (current && drop.has(current) ? null : current));
    setDuesOverrides((prev) => prev.filter((row) => !drop.has(row.memberId)));
  }, [notes]);

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
    setChartSeenByAccount((prev) => omitSeenIds(prev, new Set([id])));
  }, []);

  const acknowledgeChartNote = useCallback((id: string) => {
    setChartSeenByAccount((prev) => {
      const current = prev[accountId] ?? [];
      if (current.includes(id)) return prev;
      return { ...prev, [accountId]: [...current, id] };
    });
  }, [accountId]);

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

  const moveCategory = useCallback((from: number, to: number) => {
    setCategories((prev) => moveName(prev, from, to));
  }, []);

  const moveRole = useCallback((from: number, to: number) => {
    setRoles((prev) => moveName(prev, from, to));
  }, []);

  const addEventType = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEventTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeEventType = useCallback((name: string) => {
    setEventTypes((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, []);

  const addPlace = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlaces((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removePlace = useCallback((name: string) => {
    setPlaces((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, []);

  const addTxCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTxCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeTxCategory = useCallback((name: string) => {
    setTxCategories((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, []);

  const moveTxCategory = useCallback((from: number, to: number) => {
    setTxCategories((prev) => moveName(prev, from, to));
  }, []);

  const assignCategory = useCallback((ids: string[], category: string) => {
    setMembers((prev) => prev.map((member) => (ids.includes(member.id) ? { ...member, category } : member)));
  }, []);

  const addTransaction = useCallback(
    (input: Omit<Transaction, "id" | "balanceAfter"> & { balanceAfter?: number }) => {
      setTransactions((prev) => {
        const last = prev[prev.length - 1];
        const balanceAfter = input.balanceAfter ?? (last?.balanceAfter ?? 0) + input.amount;
        return [...prev, { ...input, id: uid("t"), balanceAfter, proofs: input.proofs ?? [] }].sort(compareTxAsc);
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
      return [...prev, ...next.map((row) => ({ ...row, id: uid("t"), category: "" as const, proofs: [] }))].sort(
        compareTxAsc,
      );
    });
    return fresh.length;
  }, [transactions]);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const addTransactionProof = useCallback(async (id: string, file: File) => {
    const { meta, blob } = await fileToProof(file);
    await putProofBlob(meta.id, blob);
    setTransactions((prev) =>
      prev.map((row) => (row.id === id ? { ...row, proofs: [...txProofs(row), meta] } : row)),
    );
  }, []);

  const removeTransactionProof = useCallback(async (id: string, proofId: string) => {
    await deleteProofBlob(proofId);
    setTransactions((prev) =>
      prev.map((row) => (row.id === id ? { ...row, proofs: txProofs(row).filter((item) => item.id !== proofId) } : row)),
    );
  }, []);

  const addEvent = useCallback((input: Omit<ClubEvent, "id">) => {
    const created: ClubEvent = persistableEvent({ ...input, id: uid("e") });
    if (isPracticeEvent(created) && created.date < todayISO() && !created.attendanceClosedAt) {
      created.attendanceClosedAt = new Date().toISOString();
    }
    setEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    if (input.type) setEventTypes((prev) => (prev.includes(input.type) ? prev : [...prev, input.type]));
    if (input.place) setPlaces((prev) => (prev.includes(input.place) ? prev : [...prev, input.place]));
    return created;
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<ClubEvent>) => {
    setEvents((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = persistableEvent({ ...row, ...patch });
        if (isPracticeEvent(next) && next.date < todayISO() && !next.attendanceClosedAt) {
          next.attendanceClosedAt = new Date().toISOString();
        }
        return next;
      }),
    );
    if (patch.type) setEventTypes((prev) => (prev.includes(patch.type!) ? prev : [...prev, patch.type!]));
    if (patch.place) setPlaces((prev) => (prev.includes(patch.place!) ? prev : [...prev, patch.place!]));
  }, []);

  const addEventAttachment = useCallback(async (id: string, file: File) => {
    const { meta, blob } = await fileToProof(file);
    await putProofBlob(meta.id, blob);
    setEvents((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const current = Array.isArray(row.attachments) ? row.attachments : [];
        return persistableEvent({ ...row, attachments: [...current, meta] });
      }),
    );
  }, []);

  const removeEventAttachment = useCallback(async (id: string, attachmentId: string) => {
    setEvents((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        return persistableEvent({
          ...row,
          attachments: eventAttachments(row).filter((item) => item.id !== attachmentId),
        });
      });
      const stillUsed = next.some((row) => eventAttachments(row).some((item) => item.id === attachmentId));
      if (!stillUsed) void deleteProofBlob(attachmentId);
      return next;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const doomed = prev.find((row) => row.id === id);
      const next = prev.filter((row) => row.id !== id);
      if (doomed) {
        for (const item of eventAttachments(doomed)) {
          const stillUsed = next.some((row) => eventAttachments(row).some((file) => file.id === item.id));
          if (!stillUsed) void deleteProofBlob(item.id);
        }
      }
      return next;
    });
    setAttendance((prev) => prev.filter((row) => row.eventId !== id));
  }, []);

  const openModal = useCallback((key: Exclude<ModalKey, null>, payload?: { date?: string }) => {
    setModal(key);
    setEventModalDate(key === "event" ? payload?.date ?? null : null);
  }, []);
  const closeModal = useCallback(() => {
    setModal(null);
    setEventModalDate(null);
  }, []);

  const setDuesOverride = useCallback((memberId: string, semesterStart: string, paid: boolean | null) => {
    setDuesOverrides((prev) => {
      const without = prev.filter((row) => !(row.memberId === memberId && row.semesterStart === semesterStart));
      if (paid === null) return without;
      return [...without, { memberId, semesterStart, paid }];
    });
  }, []);

  const value = useMemo<ClubContextValue>(
    () => ({
      groups: seedGroups,
      members,
      events,
      weatherDays,
      attendance,
      notes,
      transactions,
      categories,
      roles,
      eventTypes,
      places,
      txCategories,
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
      closeAttendance,
      updateMember,
      addMember,
      removeMembers,
      setPracticeDays,
      addChartNote,
      deleteChartNote,
      accountId,
      chartSeenByAccount,
      acknowledgeChartNote,
      addCategory,
      removeCategory,
      moveCategory,
      addRole,
      removeRole,
      moveRole,
      addEventType,
      removeEventType,
      addPlace,
      removePlace,
      addTxCategory,
      removeTxCategory,
      moveTxCategory,
      assignCategory,
      addTransaction,
      importBankTransactions,
      updateTransaction,
      addTransactionProof,
      removeTransactionProof,
      addEvent,
      updateEvent,
      addEventAttachment,
      removeEventAttachment,
      deleteEvent,
      toast,
      dismissToast,
      eventModalDate,
      openModal,
      closeModal,
      duesOverrides,
      setDuesOverride,
    }),
    [
      members,
      events,
      weatherDays,
      attendance,
      notes,
      transactions,
      categories,
      roles,
      eventTypes,
      places,
      txCategories,
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
      closeAttendance,
      updateMember,
      addMember,
      removeMembers,
      setPracticeDays,
      addChartNote,
      deleteChartNote,
      accountId,
      chartSeenByAccount,
      acknowledgeChartNote,
      addCategory,
      removeCategory,
      moveCategory,
      addRole,
      removeRole,
      moveRole,
      addEventType,
      removeEventType,
      addPlace,
      removePlace,
      addTxCategory,
      removeTxCategory,
      moveTxCategory,
      assignCategory,
      addTransaction,
      importBankTransactions,
      updateTransaction,
      addTransactionProof,
      removeTransactionProof,
      addEvent,
      updateEvent,
      addEventAttachment,
      removeEventAttachment,
      deleteEvent,
      toast,
      dismissToast,
      eventModalDate,
      openModal,
      closeModal,
      duesOverrides,
      setDuesOverride,
    ],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}


