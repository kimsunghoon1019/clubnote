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
  MEMBER_ROLE,
  OPERATOR_NAME,
  OPERATOR_ROLE,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  TX_CATEGORIES,
  emptyFineTally,
  normalizeAttendanceStatus,
} from "./constants";
import { closePastPracticeEvents, withFineTallies } from "./attendanceSheet";
import { collegeFromMajor, msUntilNextLocalMidnight, todayISO } from "./format";
import { isPracticeEvent } from "./stats";
import {
  attendance as seedAttendance,
  chartNotes as seedNotes,
  dropEventsBefore,
  dropPracticeEventsExcept,
  EVENTS_KEEP_FROM,
  events as seedEvents,
  migrateSaturdayPracticeHours,
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
  persistableMember,
  persistableTransaction,
  txProofs,
} from "./proof";
import { deleteProofBlob, getProofBlob, peekProofBlob, putProofBlob, setProofRemote } from "./proofDb";
import {
  authenticateMember,
  canLogin,
  defaultSessionMemberId,
  isOperatorMember,
  loadSession,
  persistSession,
} from "./session";
import type { ChartSeenByAccount, Persisted } from "./clubState";
import { asPersisted } from "./clubState";
import {
  fetchAuthSession,
  fetchClubState,
  fetchDbHealth,
  loginRemote,
  logoutRemote,
  putClubState,
} from "./remoteClient";
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

export type ToastItem = { id: string; message: string };
export type ModalKey = "sms" | "transaction" | "event" | "member-add" | null;
export type PersistStatus = "idle" | "pending" | "saving" | "saved" | "error";

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
  renameCategory: (from: string, to: string) => void;
  moveCategory: (from: number, to: number) => void;
  addRole: (name: string) => void;
  removeRole: (name: string) => void;
  renameRole: (from: string, to: string) => void;
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
  deleteEvents: (ids: string[]) => void;
  undoEventChange: () => boolean;
  toast: (message: string) => void;
  dismissToast: (id: string) => void;
  eventModalDate: string | null;
  openModal: (key: Exclude<ModalKey, null>, payload?: { date?: string }) => void;
  closeModal: () => void;
  duesOverrides: DuesOverride[];
  setDuesOverride: (memberId: string, semesterStart: string, paid: boolean | null) => void;
  sessionReady: boolean;
  sessionMemberId: string | null;
  currentMember: Member | null;
  remoteDb: boolean;
  persistStatus: PersistStatus;
  signIn: (studentId: string, pin: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const EVENT_UNDO_LIMIT = 40;

type EventUndoSnap = { events: ClubEvent[]; attendance: Attendance[] };

function cloneEventState(events: ClubEvent[]): ClubEvent[] {
  return events.map((event) =>
    persistableEvent({
      ...event,
      attachments: eventAttachments(event).map((item) => ({ ...item })),
    }),
  );
}

function cloneAttendanceState(rows: Attendance[]): Attendance[] {
  return rows.map((row) => ({ ...row }));
}

function eventAttachmentIds(events: ClubEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    for (const item of eventAttachments(event)) ids.add(item.id);
  }
  return ids;
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
  return Promise.all(
    rows.map(async (row) => {
      const proofs = txProofs(row);
      await Promise.all(
        proofs.map(async (proof, i) => {
          if (await getProofBlob(proof.id)) return;
          if (i === 0 && row.proofDataUrl) {
            try {
              await putProofBlob(proof.id, dataUrlToBlob(row.proofDataUrl));
            } catch {
              /* local cache is enough for this session */
            }
            return;
          }
          const seed = seedTransactions.find((item) => item.id === row.id);
          if (!seed?.proofDataUrl) return;
          const seedProofs = txProofs(seed);
          const seedMatch = seedProofs.find((item) => item.id === proof.id) ?? (i === 0 ? seedProofs[0] : undefined);
          if (!seedMatch) return;
          try {
            await putProofBlob(proof.id, dataUrlToBlob(seed.proofDataUrl));
          } catch {
            /* local cache is enough for this session */
          }
        }),
      );
      const { proofName: _name, proofMime: _mime, proofDataUrl: _data, ...rest } = row;
      return { ...rest, proofs };
    }),
  );
}

