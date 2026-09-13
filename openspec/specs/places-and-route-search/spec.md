# Places and Route Search Specification

## Purpose

場所入力、Google Mapsリンク、および公共交通経路検索APIの現行契約を定義する。Provider選択、共通レスポンス、検索結果表示までをこの仕様の対象とする。

## Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時の場所名と、経路検索時の出発地にはGoogle Placesの候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない（MUST）。文字入力だけの予定はPlace IDや座標がなくても保存できる。予定詳細の経路検索ボタンは、Autocompleteを使用したかどうかではなく、予定に `destination_lat` と `destination_lng` の両方がある場合に限り有効にしなければならない（MUST）。いずれかがない場合はボタンをdisabledにし、「経路検索するには、場所を候補から選択してください」という趣旨の案内をボタン付近に表示しなければならない（MUST）。Transit経路検索にはplannerが受け付ける駅/停留所endpointまたは座標が必要である。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度を取得する

#### Scenario: 候補を選択せず予定の場所を入力する

- **WHEN** ユーザーが文字列だけの場所を予定へ入力する
- **THEN** システムはPlace IDや座標がなくても予定を保存できる

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが文字列だけを予定の場所または経路検索の出発地へ入力する
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

### Requirement: Google Mapsリンクを生成する

予定に場所名、住所、座標、またはPlace IDから検索可能な情報がある場合、システムは保存済みURLではなく表示時にGoogle Maps Search URLを生成しなければならない（MUST）。

#### Scenario: Place IDがある

- **WHEN** 予定に `destination_place_id` がある
- **THEN** システムはURLへ `query_place_id` を含める

#### Scenario: Place IDがない

- **WHEN** 予定にPlace IDがなく、住所、場所名、または座標がある
- **THEN** システムは利用可能な値を `query` とするリンクを表示する

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` で出発地情報と対象予定をJSONとして受け付けなければならない（MUST）。Transit APIへは駅/停留所endpointまたは `geo:<lat>,<lon>` 形式の地点を渡す。座標のない自由入力文字列だけではTransit検索を行わず、Places候補の選択を促すHTTP 400を返す。

#### Scenario: 出発地と目的地の両方に座標がある

- **WHEN** 出発地と目的地の両方に緯度と経度がある
- **THEN** システムはそれぞれのGoogle Places表示名を保持し、Transit用endpointを解決して検索する

#### Scenario: 地点を解決する

- **WHEN** 出発地または目的地に緯度と経度の両方があり、近傍のTransit station/stop名が表示名と一致する
- **THEN** システムは一致候補のplanner endpointを使い、一致しない場合は `geo:<lat>,<lon>` を使う

#### Scenario: 駅または停留所名が近傍候補と一致する

- **WHEN** 座標と表示名を持つ地点についてTransit `/api/v1/places/reverse` が300m以内のstation/stop候補を返し、正規化後の名前が一致する
- **THEN** システムは一致候補のうち最も近い候補のTransit planner endpointを経路検索に使う

#### Scenario: 駅または停留所名が一致しない

- **WHEN** 近傍候補がstation/stopではない、Transit endpointを持たない、または表示名と一致しない
- **THEN** システムは駅/停留所へ吸着せず `geo:<lat>,<lon>` を経路検索に使う

#### Scenario: reverse検索に失敗する

- **WHEN** Transit `/api/v1/places/reverse` が通信、HTTP、JSONまたはレスポンス形式のエラーになる
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

### Requirement: 到着希望日時を計算する

バックエンドは予定開始日時から到着余裕時間を減算してTransit APIへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない（MUST）。日時は日本時間の `date=YYYYMMDD` と `time=HH:MM` に分け、`/api/v1/guidance/plan` の `type=arrival` で問い合わせる。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

#### Scenario: 1件のbalanced itineraryを検索する

- **WHEN** バックエンドがTransit APIへ経路検索を送る
- **THEN** リクエストは `numItineraries=1`、`strategy=balanced`、`live=false`、`tracking=none` を指定する

### Requirement: Route Providerを選択する

バックエンドは `ROUTE_PROVIDER` により `transit` または `mock` を選択し、未設定時は `transit` を使用しなければならない（MUST）。`mock` は開発・自動テスト用で、Transit guidance-plan形式のfixtureを現行の共通converterへ渡さなければならない（MUST）。Transit APIにAPIキーは要求しない。

#### Scenario: 未知のProviderを指定する

- **WHEN** `ROUTE_PROVIDER` に対応していない名前を指定する
- **THEN** APIはProvider設定エラーとしてHTTP 502を返す

#### Scenario: Transit APIキーを必要としない

- **WHEN** `transit` Providerを選択し、Transit API用のAPIキーを設定していない
- **THEN** システムはキーを要求せずTransit APIへ経路検索を行う

### Requirement: 共通Route JSONを返す

Providerのレスポンスは、フロントエンドへ返す前に次の既存共通形式へ変換しなければならない（MUST）。

```text
Route:
  origin: string
  destination: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  transport_mode: string
  segments: RouteSegment[]

RouteSegment:
  type: string
  from: string
  to: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  line_name: string | null
```

区間 `type` はTransitの徒歩を `WALK`、鉄道・バス等の公共交通を `TRANSIT` とし、公共交通の `line_name` にはTransitの路線表示名を設定する。成功したroute JSONにTransit固有情報やTransit endpoint IDを追加してはならない（MUST NOT）。

#### Scenario: guidance planを変換する

- **WHEN** Transit APIが有効なoptionsを返す
- **THEN** システムは最初のoptionのjourneyとlegsを現在の共通Route JSONへ変換する

#### Scenario: guidance-plan optionを変換する

- **WHEN** Transit APIが有効なguidance-plan形式のoptionを返す
- **THEN** システムは最初のoptionを共通Route JSONへ変換する

#### Scenario: 経路がない

- **WHEN** Transit APIのoptionsが空である
- **THEN** APIは経路なしとしてHTTP 404を返す

#### Scenario: 純徒歩optionしかない

- **WHEN** 選択されたTransit journeyに公共交通legが1つもない
- **THEN** APIは公共交通を使う経路が見つからなかったとしてHTTP 404を返す

#### Scenario: Providerのレスポンスが不正である

- **WHEN** Transit APIが不正なJSONまたは共通Routeへ変換できない形式を返す
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: Providerとの通信に失敗する

- **WHEN** Transit APIがタイムアウト、接続失敗、またはHTTPエラーを返す
- **THEN** APIは外部経路サービスエラーとしてHTTP 502を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** Transit APIとの通信またはguidance-planから共通Routeへの変換に失敗する
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: 検索結果を画面に表示する

- **WHEN** 経路検索APIが既存の共通Route JSONを返す
- **THEN** システムは現在の縦型Route結果と「この経路を登録」操作を表示し、coverage noticeを成功時のUIへ表示しない
### Requirement: 経路結果を登録前に表示する

フロントエンドは検索結果の出発・到着時刻、所要時間、出発地、目的地、および各区間を表示しなければならない（MUST）。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが共通Route JSONを返す
- **THEN** システムは縦型の経路結果と「この経路を登録」操作を表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果をクリアして出発地入力へ戻る
