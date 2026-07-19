import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Firebaseの公開設定。APIキーは秘密情報ではなく(アクセス制御は
 * FirestoreのセキュリティルールとAuthが担う)、コミットして問題ない。
 * プロジェクト作成後にここを実際の値で埋める。
 *
 * SDKはバンドルを肥大化させるため、すべて動的importで遅延読み込みする。
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBCOeFjtdCjjict92FW1COw4_1sgd4sV4Q',
  authDomain: 'weightnote-923c3.firebaseapp.com',
  projectId: 'weightnote-923c3',
  storageBucket: 'weightnote-923c3.firebasestorage.app',
  messagingSenderId: '766870192843',
  appId: '1:766870192843:web:bd999048ee24e61099914e',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== '';

let authPromise: Promise<Auth> | undefined;
let dbPromise: Promise<Firestore> | undefined;

async function ensureAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp, getApps, getApp }, { getAuth }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return getAuth(app);
  })();
  return authPromise;
}

export async function getDb(): Promise<Firestore> {
  dbPromise ??= (async () => {
    const [{ initializeApp, getApps, getApp }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return getFirestore(app);
  })();
  return dbPromise;
}

export async function signInWithGoogle(): Promise<User> {
  const auth = await ensureAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const auth = await ensureAuth();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/** 認証状態を監視する。返り値のPromiseで解除関数を得る */
export async function watchAuth(cb: (user: User | null) => void): Promise<() => void> {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  const auth = await ensureAuth();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, cb);
}
