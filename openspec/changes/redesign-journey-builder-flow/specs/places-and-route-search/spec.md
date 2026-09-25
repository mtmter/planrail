## MODIFIED Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集画面は「場所」1項目でGoogle Places候補と自由入力を提供し、自由入力だけでも予定を保存できなければならない（MUST）。候補を選択した場合は名前、住所、Place ID、緯度、経度、`types` を取得し、予定の既存場所フィールドへ保存する。自由入力だけの場合は以前のPlace ID・座標・typeを保存対象にしてはならない（MUST NOT）。APIキー不足・候補取得失敗時は通常の文字入力へフォールバックする。

予定とJourney Builderの選択済み地点は、同じshared selected-place presentation/componentと既存 `selected-place-card` スタイルを使用しなければならない（MUST）。Journey専用の別デザインを作ってはならない（MUST NOT）。選択済み状態では📍、地点名、✓、取得済み住所、「変更」をEventと同じ見た目で表示する。対象はStandaloneの出発地・目的地、FIXEDの乗車・降車地点、および表示が必要なEvent由来の目的地である。選択中の地点名を直接編集させず、変更を選んだときは選択済みPlacePointを解除する。選択済み地点を検索に使う場合、有効な緯度・経度が揃っていることを要求する。公共交通地点はPlacesの `types` で識別し、名称から推測してはならない（MUST NOT）。

#### Scenario: 予定の場所に自由入力する

- **WHEN** ユーザーがPlaces候補を選ばず予定の場所へ文字列を入力する
- **THEN** システムは予定を保存でき、Place ID・座標・typeを未設定とする

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選ぶ
- **THEN** システムは名前・住所・Place ID・緯度・経度・typesを取得し、EventとJourneyに共通の表示で📍、地点名、✓、利用可能な住所、「変更」を表示する

#### Scenario: Journeyの選択済み地点を変更する

- **WHEN** ユーザーがStandaloneまたはFIXEDの選択済み地点の「変更」を押す
- **THEN** システムはAutocomplete入力へ戻し、以前のPlacePointを検索対象から外す

#### Scenario: 予定の目的地座標が不足する

- **WHEN** Eventに目的地の有効な緯度または経度がない
- **THEN** システムはEventからの移動計画を無効にし、候補選択を促す

#### Scenario: 予定へ候補を保存する

- **WHEN** 選択したPlaces候補を含む予定を保存する
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng`、typesを `destination_place_types` に保存する
#### Scenario: 候補を選択せず予定の場所を入力する

- **WHEN** ユーザーが「場所」に文字列だけを入力して予定を保存する
- **THEN** システムは予定を保存し、文字列を場所名として保持し、Place ID・座標・typeは未設定とする

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが文字列だけを予定の場所または経路検索の出発地へ入力する
- **THEN** システムは予定の場所を保存でき、座標等が不足したままAPIへ到達した経路検索リクエストにはHTTP 400を返す

#### Scenario: 候補を選択せず経路検索の出発地を入力する

- **WHEN** ユーザーが座標のない文字列だけを出発地として経路検索する
- **THEN** APIはGoogle Placesの候補を選択するよう促す入力エラーとしてHTTP 400を返す

#### Scenario: 選択済み地点を変更する

- **WHEN** ユーザーが選択済み場所の変更操作を選ぶ
- **THEN** システムはAutocomplete入力へ戻り、別の候補を選択するまで以前の地点情報を保存対象にしない

#### Scenario: 予定の場所候補が未選択である

- **WHEN** 予定に `destination_lat` または `destination_lng` のいずれかがない
- **THEN** システムは経路検索ボタンをdisabledにし、候補選択を促す案内を表示する

#### Scenario: 予定の目的地座標が不足している

- **WHEN** 予定に `destination_lat` または `destination_lng` のいずれかがない
- **THEN** システムは経路検索ボタンをdisabledにし、ボタン付近に「経路検索するには、場所を候補から選択してください」という趣旨の案内を表示する

#### Scenario: 予定の目的地座標が揃っている

- **WHEN** 予定に `destination_lat` と `destination_lng` の両方がある
- **THEN** システムはAutocompleteの利用有無にかかわらず経路検索ボタンを有効にする

#### Scenario: 予定の場所候補が選択済みである

- **WHEN** 予定に `destination_lat` と `destination_lng` の両方がある
- **THEN** システムは経路検索を有効にし、予定に保存された場所の座標とtypeをdestinationとして検索する

#### Scenario: Place候補を含む予定を保存する

- **WHEN** ユーザーが選択済みPlaces候補を含む予定を保存する
- **THEN** システムは候補名を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` / `destination_lng`、typeを `destination_place_types` に保存する

## ADDED Requirements

### Requirement: Journeyの選択済み地点を検索まで一貫して渡す

システムは選択済みPlacePointの `name`、`address`、`place_id`、`lat`、`lng`、`types` を、Builder入力、gap生成、各 `POST /api/route-search` requestの `origin` / `destination` まで保持しなければならない（MUST）。有効な緯度・経度を持つ選択済み両端をフロントエンドのstate不整合だけで検索不能としてはならない（MUST NOT）。APIが地点解決に失敗した場合と、Transitに有効経路がない場合は区別して扱う。

#### Scenario: 選択済み両端を検索する

- **WHEN** ユーザーが有効座標を持つPlaces候補を出発地・目的地に選び一括検索する
- **THEN** システムは両地点のname/address/place_id/lat/lng/typesを欠落・入れ替えなくrequestへ含める

#### Scenario: FIXEDを挟むgapを検索する

- **WHEN** FIXEDの乗降地点がPlaces候補から選択されている
- **THEN** システムは各gapで対応するFIXED端点のPlacePointをそのままrequestのoriginまたはdestinationへ渡す

#### Scenario: Transitに有効経路がない

- **WHEN** 両端の有効座標がrequestへ正しく渡ったが、APIが経路なしを返す
- **THEN** システムはその地点間の経路なしとして示し、Places未選択とは案内しない
