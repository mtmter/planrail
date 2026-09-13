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
