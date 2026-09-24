## Why

予定作成・編集画面に「場所名」と「目的地」が別々にあり、予定の場所と経路検索の目的地の関係が分かりにくい。ユーザー向け入力を「場所」1つにし、予定の場所として選択した地点を経路検索にも使う。

## What Changes

- 予定作成・編集の場所入力を1つに統合し、Google Places候補を選ばない自由入力でも予定を保存できるようにする。
- Places候補を選択した場合は既存の場所名、住所、Place ID、座標、typeを保存し、選択済み状態と変更操作を表示する。
- 候補を選択していない予定では経路検索を無効にし、場所を候補から選ぶよう案内する。
- 経路検索の目的地は予定の場所として選択した地点情報を使う。

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `places-and-route-search`: 予定の場所入力を単一化し、候補選択状態と経路検索の可否を定義する。

## Impact

- Frontend: 予定作成・編集フォーム、予定詳細の経路検索案内、Places入力状態表示。
- Firestore: 既存の `location_name`、`destination`、`destination_place_id`、`destination_lat`、`destination_lng`、`destination_place_types` を再利用する。新しいフィールドやmigrationは追加しない。
- Backend / Transit API: リクエスト契約と経路検索ロジックは変更しない。
- Verification: フロントエンドlint/build・既存テストとバックエンド既存テストを実行する。
