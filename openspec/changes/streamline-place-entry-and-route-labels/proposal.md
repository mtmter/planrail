## Why

予定の作成時に同じ場所を「場所名」と「目的地」へ二重入力させており、自由入力で保存した予定は座標を持たないためLS8H Transit APIを利用する経路検索が失敗する。また、Providerの内部数値識別子が移動詳細の路線名として表示されることがある。

## What Changes

- 新規・編集予定の場所入力を、Google Places候補を使う単一の「場所」項目へ統一する。
- 自由入力の場所は予定として保存できるままとし、座標を持たない地点を含む経路検索操作は実行不可にして、候補を選択する案内を表示する。
- 保存済みの場所文字列と既存Firestoreフィールドの互換性を維持し、候補を選び直した時だけPlace IDと座標を更新する。
- LS8H Transit APIの数値だけの内部路線・便識別子をユーザーへ表示せず、読める路線名または交通種別を表示する。
- LS8H Transit APIが徒歩のみの候補と公共交通を含む候補を同時に返す場合、公共交通を含む候補を優先する。
- 座標を持たない既存の予定・移動ブロックでも、再検索画面で保存済み地点をPlaces候補から選び直して経路検索できるようにする。
- 非目標: 座標のない自由入力をサーバー側でジオコーディングすること、Google Routes用サーバーキーを追加すること、既存予定の一括移行。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `places-and-route-search`: 予定の単一場所入力、座標を必要とする経路検索操作、および表示可能な路線ラベルの契約を変更する。
- `schedule-management`: 予定追加・編集フォームの場所フィールドを単一入力へ変更する。

## Impact

- `frontend/src/components/AddItemModal.jsx`、`EventDetailsModal.jsx`、経路検索modalと移動詳細表示を変更する。
- `frontend/src/travelUtils.js`、経路検索の操作可否・再検索画面、LS8H Transit APIの候補選択・区間ラベル変換とそのテストを変更する。
- Firestoreの既存フィールド名とFastAPIのエンドポイントは維持する。
