## ADDED Requirements

### Requirement: Transit APIの呼び出しに用途別timeoutを適用する

システムはTransit `/api/v1/guidance/plan` のtimeoutを30秒とし、Transit `/api/v1/places/reverse` のtimeoutを10秒としなければならない（MUST）。reverse lookupは駅・停留所endpointを解決する補助処理であり、timeoutを含むreverse lookupの失敗時は既存どおり `geo:<lat>,<lon>` へフォールバックして経路検索を続けなければならない（MUST）。

#### Scenario: Guidance planを30秒timeoutで呼び出す

- **WHEN** システムがTransit `/api/v1/guidance/plan` へ経路検索を送る
- **THEN** システムは30秒のtimeoutを適用する

#### Scenario: Reverse lookupを10秒timeoutで呼び出す

- **WHEN** システムがTransit `/api/v1/places/reverse` へ地点解決を送る
- **THEN** システムは10秒のtimeoutを適用し、timeout時はその地点の `geo:<lat>,<lon>` で経路検索を続ける

### Requirement: 経路検索エラーをHTTP statusに応じて表示し、自動再試行しない

フロントエンドはHTTP 504に「経路検索に時間がかかりすぎました。もう一度お試しください。」を表示し、HTTP 502に「経路検索サービスでエラーが発生しました。もう一度お試しください。」を表示しなければならない（MUST）。HTTP 400および404では既存どおりAPIの `detail` を表示し、`detail` がない場合は「経路を検索できませんでした」を表示しなければならない（MUST）。HTTP 422では既存どおり「入力内容を確認してください」を表示しなければならない（MUST）。システムは経路検索リクエストを自動再試行してはならず、再検索はユーザーが検索操作を再度行った場合に限らなければならない（MUST）。

#### Scenario: 経路検索がtimeoutする

- **WHEN** `/api/route-search` がHTTP 504を返す
- **THEN** フロントエンドは「経路検索に時間がかかりすぎました。もう一度お試しください。」を表示し、自動で再検索しない

#### Scenario: 経路検索サービスでエラーが発生する

- **WHEN** `/api/route-search` がHTTP 502を返す
- **THEN** フロントエンドは「経路検索サービスでエラーが発生しました。もう一度お試しください。」を表示する

#### Scenario: 400と404で既存のAPI detailを表示する

- **WHEN** `/api/route-search` がHTTP 400または404を返し、レスポンスに文字列の `detail` がある
- **THEN** フロントエンドはその `detail` を表示する

#### Scenario: 400または404にdetailがない

- **WHEN** `/api/route-search` がHTTP 400または404を返し、文字列の `detail` がない
- **THEN** フロントエンドは「経路を検索できませんでした」を表示する

#### Scenario: 422の既存エラーを表示する

- **WHEN** `/api/route-search` がHTTP 422を返す
- **THEN** フロントエンドは「入力内容を確認してください」を表示する

#### Scenario: ユーザーがtimeout後に再検索する

- **WHEN** HTTP 504の表示後にユーザーが検索操作を再度行う
- **THEN** システムはそのユーザー操作に対する検索を行う

### Requirement: 5xxへ変換する経路検索エラーを診断可能なログへ記録する

バックエンドは経路検索エラーをHTTP 5xxへ変換するとき、エラー発生箇所、例外種別、原因、およびstack traceを運用ログへ記録しなければならない（MUST）。Transit HTTP errorの場合は、Transitが返したstatus codeをログから確認可能にしなければならない（MUST）。ログへリクエスト本文全体、ユーザー情報、Place ID、または緯度・経度を記録してはならない（MUST NOT）。

#### Scenario: 経路検索timeoutをHTTP 504へ変換する

- **WHEN** Transit guidance planのtimeoutをHTTP 504へ変換する
- **THEN** バックエンドはtimeoutの例外種別、元のcause、およびstack traceを含む診断ログを出力する

#### Scenario: Provider failureをHTTP 502へ変換する

- **WHEN** provider、レスポンス、または変換エラーをHTTP 502へ変換し、Transit HTTP status codeがある
- **THEN** バックエンドは例外chainとstack traceを記録し、Transit HTTP status codeをログから確認可能にする

#### Scenario: 経路検索の診断ログへ機微なリクエスト情報を含めない

- **WHEN** バックエンドが経路検索の5xx診断ログを出力する
- **THEN** ログにリクエスト本文全体、ユーザー情報、Place ID、または緯度・経度を含めない

## MODIFIED Requirements

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

- **WHEN** Transit `/api/v1/guidance/plan` がtimeoutする
- **THEN** APIはtimeout専用の経路検索エラーとしてHTTP 504を返す

#### Scenario: Transit providerへの接続または応答に失敗する

- **WHEN** Transit APIへの接続失敗、HTTPエラー、不正なJSON、または不正なレスポンス形式が発生する
- **THEN** APIは外部経路サービスエラーとしてHTTP 502を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** guidance-plan timeout以外のprovider failure、またはguidance-planから共通Routeへの変換エラーが発生する
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: 候補を検索結果に表示する

- **WHEN** 経路検索APIが候補一覧を返す
- **THEN** システムは候補数と同じ最大3件のsummary card、推奨表示、warningsがあればその表示、および推奨候補または先頭候補を選択状態として表示する

#### Scenario: 検索結果を画面に表示する

- **WHEN** 経路検索APIが共通RouteCandidate一覧を返す
- **THEN** システムは候補summary card、選択中候補の縦型Route表示、「この経路を登録」操作を表示し、coverage warningがあれば同じ検索結果画面へ表示する
