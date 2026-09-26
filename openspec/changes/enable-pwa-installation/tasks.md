## 1. PWA資源とbuild設定

- [ ] 1.1 `frontend/package.json`とlockfileへVite 8対応の`vite-plugin-pwa` 1.3.0を開発依存として追加する。完了条件: 通常のnpm installでpeer dependency errorがなく、解決されたVite/plugin/Node版を確認できる。
- [ ] 1.2 `frontend/public/favicon.svg`の現行「青背景＋白P」から`pwa-192x192.png`、`pwa-512x512.png`、safe zoneにPが収まる`pwa-maskable-512x512.png`、180×180の`apple-touch-icon.png`を`frontend/public/`へ作る。完了条件: ファイルの実寸・PNG形式、通常/マスク時の視認性を確認できる。
- [ ] 1.3 `frontend/vite.config.js`でpluginの`generateSW`、manifest（PlanRail名、`id`/`start_url`/`scope`=`/`、standalone、色、通常192/512とmaskable icon）、静的asset precache、旧cache cleanupを設定する。完了条件: production buildの`dist/manifest.webmanifest`と`sw.js`が生成され、manifestの値とprecache一覧にHTML/JS/CSS/公開アイコンが含まれ、動的APIのruntime cacheがない。
- [ ] 1.4 `frontend/index.html`の既存`viewport-fit=cover`とfaviconを維持し、theme-colorとapple touch iconを参照する。完了条件: build後のHTMLでmanifest linkが一つ、viewportとicon参照が正しい。

## 2. Service Worker登録とVercel配信

- [ ] 2.1 `frontend/src/main.jsx`でpluginの登録APIを一度だけ使い、`autoUpdate`と再表示時・可視状態の約1時間ごとの更新確認を有効にする。完了条件: `npm run preview`のApplication/Service Workersで`/sw.js`が`/` scopeに登録され、二重登録や不要な更新UIがない。開発serverでの未登録は問題としない。
- [ ] 2.2 `frontend/vercel.json`へfrontendの`/sw.js`・HTML再検証と`/manifest.webmanifest`のContent-Typeに必要な最小headerだけを追加し、`docs/deployment.md`へPWA配信と更新確認方法を記す。完了条件: frontend Root Directoryの通常Vite buildを維持し、`vercel.json`がbackendや全パスrewriteを追加していない。READMEとdeployment資料の二つのfrontend URLは現在のVercel project/aliasと照合し、案内するproduction originを明記する。

## 3. buildとブラウザでの統合確認

- [ ] 3.1 `cd frontend && npm test && npm run lint && npm run build`を実行する。完了条件: 3コマンドが成功し、失敗時は原因を修正して再実行する。backendに変更がないためbackend unittestは対象外とする。
- [ ] 3.2 `npm run preview`で生成manifestとicon URLを直接取得し、名前・表示・起動範囲・色・画像寸法、Service Worker登録/制御、静的precache、Firestore/Auth/Places/経路APIの非runtime-cacheを確認する。完了条件: ブラウザNetwork/Applicationとbuild生成物で根拠を記録でき、オフライン時も静的shell以上の機能を成功扱いにしていない。
- [ ] 3.3 Chromium DevToolsのApplication/ManifestとService Workersでinstallabilityの重大なエラーがなく、192/512/maskable iconの読み込みとsafe zoneを確認する。完了条件: DevToolsの診断結果を記録し、実機でのホーム画面起動とは区別する。
- [ ] 3.4 通常のPCブラウザ、mobile Safari/Chrome、Vercel previewで既存のログイン、画面、操作を回帰確認する。完了条件: PCの月/週/日/Timeline、スマホのタイムライン→カレンダー→準備、Event/Journeyの主要操作が同じReactアプリで使える。実機やログイン環境が不足した範囲は未確認として記録する。

## 4. Vercel productionとiPhoneの受け入れ確認

- [ ] 4.1 frontendのpreviewとproductionへ通常のVite buildをデプロイし、各originの`/manifest.webmanifest`、icon PNG、`/sw.js`、`/`のHTTP status、Content-Type、cache header、SW scopeを確認する。完了条件: asset URLがHTMLへ誤rewriteされず、productionでSW登録・制御が確認できる。デプロイできない場合はこのtaskを未完了のままにする。
- [ ] 4.2 可能ならiPhone実機Safariでproduction URLを開き「ホーム画面に追加」→アイコンから起動→standalone状態でGoogleログインとTimeline表示→カレンダー/準備、bottom navigation、FAB、modal、bottom sheet、再起動まで確認する。完了条件: 各操作の結果を記録し、Safariとホーム画面アプリで認証状態が別でもログインできる。実機確認ができなければ完了扱いにせず未確認を列挙する。
- [ ] 4.3 iPhone実機のnotch/Dynamic Island、status bar、Home Indicatorとtop bar、bottom navigation、FAB、modal/bottom sheet、スクロール末尾・キーボードの位置を確認し、必要な`App.css`の微調整だけ行う。完了条件: 通常Safariとstandaloneの両方で操作が遮られない。実機確認ができなければ未完了のまま残す。
- [ ] 4.4 同じproduction originで一度PWAを起動後、小さな静的表示差を含む新buildをデプロイし、再起動または再表示でSWが更新され最新版へ移ることと旧precache cleanupを確認する。完了条件: 更新ボタンや手動cache削除を使わず新しい版へ移行し、フォーム編集中の自動再読み込みの影響も記録する。二度のdeployができない場合は未完了にする。
- [ ] 4.5 可能ならAndroid実機のChromeでproduction URLをインストールし、ホーム画面アイコンからのstandalone起動、ログイン、既存mobile navigation、再起動を確認する。完了条件: 実機操作の結果を記録し、実機がなければ未確認としてこのtaskを未完了のまま残す。