async function offloadMemberPhotos(members: Member[]): Promise<Member[]> {
  return Promise.all(
    members.map(async (member) => {
      const slim = persistableMember(member);
      const dataUrl = member.photoDataUrl;
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:") || !slim.photoId) return slim;
      if (peekProofBlob(slim.photoId)) return slim;
      try {
        const blob = dataUrlToBlob(dataUrl);
        await putProofBlob(slim.photoId, blob, { name: `${member.name}.jpg`, mime: blob.type || "image/jpeg" });
        return slim;
      } catch {
        return member;
      }
    }),
  );
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

function cleanNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return uniqueNames(raw.map((item) => String(item)));
}

function sameNames(list: string[] | undefined, defaults: readonly string[]) {
  return Array.isArray(list) && list.length === defaults.length && list.every((name, index) => name === defaults[index]);
}

function loadLegacyTaxonomy(): { categories: string[]; roles: string[] } | null {
  if (typeof window === "undefined") return null;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as Partial<Persisted>;
      const categories = cleanNames(data.categories);
      const roles = cleanNames(data.roles);
      if (categories.length || roles.length) return { categories, roles };
    } catch {
      /* ignore broken legacy blobs */
    }
  }
  return null;
}

function pickTaxonomy(
  stored: string[] | undefined,
  legacy: string[] | undefined,
  used: string[],
  defaults: readonly string[],
  migrated: boolean,
) {
  const current = cleanNames(stored);
  const previous = cleanNames(legacy);
  const base = (() => {
    if (migrated) return current.length ? current : [...defaults];
    if (current.length && !sameNames(current, defaults)) return current;
    if (previous.length && !sameNames(previous, defaults)) return previous;
    return current.length ? current : [...defaults];
  })();
  return uniqueNames(base, used);
}

function normalizeMember(member: Member): Member {
  const role = member.role === "회원" ? MEMBER_ROLE : member.role;
  const next: Member = {
    ...member,
    role,
    loginId: typeof member.loginId === "string" ? member.loginId : "",
    password: typeof member.password === "string" ? member.password : "",
    photoDataUrl: typeof member.photoDataUrl === "string" ? member.photoDataUrl : "",
    photoId: typeof member.photoId === "string" && member.photoId ? member.photoId : undefined,
    bio: typeof member.bio === "string" ? member.bio : "",
    active: member.active !== false,
    practiceDays: member.practiceDays ?? ["화", "목", "토"],
    college: typeof member.college === "string" ? member.college : collegeFromMajor(member.major),
    birthDate: typeof member.birthDate === "string" ? member.birthDate : "",
    joinedAt: typeof member.joinedAt === "string" ? member.joinedAt : "",
    fineTally: member.fineTally ?? emptyFineTally(),
  };
  if (isOperatorMember(next) && !canLogin(next)) next.role = OPERATOR_ROLE;
  return next;
}

function normalizeRoles(list: string[]) {
  return uniqueNames(list.map((name) => (name === "회원" ? MEMBER_ROLE : name)));
}

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return asPersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

function toPersistPayload(input: {
  members: Member[];
  events: ClubEvent[];
  attendance: Attendance[];
  notes: ChartNote[];
  transactions: Transaction[];
  categories: string[];
  roles: string[];
  eventTypes: string[];
  places: string[];
  txCategories: string[];
  chartSeenByAccount: ChartSeenByAccount;
  weatherDays: WeatherDay[];
  weatherFetchedAt: string;
  eventsClearedBefore: string;
  seedPracticesKeptDate: string;
  duesOverrides: DuesOverride[];
  stripPhotos?: boolean;
}): Persisted {
  const members = withFineTallies(input.members, input.events, input.attendance);
  return {
    members: input.stripPhotos ? members.map(persistableMember) : members,
    events: input.events.map(persistableEvent),
    attendance: input.attendance,
    notes: input.notes,
    transactions: input.transactions.map(persistableTransaction),
    categories: input.categories,
    roles: input.roles,
    eventTypes: input.eventTypes,
    places: input.places,
    txCategories: input.txCategories,
    chartSeenByAccount: input.chartSeenByAccount,
    weatherDays: input.weatherDays,
    weatherFetchedAt: input.weatherFetchedAt,
    eventsClearedBefore: input.eventsClearedBefore,
    seedPracticesKeptDate: input.seedPracticesKeptDate,
    duesOverrides: input.duesOverrides,
    legacyTaxonomyMerged: true,
    profileDatesCleared: true,
  };
}

