import {
  DATE_TABLES,
  UUID_TABLES,
  db,
  getActiveProfileId,
  onLocalChange,
  withRemoteApply,
  type SyncTable,
} from '../db';
import { getDb, isFirebaseConfigured, watchAuth } from './firebase';

/* ================= マージ判定(純関数・テスト対象) ================= */

/** リモートの行をローカルに取り込むべきか(新しい方が勝つ) */
export function shouldApplyRemote(
  localUpdatedAt: number | undefined,
  remoteUpdatedAt: number | undefined,
): boolean {
  return (localUpdatedAt ?? 0) < (remoteUpdatedAt ?? 0);
}

/** 墓標(削除)をローカルに適用すべきか。削除後にローカルで作り直した行は守る */
export function shouldApplyTombstone(
  localUpdatedAt: number | undefined,
  deletedAt: number,
): boolean {
  return (localUpdatedAt ?? 0) < deletedAt;
}

/* ================= 同期エンジン ================= */

export interface SyncInfo {
  at: number;
  pushed: number;
  pulled: number;
  error?: string;
}

const SYNC_STATE_KEY = 'lastSyncAt';
const SYNC_INFO_KEY = 'syncInfo';
const BATCH_LIMIT = 400;

let currentUid: string | null = null;
let inFlight = false;
let queued = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function getLastSyncAt(): Promise<number> {
  const s = await db.settings.get(SYNC_STATE_KEY);
  return s ? Number(s.value) : 0;
}

async function writeSyncInfo(info: SyncInfo): Promise<void> {
  await db.settings.put({ key: SYNC_INFO_KEY, value: JSON.stringify(info) });
}

export function parseSyncInfo(value: string | undefined): SyncInfo | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as SyncInfo;
  } catch {
    return undefined;
  }
}

/** Firestoreに書く形(ローカル固有のid/profileIdを除去) */
function toRemote(row: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, profileId: _pid, ...rest } = row;
  // Firestoreはundefinedを受け付けないので落とす
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
}

function docIdOf(table: SyncTable, row: { date?: string; uuid?: string }): string | undefined {
  return (DATE_TABLES as readonly string[]).includes(table) ? row.date : row.uuid;
}

async function findLocal(
  table: SyncTable,
  profileId: number,
  docId: string,
): Promise<{ id: number; updatedAt?: number } | undefined> {
  if ((DATE_TABLES as readonly string[]).includes(table)) {
    return db.table(table).where('[profileId+date]').equals([profileId, docId]).first() as Promise<
      { id: number; updatedAt?: number } | undefined
    >;
  }
  return db.table(table).where('uuid').equals(docId).first() as Promise<
    { id: number; updatedAt?: number } | undefined
  >;
}

