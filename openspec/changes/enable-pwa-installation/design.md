## Context

`frontend`は単一のReact/Viteアプリで、`vite.config.js`はReact pluginのみ、`index.html`は`/favicon.svg`と`viewport-fit=cover`を持つ。manifestとService Workerはない。`package.json`/lockfileはVite `^8.2.0`、`npm test`、lint、buildを定義する。既存の`public/favicon.svg`は青い角丸背景と白い「P」のPlanRailアイコンで、`App.css`のモバイルtop bar、bottom navigation、FAB、追加sheetは既に`env(safe-area-inset-*)`を使っている。認証は`AuthProvider.jsx`でGoogle `signInWithPopup`、データCRUDはブラウザからFirestoreへ直接行う。

Vercel frontend projectは`frontend`をRoot DirectoryとするVite projectで、`npm run build`を実行する。change作成前のrepositoryに`vercel.json`はなく、backendは別project/originである。案内用production URLはユーザー指定の`https://planrail-frontend.vercel.app`とする。2026-09-08時点の`docs/deployment.md`は`https://ryuute-v2-frontend.vercel.app`を過去の確認先として記す。両URLはHTTP 200と同じHTML/asset名を返したが、同一projectのaliasかは管理画面で未確認である。PWAのインストールとSWはorigin別になるため、productionのPWA確認は案内用URLで行う。現行canonical `schedule-management`は3表示と旧追加導線を記す一方、未archiveの`introduce-timeline-view`と`redesign-mobile-schedule-navigation`には採用済みのタイムラインと3つのmobile tabがある。この不整合は本changeでcanonicalへ同期せず、PWAが現在の実装と進行中のchangeに重なる箇所だけ回帰確認する。

## Goals / Non-Goals

**Goals:** Vite buildだけで配信可能なPWA資源を生成し、既存の一つのReactアプリを通常ブラウザとホーム画面起動の両方で使う。静的資源だけをprecacheし、新deploymentへ自動で移る。

**Non-Goals:** Firestore/Auth/APIのオフライン機能、動的レスポンスのruntime cache、独自Service Worker・更新画面、React splash画面、認証方式やFirebase設定の変更、画面・backendの再設計。

## Decisions

### 1. `vite-plugin-pwa` 1.3.0をbuild用依存として使う

`frontend/package.json`とlockfileへ開発依存として追加し、`vite.config.js`の既存`react()`に`VitePWA(...)`を加える。1.3.0の公開package metadataはVite `^8.0.0`をpeer dependencyに含み、repositoryのVite `^8.2.0`と合う。Nodeの公開engineは`>=16`で、文書上のVercel projectのNode 24.xとも合う。導入時はlockfileを更新し、実際の解決版で`npm test`、lint、buildを実行する。pluginはbuild時にmanifest、Workbox Service Worker、登録コードを出力する。productionへ新しいサーバーやruntime依存を要求しない。手書きSWや別のmanifest生成スクリプトは採らない。

