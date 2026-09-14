## MODIFIED Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時の場所名と、経路検索時の出発地にはGoogle Placesの候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない（MUST）。文字入力だけの予定はPlace IDや座標がなくても保存できる。予定詳細の経路検索ボタンは、Autocompleteを使用したかどうかではなく、予定に `destination_lat` と `destination_lng` の両方がある場合に限り有効にしなければならない（MUST）。いずれかがない場合はボタンをdisabledにし、「経路検索するには、場所を候補から選択してください」という趣旨の案内をボタン付近に表示しなければならない（MUST）。Transit経路検索にはplannerが受け付ける駅/停留所endpointまたは座標が必要である。Places候補を選択したとき、システムは候補の `types` を取得し、予定の目的地では `destination_place_types` として座標等とともに保存しなければならない（MUST）。公共交通地点の識別にはGoogle Places API (New) のtype値を使い、表示名から推測してはならない（MUST NOT）。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度、および候補が返す `types` を取得する

#### Scenario: 候補を選択せず予定の場所を入力する

- **WHEN** ユーザーが文字列だけの場所を予定へ入力する
- **THEN** システムはPlace IDや座標がなくても予定を保存できる

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが文字列だけの場所を予定または経路検索の出発地へ入力する
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
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng`、候補の `types` を `destination_place_types` に保存する

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` で出発地情報と対象予定をJSONとして受け付けなければならない（MUST）。選択済み出発地のtypeは任意の `origin_place_types`、予定に保存された目的地のtypeは任意の `event.destination_place_types` として伝搬する。Transit APIへは駅/停留所endpointまたは `geo:<lat>,<lon>` 形式の地点を渡す。座標のない自由入力文字列だけではTransit検索を行わず、Places候補の選択を促すHTTP 400を返す。

#### Scenario: 出発地と目的地の両方に座標がある

- **WHEN** 出発地と目的地の両方に緯度と経度があり、候補にtype情報がある
- **THEN** システムはそれぞれのGoogle Places表示名とtype情報を保持してTransit用endpointを解決し、表示名を経路候補のラベルとして使う

#### Scenario: 地点を解決する

- **WHEN** 出発地または目的地に座標があり、Places候補の `types` に `train_station`、`subway_station`、`transit_station`、`bus_station`、`bus_stop`、`light_rail_station`、`transit_stop` のいずれかが含まれる
- **THEN** システムはTransit `/api/v1/places/reverse` を実行して既存のstation/stop endpoint解決を試み、一致しない場合は `geo:<lat>,<lon>` を使う

#### Scenario: 駅または停留所名が近傍候補と一致する

- **WHEN** 公共交通typeを持つ地点についてTransit `/api/v1/places/reverse` が300m以内のstation/stop候補を返し、正規化後の名前が一致する
- **THEN** システムは一致候補のうち最も近い候補のTransit planner endpointを経路検索に使う

#### Scenario: 一般POIを解決する

- **WHEN** Google Places候補に既知の公共交通typeが含まれない
- **THEN** システムは `/api/v1/places/reverse` を呼ばず、保存済み座標から `geo:<lat>,<lon>` endpointを作る

#### Scenario: 既存データに地点typeがない

- **WHEN** 出発地または目的地に座標があるが、対応するPlaces type情報がない
- **THEN** システムは地点名から駅・停留所と推測せず、reverse lookupを呼ばずに `geo:<lat>,<lon>` endpointを使う

#### Scenario: 駅または停留所名が一致しない

- **WHEN** 公共交通typeの候補について近傍候補がstation/stopではない、Transit endpointを持たない、または表示名と一致しない
- **THEN** システムは駅/停留所へ吸着せず `geo:<lat>,<lon>` を経路検索に使う

#### Scenario: reverse検索に失敗する

- **WHEN** 公共交通typeの地点についてTransit `/api/v1/places/reverse` が通信、HTTP、JSONまたはレスポンス形式のエラーになる
- **THEN** システムはその地点の `geo:<lat>,<lon>` を使って経路検索を続ける

