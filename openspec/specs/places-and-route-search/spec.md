# Places and Route Search Specification

## Purpose

場所入力、Google Mapsリンク、および公共交通経路検索APIの現行契約を定義する。Provider選択、共通レスポンス、検索結果表示までをこの仕様の対象とする。

## Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時の場所名と、経路検索時の出発地にはGoogle Placesの候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない（MUST）。文字入力だけの予定はPlace IDや座標がなくても保存できる。予定詳細の経路検索ボタンは、Autocompleteを使用したかどうかではなく、予定に `destination_lat` と `destination_lng` の両方がある場合に限り有効にしなければならない（MUST）。いずれかがない場合はボタンをdisabledにし、「経路検索するには、場所を候補から選択してください」という趣旨の案内をボタン付近に表示しなければならない（MUST）。Transit経路検索にはplannerが受け付ける駅/停留所endpointまたは座標が必要である。Places候補を選択したとき、システムは候補の `types` を取得し、予定の目的地では `destination_place_types` として座標等とともに保存しなければならない（MUST）。公共交通地点の識別にはGoogle Places API (New) のtype値を使い、表示名から推測してはならない（MUST NOT）。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度、および候補が返す `types` を取得する

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
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng`、候補の `types` を `destination_place_types` に保存する

### Requirement: Google Mapsリンクを生成する

予定に場所名、住所、座標、またはPlace IDから検索可能な情報がある場合、システムは保存済みURLではなく表示時にGoogle Maps Search URLを生成しなければならない（MUST）。

#### Scenario: Place IDがある

- **WHEN** 予定に `destination_place_id` がある
- **THEN** システムはURLへ `query_place_id` を含める

#### Scenario: Place IDがない

- **WHEN** 予定にPlace IDがなく、住所、場所名、または座標がある
- **THEN** システムは利用可能な値を `query` とするリンクを表示する

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` で出発地情報と対象予定をJSONとして受け付けなければならない（MUST）。選択済み出発地のtypeは任意の `origin_place_types`、予定に保存された目的地のtypeは任意の `event.destination_place_types` として伝搬する。Transit APIへは駅/停留所endpointまたは `geo:<lat>,<lon>` 形式の地点を渡す。座標のない自由入力文字列だけではTransit検索を行わず、Places候補の選択を促すHTTP 400を返す。

#### Scenario: 出発地と目的地の両方に座標がある

- **WHEN** 出発地と目的地の両方に緯度と経度がある
- **THEN** システムはそれぞれのGoogle Places表示名とtype情報を保持してTransit用endpointを解決し、表示名を経路候補のラベルとして使う

#### Scenario: 地点を解決する

- **WHEN** 出発地または目的地に座標があり、Places候補の `types` に `train_station`、`subway_station`、`transit_station`、`bus_station`、`bus_stop`、`light_rail_station`、`transit_stop` のいずれかが含まれる
- **THEN** システムはTransit `/api/v1/places/reverse` を実行して既存のstation/stop endpoint解決を試み、一致しない場合は `geo:<lat>,<lon>` を使う

#### Scenario: 一般POIを解決する

- **WHEN** Google Places候補に既知の公共交通typeが含まれない
- **THEN** システムは `/api/v1/places/reverse` を呼ばず、保存済み座標から `geo:<lat>,<lon>` endpointを作る

#### Scenario: 既存データに地点typeがない

- **WHEN** 出発地または目的地に座標があるが、対応するPlaces type情報がない
- **THEN** システムは地点名から駅・停留所と推測せず、reverse lookupを呼ばずに `geo:<lat>,<lon>` endpointを使う

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

### Requirement: Transit APIの呼び出しに用途別timeoutを適用する

システムはTransit `/api/v1/guidance/plan` のtimeoutを45秒とし、Transit `/api/v1/places/reverse` のtimeoutを10秒としなければならない（MUST）。reverse lookupは明示的に選択された公共交通地点のendpoint解決に限る補助処理であり、timeoutを含むreverse lookupの失敗時は既存どおり `geo:<lat>,<lon>` へフォールバックして経路検索を続けなければならない（MUST）。plan timeout時は既存の例外分類とHTTP 504の挙動を維持しなければならない（MUST）。

#### Scenario: Guidance planを30秒timeoutで呼び出す

- **WHEN** Transit `/api/v1/guidance/plan` が従来の30秒timeout設定で呼び出される経路検索を処理する
- **THEN** システムは30秒設定を置き換えた45秒のtimeoutを適用する

#### Scenario: Guidance planを45秒timeoutで呼び出す

- **WHEN** システムがTransit `/api/v1/guidance/plan` へ経路検索を送る
- **THEN** システムは45秒のtimeoutを適用する

#### Scenario: Reverse lookupを10秒timeoutで呼び出す

