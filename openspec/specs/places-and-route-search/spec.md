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

バックエンドは予定開始日時から到着余裕時間を減算してTransit APIへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない（MUST）。日時は日本時間の `date=YYYYMMDD` と `time=HH:MM` に分け、`/api/v1/guidance/plan` の `type=arrival` で問い合わせなければならない（MUST）。問い合わせでは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を指定する。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

#### Scenario: 1件のbalanced itineraryを検索する

- **WHEN** バックエンドは3件を要求し、Transit APIが有効なoptionを1件だけ返す
- **THEN** システムはその1件だけを候補として返す

#### Scenario: 最大3件のbalanced itineraryを検索する

- **WHEN** バックエンドがTransit APIへ経路検索を送る
- **THEN** リクエストは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を指定する

### Requirement: Route Providerを選択する

バックエンドは `ROUTE_PROVIDER` により `transit` または `mock` を選択し、未設定時は `transit` を使用しなければならない（MUST）。`mock` は開発・自動テスト用で、Transit guidance-plan形式のfixtureを現行の共通converterへ渡さなければならない（MUST）。Transit APIにAPIキーは要求しない。

#### Scenario: 未知のProviderを指定する

- **WHEN** `ROUTE_PROVIDER` に対応していない名前を指定する
- **THEN** APIはProvider設定エラーとしてHTTP 502を返す

#### Scenario: Transit APIキーを必要としない

- **WHEN** `transit` Providerを選択し、Transit API用のAPIキーを設定していない
- **THEN** システムはキーを要求せずTransit APIへ経路検索を行う

### Requirement: 共通Route JSONを返す

Providerのレスポンスは、フロントエンドへ返す前に候補一覧を含むPlanRail共通形式へ変換しなければならない（MUST）。レスポンスは1件以上3件以下の `candidates: RouteCandidate[]`、候補のいずれかを指す `recommended_candidate_id: string`、およびユーザー向け日本語文言の `warnings: string[]` を持たなければならない（MUST）。候補はTransitが返したoptionの順序を維持し、独自に並べ替えたり、3件に満たない場合に追加取得したりしてはならない（MUST NOT）。

```text
RouteCandidate:
  candidate_id: string                 # この検索レスポンス内で一意
  origin: string
  destination: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  transport_mode: string
  transfer_count: 0以上の整数 | null
  walk_minutes: 0以上の整数 | null
  wait_minutes: 0以上の整数 | null
  fare: RouteFare | null
  segments: RouteSegment[]

RouteFare:
  currency: string | null
  ticket: number | null
  ic: number | null

RouteSegment:
  type: string
  from: string
  to: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  line_name: string | null
  mode: string | null
  train_type: string | null
  headsign: string | null
  from_platform: string | null
  to_platform: string | null
  color: string | null
  headway_based: boolean | null
```

運賃や比較値、追加segment情報が取得できない場合は該当項目をnullとする。`transfer_count`はoptionの指標を使い、なければjourneyの乗換回数を使う。徒歩・待ち時間は秒数から分へ切り上げる。運賃は候補指標のfareを使い、取得できない場合はjourneyのfareを使う。`fare`自体を取得できない場合はnullとし、運賃表示ではIC運賃、ticket運賃の順に優先し、どちらもない場合は運賃情報がないことを示す。区間 `type` はTransitの徒歩を `WALK`、鉄道・バス等の公共交通を `TRANSIT` とし、公共交通の `line_name` にはTransitの路線表示名を設定する。Transitの `mode`、`trainType`、`headsign`、from/toの `platformCode`、`color`、`headwayBased` を共通形式の対応するsegment項目へ変換する。Transit option ID、Transit endpoint ID、生metadata、およびgeometryを共通形式へ含めてはならない（MUST NOT）。

coverage noticeのうち、`severity=warning`かつ既知の `loadedDataScope`、`stationRailCandidateMissing`、`noRouteInLoadedData`、`constraintsApplied`、`constraintsNoRoute`、`staleFeedData` は固定のPlanRail日本語文言へ変換する。Transitが返す生message、info notice、未知code、不正noticeはwarningsへ含めず、これらのnoticeによって経路検索を失敗させてはならない（MUST NOT）。

#### Scenario: guidance-plan optionsを複数候補へ変換する

- **WHEN** Transit APIが1件から3件まで有効なoptionsを返し、それぞれに公共交通legがある
- **THEN** システムは各optionをRouteCandidateへ変換し、Transitの返却順を保ち、レスポンス内で一意のcandidate IDを割り当てる

#### Scenario: guidance planを変換する

- **WHEN** Transit APIが有効なguidance-plan optionsを返す
- **THEN** システムは各有効optionのjourneyとlegsをRouteCandidateへ変換する

#### Scenario: guidance-plan optionを変換する

- **WHEN** Transit APIが有効なguidance-plan optionを1件以上返す
- **THEN** システムは各optionを共通RouteCandidate形式へ変換する

#### Scenario: Transitが3件未満を返す

- **WHEN** Transit APIが1件または2件の有効な公共交通optionを返す
- **THEN** システムは返された有効候補だけを返し、追加検索や再ランキングで候補を補わない

#### Scenario: 純徒歩optionを除外する

- **WHEN** Transit APIが公共交通legを含まないoptionを1件以上返す
- **THEN** システムはそのoptionを候補一覧から除外し、残った候補の相対順序を維持する

#### Scenario: 公共交通候補が残らない

