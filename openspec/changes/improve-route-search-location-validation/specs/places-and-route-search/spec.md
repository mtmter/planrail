## MODIFIED Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時の場所名と、経路検索時の出発地にはGoogle Placesの候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない（MUST）。文字入力だけの予定はPlace IDや座標がなくても保存できる。予定詳細の経路検索ボタンは、Autocompleteを使用したかどうかではなく、予定に `destination_lat` と `destination_lng` の両方がある場合に限り有効にしなければならない（MUST）。いずれかがない場合はボタンをdisabledにし、「経路検索するには、場所を候補から選択してください」という趣旨の案内をボタン付近に表示しなければならない（MUST）。Transit経路検索にはplannerが受け付ける駅/停留所endpointまたは座標が必要である。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度を取得する

#### Scenario: 候補を選択せず予定の場所を入力する

- **WHEN** ユーザーが文字列だけの場所を予定へ入力する
- **THEN** システムはPlace IDや座標がなくても予定を保存できる

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが候補を選択せず予定の場所または経路検索の出発地へ文字列だけを入力する
- **THEN** システムは予定の場所を保存でき、座標等が不足したままAPIへ到達した経路検索リクエストにはHTTP 400を返す

#### Scenario: 候補を選択せず経路検索の出発地を入力する

- **WHEN** ユーザーが座標のない文字列だけを出発地として経路検索する
- **THEN** APIはGoogle Placesの候補を選択するよう促す入力エラーとしてHTTP 400を返す

#### Scenario: 予定の目的地座標が不足している

- **WHEN** 予定に `destination_lat` または `destination_lng` のいずれかがない
- **THEN** システムは経路検索ボタンをdisabledにし、ボタン付近に「経路検索するには、場所を候補から選択してください」という趣旨の案内を表示する

#### Scenario: 予定の目的地座標が揃っている

- **WHEN** 予定に `destination_lat` と `destination_lng` の両方がある
- **THEN** システムはAutocompleteの利用有無にかかわらず経路検索ボタンを有効にする

#### Scenario: 予定へ候補を保存する

- **WHEN** 選択したPlaces候補を含む予定を保存する
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng` に保存する
