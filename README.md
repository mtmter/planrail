# PlanRail

PlanRailは、予定・タスクと、その予定に向かうための経路や準備項目をまとめて管理するWebスケジュール帳です。

Googleアカウントでログインすると、ユーザーごとのデータをCloud Firestoreへ保存します。予定に場所を設定すると、Google Mapsで場所を開いたり、FastAPIバックエンドを通じて経路を検索したりできます。検索した経路は移動予定として登録し、予定詳細から確認できます。

## 主な機能

- 月・週・日のカレンダー表示
- 予定とタスクの追加・編集・削除
- タスクの完了・未完了管理
- Google Placesによる場所候補と、候補を利用できない場合の文字入力
- Google Mapsへの場所リンク
- Transit APIまたは開発・テスト用Mock Providerを使った公共交通経路検索
- 検索結果の移動予定への登録
- 予定ごとの準備チェックリストと、開始前の準備案内

現在、登録した移動予定は予定詳細に表示されます。カレンダー上に移動時間ブロックとして表示する機能は実装されていません。

## 構成

| 領域 | 技術・役割 |
| --- | --- |
| `frontend/` | React、Vite、Firebase Authentication、Cloud Firestore、Google Places |
| `backend/` | FastAPI、経路検索、Transit・Mock Provider |
| `openspec/` | 実装済みのプロダクト仕様と、今後の変更管理 |
| `docs/` | アーキテクチャ、外部Provider、デプロイなどの技術資料 |

予定、タスク、準備項目、移動予定の読み書きはフロントエンドからFirestoreへ直接行います。FastAPIが提供するアプリ用APIは、ヘルスチェックと経路検索の2つです。

詳しくは次を参照してください。

- [アーキテクチャ](docs/architecture.md)
- [経路Provider](docs/route-providers.md)
- [デプロイ](docs/deployment.md)
- [現行OpenSpec](openspec/specs/)

## 本番環境

- フロントエンド: [https://ryuute-v2-frontend.vercel.app](https://ryuute-v2-frontend.vercel.app)
- バックエンド・ヘルスチェック: [https://ryuute-v2-backend.vercel.app/api/health](https://ryuute-v2-backend.vercel.app/api/health)

フロントエンドとバックエンドは、同じリポジトリから別々のVercel Projectとしてデプロイしています。Root Directory、Framework Preset、環境変数などの再現手順は[デプロイ資料](docs/deployment.md)を参照してください。

## 必要なもの

- Node.jsとnpm
- Python 3
- GoogleログインとCloud Firestoreを利用できるFirebaseプロジェクト
- 場所候補を利用する場合は、Maps JavaScript APIとPlaces APIを利用できるブラウザ用APIキー
- Transit APIは公開APIのため、経路検索用APIキーは不要

Node.jsとPythonの対応バージョンは現在リポジトリで固定されていません。依存関係は `frontend/package-lock.json` と `backend/requirements.txt` で管理されています。

## フロントエンドの設定

```bash
cd frontend
npm ci
cp .env.example .env.local
```

`.env.local` に次を設定します。

```text
VITE_GOOGLE_MAPS_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BACKEND_API_BASE_URL=http://localhost:8000/api
```

`VITE_GOOGLE_MAPS_API_KEY` が未設定、またはPlacesを読み込めない場合も、場所は文字列として入力できます。FirestoreのCRUDにはバックエンドURLを使用しません。

## バックエンドの設定

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

既定のProviderはTransit APIです。自動テストやローカルで外部APIへ接続せずに動作確認する場合は `ROUTE_PROVIDER=mock` を指定できます。

```text
ROUTE_PROVIDER=transit
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`ROUTE_PROVIDER` は `transit` または `mock` を指定できます。`CORS_ORIGINS` はカンマ区切りで複数指定できます。

秘密情報を含む `.env` と `.env.local` はコミットしないでください。

## 起動

ターミナルを2つ使用します。

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

```bash
cd frontend
npm run dev
```

フロントエンドは通常 `http://localhost:5173`、バックエンドのヘルスチェックは `http://localhost:8000/api/health` で確認できます。

## 検証

リポジトリルートからバックエンドテストを実行します。

```bash
backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'
```

フロントエンドは `frontend/` で検証します。

```bash
cd frontend
npm run lint
npm run build
```

フロントエンドには現在、自動テスト用のスクリプトはありません。

## 仕様変更

実装済みの詳細な挙動は `openspec/specs/` を参照してください。新しい機能や挙動変更は、現行specを直接予定表として書き換えず、OpenSpec changeとして提案・設計・実装・検証します。
