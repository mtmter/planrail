## MODIFIED Requirements

### Requirement: 到着希望日時を計算する

バックエンドは予定開始日時から到着余裕時間を減算してTransit APIへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない（MUST）。日時は日本時間の `date=YYYYMMDD` と `time=HH:MM` に分け、`/api/v1/guidance/plan` の `type=arrival` で問い合わせる。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

#### Scenario: 1件のbalanced itineraryを検索する

- **WHEN** Transitが要求に対して有効なoptionを1件だけ返す
- **THEN** バックエンドは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を要求したうえで、その1件を候補として返す

#### Scenario: 最大3件のbalanced itineraryを検索する

- **WHEN** バックエンドがTransit APIへ経路検索を送る
- **THEN** リクエストは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を指定する

### Requirement: 共通Route JSONを返す

Providerのレスポンスは、フロントエンドへ返す前に以下の候補一覧を含むPlanRail共通形式へ変換しなければならない（MUST）。レスポンスは `candidates: RouteCandidate[]`、候補のいずれかを指す `recommended_candidate_id: string`、およびユーザー向け日本語文言の `warnings: string[]` を持たなければならない（MUST）。候補数は1件以上3件以下とし、Transitが返したoptionの順序を維持しなければならない（MUST）。独自の並べ替えや、3件を確保するための追加取得をしてはならない（MUST NOT）。

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

`RouteFare`が存在しないときは `fare` をnullとし、運賃の一部だけをTransitから取得できるときは取得できない値をnullとする。検索結果の運賃表示はIC運賃を優先し、IC運賃がない場合はticket運賃を使う。両方ない場合は運賃情報がないことを示す。候補比較値や追加segment情報が取得できない場合は各項目をnullとする。

区間 `type` はTransitの徒歩を `WALK`、鉄道・バス等の公共交通を `TRANSIT` とする。公共交通の `line_name` にはTransitの路線表示名を設定する。Transitの `mode`、`trainType`、`headsign`、from/toの `platformCode`、`color`、`headwayBased` は、それぞれ共通形式の `mode`、`train_type`、`headsign`、`from_platform`、`to_platform`、`color`、`headway_based` へ変換する。共通Route JSONにTransit option ID、Transit endpoint ID、その他のTransit生metadataまたはgeometryを含めてはならない（MUST NOT）。

#### Scenario: guidance-plan optionsを複数候補へ変換する

- **WHEN** Transit APIが1件から3件まで有効なoptionsを返し、それぞれに公共交通legがある
- **THEN** システムは各optionをRouteCandidateへ変換し、Transitの返却順を保ち、response-localな一意のcandidate IDを割り当てる

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
- **THEN** APIは「公共交通を使う経路が見つかりませんでした」相当の経路なしとしてHTTP 404を返す

#### Scenario: 経路がない

- **WHEN** Transit APIのoptionsが空である
- **THEN** APIは経路なしとしてHTTP 404を返す

#### Scenario: 純徒歩optionしかない

- **WHEN** Transit APIが純徒歩optionだけを返す
- **THEN** システムは全optionを除外し、公共交通を使う経路が見つからなかったとしてHTTP 404を返す

#### Scenario: Transitの推奨候補が有効である

- **WHEN** Transit APIが `decision.recommendedOptionId` またはoptionの `recommended` で候補を推奨し、そのoptionが有効なRouteCandidateへ変換される
- **THEN** `recommended_candidate_id` はその候補を指す

#### Scenario: Transitの推奨候補がない、または除外される

- **WHEN** Transit APIが推奨候補を示さない、推奨optionが純徒歩で除外される、または推奨IDが有効な候補と一致しない
- **THEN** `recommended_candidate_id` はTransitのoption順で最初の有効候補を指す

#### Scenario: 比較用の運賃と指標を変換する

- **WHEN** Transit optionに `transferCount`、walk/wait/durationの指標、またはcurrency・ticket・IC fareが含まれる
- **THEN** システムはそれらを候補比較用の整数分・乗換数・RouteFareへ変換し、運賃表示ではIC金額をticket金額より優先する

#### Scenario: 追加情報が欠けた経路を変換する

