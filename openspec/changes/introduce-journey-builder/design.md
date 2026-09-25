## Context

`loadScheduleData` は Event と Preparation だけを取得し、Event 詳細は `getTravelPlan(eventId)` で旧 Route を個別取得する。`saveTravelPlan` は Route/Segment の allowlist を `travelPlans/{eventId}` に保存する。月・週・日表示は Event の `start_at`/`end_at` のみを共通日時 helper で分割し、週・日の時間ブロックは現状重なりを配置しない。`POST /api/route-search` は Event 開始時刻から余裕時間を引いた到着時刻だけを受け、Transit Provider は `type=arrival` 固定である。Firestore rules は `users/{uid}/{document=**}` を認証 uid に限定する。

## Goals / Non-Goals

**Goals:** Event と独立した Journey、単独/連携共通 Builder、固定移動を含む複数 section、未完成データの保存防止、カレンダーと一本の縦型詳細表示、旧 TravelPlan 機能の廃止。

**Non-Goals:** 部分再検索、現在位置・遅延・Recovery、自動的な複数区間候補の組み合わせ最適化、予約詳細項目、旧 TravelPlan の変換、出発希望時刻から始める Standalone モード。

## Decisions

### Journey と Route の境界

`Journey.sections` は行程順の大区間であり、`kind: ROUTE | FIXED` だけを区別する。`ROUTE.route.segments` は既存の `WALK`/`TRANSIT` 等の検索結果内部だけを表す。FIXED は RouteSegment に変換しない。ROUTE は現行 `serializeTravelPlan` からEvent IDを除いたRoute/Segment allowlistを切り出して `route` に格納し、candidate ID・warnings・推奨情報・Transit 生 metadata を保存しない。section の接続点は `origin` と `destination` の PlacePoint を持ち、Route 内の同名フィールドは従来の表示文字列のままとする。

```text
Journey {
  event_id: string | null,
  target: { destination: PlacePoint, arrival_deadline: YYYY-MM-DDTHH:mm } | null,
  departure_at: YYYY-MM-DDTHH:mm,
  arrival_at: YYYY-MM-DDTHH:mm,
  sections: [
    { kind: "ROUTE", origin: PlacePoint, destination: PlacePoint,
      route: StoredRoute },
    { kind: "FIXED", origin: PlacePoint, destination: PlacePoint,
      departure_at: YYYY-MM-DDTHH:mm, arrival_at: YYYY-MM-DDTHH:mm,
      label: string | null }
  ]
}
PlacePoint { name: string, address: string | null,
  place_id: string | null, lat: number | null,
  lng: number | null, types: string[] }
```

PlacePoint は `{name, address, place_id, lat, lng, types}` を基本とし、取得できない値は null（types は空配列）とする。Event の既存 `location_name`、`destination`、`destination_place_id`、座標、types を target の PlacePoint へ写す。FIXED の両端でも Places 候補を利用する。検索する ROUTE の両端には有効な座標を要求し、名前だけの固定地点は固定区間の記録には利用できるが、その地点を端点とする検索には使えないことを Builder で示す。Transit の endpoint ID は保存せず、再検索時には PlacePoint から既存の保守的な地点解決をやり直す。

### Firestore ID とライフサイクル

Event-linked Journey は `journeys/event-{eventId}` の決定的 ID と `event_id` を持つ。Standalone は衝突しない `standalone-` 接頭辞付き生成 ID と `event_id: null` を持つ。Event-linked の再保存は同じ文書を置換し、正規フロントエンドから同一 Event への二重作成を防ぐ。現行 rules は uid 境界のみを検査するため、任意クライアントによる別 ID・同じ `event_id` の文書までは禁止できない。この change ではrulesを広範囲に組み替えず、正規書き込み経路と読み込みで決定的IDを使う。Event 削除時は準備項目、決定的 ID の linked Journey、Event を同一 batch に入れる。Standalone は削除しない。

旧 `travelPlans` の読み込み・新規保存・Event削除連携をアプリから除く。Event詳細とカレンダーは `journeys` のみを表示し、旧travelPlanしかないEventは移動未登録として扱う。旧文書はJourneyへ変換しない。既存の `travelPlans` 文書は運用上削除してよく、削除前後のアプリ挙動は同じとする。旧 collection の一括削除はこのchangeのアプリ実装に含めない。

Eventのタイトル変更はJourney表示名へ反映する。Eventの目的地または計算した到着期限が保存済みJourneyのtargetと異なる場合、Journeyのsectionsと時間ブロックは自動変更せず、Event詳細とJourney詳細に再計画が必要な案内を出す。カレンダーでは保存済み時刻を表示し続ける。ユーザーがBuilderで再確定して保存すると、同じlinked Journey文書を置換する。

### Builder state と保存検証

