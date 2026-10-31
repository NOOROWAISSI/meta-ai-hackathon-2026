import { DEFAULT_PROFILE, DEMO_HACKATHONS } from "../discover/demo-data";
import type { UserProfile } from "../discover/types";
import { buildEventDetails } from "../details/records";
import { analysisContext } from "../details/logic";
import type { Plan, Opportunity, PreparationTask } from "../contract/types";
import {
  assessmentContext,
  emptySubmission,
  toOpportunity,
  toStudentProfile,
} from "../preparation/adapters";
import { budgetFor, validatePlan } from "../preparation/logic";

export const STORAGE_SCHEMA_VERSION = 1;
const DB_NAME = "nextstep-browser";
let connection: Promise<IDBDatabase> | undefined;
let initialized: Promise<void> | undefined;
let channel: BroadcastChannel | undefined;
const listeners = new Set<() => void>();
export function notifyStore() {
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") window.dispatchEvent(new Event("nextstep:storage"));
  if (typeof BroadcastChannel !== "undefined") {
    channel ??= createChannel();
    channel.postMessage("changed");
  }
}
function createChannel() {
  const value = new BroadcastChannel("nextstep-store");
  value.onmessage = () => {
    listeners.forEach((listener) => listener());
    if (typeof window !== "undefined") window.dispatchEvent(new Event("nextstep:storage"));
  };
  return value;
}
export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  if (typeof BroadcastChannel !== "undefined") channel ??= createChannel();
  return () => {
    listeners.delete(listener);
  };
}
export function openDatabase(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Browser storage is unavailable. Enable IndexedDB or use another browser. Your existing data has not been changed.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DB_NAME, STORAGE_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("records"))
        request.result.createObjectStore("records");
    };
    request.onerror = () => {
      connection = undefined;
      reject(new Error("Browser storage could not be opened. Existing data is preserved."));
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error("Close other NextStep tabs and retry opening browser storage."));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
        initialized = undefined;
      };
      resolve(db);
    };
  });
  return connection;
}
export async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, finish: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("records", mode);
    const store = tx.objectStore("records");
    let value: T;
    let failure: Error | undefined;
    const fail = (error: Error) => {
      failure = error;
      try {
        tx.abort();
      } catch {
        reject(error);
      }
    };
    tx.oncomplete = () => {
      if (mode === "readwrite") notifyStore();
      resolve(value);
    };
    tx.onerror = () => {
      failure ??= new Error(
        "Browser storage write failed. The previous confirmed data is unchanged.",
      );
    };
    tx.onabort = () =>
      reject(
        failure ??
          new Error("Browser storage transaction failed. Your last confirmed data is unchanged."),
      );
    try {
      work(
        store,
        (result) => {
          value = result;
        },
        fail,
      );
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Browser storage failed."));
    }
  });
}
export function getInTransaction<T>(
  store: IDBObjectStore,
  key: string,
  callback: (value: T | undefined) => void,
  fail: (error: Error) => void,
) {
  const request = store.get(key);
  request.onsuccess = () => {
    try {
      callback(request.result as T | undefined);
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Stored data is invalid."));
    }
  };
}
export async function initializeStore(): Promise<void> {
  initialized ??= initialize().catch((error) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}
async function initialize() {
  const ready = await transaction<boolean>("readonly", (store, finish, fail) =>
    getInTransaction<{ schemaVersion: number }>(
      store,
      "meta",
      (meta) => {
        if (meta && meta.schemaVersion !== STORAGE_SCHEMA_VERSION)
          throw new Error(
            "Storage schema is unsupported. Export your data or reset it in Storage & recovery.",
          );
        finish(!!meta);
      },
      fail,
    ),
  );
  if (ready) return;
  const legacy = new Map<string, unknown>();
  if (typeof localStorage !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === "nextstep.profile" || key === "nextstep.saved" || key.startsWith("nextstep.plan."))
      ) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            legacy.set(key, JSON.parse(raw));
          } catch {
            legacy.set(key, raw);
          }
        }
      }
    }
  }
  const candidate = legacy.get("nextstep.profile") as UserProfile | undefined;
  const validProfile =
    !!candidate &&
    Array.isArray(candidate.interests) &&
    candidate.interests.every((v) => typeof v === "string") &&
    Array.isArray(candidate.skills) &&
    candidate.skills.every((v) => typeof v === "string") &&
    (candidate.weeklyHours === null ||
      (typeof candidate.weeklyHours === "number" && Number.isFinite(candidate.weeklyHours)));
  const editor = validProfile ? candidate : structuredClone(DEFAULT_PROFILE);
  const profile = toStudentProfile(editor);
  await transaction<void>("readwrite", (store, finish, fail) =>
    getInTransaction(
      store,
      "meta",
      (meta) => {
        if (meta) {
          finish();
          return;
        }
        const recovery: string[] = [];
        store.put(editor, "nextstep.profile");
        const saved = legacy.get("nextstep.saved");
        store.put(
          Array.isArray(saved) ? saved.filter((v) => typeof v === "string") : [],
          "nextstep.saved",
        );
        for (const [key, raw] of legacy) {
          store.put(raw, `legacy-backup:${key}`);
          if (key === "nextstep.profile" && !validProfile) recovery.push(key);
        }
        for (const event of DEMO_HACKATHONS) {
          const details = buildEventDetails(event.id)!;
          const opportunity = toOpportunity(details);
          const submission = emptySubmission(event.id);
          store.put(opportunity, `opportunity:${event.id}`);
          store.put(submission, `submission:${event.id}`);
          const old = legacy.get(`nextstep.plan.${event.id}`) as
            | {
                eventId?: string;
                context?: string;
                createdAt?: string;
                weeklyHours?: number;
                tasks?: Array<{
                  id: string;
                  title: string;
                  deliverable: string;
                  completionCriteria: string;
                  hours: number;
                  status: PreparationTask["status"];
                  artifactUrls?: string[];
                }>;
              }
            | undefined;
          if (!old) continue;
          try {
            if (
              old.eventId !== event.id ||
              !Array.isArray(old.tasks) ||
              old.tasks.some(
                (t) =>
                  !t.id ||
                  !t.title ||
                  !Number.isFinite(t.hours) ||
                  t.hours < 0 ||
                  !["not_started", "in_progress", "done"].includes(t.status),
              )
            )
              throw new Error();
            const goals = old.tasks.map((t) => ({ id: `legacy-goal-${t.id}`, statement: t.title }));
            const tasks: PreparationTask[] = old.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              target: { kind: "goal", goalId: `legacy-goal-${t.id}` },
              priority: "should",
              deliverable: t.deliverable,
              completionCriteria: t.completionCriteria,
              estimatedHours: t.hours,
              remainingEstimatedHours: t.status === "done" ? 0 : t.hours,
              status: t.status,
              resourceIds: [],
              artifactUrls: t.artifactUrls ?? [],
            }));
            const context = assessmentContext(opportunity, profile, submission);
            if (old.context !== analysisContext(details, editor))
              context.sourceRevision = `legacy-unconfirmed:${context.sourceRevision}`;
            const plan: Plan = {
              id: `legacy-plan-${event.id}`,
              version: 1,
              context,
              goals,
              tasks,
              taskOrder: tasks.map((t) => t.id),
              ...budgetFor(
                tasks,
                typeof old.weeklyHours === "number" && Number.isFinite(old.weeklyHours)
                  ? old.weeklyHours
                  : null,
                null,
              ),
              warnings: [
                "Imported from your previous confirmed demo plan. Completed work is preserved; source details remain unverified.",
              ],
            };
            if (!validatePlan(plan)) throw new Error();
            store.put(plan, `plan:${event.id}`);
            store.put(
              {
                createdAt: old.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              `plan-meta:${plan.id}`,
            );
            store.put(
              { planId: plan.id, confirmedPlanVersion: 1, saveState: "confirmed" },
              `progress:${plan.id}`,
            );
          } catch {
            recovery.push(`nextstep.plan.${event.id}`);
          }
        }
        store.put(
          {
            schemaVersion: STORAGE_SCHEMA_VERSION,
            initializedAt: new Date().toISOString(),
            recovery,
          },
          "meta",
        );
        finish();
      },
      fail,
    ),
  );
  // Cleanup only after a successful atomic import. Backups remain in IndexedDB for export.
  for (const key of legacy.keys()) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Ignored, non-authoritative legacy backup. */
    }
  }
}
export async function readRecord<T>(key: string, initial: T): Promise<T> {
  await initializeStore();
  return transaction<T>("readonly", (store, finish, fail) =>
    getInTransaction<T>(store, key, (value) => finish(value ?? initial), fail),
  );
}
export async function updateRecord<T>(
  key: string,
  initial: T,
  update: (current: T) => T,
): Promise<T> {
  await initializeStore();
  return transaction<T>("readwrite", (store, finish, fail) =>
    getInTransaction<T>(
      store,
      key,
      (current) => {
        const next = update(current ?? initial);
        store.put(next, key);
        if (key === "nextstep.saved" && Array.isArray(next)) {
          getInTransaction<Record<string, string>>(
            store,
            "nextstep.savedAt",
            (previous) => {
              const timestamps = { ...previous };
              const before: readonly unknown[] = Array.isArray(current) ? current : [];
              for (const id of next) {
                if (typeof id === "string" && !before.includes(id))
                  timestamps[id] = new Date().toISOString();
              }
              store.put(timestamps, "nextstep.savedAt");
              finish(next);
            },
            fail,
          );
        } else finish(next);
      },
      fail,
    ),
  );
}
export async function exportStore() {
  await initializeStore();
  return transaction<{ schemaVersion: number; records: Record<string, unknown> }>(
    "readonly",
    (store, finish) => {
      const records: Record<string, unknown> = {};
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          records[String(cursor.key)] = cursor.value;
          cursor.continue();
        } else finish({ schemaVersion: STORAGE_SCHEMA_VERSION, records });
      };
    },
  );
}
export async function resetStore() {
  await transaction<void>("readwrite", (store, finish) => {
    store.clear();
    store.put(
      {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        initializedAt: new Date().toISOString(),
        recovery: [],
      },
      "meta",
    );
    store.put(structuredClone(DEFAULT_PROFILE), "nextstep.profile");
    store.put([], "nextstep.saved");
    for (const event of DEMO_HACKATHONS) {
      store.put(toOpportunity(buildEventDetails(event.id)!), `opportunity:${event.id}`);
      store.put(emptySubmission(event.id), `submission:${event.id}`);
    }
    finish();
  });
  initialized = Promise.resolve();
}
export async function closeStore() {
  if (connection) {
    try {
      (await connection).close();
    } catch {
      /* Already closed. */
    }
  }
  connection = undefined;
  initialized = undefined;
  channel?.close();
  channel = undefined;
}