/** 双方向同期を1回実行する。多重呼び出しは自動で直列化される */
export async function syncNow(): Promise<SyncInfo | undefined> {
  if (!currentUid || !isFirebaseConfigured) return undefined;
  if (inFlight) {
    queued = true;
    return undefined;
  }
  inFlight = true;
  const uid = currentUid;
  const startedAt = Date.now();
  let pushed = 0;
  let pulled = 0;

  try {
    const since = await getLastSyncAt();
    const [fs, { collection, doc, getDoc, getDocs, query, where, writeBatch }] =
      await Promise.all([getDb(), import('firebase/firestore')]);
    const profileId = await getActiveProfileId();
    if (profileId == null) return undefined;

    /* ---- push ---- */
    let batch = writeBatch(fs);
    let batchCount = 0;
    const commitIfFull = async () => {
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(fs);
        batchCount = 0;
      }
    };

    // プロフィール(users/{uid} 直下)
    const profile = await db.profiles.get(profileId);
    if (profile && (profile.updatedAt ?? 0) > since) {
      batch.set(doc(fs, 'users', uid), toRemote(profile as unknown as Record<string, unknown>), {
        merge: true,
      });
      batchCount++;
      pushed++;
    }

    // レコード
    for (const table of [...DATE_TABLES, ...UUID_TABLES]) {
      const rows = (await db
        .table(table)
        .where('profileId')
        .equals(profileId)
        .toArray()) as ({ date?: string; uuid?: string; updatedAt?: number } & Record<
        string,
        unknown
      >)[];
      for (const row of rows) {
        if ((row.updatedAt ?? 0) <= since) continue;
        const docId = docIdOf(table, row);
        if (!docId) continue;
        batch.set(doc(fs, 'users', uid, table, docId), toRemote(row));
        batchCount++;
        pushed++;
        await commitIfFull();
      }
    }

    // 墓標(リモートの実体も消す)
    const tombs = await db.tombstones.filter((t) => t.deletedAt > since).toArray();
    for (const t of tombs) {
      batch.set(doc(fs, 'users', uid, 'tombstones', `${t.collection}_${t.docId}`), {
        collection: t.collection,
        docId: t.docId,
        deletedAt: t.deletedAt,
      });
      batch.delete(doc(fs, 'users', uid, t.collection, t.docId));
      batchCount += 2;
      pushed++;
      await commitIfFull();
    }
    if (batchCount > 0) await batch.commit();

    /* ---- pull ---- */
    await withRemoteApply(async () => {
      // プロフィール
      const remoteProfile = await getDoc(doc(fs, 'users', uid));
      if (remoteProfile.exists()) {
        const data = remoteProfile.data() as { updatedAt?: number };
        const local = await db.profiles.get(profileId);
        if (shouldApplyRemote(local?.updatedAt, data.updatedAt)) {
          await db.profiles.update(profileId, data);
          pulled++;
        }
      }

      // レコード
      for (const table of [...DATE_TABLES, ...UUID_TABLES]) {
        const snap = await getDocs(
          query(collection(fs, 'users', uid, table), where('updatedAt', '>', since)),
        );
        for (const d of snap.docs) {
          const remote = d.data() as { updatedAt?: number } & Record<string, unknown>;
          const local = await findLocal(table, profileId, d.id);
          if (local) {
            if (shouldApplyRemote(local.updatedAt, remote.updatedAt)) {
              await db.table(table).update(local.id, remote);
              pulled++;
            }
          } else {
            await db.table(table).add({ ...remote, profileId });
            pulled++;
          }
        }
      }

      // 墓標
      const tombSnap = await getDocs(
        query(collection(fs, 'users', uid, 'tombstones'), where('deletedAt', '>', since)),
      );
      for (const d of tombSnap.docs) {
        const t = d.data() as { collection: SyncTable; docId: string; deletedAt: number };
        const local = await findLocal(t.collection, profileId, t.docId);
        if (local && shouldApplyTombstone(local.updatedAt, t.deletedAt)) {
          await db.table(t.collection).delete(local.id);
          pulled++;
        }
      }
    });

    await db.settings.put({ key: SYNC_STATE_KEY, value: String(startedAt) });
    const info: SyncInfo = { at: startedAt, pushed, pulled };
    await writeSyncInfo(info);
    return info;
  } catch (e) {
    const info: SyncInfo = {
      at: startedAt,
      pushed,
      pulled,
      error: e instanceof Error ? e.message : String(e),
    };
    await writeSyncInfo(info);
    return info;
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      scheduleSync(500);
    }
  }
}

function scheduleSync(delayMs = 3000): void {
  if (!currentUid) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), delayMs);
}

/** アプリ起動時に1回呼ぶ。認証状態・ローカル変更・オンライン復帰で自動同期する */
export function initSync(): void {
  if (!isFirebaseConfigured) return;
  void watchAuth((user) => {
    currentUid = user?.uid ?? null;
    if (user) void syncNow();
  });
  window.addEventListener('online', () => scheduleSync(500));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSync(500);
  });
  onLocalChange(() => scheduleSync());
}
