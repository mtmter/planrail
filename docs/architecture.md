# Architecture

この文書は、現在のコードから確認できるPlanRailの構成と責務を説明します。画面上の詳細な挙動とデータ契約は `openspec/specs/` を参照してください。

## 全体構成

```text
Browser / React
  |
  +-- Firebase Authentication -- Google login
  |
  +-- Cloud Firestore --------- events, preparations, travelPlans
  |
  +-- Google Maps JavaScript API / Places
  |
  +-- FastAPI
        |
        +-- GET  /api/health
        +-- POST /api/route-search
               |
               +-- Mock Provider
               +-- Transit Provider
                       +-- /places/reverse
                       +-- /guidance/plan
```

フロントエンドは認証済みユーザーのuidを使い、Firestoreの `users/{uid}` 以下を直接読み書きします。FastAPIはFirestoreのCRUDを担当しません。

## フロントエンド

- `src/App.jsx`: 認証後の画面状態、データ読み込み、CRUD操作、経路検索の接続
- `src/auth/`: Firebase Authenticationの状態とGoogleログイン・ログアウト
- `src/firestoreService.js`: ユーザー別FirestoreパスとCRUD
- `src/googleMaps.js`: Google Maps JavaScript APIの遅延読み込み
- `src/components/`: カレンダー、モーダル、経路、準備案内などのUI
- `src/dateUtils.js`: ローカル日時文字列とカレンダー表示用の日時計算

予定と準備項目はログイン後にまとめて読み込みます。移動予定は一覧として読み込まず、予定詳細を開いたときに対象予定の1件を読み込みます。そのため、現在のカレンダーは予定だけを表示し、移動予定を時間ブロックとして表示しません。

## バックエンド

- `main.py`: FastAPIアプリ、CORS、リクエスト・レスポンスモデル、HTTPエラー変換
- `routes_service.py`: Provider選択とTransit形式から共通Route形式への変換
- `route_providers/transit_provider.py`: Transit API問い合わせ、Google Places座標の駅・停留所解決
- `route_providers/mock_provider.py`: Transit形式fixtureの読み込みと時刻調整
- `fixtures/transit_guidance_plan_demo.json`: Mock Providerが返すTransit guidance-plan形式データ

Providerから取得したデータはバックエンドでアプリ共通Route JSONへ変換します。フロントエンドとFirestoreはTransit APIの生レスポンスを扱いません。

## データ境界

Firestore Security Rulesは、認証中のuidとパス上のuidが一致するときだけ `users/{uid}` 以下の読み書きを許可します。フィールド単位のスキーマ検証はSecurity Rulesには定義されていません。

FastAPIのCORSは、未設定時に次のオリジンを許可します。

```text
http://localhost:5173
http://127.0.0.1:5173
```

`CORS_ORIGINS` が設定されている場合は、カンマ区切りの値を使用します。

Google Placesは場所候補と緯度・経度の取得に引き続き使用します。経路検索ではTransit endpointへのリクエスト時だけ station/stop IDを利用し、共通Route JSONやFirestoreには含めません。Google Routes APIは現在の経路Providerとして使用しません。