- **WHEN** Transit APIのoptionsが空、または純徒歩optionを除外した後に候補が0件である
- **THEN** APIは公共交通を使う経路が見つからなかったとしてHTTP 404を返す

#### Scenario: 経路がない

- **WHEN** Transit APIのoptionsが空である
- **THEN** APIは経路なしとしてHTTP 404を返す

#### Scenario: 純徒歩optionしかない

- **WHEN** Transit APIが公共交通legを含むoptionを返さない
- **THEN** システムはすべての候補を除外し、公共交通を使う経路が見つからなかったとしてHTTP 404を返す

#### Scenario: Transitの推奨候補が有効である

- **WHEN** Transit APIが `decision.recommendedOptionId` またはoptionの `recommended` で推奨し、そのoptionが有効なRouteCandidateへ変換される
- **THEN** `recommended_candidate_id` はその候補を指す

#### Scenario: Transitの推奨候補がない、または除外される

- **WHEN** Transit APIが推奨候補を示さない、推奨optionが純徒歩で除外される、または推奨IDが有効候補と一致しない
- **THEN** `recommended_candidate_id` はTransitのoption順で最初の有効候補を指す

#### Scenario: 比較用の運賃と指標を変換する

- **WHEN** Transit optionに乗換回数、徒歩・待ち時間、またはcurrency・ticket・IC fareが含まれる
- **THEN** システムは候補比較用のRoute項目へ変換し、運賃表示ではIC金額をticket金額より優先する

#### Scenario: 追加情報が欠けた経路を変換する

- **WHEN** 有効なTransit optionに運賃、比較用指標、mode、train type、headsign、platform、color、またはheadway情報の一部がない
- **THEN** システムは取得できない共通形式の追加項目をnullにし、RouteCandidateを返す

#### Scenario: Coverage warningを日本語へ変換する

- **WHEN** Transit responseの`coverage.notices`に`severity=warning`の既知codeがある
- **THEN** システムは既知のcoverage codeを固定の日本語warningへ変換し、Transitの生messageを含めない

#### Scenario: Coverageのinfo通知を表示しない

- **WHEN** Transit responseのcoverage noticeのseverityが`info`である
- **THEN** システムはそのnoticeを検索結果のwarningsへ含めない

#### Scenario: 未知のcoverage codeを受け取る

- **WHEN** Transit responseに未対応のcoverage codeが含まれる
- **THEN** システムは検索全体を失敗させず、そのnoticeをwarningsへ含めない

#### Scenario: 不正なcoverage noticeを無視する

- **WHEN** Transit responseのcoverage noticeが不正な形式である
- **THEN** システムはそのnoticeをwarningsへ含めず、有効な経路検索を失敗させない

#### Scenario: 不正なoptionまたはRoute情報を受け取る

- **WHEN** Transit response、option、journey、または必須のRoute/segment情報を共通形式へ変換できない
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: Providerのレスポンスが不正である

- **WHEN** Transit APIが不正なJSONまたは共通Routeへ変換できない形式を返す
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: Providerとの通信に失敗する

- **WHEN** Transit APIがタイムアウト、接続失敗、またはHTTPエラーを返す
- **THEN** APIは外部経路サービスエラーとしてHTTP 502を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** Transit APIとの通信またはguidance-planから共通Routeへの変換に失敗する
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: 候補を検索結果に表示する

- **WHEN** 経路検索APIが候補一覧を返す
- **THEN** システムは候補数と同じ最大3件のsummary card、推奨表示、warningsがあればその表示、および推奨候補または先頭候補を選択状態として表示する

#### Scenario: 検索結果を画面に表示する

- **WHEN** 経路検索APIが共通RouteCandidate一覧を返す
- **THEN** システムは候補summary card、選択中候補の縦型Route表示、「この経路を登録」操作を表示し、coverage warningがあれば同じ検索結果画面へ表示する

### Requirement: 経路結果を登録前に表示する

フロントエンドは最大3件の候補を比較・選択できるようにし、初期選択候補の詳細を登録前に表示しなければならない（MUST）。summary cardには出発時刻、到着時刻、所要時間、乗換回数、徒歩時間、運賃を表示し、推奨候補にはおすすめ表示を付けなければならない（MUST）。未取得の比較値は0と誤認させず、値がないことを表示しなければならない（MUST）。運賃はIC運賃、なければticket運賃の順で表示し、どちらもない場合は運賃情報がないことを示す。候補の詳細には既存の縦型Route timelineを使用し、coverage warningがあれば同じ検索結果に表示する。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが1件以上3件以下のRouteCandidateを返す
- **THEN** システムは候補summary cardと選択中候補1件の縦型route timeline、「この経路を登録」操作を表示する

#### Scenario: 初期候補を選択する

- **WHEN** 候補一覧を表示する
- **THEN** システムは`recommended_candidate_id`の候補を初期選択する

#### Scenario: 推奨表示の候補をユーザーが選び直す

- **WHEN** ユーザーが別のsummary cardを選択する
- **THEN** システムはその候補をactiveにし、その候補だけのroute timelineと登録操作を表示する

#### Scenario: 選択した経路を登録する

- **WHEN** ユーザーがactiveな候補に対して「この経路を登録」を選ぶ
- **THEN** フロントエンドはactiveな候補1件だけを登録処理へ渡す

#### Scenario: Coverage warningがある

- **WHEN** 検索結果にwarningがある
- **THEN** システムは候補詳細とともにPlanRailの日本語warningを表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果と選択中候補をクリアして出発地入力へ戻る
