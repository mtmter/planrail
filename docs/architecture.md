# Architecture

この文書は、現在のコードから確認できるPlanRailの構成と責務を説明します。画面上の詳細な挙動とデータ契約は `openspec/specs/` を参照してください。

## 全体構成

```text
Browser / React
  |
  +-- Firebase Authentication -- Google login
  |
  +-- Cloud Firestore --------- events, tasks, preparations, travelPlans
  |
  +-- Google Maps JavaScript API / Places
  |
  +-- FastAPI
        |
        +-- GET  /api/health
        +-- POST /api/route-search
               |
               +-- Mock Provider
               +-- Ekispert Provider
```

フロントエンドは認証済みユーザーのuidを使い、Firestoreの `users/{uid}` 以下を直接読み書きします。FastAPIはFirestoreのCRUDを担当しません。

## フロントエンド

- `src/App.jsx`: 認証後の画面状態、データ読み込み、CRUD操作、経路検索の接続
- `src/auth/`: Firebase Authenticationの状態とGoogleログイン・ログアウト
- `src/firestoreService.js`: ユーザー別FirestoreパスとCRUD
- `src/googleMaps.js`: Google Maps JavaScript APIの遅延読み込み
- `src/components/`: カレンダー、モーダル、経路、準備案内などのUI
- `src/dateUtils.js`: ローカル日時文字列とカレンダー表示用の日時計算

予定、タスク、準備項目はログイン後にまとめて読み込みます。移動予定は一覧として読み込まず、予定詳細を開いたときに対象予定の1件を読み込みます。そのため、現在のカレンダーは移動予定を時間ブロックとして表示しません。

## バックエンド

- `main.py`: FastAPIアプリ、CORS、リクエスト・レスポンスモデル、HTTPエラー変換
- `routes_service.py`: Provider選択と駅すぱあと形式から共通Route形式への変換
- `route_providers/mock_provider.py`: fixtureの読み込みと時刻調整
- `route_providers/ekispert_provider.py`: 駅すぱあとAPIへのHTTPリクエスト
- `fixtures/ekispert_route_demo.json`: Mock Providerが返す駅すぱあと形式データ

Providerから取得したデータはバックエンドでアプリ共通Route JSONへ変換します。フロントエンドとFirestoreは駅すぱあとの生レスポンスを扱いません。

## データ境界

Firestore Security Rulesは、認証中のuidとパス上のuidが一致するときだけ `users/{uid}` 以下の読み書きを許可します。フィールド単位のスキーマ検証はSecurity Rulesには定義されていません。

FastAPIのCORSは、未設定時に次のオリジンを許可します。

```text
http://localhost:5173
http://127.0.0.1:5173
```

`CORS_ORIGINS` が設定されている場合は、カンマ区切りの値を使用します。

## 残存している旧Google Routesコード

`backend/routes_service.py` にはGoogle Routes APIを呼び出して共通Route形式へ変換する関数と、そのユニットテストが残っています。ただし、この関数は現在のProvider一覧にもFastAPIエンドポイントにも接続されていません。

このコードを互換用として維持するか削除するかは未決定です。現在のプロダクト仕様には含めません。
