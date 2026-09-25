## Why

現行の移動予定は Event ID を文書 ID とする単一 Route であり、Event を伴わない移動や予約済みの固定移動を表せない。移動を Event から独立した Journey として扱い、検索した Route と固定移動を一本の行程に組み合わせられるようにする。

## What Changes

- `users/{uid}/journeys/{journeyId}` を新規 Journey の正規保存先とし、Event-linked と Standalone の両方を扱う。Event-linked は Event ごとに最大1件とする。
- 共通 Journey Builder で `ROUTE` と `FIXED` の section を並べ、各未設定 ROUTE 区間を個別に検索・選択する。作業中 draft は永続化せず、全区間と行程の時刻が確定してから保存する。
- FIXED の前後と固定区間間を検索できるよう、経路検索 API の地点・時間制約を Event 専用形から一般化し、Transit/Mock Provider と既存候補変換を再利用する。
- グローバル追加操作から Event または Standalone Journey を選べるようにし、目的地座標を持つ Event の「移動を計画」から Event-linked Journey Builder を開く。目的地座標のない Event では現行と同様に無効にする。
- Journey を月・週・日カレンダーの独立した時間ブロックと詳細画面に表示する。旧 `travelPlans` の互換読み込みと新規保存を廃止する。
- Event 削除時に対応する Event-linked Journey も削除する。Firestore の既存 uid 境界が `journeys` に及ぶことを確認する。

## Capabilities

### New Capabilities

- `journeys`: Journey の種類、section、Builder、保存条件、詳細表示を定義する。

### Modified Capabilities

- `travel-plans`: 旧 `travelPlans` の保存・表示・削除連携要件を廃止し、新規保存を Journey に移す。
- `schedule-management`: 追加導線、Event 削除、月・週・日の Journey 表示を定義する。
- `places-and-route-search`: Journey section の地点・到着/出発制約と候補選択を定義する。
- `authentication-and-persistence`: `journeys` の uid 配下保存とアクセス境界を定義する。

## Impact

- Frontend: `App.jsx`、Firestore service/serializer、Event 詳細、Journey Builder/詳細、Route 詳細、Places 入力、カレンダー3表示と共通日時処理。
- Backend: `POST /api/route-search` を Journey section の地点・時間制約で検索する契約へ変更し、`routes_service.py`、Transit/Mock Providerと関連テストを更新する。
- Firestore: 新規 `journeys` collection。旧 `travelPlans` は移行・互換読み込みを行わず、既存文書を削除してよい。現行 rules の uid 配下 wildcard は新 collection にも適用される。
- 対象外: 現在位置強調、GPS、部分再検索、遅延判定、Recovery route、タクシー、PWA、TypeScript 全面移行、TanStack Query、無関係な大規模リファクタ。
