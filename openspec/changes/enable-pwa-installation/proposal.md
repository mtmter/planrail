## Why

PlanRailのスマホ画面は用意されているが、Web App ManifestとService Workerがないため、ホーム画面から独立したアプリとして起動する体験が整っていない。既存のWeb版とデータ連携を保ちながら、iPhoneとAndroidでインストール可能なPWAにする。

## What Changes

- PlanRailの名前、起動URL、表示モード、色、通常・maskableアイコンを定義したmanifestを、Viteのproduction buildから配信する。
- build時にapp shellと静的assetをprecacheするService Workerを生成・登録し、デプロイ後の更新を自動適用する。Firestore、認証、経路検索、Places、Transitなどの動的データはオフライン提供しない。
- iOSのホーム画面起動、Android/Chromiumのインストール、Vercel上の配信と更新、standalone時のsafe areaと既存画面の回帰を検証する。
- 通常のスマホ/PCブラウザとVercel previewでも同じReactアプリを継続利用する。新しいReactのホーム画面、install UI、画面遷移は追加しない。

## Capabilities

### New Capabilities

- `pwa-installation`: manifest、ホーム画面からのstandalone起動、静的app shellのcache、Service Worker更新、既存Web体験との共存。

### Modified Capabilities

なし。`authentication-and-persistence`と、未archiveの`redesign-mobile-schedule-navigation`が定める認証・スマホ画面は変更せず、PWA起動時にもそれらを利用する。

## Impact

- Frontend: `vite.config.js`、`index.html`、`public/`のアイコン、`package.json`とlockfile。必要な場合に限り`App.css`のsafe areaを微調整する。
- Build/deploy: Vite 8系と互換の`vite-plugin-pwa`を開発依存に追加し、生成物を既存のVercel frontend project（Root Directory `frontend`）から静的配信する。配信headerが必要なら`frontend/vercel.json`を最小限追加する。
- 既存のFirebase Authentication/Firestore構造、API、backend、PC画面の機能契約は変更しない。
- 対象外: Push通知と許可UI、位置情報と遅延検知、background/periodic sync、Firestoreや経路/API結果のオフライン化、高度なruntime cache、独自install UI・誘導banner、native化、Capacitor、React Native、TanStack Router、Firebase構成変更、backend変更、スマホUI再設計。
