# iOS / TestFlight 配布のセットアップ手順

Mac を持たずに GitHub Actions (macOS ランナー) だけで TestFlight まで配布するための手順。
コード側の実装は済んでいるので、ここに書いてあるのは **Apple / GitHub 側の設定作業** だけ。

- Bundle ID: `com.tsukune.vitanote`
- ワークフロー: [.github/workflows/ios-testflight.yml](../.github/workflows/ios-testflight.yml)(手動実行)
- fastlane: [fastlane/Fastfile](../fastlane/Fastfile)

---

## 1. Apple Developer で App ID を作る

1. https://developer.apple.com/account/resources/identifiers/list
2. `+` → **App IDs** → **App**
3. Description: `VitaNote` / Bundle ID: **Explicit** で `com.tsukune.vitanote`
4. Capabilities は今は何もオンにしない
   (HealthKit は C-3、Push は使わない。ローカル通知は capability 不要)
5. Team ID を控える(画面右上、または Membership ページの 10 桁英数字)

## 2. App Store Connect にアプリを登録する

1. https://appstoreconnect.apple.com/apps → `+` → **新規アプリ**
2. プラットフォーム: iOS / 名前: `VitaNote` / 主要言語: 日本語
3. バンドルID: 手順1で作った `com.tsukune.vitanote` を選ぶ
4. SKU: `vitanote` など任意

> 名前 `VitaNote` が他社に取られていた場合はここで弾かれる。
> その場合はアプリ名の再検討が必要(Bundle ID は変えなくてよい)。

## 3. App Store Connect API キーを発行する

1. https://appstoreconnect.apple.com/access/integrations/api
2. **チームキー** タブ → `+`
3. 名前: `GitHub Actions` / アクセス権: **Admin**
   (match で証明書を作るため App Manager では足りない)
4. `.p8` ファイルをダウンロード(**再ダウンロード不可**。無くしたら作り直し)
5. **Key ID** と **Issuer ID** を控える

## 4. match 用のプライベートリポジトリを作る

証明書と秘密鍵を暗号化して置いておく場所。**必ず private** にする。

1. GitHub で新規リポジトリ `VitaNote-certificates` を **Private** で作成(README なしの空でよい)
2. Personal Access Token を作る
   - https://github.com/settings/tokens → Fine-grained token
   - Repository access: `VitaNote-certificates` のみ
   - Permissions: **Contents: Read and write**
3. 暗号化パスフレーズを **自分で決める**
   - どこかの画面で設定する項目ではなく、好きな文字列を考えるだけ。
     手順5で `MATCH_PASSWORD` として GitHub Secrets に登録し、
     lane=`certificates` の初回実行時にこの値で証明書が暗号化される
   - ランダムに作るなら:
     `[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Max 256 }))`
   - **忘れると保存済みの証明書を復号できない**(作り直しになる)ので
     パスワードマネージャ等に保存しておく

## 5. GitHub Secrets を登録する

VitaNote リポジトリの Settings → Secrets and variables → Actions → **New repository secret**

| Secret 名 | 値 |
|---|---|
| `ASC_KEY_ID` | 手順3の Key ID |
| `ASC_ISSUER_ID` | 手順3の Issuer ID |
| `ASC_KEY_P8_BASE64` | `.p8` を base64 にした文字列(下記コマンド) |
| `APPLE_TEAM_ID` | 手順1の Team ID(10桁) |
| `MATCH_GIT_URL` | `https://github.com/tsukune131/VitaNote-certificates.git` |
| `MATCH_PASSWORD` | 手順4で決めたパスフレーズ |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `tsukune131:<PAT>` を base64 にした文字列 |

PowerShell での base64 化:

```powershell
# .p8 ファイル
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXXXXXXXX.p8"))

# match 用の Basic 認証 (ユーザー名:PAT)
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("tsukune131:github_pat_xxxxx"))
```

> 改行が混ざらないよう、出力をそのままコピーして貼り付ける。

## 6. 証明書を作る(初回だけ)

手順1〜5がすべて終わっていることが前提。特に **App ID が未作成だと失敗する**
(match はその App ID に対してプロファイルを作るため)。

1. https://github.com/tsukune131/VitaNote/actions を開く
2. 左サイドバーのワークフロー一覧から **iOS TestFlight** をクリック
3. 右側の **Run workflow** をクリック
4. `Use workflow from` は **Branch: main** のまま
5. `実行する fastlane レーン` を **`certificates`** に変更(既定は `beta` なので必ず変える)
6. 緑の **Run workflow** を押す
7. ページを再読み込みすると実行中の行が出る。クリックでログが見られる

成功の確認:

- 全ステップに緑のチェックが付く(5〜10分程度)
- `VitaNote-certificates` リポジトリに `certs/` と `profiles/` ができている

失敗したら `Run fastlane` ステップのログを開く:

| エラー | 原因 |
|---|---|
| `Authentication credentials are missing or invalid` (401) | `ASC_KEY_ID` / `ASC_ISSUER_ID` / `.p8` の base64 のどれかが違う |
| `Access forbidden` (403) | APIキーの権限が Admin でない |
| `Couldn't find bundle identifier com.tsukune.vitanote` | 手順1の App ID が未作成、または `APPLE_TEAM_ID` が違う |
| `Authentication failed` / `repository not found` (git) | `MATCH_GIT_URL` か `MATCH_GIT_BASIC_AUTHORIZATION` が違う。PATの権限が Contents: Read and write か確認 |

## 7. TestFlight にアップロードする

同じワークフローを、今度は lane **`beta`** で実行する(手順6と同じ操作)。

`npm run build` → `npx cap sync ios` → match で署名 → アーカイブ →
TestFlight アップロード、まで自動で走る。

- ビルド番号は TestFlight の最新 +1 を自動採番(初回は Actions の run number)
- 処理完了を待たずに終わるので、App Store Connect 側の「処理中」が
  終わるまで数分〜数十分かかる
- 生成された `.ipa` は Actions の Artifacts からもダウンロードできる

## 8. 家族に配布する

App Store Connect → TestFlight → **内部テスト** グループを作り、
家族の Apple ID をユーザーとして招待する。
内部テスト(最大100名)は Apple のレビュー不要ですぐ配れる。

---

## つまずきやすいところ

- **輸出コンプライアンス**: 初回アップロード後に App Store Connect で聞かれる。
  VitaNote は独自の暗号化を使っていないので「いいえ」で通る。
  毎回聞かれるのが面倒なら Info.plist に
  `ITSAppUsesNonExemptEncryption = false` を追加する。
- **証明書の作り直し**: 期限切れなどで作り直す場合は、`VitaNote-certificates` の
  中身を消してから lane=`certificates` を再実行する。
- **Xcode バージョン**: ランナーの `latest-stable` を使っている。
  Apple の要件が上がって古い Xcode が弾かれた場合もこの指定なら自動追従する。
