# Deployment

このリポジトリとVercelから確認できるデプロイ設定、およびほかの外部サービス側で確認が必要な事項を分けて記載します。PlanRailの案内用production URLは`https://planrail-frontend.vercel.app`です。

## 現在の本番環境

以下は2026年9月8日にVercel CLIと公開URLで確認した当時の構成です。この確認時点ではTransit Providerへの置換前でした。表のfrontend URLは当時確認したURLで、現在の案内用production URLではありません。

| 用途 | Project | Root Directory | Framework Preset | 公開URL |
| --- | --- | --- | --- | --- |
| フロントエンド | `ryuute-v2-frontend` | `frontend` | Vite | `https://ryuute-v2-frontend.vercel.app` |
| バックエンド | `ryuute-v2-backend` | `backend` | FastAPI | `https://ryuute-v2-backend.vercel.app` |

両プロジェクトの直近Production Deploymentは `READY` です。フロントエンドは `npm run build`、バックエンドは `pip install -r requirements.txt` を使用する設定です。VercelのProject設定では両方にNode.js 24.xが選択されていますが、バックエンドのPythonランタイムバージョンはリポジトリでもVercel CLIの表示でも確認できませんでした。

Production環境には次の環境変数名が登録されています。値は暗号化されており、この確認では取得していません。

フロントエンド:

```text
VITE_GOOGLE_MAPS_API_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_BACKEND_API_BASE_URL
```

バックエンド:

```text
ROUTE_PROVIDER
CORS_ORIGINS
```

当時の公開経路検索はMock fixtureと同じ構造・所要時間の結果を返していました。`ROUTE_PROVIDER` の実値はリポジトリやVercel CLIから取得できないため、デプロイ時にはVercelのバックエンドProjectで値を確認し、`transit` に設定してください。`ROUTE_PROVIDER` が明示されている場合はアプリの既定値より優先されるため、古い `mock` 設定が残っているとTransitへ切り替わりません。Transit APIにAPIキーは不要です。

公開環境では次を確認済みです（Transit候補を複数返す今回の変更をデプロイする前の契約です）。

- フロントエンドURLがHTTP 200とHTMLを返す
- `GET /api/health` がHTTP 200と `{"status":"ok"}` を返す
- `POST /api/route-search` がHTTP 200と従来の単一Route JSONを返す
- バックエンドが `https://ryuute-v2-frontend.vercel.app` をCORSで許可する

## リポジトリで管理している設定

`firebase.json` は `firestore.rules` をFirestore Security Rulesとして参照しています。Firebase Hostingの設定はありません。

リポジトリにはfrontend専用の`frontend/vercel.json`があり、PWA資源のheaderだけを設定しています。backend用の`vercel.json`はありません。

リポジトリには次の設定がありません。

- GitHub ActionsなどのCI/CDワークフロー
- Node.jsまたはPythonのランタイムバージョン指定

Vercelの設定はリポジトリだけでは再現されないため、変更時は上記のProject設定とこの文書を同期する必要があります。

## Vercel Projectを再作成する場合

同じリポジトリからフロントエンドとバックエンドを別プロジェクトとして設定します。

| 用途 | Root Directory | 必要な主な設定 |
| --- | --- | --- |
| フロントエンド | `frontend` | Firebase、Google Maps、バックエンドURL |
| バックエンド | `backend` | `ROUTE_PROVIDER=transit`、CORS |

バックエンドの環境変数例:

```text
ROUTE_PROVIDER=transit
CORS_ORIGINS=https://<frontend-domain>
```

フロントエンドの環境変数例:

```text
VITE_GOOGLE_MAPS_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BACKEND_API_BASE_URL=https://<backend-domain>/api
```

`VITE_BACKEND_API_BASE_URL` の末尾は `/api` とし、その後ろに `/` を付けません。Viteの環境変数はビルド時に取り込まれるため、値を変更した場合はフロントエンドを再デプロイします。

## PWAの配信と確認