#### Scenario: 地点を検索用endpointへ解決できない

- **WHEN** 出発地または目的地に座標がなく、Transit plannerが受け付けるendpointもない
- **THEN** APIはGoogle Places候補を選択するよう促す入力エラーとしてHTTP 400を返す

#### Scenario: 出発地または目的地がない

- **WHEN** 利用可能な出発地または目的地の情報がない
- **THEN** APIはHTTP 400を返す

#### Scenario: 予定開始日時が不正である

- **WHEN** `event.start_at` が `YYYY-MM-DDTHH:mm` として解析できない
- **THEN** APIはHTTP 400を返す

### Requirement: Transit APIの呼び出しに用途別timeoutを適用する

システムはTransit `/api/v1/guidance/plan` のtimeoutを45秒とし、Transit `/api/v1/places/reverse` のtimeoutを10秒としなければならない（MUST）。reverse lookupは明示的に選択された公共交通地点のendpoint解決に限る補助処理であり、timeoutを含むreverse lookupの失敗時は既存どおり `geo:<lat>,<lon>` へフォールバックして経路検索を続けなければならない（MUST）。plan timeout時は既存の例外分類とHTTP 504の挙動を維持しなければならない（MUST）。

#### Scenario: Guidance planを30秒timeoutで呼び出す

- **WHEN** Transit `/api/v1/guidance/plan` が従来の30秒timeout設定で呼び出される経路検索を処理する
- **THEN** システムは30秒設定を置き換えた45秒のtimeoutを適用する

#### Scenario: Guidance planを45秒timeoutで呼び出す

- **WHEN** システムがTransit `/api/v1/guidance/plan` へ経路検索を送る
- **THEN** システムは45秒のtimeoutを適用する

#### Scenario: Reverse lookupを10秒timeoutで呼び出す

- **WHEN** システムが公共交通typeの地点についてTransit `/api/v1/places/reverse` へ地点解決を送る
- **THEN** システムは10秒のtimeoutを適用し、timeout時はその地点の `geo:<lat>,<lon>` で経路検索を続ける

#### Scenario: Guidance planがtimeoutする

- **WHEN** Transit `/api/v1/guidance/plan` が45秒以内に応答しない
- **THEN** APIは既存のtimeout専用経路を通じてHTTP 504を返す

## ADDED Requirements

### Requirement: 経路検索の段階別latencyを機微情報なしで記録する

バックエンドはroute searchで実行したorigin endpoint解決、destination endpoint解決、Transit `/api/v1/guidance/plan` 呼び出し、Transit responseからRouteCandidateへの変換、およびroute search全体について所要時間をサーバーログから確認できるようにしなければならない（MUST）。段階ごとの所要時間はミリ秒で記録しなければならない（MUST）。endpoint解決ログには解決種別 `geo`、`station`、`stop` とreverse lookupの実行有無を含めてもよい。診断ログは地点名、住所、緯度・経度、Place ID、リクエスト本文、または位置を特定できる例外メッセージを記録してはならない（MUST NOT）。

#### Scenario: 経路検索の各段階を計測する

- **WHEN** route searchがendpoint解決、Transit plan、候補変換を実行する
- **THEN** サーバーログにorigin解決、destination解決、plan、候補変換、全体の所要時間をそれぞれミリ秒単位で記録する

#### Scenario: 一般POIのendpoint解決を記録する

- **WHEN** type情報のない一般POIを座標endpointとして解決する
- **THEN** 診断ログから解決時間、解決種別が `geo` であること、およびreverse lookupを実行していないことを確認できる

#### Scenario: 駅または停留所のendpoint解決を記録する

- **WHEN** 公共交通typeの地点を解決する
- **THEN** 診断ログから解決時間、結果の種別 `geo`、`station`、`stop` のいずれか、およびreverse lookupの実行有無を確認できる

#### Scenario: latencyログに位置情報を含めない

- **WHEN** サーバーが成功または失敗したroute searchの段階別latencyを記録する
- **THEN** ログに地点名、住所、緯度・経度、Place ID、またはリクエスト本文を含めない
