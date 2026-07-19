import Dexie, { type EntityTable } from 'dexie';

export type Sex = 'male' | 'female';

export interface Profile {
  id: number;
  name: string;
  heightCm: number;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  activityLevel: number;
  targetWeightKg?: number;
  targetFatPct?: number; // 目標体脂肪率(%)
  targetDate?: string; // YYYY-MM-DD
  updatedAt?: number; // 同期用(ms)
}

export interface WeightEntry {
  id: number;
  profileId: number;
  date: string; // YYYY-MM-DD
  kg: number;
  bodyFatPct?: number; // 体脂肪率(%)
  updatedAt?: number;
}

export interface MealEntry {
  id: number;
  profileId: number;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
  breakfastTime?: string; // HH:mm
  lunchTime?: string;
  dinnerTime?: string;
  snackTime?: string;
  updatedAt?: number;
}

export interface WaterLog {
  id: number;
  profileId: number;
  date: string;
  time: string; // HH:mm
  ml: number;
  uuid?: string; // 端末をまたいで一意(同期用)
  updatedAt?: number;
}

export interface StepEntry {
  id: number;
  profileId: number;
  date: string;
  total: number;
  hourly?: number[]; // 24要素。未入力の時間帯は0
  updatedAt?: number;
}

export interface ExerciseEntry {
  id: number;
  profileId: number;
  date: string;
  name: string;
  kcal: number;
  uuid?: string;
  updatedAt?: number;
}

/** 1日1ページの日記メモ */
export interface NoteEntry {
  id: number;
  profileId: number;
  date: string;
  text: string;
  updatedAt?: number;
}

/** マイメニュー(よく食べる物の登録) */
export interface Food {
  id: number;
  profileId: number;
  name: string;
  kcal: number;
  uses: number; // 使用回数(よく使う順の表示用)
  uuid?: string;
  updatedAt?: number;
}

/** 削除の同期伝播用の墓標 */
export interface Tombstone {
  key: string; // `${collection}/${docId}`
  collection: string;
  docId: string; // 日付キーのテーブルはdate、それ以外はuuid
  deletedAt: number;
}

export interface Setting {
  key: string;
  value: string;
}

/** 日付が1日1件のキーになるテーブル */
export const DATE_TABLES = ['weights', 'meals', 'steps', 'notes'] as const;
/** uuidがキーになるテーブル */
export const UUID_TABLES = ['waterLogs', 'exercises', 'foods'] as const;
export type SyncTable = (typeof DATE_TABLES)[number] | (typeof UUID_TABLES)[number];

export const db = new Dexie('weight-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>;
  weights: EntityTable<WeightEntry, 'id'>;
  meals: EntityTable<MealEntry, 'id'>;
  waterLogs: EntityTable<WaterLog, 'id'>;
  steps: EntityTable<StepEntry, 'id'>;
  exercises: EntityTable<ExerciseEntry, 'id'>;
  foods: EntityTable<Food, 'id'>;
  notes: EntityTable<NoteEntry, 'id'>;
  tombstones: EntityTable<Tombstone, 'key'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  profiles: '++id',
  weights: '++id, profileId, [profileId+date]',
  meals: '++id, profileId, [profileId+date]',
  waterLogs: '++id, profileId, [profileId+date]',
  steps: '++id, profileId, [profileId+date]',
  exercises: '++id, profileId, [profileId+date]',
  settings: 'key',
});

// v2: マイメニュー(foods)を追加
db.version(2).stores({
  foods: '++id, profileId',
});

// v3: 日記メモ(notes)を追加
db.version(3).stores({
  notes: '++id, profileId, [profileId+date]',
});

// v4: クラウド同期対応(uuid・updatedAt・墓標)。既存行にはuuidと
// updatedAt=現在時刻を付与し、初回同期ですべてアップロードされるようにする
db.version(4)
  .stores({
    waterLogs: '++id, profileId, [profileId+date], uuid',
    exercises: '++id, profileId, [profileId+date], uuid',
    foods: '++id, profileId, uuid',
    tombstones: 'key',
  })
  .upgrade(async (tx) => {
    const now = Date.now();
    for (const name of ['profiles', 'weights', 'meals', 'steps', 'notes'] as const) {
      await tx.table(name).toCollection().modify((row: { updatedAt?: number }) => {
        row.updatedAt ??= now;
      });
    }
    for (const name of UUID_TABLES) {
      await tx
        .table(name)
        .toCollection()
        .modify((row: { uuid?: string; updatedAt?: number }) => {
          row.uuid ??= crypto.randomUUID();
          row.updatedAt ??= now;
        });
    }
  });

/* ---- 同期用フック ----
   通常の書き込みには updatedAt(とuuid)を自動付与する。
   リモートから取り込むとき(applyingRemote)はタイムスタンプを保持する。 */

let applyingRemote = false;

/** リモート適用中はupdatedAtの自動更新を止める */
export async function withRemoteApply<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true;
  try {
    return await fn();
  } finally {
    applyingRemote = false;
  }
}

type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

/** ローカル書き込み(ユーザー操作由来)があったときに呼ばれるリスナーを登録 */
export function onLocalChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange() {
  if (applyingRemote) return;
  for (const l of changeListeners) l();
}

const STAMPED_TABLES = ['profiles', ...DATE_TABLES, ...UUID_TABLES] as const;
const NEEDS_UUID = new Set<string>(UUID_TABLES);

for (const name of STAMPED_TABLES) {
  const table = db.table(name);
  table.hook('creating', function (_pk, obj: { updatedAt?: number; uuid?: string }) {
    if (!applyingRemote) obj.updatedAt = Date.now();
    if (NEEDS_UUID.has(name)) obj.uuid ??= crypto.randomUUID();
    queueMicrotask(notifyChange);
  });
  table.hook('updating', function (mods: object) {
    queueMicrotask(notifyChange);
    if (applyingRemote) return undefined;
    if ('updatedAt' in mods) return undefined;
    return { updatedAt: Date.now() };
  });
}

/** 同期対象レコードの削除。墓標を残してリモートにも伝播させる */
export async function removeRecord(tableName: SyncTable, id: number): Promise<void> {
  const table = db.table(tableName);
  const row = (await table.get(id)) as
    | { date?: string; uuid?: string }
    | undefined;
  if (!row) return;
  const docId = (DATE_TABLES as readonly string[]).includes(tableName) ? row.date : row.uuid;
  await db.transaction('rw', [table, db.tombstones], async () => {
    if (docId) {
      await db.tombstones.put({
        key: `${tableName}/${docId}`,
        collection: tableName,
        docId,
        deletedAt: Date.now(),
      });
    }
    await table.delete(id);
  });
  notifyChange();
}

export async function setActiveProfileId(id: number): Promise<void> {
  await db.settings.put({ key: 'activeProfileId', value: String(id) });
}

export async function getActiveProfileId(): Promise<number | undefined> {
  const s = await db.settings.get('activeProfileId');
  if (s) return Number(s.value);
  const first = await db.profiles.toCollection().first();
  return first?.id;
}

export async function deleteProfile(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.weights, db.meals, db.waterLogs, db.steps, db.exercises, db.foods, db.notes],
    async () => {
      await db.profiles.delete(id);
      for (const table of [
        db.weights,
        db.meals,
        db.waterLogs,
        db.steps,
        db.exercises,
        db.foods,
        db.notes,
      ]) {
        await table.where('profileId').equals(id).delete();
      }
    },
  );
}
