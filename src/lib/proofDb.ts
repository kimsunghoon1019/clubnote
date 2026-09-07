const DB_NAME = "clubnote-proofs-v1";
const STORE = "files";
const VERSION = 1;

const memory = new Map<string, Blob>();
const listeners = new Set<() => void>();

let dbPromise: Promise<IDBDatabase> | null = null;
let remoteFiles = false;

export function setProofRemote(enabled: boolean) {
  remoteFiles = enabled;
}

function notifyProofStore() {
  for (const listener of listeners) listener();
}

export function peekProofBlob(id: string) {
  return memory.get(id);
}

export function subscribeProofStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function openProofDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB를 쓸 수 없어요"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("증빙 DB를 열지 못했어요"));
      };
    });
  }
  return dbPromise;
}

export async function putProofBlob(id: string, blob: Blob, meta?: { name?: string; mime?: string }) {
  memory.set(id, blob);
  notifyProofStore();
  try {
    const db = await openProofDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(blob, id);
    });
  } catch {
    /* keep the file in memory for this session */
  }
  if (remoteFiles) {
    try {
      const { putClubFile } = await import("./remoteClient");
      await putClubFile(id, blob, meta?.name || id, meta?.mime || blob.type || "application/octet-stream");
    } catch {
      /* metadata is in club_state; retry on next get */
    }
  }
}

export async function getProofBlob(id: string): Promise<Blob | undefined> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const db = await openProofDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? undefined);
      req.onerror = () => reject(req.error);
    });
    if (blob) {
      memory.set(id, blob);
      return blob;
    }
  } catch {
    /* fall through to remote */
  }
  if (remoteFiles) {
    try {
      const { getClubFile } = await import("./remoteClient");
      const remote = await getClubFile(id);
      if (remote) {
        memory.set(id, remote);
        notifyProofStore();
        try {
          const db = await openProofDb();
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.objectStore(STORE).put(remote, id);
          });
        } catch {
          /* memory cache is enough */
        }
        return remote;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function deleteProofBlob(id: string) {
  memory.delete(id);
  notifyProofStore();
  try {
    const db = await openProofDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(id);
    });
  } catch {
    /* metadata removal still proceeds */
  }
  if (remoteFiles) {
    try {
      const { deleteClubFile } = await import("./remoteClient");
      await deleteClubFile(id);
    } catch {
      /* metadata removal still proceeds */
    }
  }
}
