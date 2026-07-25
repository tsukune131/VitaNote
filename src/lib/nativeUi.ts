import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from './platform';

/**
 * ネイティブの見た目・手触りに関する小さな処理。
 * プラグインは静的importにする(遅延読み込みは実機で読み込みが返らない事例があったため)。
 */

/** 起動時のスプラッシュを閉じる。描画が済んでから呼ぶことで白い画面を挟まない */
export async function hideSplash(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // スプラッシュが出ていない場合など。閉じられなくても実害はない
  }
}

/**
 * 記録できたことを指先に返す。書き込む手応えを出すための軽い振動。
 * 通らなくても記録自体には影響しないので、失敗は握りつぶす。
 */
export async function tapFeedback(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // 端末が対応していない・設定で切られている
  }
}
