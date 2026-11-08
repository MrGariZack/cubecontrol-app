import type { SyncChange } from "./remote";
import type { SyncState } from "./syncState";
import { fingerprintKey } from "./syncState";
import type { SyncKind, SyncRecord } from "./types";

/**
 * Pure LWW merge helpers. Deterministic and side-effect free so they can be
 * unit-tested without a network or filesystem.
 */

function keyOf(record: Pick<SyncRecord, "kind" | "id">): string {
  return fingerprintKey(record.kind, record.id);
}

function snapshotMap(snapshot: readonly SyncRecord[]): Map<string, SyncRecord> {
  const map = new Map<string, SyncRecord>();
  for (const record of snapshot) map.set(keyOf(record), record);
  return map;
}

export interface LocalDiff {
  readonly changes: SyncChange[];
  readonly nextEntries: SyncState["entries"];
}

/**
 * Diff the current local snapshot against the last-pushed fingerprint.
 * `now` is the tombstone timestamp assigned to records deleted since last sync.
 */
export function computeLocalChanges(
  snapshot: readonly SyncRecord[],
  entries: SyncState["entries"],
  now: string,
): LocalDiff {
  const changes: SyncChange[] = [];
  const nextEntries: SyncState["entries"] = {};
  const seen = new Set<string>();

  for (const record of snapshot) {
    const key = keyOf(record);
    seen.add(key);
    const entry = entries[key];
    nextEntries[key] = {
      updatedAt: record.updatedAt,
      deleted: false,
      ...(record.kind === "ir" ? { hadLocalIr: true } : {}),
    };
    if (entry === undefined || entry.deleted || entry.updatedAt !== record.updatedAt) {
      changes.push({
        kind: record.kind,
        id: record.id,
        updatedAt: record.updatedAt,
        deleted: false,
        record,
      });
    }
  }

  for (const [key, entry] of Object.entries(entries)) {
    if (seen.has(key)) continue;
    if (entry.deleted) {
      nextEntries[key] = entry;
      continue;
    }
    // Present in the fingerprint but no longer local → tombstone.
    const [kind, id] = splitKey(key);
    if (kind === "ir" && entry.hadLocalIr !== true) continue;
    nextEntries[key] = { updatedAt: now, deleted: true };
    changes.push({ kind, id, updatedAt: now, deleted: true });
  }

  return { changes, nextEntries };
}

function splitKey(key: string): [SyncKind, string] {
  const index = key.indexOf(":");
  return [key.slice(0, index) as SyncKind, key.slice(index + 1)];
}

export interface RemoteApplication {
  readonly applyUpserts: SyncRecord[];
  readonly applyDeletes: readonly { readonly kind: SyncKind; readonly id: string }[];
  readonly nextEntries: SyncState["entries"];
}

/**
 * Decide which pulled (server-authoritative) changes must be applied locally.
 * Newer edits win. A tombstone takes precedence over an edit at the same
 * timestamp. IR records describe local files, so cloud-only metadata and
 * remote deletions cannot create or remove a WAV.
 */
export function computeRemoteApplication(
  changes: readonly SyncChange[],
  snapshot: readonly SyncRecord[],
  baseEntries: SyncState["entries"],
): RemoteApplication {
  const local = snapshotMap(snapshot);
  const applyUpserts: SyncRecord[] = [];
  const applyDeletes: { kind: SyncKind; id: string }[] = [];
  const nextEntries: SyncState["entries"] = { ...baseEntries };

  for (const change of changes) {
    const key = fingerprintKey(change.kind, change.id);
    const record = local.get(key);
    const localEntry = baseEntries[key];
    const localVersion = record?.updatedAt ?? localEntry?.updatedAt;
    if (localVersion !== undefined && change.updatedAt < localVersion) continue;
    if (
      record === undefined &&
      localEntry?.deleted &&
      change.updatedAt === localVersion &&
      !change.deleted
    ) {
      continue;
    }

    if (change.kind === "ir") {
      if (record === undefined || change.deleted) continue;
      nextEntries[key] = { updatedAt: change.updatedAt, deleted: false, hadLocalIr: true };
    } else {
      nextEntries[key] = { updatedAt: change.updatedAt, deleted: change.deleted };
    }

    if (change.deleted) {
      if (record !== undefined) {
        applyDeletes.push({ kind: change.kind, id: change.id });
      }
      continue;
    }

    if (record === undefined || change.updatedAt > record.updatedAt) {
      applyUpserts.push(change.record);
    }
  }

  return { applyUpserts, applyDeletes, nextEntries };
}