frontendの通常の`npm run build`は、`vite-plugin-pwa`でWeb App ManifestとService Workerを生成します。案内用production originは`https://planrail-frontend.vercel.app`で、manifestはその`/manifest.webmanifest`、Service Workerは`/sw.js`、登録scopeは`/`です。previewでは各preview originの同じパスを確認します。アイコンは`/pwa-192x192.png`、`/pwa-512x512.png`、`/pwa-maskable-512x512.png`、iOS用の`/apple-touch-icon.png`です。PWAの登録・cacheはoriginごとに独立します。

`frontend/vercel.json`は`/`、`/index.html`、`/sw.js`、`/manifest.webmanifest`に`Cache-Control: public, max-age=0, must-revalidate`を指定します。manifestには`Content-Type: application/manifest+json`も指定します。hashed JS/CSS/assetsには特別なheaderを追加せず、広いSPA rewriteも設定しません。backendの配信設定は変更しません。

Vercel previewとproductionのそれぞれで次を確認します。

1. ブラウザのNetworkまたはHTTPクライアントで`/manifest.webmanifest`、`/sw.js`、各アイコンを直接取得し、HTTP status、Content-Type、上記Cache-Controlを確認します。manifestの名前・説明・`id`・`start_url`・`scope`・表示モード・色・アイコンと画像寸法も確認します。previewが保護されている場合はアクセス可能なセッションで確認します。
2. Chrome DevToolsのApplication > Manifestでinstallabilityの重大なエラーがないこと、Application > Service WorkersでSWがfrontend originの`/`へ登録されていることを確認します。通常のPC/スマホブラウザ画面も回帰確認します。
3. 新buildを同じoriginへデプロイして通常の再訪・再起動でSWと静的アプリ版が更新され、旧precacheが削除されることを確認します。登録はpluginが生成するscriptに任せ、アプリ側の更新監視、手動cache削除、更新UIは通常運用に含めません。開いたフォームが更新のために強制reloadされないことも確認します。
4. rollbackは旧コードを再デプロイしたうえで同じoriginから再訪し、戻した版のSWと画面へ移行できることを確認します。既に登録されたSWが残り得るため、公開HTMLだけでなくSW・precacheも確認します。

実機iPhone/Androidでのホーム画面追加、standalone起動、認証、safe areaは`enable-pwa-installation` changeのManual acceptance checklistで扱います。

経路検索APIは今回の変更で単一Route JSONから候補レスポンス（最大3件）へ変わるため、バックエンドとフロントエンドを同じリリースで更新してください。片方だけが新旧で混在すると検索結果を処理できません。リポジトリには両プロジェクトを一括デプロイするCI/CDがないため、同じ変更コミットから両方をデプロイし、経路検索・候補選択・移動予定登録を確認します。

## 外部サービス側の確認

- Firebase AuthenticationでGoogleログインが有効であること
- Firebase AuthenticationのAuthorized domainsにフロントエンドドメインがあること
- Google Mapsのブラウザ用キーで必要なAPIとHTTPリファラが許可されていること
- FastAPIの `CORS_ORIGINS` が実際のフロントエンドオリジンと一致すること
- Firestore Security Rulesが `firestore.rules` の内容でデプロイされていること

## デプロイ後の確認

バックエンド:

```text
GET https://<backend-domain>/api/health
```

期待するレスポンス:

```json
{"status":"ok"}
```

フロントエンドでは、Googleログイン、Firestoreの読み書き、場所入力、経路検索、移動予定登録を実環境で確認します。

## 未確認事項

環境変数の実値、Firebase AuthenticationのAuthorized domains、Google Maps APIキーのHTTPリファラ制限、デプロイ済みFirestore Security Rulesの版は今回取得していません。これらは各サービスの管理画面で確認する必要があります。

案内用production URLは`https://planrail-frontend.vercel.app`と決定しました。過去の確認結果にある`https://ryuute-v2-frontend.vercel.app`とのVercel project/alias関係は管理画面で未確認です。PWAの配信・実機確認は案内用production originで行い、previewや別originのインストールと混同しないでください。
