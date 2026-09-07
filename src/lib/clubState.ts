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
  duesOverrides?: DuesOverride[];
  legacyTaxonomyMerged?: boolean;
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
    duesOverrides: [],
    legacyTaxonomyMerged: true,
  };
}

export function asPersisted(value: unknown): Persisted | null {
  return isPersisted(value) ? value : null;
}