- **WHEN** 有効なTransit optionに運賃、比較用指標、mode、train type、headsign、platform、color、またはheadway情報の一部がない
- **THEN** システムは取得できない共通形式の追加項目をnullにし、残りの有効なRouteCandidateを返す

#### Scenario: Coverage warningを日本語へ変換する

- **WHEN** Transit responseの `coverage.notices` に `severity=warning` の既知codeがある
- **THEN** システムは `loadedDataScope`、`stationRailCandidateMissing`、`noRouteInLoadedData`、`constraintsApplied`、`constraintsNoRoute`、`staleFeedData` をPlanRailのユーザー向け日本語warningへmappingし、Transitの生messageを表示しない

#### Scenario: Coverageのinfo通知を表示しない

- **WHEN** Transit responseのcoverage noticeのseverityが `info` である
- **THEN** システムはそのnoticeを検索結果のwarningsへ含めない

#### Scenario: 未知のcoverage codeを受け取る

- **WHEN** Transit responseに未対応のcoverage codeが含まれる
- **THEN** システムは検索全体を失敗させず、そのnoticeをユーザー向けwarningsへ含めない

#### Scenario: 不正なcoverage noticeを無視する

- **WHEN** Transit responseのcoverage noticeが不正な形式である
- **THEN** システムはそのnoticeをwarningsへ含めず、有効な経路検索を失敗させない

#### Scenario: 不正なoptionまたはRoute情報を受け取る

- **WHEN** Transit response、option、journey、または必須のRoute/segment情報が共通形式へ変換できない
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: Providerのレスポンスが不正である

- **WHEN** Transit APIが不正なJSONまたは共通Routeへ変換できない形式を返す
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: Providerとの通信に失敗する

- **WHEN** Transit APIがタイムアウト、接続失敗、またはHTTPエラーを返す
- **THEN** APIは外部経路サービスエラーとしてHTTP 502を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** Transit APIとの通信またはguidance-planから共通RouteCandidateへの変換に失敗する
- **THEN** APIは外部経路サービスまたは変換エラーとしてHTTP 502を返す

#### Scenario: 候補を検索結果に表示する

- **WHEN** 経路検索APIが候補一覧を返す
- **THEN** システムは候補数と同じ最大3件のsummary card、推奨表示、warningsがあればその表示、およびTransit推奨候補または先頭候補を選択状態として表示する

#### Scenario: 検索結果を画面に表示する

- **WHEN** 経路検索APIが共通RouteCandidate一覧を返す
- **THEN** システムは候補summary card、選択中候補の縦型Route表示、「この経路を登録」操作を表示し、coverage warningがあれば同じ検索結果画面へ表示する

### Requirement: 経路結果を登録前に表示する

フロントエンドは最大3件の候補を比較・選択できるようにし、初期選択候補の詳細を登録前に表示しなければならない（MUST）。summary cardには出発時刻、到着時刻、所要時間、乗換回数、徒歩時間、運賃を表示し、推奨候補には「おすすめ」相当の表示を付けなければならない（MUST）。未取得の比較値を0と誤認させず、値がないことを表示しなければならない（MUST）。運賃はIC運賃、なければticket運賃の順で表示する。候補の詳細には既存の縦型Route timelineを使用する。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが1件以上3件以下の共通RouteCandidateを返す
- **THEN** システムは候補summary cardと選択中の1件の縦型route timeline、「この経路を登録」操作を表示する

#### Scenario: 初期候補を選択する

- **WHEN** 候補一覧を表示する
- **THEN** システムは `recommended_candidate_id` の候補を初期選択する

#### Scenario: 推奨表示の候補をユーザーが選び直す

- **WHEN** ユーザーが別のsummary cardを選択する
- **THEN** システムはその候補をactiveにし、その1件のroute timelineと登録操作を表示する

#### Scenario: 選択した経路を登録する

- **WHEN** ユーザーがactiveな候補に対して「この経路を登録」を選ぶ
- **THEN** フロントエンドはactiveな候補1件だけを登録処理へ渡す

#### Scenario: Coverage warningがある

- **WHEN** 検索結果にwarningがある
- **THEN** システムは候補詳細とともにPlanRailの日本語warningを表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果と選択中候補をクリアして出発地入力へ戻る