- **WHEN** システムがTransit `/api/v1/places/reverse` へ地点解決を送る
- **THEN** システムは10秒のtimeoutを適用し、timeout時はその地点の `geo:<lat>,<lon>` で経路検索を続ける

#### Scenario: Guidance planがtimeoutする

- **WHEN** Transit `/api/v1/guidance/plan` が45秒以内に応答しない
- **THEN** APIは既存のtimeout専用経路を通じてHTTP 504を返す

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

Transitの `journey.accessWalkSecs` または `journey.egressWalkSecs` が正の値である場合、システムは該当する外部徒歩区間を既存の `WALK` RouteSegmentとして表現しなければならない（MUST）。access区間は候補のorigin表示名から最初のjourney legの `from.name` までとし、時刻は `journey.departureSecs` から `journey.departureSecs + accessWalkSecs` とする。egress区間は最後のjourney legの `to.name` から候補のdestination表示名までとし、時刻は `journey.arrivalSecs - egressWalkSecs` から `journey.arrivalSecs` とする。durationは各秒数を分へ切り上げ、`line_name` および既存schema上の交通機関固有項目をnullとする。access区間は既存journey legの前、egress区間は後に置き、journey legの順序・内容と待ち時間を変更してはならない。秒数が欠落または0の場合は外部徒歩区間を追加してはならない（MUST NOT）。`metrics.walkSecs` による候補全体の `walk_minutes` は現在のとおり変換し、access/egress秒数を再加算してはならない（MUST NOT）。徒歩区間はTransitが返した値に基づいてのみ追加し、駅・停留所との近さから推定してはならない（MUST NOT）。

access/egress秒数が負、数値以外、NaNまたは無限大相当である場合、あるいは合計秒数がjourneyのdurationまたはdeparture/arrivalの時間幅と整合しない場合、APIはTransit response errorとして扱い、既存の経路検索サービスエラー経路を通じてHTTP 502を返さなければならない（MUST）。正の秒数があるのに対応する先頭または末尾journey legの有効なstop名を取得できず、segmentを構築できない場合も同様にHTTP 502を返さなければならない（MUST）。

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

#### Scenario: geographic originのaccess walkをRoute segmentへ変換する

- **WHEN** Places由来のorigin表示名があり、Transit journeyに正の `accessWalkSecs` と有効な最初のlegの `from.name` がある
- **THEN** システムはjourney legsの前にorigin表示名からそのstop名までの `WALK` segmentを追加し、departure/arrival時刻と切り上げたdurationをaccess秒数に合わせる

#### Scenario: geographic destinationのegress walkをRoute segmentへ変換する

- **WHEN** Places由来のdestination表示名があり、Transit journeyに正の `egressWalkSecs` と有効な最後のlegの `to.name` がある
- **THEN** システムはjourney legsの後にそのstop名からdestination表示名までの `WALK` segmentを追加し、departure/arrival時刻と切り上げたdurationをegress秒数に合わせる

#### Scenario: access walk終了後に待ち時間がある

- **WHEN** `journey.departureSecs + accessWalkSecs` が最初のlegの出発時刻より前である
- **THEN** access WALKの到着時刻は秒数から算出した時刻を保ち、差分を徒歩時間またはsegment durationへ含めない

#### Scenario: 両端または片端の外部徒歩を変換する

- **WHEN** Transit journeyにaccess walk、egress walk、または両方の有効な秒数がある
- **THEN** システムは該当する側にのみ既存 `WALK` segmentを追加し、他方の端点とjourney legsを変更しない

#### Scenario: access/egress時間をroute全体の徒歩指標へ重ねて加算しない

- **WHEN** optionに `metrics.walkSecs` と正のaccess/egress秒数が含まれる
- **THEN** `walk_minutes` は従来どおり `metrics.walkSecs` から算出し、access/egress秒数を二重加算しない

#### Scenario: access/egress秒数がないか0である

- **WHEN** `accessWalkSecs` または `egressWalkSecs` が欠落または0である
- **THEN** システムはその端に外部 `WALK` segmentを追加せず、Transitが返す既存legsを維持する

#### Scenario: access/egress情報がmalformedまたは生成不能である

- **WHEN** access/egress秒数が負、数値以外、NaN、無限大、journey時間と不整合、または正の秒数に必要な隣接stop名が欠けている
- **THEN** システムは徒歩segmentを推測または黙って省略せずresponse errorとして扱い、`POST /api/route-search` はHTTP 502を返す

#### Scenario: 駅endpointへsnapした場所にTransit由来の徒歩時間がない

- **WHEN** Placesの駅・停留所名が既存の保守的な名前一致でplanner endpointへsnapされ、Transit responseに正のaccess/egress秒数がない
- **THEN** システムは距離だけを根拠にWALK segmentを生成せず、駅・停留所指定間の無意味な徒歩区間を表示しない

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
