import {
  DEFAULT_CATEGORIES,
  DEFAULT_PLACES,
  DEFAULT_ROLES,
  EVENT_TYPES,
  TX_CATEGORIES,
} from "./constants";
import { persistableEvent, persistableTransaction } from "./proof";
import {
  attendance as seedAttendance,
  chartNotes as seedNotes,
  EVENTS_KEEP_FROM,
  events as seedEvents,
  members as seedMembers,
  transactions as seedTransactions,
} from "./seed";
import type {
  Attendance,
  ChartNote,
  ClubEvent,
  DuesOverride,
  Member,
  Transaction,
} from "./types";
import type { WeatherDay } from "./weather";

export type ChartSeenByAccount = Record<string, string[]>;

export type Persisted = {
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
  /** 시드 연습 일정을 이 날짜만 남기고 걷어낸 뒤 기록. */
  seedPracticesKeptDate?: string;
  duesOverrides?: DuesOverride[];
  legacyTaxonomyMerged?: boolean;
  /** 시드에 넣었던 생년월일·가입일을 한 번 비운 뒤 true. */
  profileDatesCleared?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isPersisted(value: unknown): value is Persisted {
  if (!isObject(value)) return false;
  return Array.isArray(value.members) && Array.isArray(value.events) && Array.isArray(value.attendance);
}

export function seedPersisted(): Persisted {
  return {
    members: seedMembers,
    events: seedEvents.map(persistableEvent),
    attendance: seedAttendance,
    notes: seedNotes,
    transactions: seedTransactions.map(persistableTransaction),
    categories: [...DEFAULT_CATEGORIES],
    roles: [...DEFAULT_ROLES],
    eventTypes: [...EVENT_TYPES],
    places: [...DEFAULT_PLACES],
    txCategories: [...TX_CATEGORIES],
    chartSeenByAccount: {},
    weatherDays: [],
    weatherFetchedAt: "",
    eventsClearedBefore: EVENTS_KEEP_FROM,
    seedPracticesKeptDate: EVENTS_KEEP_FROM,
    duesOverrides: [],
    legacyTaxonomyMerged: true,
    profileDatesCleared: true,
  };
}

export function asPersisted(value: unknown): Persisted | null {
  return isPersisted(value) ? value : null;
}
