## 1. Implementation tasks

- [x] 1.1 `frontend/package.json`とlockfileへVite 8対応の`vite-plugin-pwa` 1.3.0を開発依存として追加する。完了条件: 通常のnpm installでpeer dependency errorがなく、解決されたVite/plugin/Node版を確認できる。
- [x] 1.2 `frontend/public/favicon.svg`の「青背景＋白P」から`pwa-192x192.png`、`pwa-512x512.png`、safe zoneにPが収まる`pwa-maskable-512x512.png`、180×180の`apple-touch-icon.png`を`frontend/public/`へ作る。完了条件: 実ファイルの寸法・PNG形式とmaskable safe zoneを確認できる。
- [x] 1.3 `frontend/vite.config.js`に`generateSW`、`registerType: 'autoUpdate'`、pluginの自動登録、manifestの名前・日本語description・`id`/`start_url`/`scope`=`/`・standalone・色・192/512/maskableアイコンを設定する。静的app shellだけをprecacheし、rootだけのnavigateFallback、旧precache cleanupを維持し、動的APIのruntime cacheを設定しない。完了条件: 設定と生成manifest/SWを照合できる。
- [x] 1.4 `frontend/index.html`の既存faviconと`viewport-fit=cover`を維持し、theme-colorとapple touch iconを参照する。完了条件: build後のHTMLでmanifest linkが一つ、viewportとicon参照が正しい。
- [x] 1.5 pluginが生成するService Worker登録scriptを使用する。完了条件: build後のHTMLに自動登録scriptへの参照が一つあり、`main.jsx`は未変更、`virtual:pwa-register`のimport・独自の更新確認・更新UIがない。
- [x] 1.6 `frontend/vercel.json`を追加し、`/`、`/index.html`、`/sw.js`、`/manifest.webmanifest`に`Cache-Control: public, max-age=0, must-revalidate`、manifestに`Content-Type: application/manifest+json`を指定する。完了条件: 設定ファイルを確認し、hashed assetsへの特別なheaderと広いSPA rewriteがない。
- [x] 1.7 `docs/deployment.md`にPWA資源のURL/header、preview・productionでの確認方法、通常のService Worker更新とrollback時の確認方法を記す。案内用production URLを`https://planrail-frontend.vercel.app`と明示し、過去の別URLとのVercel project/alias関係は未確認として記録する。完了条件: 設定と文書が一致する。

## 2. Local verification tasks

- [x] 2.1 `cd frontend && npm test`を実行する。完了条件: 成功するか、変更に起因する失敗を修正して再実行する。
- [x] 2.2 `cd frontend && npm run lint`を実行する。完了条件: 成功するか、変更に起因する失敗を修正して再実行する。
- [x] 2.3 `cd frontend && npm run build`を実行する。完了条件: 成功し、通常のVite buildで`dist/manifest.webmanifest`と`dist/sw.js`が生成される。
- [x] 2.4 build生成物を静的に確認する。完了条件: manifestの全項目とicon実寸、HTMLのmanifest link、SWのHTML/JS/CSS/icon precacheと旧cache cleanup、動的API runtime cacheがないことを確認できる。
- [x] 2.5 `cd frontend && npm run preview`で可能な範囲を確認する。完了条件: localhost上でmanifest/icon/SWを取得し、利用可能なブラウザのApplication/ManifestとService Workersで重大なinstallability error、pluginによる自動登録・scope、通常PC/スマホ表示を確認する。ブラウザや認証環境がない場合は実施できた範囲と未確認範囲を記録する。dev serverでSWが動かないことは不合格としない。 ローカルpreviewのHTTP取得は確認済み。ブラウザDevTools・認証を要する画面操作は実行環境にブラウザがなく未確認。

## Manual acceptance checklist

以下はデプロイ後に人が確認し、結果と未確認項目を記録する。未実施でも上記のCodex implementation/local verification tasksは完了できる。

### Vercel

- ☐ Vercel previewとproductionの各frontend originで`/`、`/index.html`、`/sw.js`、`/manifest.webmanifest`とicon PNGが取得でき、status・Content-Type・指定したCache-Control・SWの`/` scopeが正しい。asset URLがHTMLへ誤rewriteされない。
- ☐ 案内用production origin `https://planrail-frontend.vercel.app`と過去の`https://ryuute-v2-frontend.vercel.app`のVercel project/alias関係を管理画面で照合する。別originにインストールしたPWAは別扱いとして記録する。
- ☐ 通常のPCブラウザ、mobile Safari/Chrome、Vercel previewで既存Reactアプリの認証・画面・主要操作が維持される。

### iPhone

- ☐ 実機Safariでproduction URLを開き、ホーム画面へ追加してアイコンからstandalone起動する。
- ☐ ホーム画面アプリ内でGoogleログイン、Timeline表示、カレンダー・準備への移動、bottom navigation、FAB、modal、bottom sheet、再起動を確認する。Safariタブとstandaloneの保存領域・認証状態の差も記録する。
- ☐ notch/Dynamic Island、status bar、Home Indicatorとtop bar、bottom navigation、FAB、modal/bottom sheet、スクロール末尾、ソフトウェアキーボードが重ならないことを通常Safariとstandaloneで確認する。必要なCSS微調整が見つかった場合は別途実装修正する。

### Android

- ☐ 実機Chromeでproduction URLをインストールし、ホーム画面アイコンからのstandalone起動、ログイン、既存mobile navigation、再起動を確認する。

### Update and rollback

- ☐ 同じproduction originでインストール済みPWAを起動後、更新されたbuildをデプロイし、通常の再訪・再起動でService Workerと静的アプリ版が更新され、旧precacheがcleanupされることを確認する。手動cache削除は使わず、開いているフォームが更新のために強制reloadされないことも確認する。
- ☐ rollback後も通常のService Worker更新で戻した版へ移れ、手動cache削除を通常の復旧操作として要求しないことを確認する。
