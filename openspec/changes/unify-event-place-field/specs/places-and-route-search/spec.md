## MODIFIED Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集画面はユーザー向け場所入力を「場所」と表示する1項目だけ提供しなければならない（MUST）。この項目ではGoogle Places候補を選択でき、候補を選択せずに自由入力だけで予定を保存できなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は通常の文字入力へフォールバックしなければならない（MUST）。

候補を選択した場合は候補の表示名、住所、Place ID、緯度、経度、および `types` を取得し、既存の予定フィールド `location_name`、`destination`、`destination_place_id`、`destination_lat`、`destination_lng`、`destination_place_types` に保存しなければならない（MUST）。自由入力だけの場合は文字列を `location_name` に保存し、Place ID、座標、typeを設定済み地点情報として保存してはならない（MUST NOT）。

候補選択後は選択した場所名と、利用可能なら住所を選択済みであると分かる状態で表示しなければならない（MUST）。候補選択中に場所名を直接編集できるようにしてはならず（MUST NOT）、ユーザーが変更操作を選んだ場合は選択を解除してAutocomplete入力へ戻さなければならない（MUST）。新しい候補が選択されるまでは以前のPlace ID、座標、typeを保存してはならない（MUST NOT）。

予定詳細の経路検索ボタンは予定に `destination_lat` と `destination_lng` の両方がある場合に限り有効にしなければならない（MUST）。不足している場合はボタンをdisabledにし、「経路検索するには、場所を候補から選択してください」という趣旨の案内を表示しなければならない（MUST）。経路検索destinationは予定の場所として選択した地点情報を使わなければならない（MUST）。Transit経路検索にはplannerが受け付ける駅/停留所endpointまたは座標が必要であり、座標のない自由入力だけでは検索できない。

公共交通地点の識別にはGoogle Places API (New) のtype値を使い、表示名から推測してはならない（MUST NOT）。

#### Scenario: 候補を選択せず予定の場所を入力する

- **WHEN** ユーザーが「場所」に文字列だけを入力して予定を保存する
- **THEN** システムは予定を保存し、文字列を場所名として保持し、Place ID・座標・typeは未設定とする

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは選択済みの場所名と利用可能な住所を明示し、名前、住所、Place ID、緯度、経度、および候補の `types` を保存する

#### Scenario: 選択済み地点を変更する

- **WHEN** ユーザーが選択済み場所の変更操作を選ぶ
- **THEN** システムはAutocomplete入力へ戻り、別の候補を選択するまで以前の地点情報を保存対象にしない

#### Scenario: 予定の場所候補が未選択である

- **WHEN** 予定に `destination_lat` または `destination_lng` のいずれかがない
- **THEN** システムは経路検索ボタンをdisabledにし、候補選択を促す案内を表示する

#### Scenario: 予定の場所候補が選択済みである

- **WHEN** 予定に `destination_lat` と `destination_lng` の両方がある
- **THEN** システムは経路検索を有効にし、予定に保存された場所の座標とtypeをdestinationとして検索する

#### Scenario: Place候補を含む予定を保存する

- **WHEN** ユーザーが選択済みPlaces候補を含む予定を保存する
- **THEN** システムは候補名を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` / `destination_lng`、typeを `destination_place_types` に保存する
