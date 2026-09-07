import { asPersisted, seedPersisted, type Persisted } from "@/lib/clubState";
import { createAdminClient, hasRemoteDb } from "@/lib/supabase/admin";

const STATE_ID = "default";

export type ClubStateRow = { payload: Persisted; version: number };

export function remoteDbConfigured() {
  return hasRemoteDb();
}

export async function pingClubDb() {
  const admin = createAdminClient();
  if (!admin) return { remote: false as const, ready: false as const };
  const { error } = await admin.from("club_state").select("id").eq("id", STATE_ID).maybeSingle();
  if (error) return { remote: true as const, ready: false as const, error: error.message };
  return { remote: true as const, ready: true as const };
}

export async function readClubState(): Promise<ClubStateRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("club_state")
    .select("payload, version")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error || !data) return null;
  const payload = asPersisted(data.payload);
  if (!payload) return Number(data.version) === 0 ? null : null;
  if (Number(data.version) === 0) return null;
  return { payload, version: Number(data.version) || 1 };
}

export async function insertClubState(payload: Persisted): Promise<ClubStateRow> {
  const admin = createAdminClient();
  if (!admin) throw new Error("원격 DB가 설정되지 않았어요");
  const { error } = await admin.from("club_state").upsert(
    { id: STATE_ID, payload, version: 1, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return { payload, version: 1 };
}

export async function writeClubState(payload: Persisted, expectedVersion: number): Promise<ClubStateRow | { conflict: ClubStateRow }> {
  const admin = createAdminClient();
  if (!admin) throw new Error("원격 DB가 설정되지 않았어요");
  const nextVersion = expectedVersion + 1;
  const { data, error } = await admin
    .from("club_state")
    .update({ payload, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", STATE_ID)
    .eq("version", expectedVersion)
    .select("payload, version")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const saved = asPersisted(data.payload) ?? payload;
    return { payload: saved, version: Number(data.version) || nextVersion };
  }
  const current = await readClubState();
  if (!current) {
    return insertClubState(payload);
  }
  return { conflict: current };
}

export async function ensureClubState(): Promise<ClubStateRow> {
  const existing = await readClubState();
  if (existing) return existing;
  return insertClubState(seedPersisted());
}
