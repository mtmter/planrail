## Why

予定の場所を自由入力だけで保存した場合、現在は経路検索を実行した後にバックエンドのHTTP 400で座標不足を知ることがある。予定の目的地座標が揃っているかを画面上で先に示し、検索できない状態と必要な操作を明確にする。

## What Changes

- 予定詳細の経路検索ボタンは、予定に `destination_lat` と `destination_lng` の両方がある場合だけ有効にする。
- いずれかの座標がない場合はボタンをdisabledにし、場所を候補から選択するよう促すメッセージを近くに表示する。
- 場所の自由入力による予定保存と、バックエンドの不足情報に対するHTTP 400 validationは維持する。
- 到着地の変更、Transit API、経路検索ロジック、Route JSON形式は変更しない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `places-and-route-search`: 予定詳細の経路検索ボタンの有効条件と、座標不足時に表示する案内を追加する。

## Impact

- フロントエンドの予定詳細と移動予定表示における経路検索ボタンの状態・案内表示。
- `places-and-route-search`のdelta spec。
- バックエンドAPI、Transit連携、Route JSON、予定の保存形式への変更はない。
