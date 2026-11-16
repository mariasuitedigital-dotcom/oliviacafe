import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OfflineOpKind = 'dar_sello' | 'canjear_premio' | 'canjear_cupon' | 'aplicar_promo';

export interface PendingPosOp {
  idempotencyKey: string;
  kind: OfflineOpKind;
  createdAt: string;
  customerName: string;
  maskedPhone: string;
  summary: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'failed';
  errorText?: string;
}

export interface PosQueueEntry {
  id: string;
  kind: OfflineOpKind;
  customerId: string;
  customerName: string;
  maskedPhone: string;
  badgeText: string;
  detailText: string;
  createdAt: string;
  syncState: 'synced' | 'offline_queued';
  idempotencyKey: string;
}

interface PosOfflineDB extends DBSchema {
  pending_ops: {
    key: string;
    value: PendingPosOp;
    indexes: { 'by-created': string };
  };
  recent_activity: {
    key: string;
    value: PosQueueEntry;
    indexes: { 'by-created': string };
  };
}

const DB_NAME = 'olivia-pos-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

function getPosDb() {
  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending_ops')) {
          const opsStore = db.createObjectStore('pending_ops', { keyPath: 'idempotencyKey' });
          opsStore.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('recent_activity')) {
          const recentStore = db.createObjectStore('recent_activity', { keyPath: 'id' });
          recentStore.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueuePendingPosOp(op: PendingPosOp): Promise<void> {
  const db = await getPosDb();
  await db.put('pending_ops', op);
}

export async function listPendingPosOps(): Promise<PendingPosOp[]> {
  const db = await getPosDb();
  const all = await db.getAllFromIndex('pending_ops', 'by-created');
  return all.reverse();
}

export async function removePendingPosOp(idempotencyKey: string): Promise<void> {
  const db = await getPosDb();
  await db.delete('pending_ops', idempotencyKey);
}

export async function markPendingPosOpFailed(
  idempotencyKey: string,
  errorText: string
): Promise<void> {
  const db = await getPosDb();
  const existing = await db.get('pending_ops', idempotencyKey);
  if (!existing) return;
  await db.put('pending_ops', {
    ...existing,
    status: 'failed',
    errorText,
  });
}

export async function addRecentPosActivity(entry: PosQueueEntry): Promise<void> {
  const db = await getPosDb();
  await db.put('recent_activity', entry);
  // Mantener los últimos 30 movimientos locales
  const all = await db.getAllFromIndex('recent_activity', 'by-created');
  if (all.length > 30) {
    const toRemove = all.slice(0, all.length - 30);
    for (const item of toRemove) {
      await db.delete('recent_activity', item.id);
    }
  }
}

export async function markRecentActivitySynced(idempotencyKey: string): Promise<void> {
  const db = await getPosDb();
  const all = await db.getAll('recent_activity');
  for (const item of all) {
    if (item.idempotencyKey === idempotencyKey && item.syncState !== 'synced') {
      await db.put('recent_activity', { ...item, syncState: 'synced' });
    }
  }
}

export async function listRecentPosActivity(): Promise<PosQueueEntry[]> {
  const db = await getPosDb();
  const all = await db.getAllFromIndex('recent_activity', 'by-created');
  return all.reverse();
}
