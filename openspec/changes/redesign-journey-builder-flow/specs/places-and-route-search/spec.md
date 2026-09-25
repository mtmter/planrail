## MODIFIED Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集画面は「場所」1項目でGoogle Places候補と自由入力を提供し、自由入力だけでも予定を保存できなければならない（MUST）。候補を選択した場合は名前、住所、Place ID、緯度、経度、`types` を取得し、予定の既存場所フィールドへ保存する。自由入力だけの場合は以前のPlace ID・座標・typeを保存対象にしてはならない（MUST NOT）。APIキー不足・候補取得失敗時は通常の文字入力へフォールバックする。

予定とJourney Builderの選択済み地点は、同じshared selected-place presentation/componentと既存 `selected-place-card` スタイルを使用しなければならない（MUST）。Journey専用の別デザインを作ってはならない（MUST NOT）。Standaloneの出発地・目的地とFIXEDの乗降地点は📍、地点名、✓、取得済み住所、「変更」をEventと同じ見た目で表示し、「変更」でAutocompleteへ戻れる。Event-linkedの目的地は現在のEventから取得し、同じshared表示の📍、地点名、✓、取得済み住所をread-onlyで示す。Builder内にそのtargetの「変更」を表示してはならず（MUST NOT）、変更はEvent編集から行う。選択中の地点名を直接編集させず、変更を選んだときは選択済みPlacePointを解除する。選択済み地点を検索に使う場合、有効な緯度・経度が揃っていることを要求する。公共交通地点はPlacesの `types` で識別し、名称から推測してはならない（MUST NOT）。

#### Scenario: 予定の場所に自由入力する

- **WHEN** ユーザーがPlaces候補を選ばず予定の場所へ文字列を入力する
- **THEN** システムは予定を保存でき、Place ID・座標・typeを未設定とする

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選ぶ
- **THEN** システムは名前・住所・Place ID・緯度・経度・typesを取得し、EventとJourneyに共通の表示で📍、地点名、✓、利用可能な住所、「変更」を表示する

#### Scenario: Journeyの選択済み地点を変更する

- **WHEN** ユーザーがStandaloneまたはFIXEDの選択済み地点の「変更」を押す
- **THEN** システムはAutocomplete入力へ戻し、以前のPlacePointを検索対象から外す

#### Scenario: Event-linkedの目的地を表示する

- **WHEN** ユーザーがEventから移動予定を計画または再計画する
- **THEN** システムは現在のEvent由来の目的地をshared selected-place表示のread-onlyモードで示し、Builder内に「変更」を出さない

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
- **THEN** システムは各区間の最大3候補とwarningsをBuilder内に保持し、推奨候補または先頭候補を自動選択して完成Journeyのpreviewを主要表示にする。候補一覧は初期状態で閉じる

#### Scenario: 検索結果を画面に表示する

- **WHEN** 経路検索APIが共通RouteCandidate一覧を返す
- **THEN** システムは選択中候補をJourney全体の縦型timelineへ組み込み、coverage warningがあれば当該区間に表示する。区間単位の登録操作は表示しない

### Requirement: 経路結果を登録前に表示する

経路検索APIは各公共交通区間に最大3件の候補を返し、Builderは今回の検索で得た各区間の候補を画面内で保持しなければならない（MUST）。推奨IDが有効ならその候補、なければ先頭候補を自動選択し、検索直後は候補summary card一覧ではなく完成したJourney全体のpreviewを主要表示としなければならない（MUST）。候補一覧は初期状態で閉じ、候補cacheがある公共交通部分だけで「別の候補を見る」から当該区間の候補を比較できるようにする。保存済みJourneyの初期previewには候補cacheがないため、別候補を探す際は全区間の「候補を再検索」を用いる。候補カードは取得済みの出発・到着、所要時間、乗換、徒歩、運賃を表示し、未取得値を0と見せてはならない（MUST NOT）。区間単位の「この経路を登録」は提供せず、Journey全体を「この移動予定を確定」で保存する。coverage warningなど検索専用情報と未選択候補は保存してはならない（MUST NOT）。

#### Scenario: Journey sectionの候補を選択する

- **WHEN** ユーザーが公共交通部分の「別の候補を見る」を開き、1件以上3件以下の候補から別候補を選ぶ
- **THEN** システムはその区間のpreviewだけを差し替え、他区間の候補と選択を維持する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが出発地、目的地、到着期限、FIXEDの乗降地点・発着日時・追加・削除のいずれかを変更する
- **THEN** システムは既存結果をdirtyとし、区間ごとの手動検索ではなく全区間の一括再検索まで確定を禁止する

#### Scenario: 検索に成功する

- **WHEN** 全ての必要区間で経路検索APIが有効な候補を返す
- **THEN** システムは候補カード一覧を常時表示せず、自動選択済みの完成Journeyを一本のtimelineで主要表示する

#### Scenario: 初期候補を選択する

- **WHEN** 区間の検索直後に候補が返る
- **THEN** システムは返された推奨IDが有効ならその候補、そうでなければ先頭候補を自動選択する

#### Scenario: 推奨表示の候補をユーザーが選び直す

- **WHEN** ユーザーが「別の候補を見る」から推奨候補と異なる候補を選ぶ
- **THEN** システムは選んだ区間だけを差し替え、他の区間を維持する

#### Scenario: 選択した経路を登録する

- **WHEN** ユーザーが完成したJourneyの「この移動予定を確定」を選ぶ
- **THEN** システムは各区間で選択中の経路だけをJourneyへ保存し、区間単位の「この経路を登録」操作を表示しない

#### Scenario: Coverage warningがある

- **WHEN** いずれかの区間の検索結果にcoverage warningがある
- **THEN** システムは当該区間とともにwarningを表示し、Journey保存データへ含めない

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