参考: [vite-plugin-pwa 1.3.0 package metadata](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/package.json)、[登録方式](https://vite-pwa-org.netlify.app/guide/register-service-worker)。

### 2. manifestをVite設定から生成し、アイコンは`public/`に置く

pluginの`manifest`を唯一のmanifest定義とし、`manifestFilename: 'manifest.webmanifest'`、`name`/`short_name: 'PlanRail'`、`description: '移動予定と準備をまとめて管理するスケジュールアプリ'`、`lang: 'ja'`、`id: '/'`、`start_url: '/'`、`scope: '/'`、`display: 'standalone'`、`theme_color: '#2957c8'`、`background_color: '#ffffff'`を設定する。`id`は将来の起動URL変更でも同じアプリとして識別されるため固定する。root URLは現在の単一画面アプリに合い、productionとpreviewではoriginごとに解決される。`index.html`には生成manifestへのlinkをpluginに任せ、既存faviconとviewport指定を維持して`meta name="theme-color"`を色に合わせる。二重の手書きmanifest linkは作らない。

画像の完成ファイルは`frontend/public/pwa-192x192.png`、`pwa-512x512.png`、`pwa-maskable-512x512.png`、`apple-touch-icon.png`（180×180）とする。manifestの通常アイコンは前二者を`purpose: 'any'`、`type: 'image/png'`、実サイズで参照し、maskableは専用512画像を`purpose: 'maskable'`で参照する。iOSのtouch iconは`index.html`から明示的に参照する。現行favicon SVGを拡大・ラスタライズして通常版と180版を作れる。maskable版は青背景を全域に敷き、白いPを中央のmaskable safe zone内へ縮小配置する。単純な通常版の`maskable`指定は、OSのマスクでPが切れるおそれがある。アイコンを新たにデザインせず、safe zoneと実ファイル寸法をChrome DevToolsで確認する。`icons.svg`は外部サービスのsymbol集であり、アプリアイコンの素材にしない。

参考: [manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)、[Chromeのmanifest確認](https://developer.chrome.com/docs/devtools/progressive-web-apps)。

### 3. `generateSW`で静的app shellだけをprecacheする

pluginの`generateSW`を使い、buildの`index.html`、hashed JS/CSS、およびmanifestに記載した公開アイコンをprecacheする。Workboxのdefault `globPatterns`はJS/CSS/HTMLで、manifest iconsは`public/`から自動収録される。必要な追加公開assetは`includeAssets: ['favicon.svg', 'apple-touch-icon.png']`に限定し、`runtimeCaching`を設定しない。`workbox.navigateFallback: '/index.html'`と`navigateFallbackAllowlist: [/^\/$/]`でナビゲーションfallbackを現在の`/`だけに制限し、任意パス・外部origin・API requestをapp shellへ書き換えない。Firestore SDK内部の永続化機能やブラウザHTTP cacheの振る舞いを、このSWのオフライン保証とは扱わない。オフラインで静的shellが描画されても認証・データ・検索の成功を約束しない。

参考: [precache対象の既定値](https://vite-pwa-org.netlify.app/guide/service-worker-precache)、[public assetの収録](https://vite-pwa-org.netlify.app/guide/static-assets)。

### 4. ブラウザの通常のService Worker更新確認を使う

`registerType: 'autoUpdate'`とpluginの自動登録（`injectRegister: 'auto'`）を使う。アプリコードに`virtual:pwa-register`をimportせず、`main.jsx`は変更しない。この組み合わせではpluginが登録scriptをHTMLへ生成し、Workboxの`skipWaiting`と`clientsClaim`を有効にする。`generateSW`は旧precacheのcleanupを既定で行う。新deploymentは再訪・再起動などに伴うブラウザとService Workerの通常の更新確認で検出し、手動cache削除を通常運用で要求しない。独自の更新確認ロジックや更新UIは追加しない。`devOptions`は有効化せず、開発serverでSWが登録されないことは不合格としない。

pluginの自動登録scriptはService Workerを登録するだけで、更新を検出した開いたページへ独自のreloadを要求しない。これにより編集中のEvent/Journeyフォームを更新のために強制reloadしない一方、長時間開いたままの画面がdeploy直後に必ず切り替わるとは保証しない。次の通常の再訪・再起動で新しい静的アプリ版を表示する。実際の更新とフォームへの影響はdeployment後のManual acceptanceで確認する。古いビルド資源を残し続けるための任意runtime cacheは導入しない。

参考: [pluginのautoUpdateとcleanup](https://vite-pwa-org.netlify.app/guide/auto-update)。

### 5. iOSではmanifestのstandaloneを使い、既存safe areaを実機で確認する

Appleの現行説明はmanifestの`display: standalone`でiPhoneのホーム画面Webアプリになるとしている。このため旧来の`apple-mobile-web-app-capable`を重ねて指定せず、status bar styleも実機で必要性が示されない限り追加しない。180pxのapple touch iconはホーム画面アイコンの見え方を一定にするため採用する。`viewport-fit=cover`を維持し、既存のtop bar上側、bottom navigation/FAB下側、追加sheet下側の`env(safe-area-inset-*)`を起点に、通常Safariとstandaloneの実表示差だけを微調整する。login画面、汎用modal、キーボード表示、スクロール末尾も見る。React側の別画面やsplash UIは作らない。

iOSのホーム画面WebアプリはSafariタブと保存領域が分かれるため、Safariですでにログインしていても初回のホーム画面起動で再ログインが必要な場合がある。既存Google popupがその場で完了するかを実機確認する。popupが失敗した場合は今回のPWA達成条件の未充足として報告し、Firebase設定変更を無断で行わない。

参考: [AppleのiOS Webアプリ説明](https://developer.apple.com/videos/play/wwdc2023/10120/)、[Appleのmanifest icon説明](https://developer.apple.com/videos/play/wwdc2022/10048/)、[Firebaseのpopupに関する注意](https://firebase.google.com/docs/auth/web/redirect-best-practices)。

### 6. Vercelではfrontend projectの静的配信を維持する

`frontend/vercel.json`を最小限のheader設定として用意し、`/`、`/index.html`、`/sw.js`、`/manifest.webmanifest`に`Cache-Control: public, max-age=0, must-revalidate`を指定する。`/manifest.webmanifest`には`Content-Type: application/manifest+json`も指定する。hashed JS/CSSやその他のassetには今回特別なcache headerを追加せず、Vite/Vercelの通常の配信挙動に任せる。生成済み`/sw.js`はJavaScript MIME、PNGは`image/png`で、root scopeがそのfrontend origin内だけになることをdeployment後のproduction/preview応答で確認する。広い`/(.*) -> /index.html`のrewriteは導入しない。これは現在routerがなく、manifest・SW・iconの直接取得を誤ってHTMLへ送らないためである。`docs/deployment.md`には設定と確認方法を追記する。backend projectとAPI契約は変更しない。

参考: [Vite PWAのVercel配信ガイド](https://vite-pwa-org.netlify.app/deployment/vercel)。

## Risks / Trade-offs

- 開いたままのページは更新後も旧版の表示を続ける場合がある → 再訪・再起動で新しい版へ移ることとフォームへの影響をManual acceptanceで記録する。更新戦略の変更が必要なら別途判断する。
- precache済みのshellはネットワーク断でも開くが、認証状態とFirestoreデータは保証されない → オフライン対応と誤認しない仕様・検証にし、API runtime cacheを置かない。
- iOSではSafariとホーム画面アプリの保存領域が別になる → 初回ログイン、再起動、popupの戻り先をManual acceptanceで実機確認する。未実施でもCodexの実装task完了を妨げず、受け入れ結果は未確認として残す。
- Vercelの実Project設定やheaderはrepositoryだけから確定できない → frontend/previewとproductionの公開応答を確認し、header/URLが一致しなければ公開完了としない。
- 過去のdeployment資料には別のfrontend URLがある → 案内用production URLは`https://planrail-frontend.vercel.app`に統一し、Vercelのproject/alias関係は別途照合する。別originのインストール済みPWAは別アプリとして扱う。
- `safe-area-inset-*`の計算値とmodalの収まりは端末・status bar状態に依存する → iPhone実機でtop/bottom、FAB、modal、sheetとソフトウェアキーボードを確認し、必要なCSSだけ調整する。

## Migration Plan

1. frontendのみの変更を同じVite buildでpreviewへ出し、manifest・アイコン・SW・通常ブラウザ・Android installabilityを検証する。
2. productionへ出し、iPhone/Androidのホーム画面起動と再起動を確認する。旧版から新buildへの更新は、同一originで小さな静的表示差を持つ連続buildを使って検証する。
3. 問題があれば変更を戻して再deployする。ただし既に登録されたSWは端末側に残るため、rollback後のSW更新と旧cache cleanupも検証し、キャッシュ削除を通常のrollback手順として要求しない。
