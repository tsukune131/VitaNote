import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { db } from '../db';
import { isNativeApp } from './platform';

/** App Store Connectに登録する非消耗型アイテムのID(ユーザーには見えない) */
export const PRO_PRODUCT_ID = 'com.tsukune.vitanote.pro';

/** 前回わかっているPro状態。機内モードで起動しても記録が読めるように残す */
const CACHE_KEY = 'proUnlocked';

export interface ProState {
  /** 検査値・血液検査を書けるか */
  isPro: boolean;
  /** 端末の通貨で整形済みの価格(取れるまでundefined) */
  price?: string;
  /** 購入・復元の通信中 */
  busy: boolean;
  /** 直前の操作が失敗したときの、そのまま出せる日本語 */
  error?: string;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}

const ProContext = createContext<ProState | undefined>(undefined);

/**
 * 買い切りPro(血液検査・検査値の記録)の状態をアプリ全体に配る。
 *
 * 判定はStoreKitに聞く。StoreKitは購入を端末に持っているのでふだんは
 * オフラインでも答えが返るが、それでも失敗しうるので、最後に分かった状態を
 * settingsに残して初期値に使う。「圏外だから自分の検査結果が読めない」を
 * 起こさないため、失敗したときは前回の状態を維持する(falseに倒さない)。
 */
export function ProProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [price, setPrice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // 開発中のホットリロードや前面復帰の連打で二重に走らせない
  const checking = useRef(false);

  const remember = useCallback(async (unlocked: boolean) => {
    setIsPro(unlocked);
    await db.settings.put({ key: CACHE_KEY, value: unlocked ? '1' : '' });
  }, []);

  const refresh = useCallback(async () => {
    if (!isNativeApp() || checking.current) return;
    checking.current = true;
    try {
      const { purchases } = await NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.INAPP,
        onlyCurrentEntitlements: true,
      });
      // 販売しているアイテムは1つだけなので、返ってきた=Pro。
      // 2つ目を出すときは productIdentifier での絞り込みが要る
      await remember(purchases.length > 0);
    } catch {
      // 前回の状態のまま(初期化時にキャッシュから入れてある)
    } finally {
      checking.current = false;
    }
  }, [remember]);

  // 起動時: まずキャッシュで即座に画面を確定させ、そのあとStoreKitに確かめる
  useEffect(() => {
    void (async () => {
      const cached = await db.settings.get(CACHE_KEY);
      if (cached?.value) setIsPro(true);
      await refresh();
    })();
  }, [refresh]);

  // 価格はApp Store側の設定なので、こちらに書かずに毎回聞く
  useEffect(() => {
    if (!isNativeApp()) return;
    void (async () => {
      try {
        const { product } = await NativePurchases.getProduct({
          productIdentifier: PRO_PRODUCT_ID,
          productType: PURCHASE_TYPE.INAPP,
        });
        setPrice(product.priceString);
      } catch {
        // 取れなければ価格を出さない(審査では価格表示が要るので、
        // 購入ボタンは価格が取れたときだけ押せるようにしている)
      }
    })();
  }, []);

  // 他の端末で買った場合や、家族共有で降りてきた場合に追いつく
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const purchase = useCallback(async () => {
    if (!isNativeApp()) {
      setError('購入はiPhoneアプリでのみ行えます。');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await NativePurchases.purchaseProduct({
        productIdentifier: PRO_PRODUCT_ID,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: false,
      });
      await remember(true);
    } catch (e) {
      // ユーザーが自分で閉じたときは、失敗として見せない
      if (!isCancelled(e)) {
        setError('購入を完了できませんでした。時間をおいて、もう一度お試しください。');
      }
    } finally {
      setBusy(false);
    }
  }, [remember]);

  const restore = useCallback(async () => {
    if (!isNativeApp()) {
      setError('購入の復元はiPhoneアプリでのみ行えます。');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await NativePurchases.restorePurchases();
      const { purchases } = await NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.INAPP,
        onlyCurrentEntitlements: true,
      });
      const unlocked = purchases.length > 0;
      await remember(unlocked);
      if (!unlocked) setError('このApple IDでの購入は見つかりませんでした。');
    } catch {
      setError('購入を復元できませんでした。通信の状態を確かめて、もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  }, [remember]);

  const value = useMemo<ProState>(
    () => ({ isPro, price, busy, error, purchase, restore }),
    [isPro, price, busy, error, purchase, restore],
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProState {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside ProProvider');
  return ctx;
}

/** StoreKitの「ユーザーが購入をやめた」を、通信エラーと区別する */
function isCancelled(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /cancel/i.test(message);
}