function parsedClubSnapshot(data: Persisted, ignoreLegacy = false) {
  const attendanceRows = data.attendance.flatMap((row) => {
    const status = normalizeAttendanceStatus(String(row.status));
    if (!status) return [];
    return [{ ...row, status }];
  });
  const cutoff = data.eventsClearedBefore ?? "";
  let loaded =
    cutoff < EVENTS_KEEP_FROM
      ? dropEventsBefore(data.events, attendanceRows, EVENTS_KEEP_FROM)
      : { events: data.events, attendance: attendanceRows };
  if (data.seedPracticesKeptDate !== EVENTS_KEEP_FROM) {
    loaded = dropPracticeEventsExcept(loaded.events, loaded.attendance, EVENTS_KEEP_FROM);
  }
  const events = migrateSaturdayPracticeHours(loaded.events).map(persistableEvent);
  const legacy = ignoreLegacy || data.legacyTaxonomyMerged ? null : loadLegacyTaxonomy();
  const usedCategories = data.members.map((member) => member.category);
  const usedRoles = data.members.map((member) => member.role);
  const members = data.members.map((member) => {
    const next = normalizeMember(member);
    if (data.profileDatesCleared) return next;
    return { ...next, birthDate: "", joinedAt: "" };
  });
  return {
    events,
    attendance: loaded.attendance,
    members: withFineTallies(members, events, loaded.attendance),
    eventsClearedBefore: EVENTS_KEEP_FROM,
    seedPracticesKeptDate: EVENTS_KEEP_FROM,
    weatherDays: normalizeWeatherDays(data.weatherDays),
    weatherFetchedAt: typeof data.weatherFetchedAt === "string" ? data.weatherFetchedAt : "",
    notes: data.notes ?? [],
    categories: pickTaxonomy(
      data.categories,
      legacy?.categories,
      usedCategories,
      DEFAULT_CATEGORIES,
      Boolean(data.legacyTaxonomyMerged),
    ),
    roles: normalizeRoles(
      pickTaxonomy(data.roles, legacy?.roles, usedRoles, DEFAULT_ROLES, Boolean(data.legacyTaxonomyMerged)),
    ),
    eventTypes: uniqueNames(EVENT_TYPES, data.eventTypes ?? [], (data.events ?? []).map((event) => event.type)),
    places: uniqueNames(DEFAULT_PLACES, data.places ?? [], (data.events ?? []).map((event) => event.place)),
    txCategories: uniqueNames(
      data.txCategories?.length ? data.txCategories : TX_CATEGORIES,
      (data.transactions ?? []).map((row) => row.category),
    ),
    chartSeenByAccount: normalizeChartSeen(data.chartSeenByAccount),
    duesOverrides: normalizeDuesOverrides(data.duesOverrides),
    transactions: data.transactions ?? [],
  };
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [events, setEvents] = useState<ClubEvent[]>(seedEvents);
  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>([]);
  const [weatherFetchedAt, setWeatherFetchedAt] = useState("");
  const [eventsClearedBefore, setEventsClearedBefore] = useState(EVENTS_KEEP_FROM);
  const [seedPracticesKeptDate, setSeedPracticesKeptDate] = useState(EVENTS_KEEP_FROM);
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
  const [sessionMemberId, setSessionMemberId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [remoteDb, setRemoteDb] = useState(false);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>("idle");
  const sessionMemberIdRef = useRef(sessionMemberId);
  sessionMemberIdRef.current = sessionMemberId;
  const eventsRef = useRef(events);
  const membersRef = useRef(members);
  membersRef.current = members;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const rolesRef = useRef(roles);
  rolesRef.current = roles;
  const attendanceRef = useRef(attendance);
  eventsRef.current = events;
  attendanceRef.current = attendance;
  const eventUndoRef = useRef<EventUndoSnap[]>([]);
  const orphanEventBlobsRef = useRef<Set<string>>(new Set());
  const remoteDbRef = useRef(false);
  const stateVersionRef = useRef(0);
  const silencePersistRef = useRef(true);
  const persistTimerRef = useRef(0);
  const persistPayloadRef = useRef<Persisted | null>(null);
  const persistInFlightRef = useRef(false);
  const persistQueuedRef = useRef(false);
  const persistDirtyRef = useRef(false);
  const persistRetryRef = useRef(0);
  const lastPushedJsonRef = useRef("");
  const persistFlushRef = useRef<() => void>(() => {});

  const sweepOrphanEventBlobs = (live: ClubEvent[]) => {
    const used = eventAttachmentIds(live);
    for (const snap of eventUndoRef.current) {
      for (const id of eventAttachmentIds(snap.events)) used.add(id);
    }
    for (const id of [...orphanEventBlobsRef.current]) {
      if (used.has(id)) continue;
      orphanEventBlobsRef.current.delete(id);
      void deleteProofBlob(id);
    }
  };

  const pushEventUndo = () => {
    eventUndoRef.current.push({
      events: cloneEventState(eventsRef.current),
      attendance: cloneAttendanceState(attendanceRef.current),
    });
    if (eventUndoRef.current.length > EVENT_UNDO_LIMIT) {
      eventUndoRef.current.shift();
      sweepOrphanEventBlobs(eventsRef.current);
    }
  };

  const undoEventChange = useCallback(() => {
    const snap = eventUndoRef.current.pop();
    if (!snap) return false;
    setEvents(snap.events);
    setAttendance(snap.attendance);
    sweepOrphanEventBlobs(snap.events);
    return true;
  }, []);

  const applySnapshot = useCallback(async (data: Persisted) => {
    const snap = parsedClubSnapshot(data, remoteDbRef.current);
    const txs = await hydrateTransactionProofs(snap.transactions.length ? snap.transactions : seedTransactions);
    setEvents(snap.events);
    setAttendance(snap.attendance);
    setMembers(snap.members);
    setEventsClearedBefore(snap.eventsClearedBefore);
    setSeedPracticesKeptDate(snap.seedPracticesKeptDate);
    setWeatherDays(snap.weatherDays);
    setWeatherFetchedAt(snap.weatherFetchedAt);
    setNotes(snap.notes);
    setCategories(snap.categories);
    setRoles(snap.roles);
    setEventTypes(snap.eventTypes);
    setPlaces(snap.places);
    setTxCategories(snap.txCategories);
    setChartSeenByAccount(snap.chartSeenByAccount);
    setDuesOverrides(snap.duesOverrides);
    setTransactions((prev) => mergeProofsDuringHydrate(prev, txs));
    const pushed = toPersistPayload({
      members: snap.members,
      events: snap.events,
      attendance: snap.attendance,
      notes: snap.notes,
      transactions: txs,
      categories: snap.categories,
      roles: snap.roles,
      eventTypes: snap.eventTypes,
      places: snap.places,
      txCategories: snap.txCategories,
      chartSeenByAccount: snap.chartSeenByAccount,
      weatherDays: snap.weatherDays,
      weatherFetchedAt: snap.weatherFetchedAt,
      eventsClearedBefore: snap.eventsClearedBefore,
      seedPracticesKeptDate: snap.seedPracticesKeptDate,
      duesOverrides: snap.duesOverrides,
      stripPhotos: remoteDbRef.current,
    });
    const hadEmbeddedPhotos = data.members.some(
      (member) => typeof member.photoDataUrl === "string" && member.photoDataUrl.startsWith("data:"),
    );
    lastPushedJsonRef.current = hadEmbeddedPhotos ? "" : JSON.stringify(pushed);
    persistDirtyRef.current = hadEmbeddedPhotos;
    persistRetryRef.current = 0;
    if (remoteDbRef.current) setPersistStatus(hadEmbeddedPhotos ? "pending" : "saved");
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const health = await fetchDbHealth();
      const remote = health.remote && health.ready;
      if (!alive) return;
      remoteDbRef.current = remote;
      setRemoteDb(remote);
      setProofRemote(remote);

      if (remote) {
        const session = await fetchAuthSession();
        if (!alive) return;
        if (session?.memberId) {
          persistSession({ status: "in", memberId: session.memberId });
          setSessionMemberId(session.memberId);
          setAccountId(session.memberId);
          const row = await fetchClubState();
          if (!alive) return;
          if (row?.payload) {
            stateVersionRef.current = row.version;
            await applySnapshot(row.payload);
          }
        } else {
          persistSession({ status: "out" });
          setSessionMemberId(null);
          setAccountId(LOCAL_ACCOUNT_ID);
        }
        if (health.error) {
          /* schema ping already failed into ready=false; this branch is remote+ready */
        }
        silencePersistRef.current = false;
        setReady(true);
        setSessionReady(true);
        return;
      }

      if (health.remote && !health.ready) {
        console.warn("클럽노트 DB 테이블이 없어요. supabase/schema.sql을 실행해 주세요.", health.error);
      }

      const data = loadPersisted();
      if (!alive) return;
      if (data) {
        await applySnapshot(data);
      } else {
        const txs = await hydrateTransactionProofs(seedTransactions);
        if (!alive) return;
        const legacy = loadLegacyTaxonomy();
        if (legacy) {
          setCategories(
            pickTaxonomy(
              undefined,
              legacy.categories,
              seedMembers.map((member) => member.category),
              DEFAULT_CATEGORIES,
              false,
            ),
          );
          setRoles(
            normalizeRoles(
              pickTaxonomy(
                undefined,
                legacy.roles,
                seedMembers.map((member) => member.role),
                DEFAULT_ROLES,
                false,
              ),
            ),
          );
        }
        setTransactions((prev) => mergeProofsDuringHydrate(prev, txs));
      }
      const stored = loadSession();
      if (stored?.status === "out") {
        setSessionMemberId(null);
      } else if (stored?.status === "in") {
        setSessionMemberId(stored.memberId);
        setAccountId(stored.memberId);
      } else {
        const fallback = defaultSessionMemberId(membersRef.current);
        setSessionMemberId(fallback);
        if (fallback) {
          persistSession({ status: "in", memberId: fallback });
          setAccountId(fallback);
        }
      }
      silencePersistRef.current = false;
      setReady(true);
      setSessionReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [applySnapshot]);

  useEffect(() => {
    if (!ready || !sessionReady) return;
    if (remoteDb) {
      if (!sessionMemberId) return;
      const member = members.find((item) => item.id === sessionMemberId);
      if (member && canLogin(member)) return;
      persistSession({ status: "out" });
      setSessionMemberId(null);
      void logoutRemote();
      return;
    }
    if (!sessionMemberId) return;
    const member = members.find((item) => item.id === sessionMemberId);
    if (member && canLogin(member)) return;
    if (member && !canLogin(member)) {
      persistSession({ status: "out" });
      setSessionMemberId(null);
      return;
    }
    const fallback = defaultSessionMemberId(members);
    if (fallback) {
      persistSession({ status: "in", memberId: fallback });
      setSessionMemberId(fallback);
      return;
    }
    persistSession({ status: "out" });
    setSessionMemberId(null);
  }, [ready, sessionReady, sessionMemberId, members, remoteDb]);

  persistFlushRef.current = () => {
    if (!remoteDbRef.current || !sessionMemberIdRef.current) return;
    if (silencePersistRef.current) return;
    if (persistInFlightRef.current) {
      persistQueuedRef.current = true;
      return;
    }
    const snapshot = persistPayloadRef.current;
    if (!snapshot) return;
    persistInFlightRef.current = true;
    persistQueuedRef.current = false;
    setPersistStatus("saving");

    void (async () => {
      let payload = snapshot;
      try {
        payload = { ...snapshot, members: await offloadMemberPhotos(snapshot.members) };
      } catch {
        payload = { ...snapshot, members: snapshot.members.map(persistableMember) };
      }
      let json: string;
      try {
        json = JSON.stringify(payload);
      } catch {
        setPersistStatus("error");
        return;
      }
      if (json === lastPushedJsonRef.current) {
        persistDirtyRef.current = false;
        persistRetryRef.current = 0;
        setPersistStatus("saved");
        return;
      }
      const result = await putClubState(payload, stateVersionRef.current);
      if (result.ok) {
        stateVersionRef.current = result.version;
        lastPushedJsonRef.current = json;
        persistRetryRef.current = 0;
        const latest = persistPayloadRef.current;
        persistDirtyRef.current = Boolean(
          latest && JSON.stringify({
            ...latest,
            members: latest.members.map(persistableMember),
          }) !== json,
        );
        setPersistStatus(persistDirtyRef.current ? "pending" : "saved");
        if (payload.members.some((member) => member.photoId)) {
          setMembers((prev) =>
            prev.map((member) => {
              const saved = payload.members.find((row) => row.id === member.id);
              if (!saved?.photoId) return member;
              if (member.photoDataUrl?.startsWith("data:")) {
                return { ...member, photoId: saved.photoId, photoDataUrl: "" };
              }
              return member.photoId === saved.photoId ? member : { ...member, photoId: saved.photoId };
            }),
          );
        }
        return;
      }
      if (result.conflict && result.payload) {
        stateVersionRef.current = result.version;
        persistRetryRef.current += 1;
        if (persistRetryRef.current > 5) {
          persistRetryRef.current = 0;
          persistQueuedRef.current = false;
          persistDirtyRef.current = false;
          silencePersistRef.current = true;
          void applySnapshot(result.payload).finally(() => {
            silencePersistRef.current = false;
          });
          const id = uid("toast");
          setToasts((prev) => [...prev, { id, message: "다른 기기에서 먼저 저장해서 최신으로 맞췄어요." }]);
          window.setTimeout(() => {
            setToasts((prev) => prev.filter((item) => item.id !== id));
          }, 2400);
          setPersistStatus("saved");
          return;
        }
        persistQueuedRef.current = true;
        return;
      }
      persistRetryRef.current += 1;
      persistQueuedRef.current = persistRetryRef.current <= 8;
      setPersistStatus("error");
      if (persistQueuedRef.current) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, Math.min(800 * persistRetryRef.current, 6000));
        });
      }
    })().finally(() => {
      persistInFlightRef.current = false;
      if (persistQueuedRef.current) {
        persistQueuedRef.current = false;
        persistFlushRef.current();
      }
    });
  };

  useEffect(() => {
    if (!ready || silencePersistRef.current) return;
    const payload = toPersistPayload({
      members,
      events,
      attendance,
      notes,
      transactions,
      categories,
      roles,
      eventTypes,
      places,
      txCategories,
      chartSeenByAccount,
      weatherDays,
      weatherFetchedAt,
      eventsClearedBefore,
      seedPracticesKeptDate,
      duesOverrides,
      stripPhotos: false,
    });
    persistPayloadRef.current = payload;
    if (!remoteDbRef.current) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* quota: keep in-memory state */
      }
      return;
    }
    if (!sessionMemberId) return;
    let json = "";
    try {
      json = JSON.stringify({ ...payload, members: payload.members.map(persistableMember) });
    } catch {
      return;
    }
    persistDirtyRef.current = json !== lastPushedJsonRef.current;
    if (!persistDirtyRef.current) {
      if (!persistInFlightRef.current) setPersistStatus("saved");
      return;
    }
    setPersistStatus((status) => (status === "saving" ? status : "pending"));
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistFlushRef.current();
    }, 280);
    return () => window.clearTimeout(persistTimerRef.current);
  }, [ready, members, events, attendance, notes, transactions, categories, roles, eventTypes, places, txCategories, chartSeenByAccount, weatherDays, weatherFetchedAt, eventsClearedBefore, seedPracticesKeptDate, duesOverrides, sessionMemberId]);

  useEffect(() => {
    if (!remoteDb || !ready || !sessionMemberId) return;
    const flushIfDirty = () => {
      if (persistDirtyRef.current || persistQueuedRef.current) persistFlushRef.current();
    };
    const onWake = () => {
      if (document.visibilityState === "hidden") {
        flushIfDirty();
        return;
      }
      if (persistInFlightRef.current || persistQueuedRef.current || persistDirtyRef.current) return;
      void fetchClubState().then((row) => {
        if (!row?.payload) return;
        if (row.version <= stateVersionRef.current) return;
        if (persistInFlightRef.current || persistQueuedRef.current || persistDirtyRef.current) return;
        stateVersionRef.current = row.version;
        silencePersistRef.current = true;
        void applySnapshot(row.payload).finally(() => {
          silencePersistRef.current = false;
        });
      });
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!persistDirtyRef.current && !persistInFlightRef.current) return;
      flushIfDirty();
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pagehide", flushIfDirty);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pagehide", flushIfDirty);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [remoteDb, ready, sessionMemberId, applySnapshot]);

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
    const author =
      membersRef.current.find((item) => item.id === sessionMemberIdRef.current)?.name.trim() || OPERATOR_NAME;
    setNotes((prev) => [
      {
        id: uid("note"),
        memberId,
        body: trimmed,
        createdAt: new Date().toISOString(),
        author,
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
    if (membersRef.current.some((member) => member.category === name)) {
      toast("이 분류를 쓰는 회원이 있어요. 이름을 바꾸거나 먼저 다른 분류로 옮기세요.");
      return;
    }
    setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, [toast]);

  const renameCategory = useCallback((from: string, to: string) => {
    const trimmed = to.trim();
    if (!trimmed || trimmed === from) return;
    if (categoriesRef.current.includes(trimmed)) {
      toast("이미 있는 분류예요");
      return;
    }
    if (!categoriesRef.current.includes(from)) return;
    setCategories((prev) => prev.map((item) => (item === from ? trimmed : item)));
    setMembers((prev) => prev.map((member) => (member.category === from ? { ...member, category: trimmed } : member)));
  }, [toast]);

  const addRole = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRoles((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeRole = useCallback((name: string) => {
    if (membersRef.current.some((member) => member.role === name)) {
      toast("이 직책을 쓰는 회원이 있어요. 이름을 바꾸거나 먼저 다른 직책으로 옮기세요.");
      return;
    }
    setRoles((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item !== name)));
  }, [toast]);

  const renameRole = useCallback((from: string, to: string) => {
    const trimmed = to.trim();
    if (!trimmed || trimmed === from) return;
    if (rolesRef.current.includes(trimmed)) {
      toast("이미 있는 직책이에요");
      return;
    }
    if (!rolesRef.current.includes(from)) return;
    setRoles((prev) => prev.map((item) => (item === from ? trimmed : item)));
    setMembers((prev) => prev.map((member) => (member.role === from ? { ...member, role: trimmed } : member)));
  }, [toast]);

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
    await putProofBlob(meta.id, blob, { name: meta.name, mime: meta.mime });
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
    pushEventUndo();
    setEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    if (input.type) setEventTypes((prev) => (prev.includes(input.type) ? prev : [...prev, input.type]));
    if (input.place) setPlaces((prev) => (prev.includes(input.place) ? prev : [...prev, input.place]));
    return created;
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<ClubEvent>) => {
    if (!eventsRef.current.some((row) => row.id === id)) return;
    pushEventUndo();
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
    await putProofBlob(meta.id, blob, { name: meta.name, mime: meta.mime });
    pushEventUndo();
    orphanEventBlobsRef.current.add(meta.id);
    setEvents((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const current = Array.isArray(row.attachments) ? row.attachments : [];
        return persistableEvent({ ...row, attachments: [...current, meta] });
      }),
    );
  }, []);

  const removeEventAttachment = useCallback(async (id: string, attachmentId: string) => {
    pushEventUndo();
    setEvents((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        return persistableEvent({
          ...row,
          attachments: eventAttachments(row).filter((item) => item.id !== attachmentId),
        });
      });
      const stillUsed = next.some((row) => eventAttachments(row).some((item) => item.id === attachmentId));
      if (!stillUsed) orphanEventBlobsRef.current.add(attachmentId);
      sweepOrphanEventBlobs(next);
      return next;
    });
  }, []);

  const deleteEvents = useCallback((ids: string[]) => {
    const doomed = new Set(ids.filter((id) => eventsRef.current.some((row) => row.id === id)));
    if (doomed.size === 0) return;
    pushEventUndo();
    setEvents((prev) => {
      const next = prev.filter((row) => !doomed.has(row.id));
      for (const row of prev) {
        if (!doomed.has(row.id)) continue;
        for (const item of eventAttachments(row)) {
          const stillUsed = next.some((live) => eventAttachments(live).some((file) => file.id === item.id));
          if (!stillUsed) orphanEventBlobsRef.current.add(item.id);
        }
      }
      sweepOrphanEventBlobs(next);
      return next;
    });
    setAttendance((prev) => prev.filter((row) => !doomed.has(row.eventId)));
  }, []);

  const deleteEvent = useCallback(
    (id: string) => {
      deleteEvents([id]);
    },
    [deleteEvents],
  );

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

  const signIn = useCallback(async (studentId: string, pin: string) => {
    const health = await fetchDbHealth();
    const remote = health.remote && health.ready;
    remoteDbRef.current = remote;
    setRemoteDb(remote);
    setProofRemote(remote);
    if (remote) {
      const result = await loginRemote(studentId, pin);
      if (!result.ok) return result;
      persistSession({ status: "in", memberId: result.memberId });
      setSessionMemberId(result.memberId);
      setAccountId(result.memberId);
      silencePersistRef.current = true;
      try {
        if (result.bootstrapped) {
          const local = loadPersisted();
          if (local) {
            const put = await putClubState(local, result.version);
            if (put.ok) {
              stateVersionRef.current = put.version;
              await applySnapshot(local);
              return { ok: true as const };
            }
            if (put.conflict && put.payload) {
              stateVersionRef.current = put.version;
              await applySnapshot(put.payload);
              return { ok: true as const };
            }
          }
        }
        const row = await fetchClubState();
        if (row?.payload) {
          stateVersionRef.current = row.version;
          await applySnapshot(row.payload);
        }
      } finally {
        silencePersistRef.current = false;
      }
      return { ok: true as const };
    }
    const result = authenticateMember(membersRef.current, studentId, pin);
    if (!result.ok) return result;
    persistSession({ status: "in", memberId: result.member.id });
    setSessionMemberId(result.member.id);
    setAccountId(result.member.id);
    return { ok: true as const };
  }, [applySnapshot]);

  const signOut = useCallback(() => {
    persistSession({ status: "out" });
    setSessionMemberId(null);
    setAccountId(LOCAL_ACCOUNT_ID);
    if (remoteDbRef.current) void logoutRemote();
  }, []);

  const currentMember = useMemo(
    () => members.find((member) => member.id === sessionMemberId) ?? null,
    [members, sessionMemberId],
  );

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
      renameCategory,
      moveCategory,
      addRole,
      removeRole,
      renameRole,
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
      deleteEvents,
      undoEventChange,
      toast,
      dismissToast,
      eventModalDate,
      openModal,
      closeModal,
      duesOverrides,
      setDuesOverride,
      sessionReady,
      sessionMemberId,
      currentMember,
      remoteDb,
      persistStatus,
      signIn,
      signOut,
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
      renameCategory,
      moveCategory,
      addRole,
      removeRole,
      renameRole,
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
      deleteEvents,
      undoEventChange,
      toast,
      dismissToast,
      eventModalDate,
      openModal,
      closeModal,
      duesOverrides,
      setDuesOverride,
      sessionReady,
      sessionMemberId,
      currentMember,
      remoteDb,
      persistStatus,
      signIn,
      signOut,
    ],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}