Builder は Event ID または null、target、入力中の PlacePoint、FIXED、各 gap の検索結果と選択候補を画面内 state に保持する。Firestore には完成後の明示的な保存操作でのみ書く。Event-linked では Event の目的地と `start_at - (arrival_buffer_minutes ?? 0)` を最初に設定し、再入力させない。Eventに `destination_lat` と `destination_lng` の両方がない場合は、現行の経路検索ボタンと同様に「移動を計画」をdisabledにしてPlaces候補の選択を促す。Builderを開いた後はFIXEDをROUTE検索より先に入力できる。Standalone の ROUTE 検索では出発地・目的地・到着希望日時を入力する。

保存時に sections が1件以上あり、各 section の両端・出発/到着時刻が有効で順序どおり、未設定 gap がなく、先頭と末尾から `departure_at`/`arrival_at` を導出できることを検証する。FIXED のみの Standalone は `target: null` として保存できる。Event-linked のFIXEDのみを保存する場合は、末尾FIXEDの降車地点のplace_idがtargetと一致し、到着時刻が期限以前であることを条件とする。place_idがない場合、同一地点と推測せず、ROUTEの確定を求める。固定移動間の待機時間は section を追加せず、隣接 section の時刻差として許容する。地点が接続していない、時刻が逆転する、必要な ROUTE が未選択などの場合は保存しない。検索結果や draft のみにあるデータは保存しない。

### 区間検索の時間制約

`POST /api/route-search` をJourney section用の地点ペアと `time_constraint: {type: arrival | departure, at}` を受ける契約へ変更する。Event-linkedでもBuilderがEventから到着期限を計算してsection検索を送るため、新規UIは旧Event形式を送信しない。内部 `search_route`/Provider に制約種別と日時を渡し、Transit の `type` を対応させる。[Transit APIのOpenAPI定義](https://api.transit.ls8h.com/api/openapi.json)はguidance planで `departure` と `arrival` を受け付ける。到着制約は最初の FIXED 出発、または FIXED なしの target 到着期限に使用する。出発制約は前 FIXED 到着に使用する。FIXED 間および末尾 FIXED 後のように上下限が両方ある場合は出発制約で候補を最大3件取得し、`departure_at >= lower` かつ `arrival_at <= upper` を共通 RouteCandidate の時刻で検証する。条件を満たす候補がなければその gap を未設定のままにして理由を表示し、保存を許さない。Transit が返した有効候補以外を追加取得・組み合わせ最適化しない。日時は `YYYY-MM-DDTHH:mm` の日本時間として扱い、ブラウザのローカルタイムゾーンに依存せず比較・日割りする。

```json
{
  "origin": { "name": "博多", "address": null, "place_id": "...", "lat": 33.59, "lng": 130.42, "types": ["train_station"] },
  "destination": { "name": "新大阪", "address": null, "place_id": "...", "lat": 34.73, "lng": 135.50, "types": ["train_station"] },
  "time_constraint": { "type": "departure", "at": "2026-10-01T10:28" }
}
```

### カレンダーと詳細表示

カレンダーは Event と保存済み Journey を異なる種別として同じ日付重なり判定へ渡す。月表示は両者を時刻順に数え、既存の上限・残件数にも含める。週・日表示は Journey 全体の時刻を1ブロックとし、日境界でクリップする。翌日に跨ぐ夜行バスは両日に各日分を表示する。同時刻に重なる Event/Journey は識別できる表示とクリック領域を保ち、重なりを横並びに配置する。Journey 名は Event-linked なら `移動: {event.title}`、Standalone の target ありなら `移動: {destination.name}`、FIXED のみなら末尾 FIXED の降車地点から生成する。Journey ブロック選択は Journey 詳細を開く。

詳細画面は既存 `RouteDetails` のタイムライン表現を section 単位へ拡張し、ROUTE では従来の segment 情報、FIXED では固定表示・label・両端地点/時刻を同じ縦線上に描く。section 間の待機時間は線の連続性を保ちながら時刻差として読み取れるようにする。

## Risks / Trade-offs

- 現在の Event 日時と Route 日時はオフセットなし文字列で、ブラウザのローカル時刻として解析される。Journeyでは日本時間として明示的に扱うため、既存日時helperとの差を境界テストで確認する。
- 現行 Firestore rules は uid 境界のみを検査し、Journey の完成条件や linked の一意性は保証しない。正規UI以外からの書き込みまで一意性を保証するにはrulesの構成変更が別途必要となる。
- 現行の Event 削除は batch を1件で作る。準備項目が多く Firestore の batch 上限を超える場合は別途対応が必要で、今回の実装で境界テストを設ける。
- Transit の departure 検索と Mock の時刻調整は現行未対応。Provider の実際の候補時刻と絞り込みをテストで検証する。

## Migration Plan

移動の読み書きを `journeys` に切り替え、旧 `travelPlans` の互換コードを除く。既存文書は変換せず、削除してよい。削除する場合は管理権限で対象と件数を確認してから運用作業として実施する。旧travelPlanしかないEventは移動未登録になる。ロールバックした旧UIは新Journeyを読めないため、公開時にこの互換性の切れ目を明示する。

## Open Questions

なし。旧データ互換とEventの目的地条件を含む方針は上記で確定した。
