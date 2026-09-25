## Context

current main の `JourneyBuilderModal` は `createJourneyDraft()` で ROUTE を生成し、`addFixedAtRoute` と区間別 `search(section)` を画面に公開する。`getRouteContext` は前後の FIXED と target から上下限を求め、`requestRouteSearch` は `origin`/`destination` の PlacePoint と `time_constraint` を既存 `POST /api/route-search` に送る。API は最大3候補を返し、出発制約と `latest_arrival_at` をフィルタできる。`setRouteCandidates` は推奨 ID、なければ先頭をすでに選択する。したがって区間の計算と候補処理を画面操作から切り離せる。

`serializeJourney`/`validateJourney` と `saveJourney` は完成した sections を `journeys` に保存する。Event-linked は決定的 ID で置換されるが、Standalone の `saveJourney` は常に新 ID を発行するため、編集時には同じ ID を更新する経路が必要である。詳細モーダルは `onEdit` prop を持つが App から渡されず、削除もない。`JourneyDetails` は各 ROUTE に `RouteDetails` を丸ごと使い、FIXED は独立カードにしている。縦線が二重化し得る。

Places の `PlaceAutocompleteInput` は選択時に name/address/place_id/lat/lng/types を返す。`EventPlaceField` は `selected-place-card` で選択状態を明示する一方、Builder の独自 `PlaceField` は Autocomplete と小さな文字列だけを表示する。旧 `AddItemModal`（`25c238e`）には `item-type-tabs` があり、現行は `AddChoiceModal` の2ボタンである。旧 `TravelPlanDetails`（`3d9ef04`）は現行 `RouteDetails` の縦型表示と route metrics を組み合わせていた。

## Goals / Non-Goals

**Goals:** 内部 section を意識しない入力から全移動を一括構築する。選択直後に確認できる完成した行程を示す。必要な区間だけ候補を変えられる。保存済み Journey を同じ Builder で更新できる。既存デザインと地点データを再利用する。

**Non-Goals:** 候補の全組み合わせ最適化、区間個別の再検索ボタン、新しい backend batch API、Transit が返さない経路の生成、既存 Firestore 文書の移行。

## Decisions

### 1. 入力モデルと保存モデルを分離する

Builder の入力 state は `origin: PlaceInput`、`target: {destination: PlaceInput, arrival_deadline}`、`fixedMovements: FixedInput[]` とする。`PlaceInput` は表示文字列 `text` と選択済み `point: PlacePoint | null` を分ける。固定移動は UI 用の安定 ID、乗車/降車 PlaceInput、出発/到着日時、任意 label を持つ。検索結果 state は入力から導出した gap key、候補、選択中候補、warning、区間エラー、検索に使った入力 revision を別に持つ。保存用の `Journey.sections` は検索成功後にのみ組み立てる。入力時に未設定 ROUTE を保持しない。

新規 Standalone は出発地・目的地・到着期限を必須とする。以前の `target: null` の FIXED のみの文書は表示・削除を維持するが、新規作成・編集確定では目的地と期限を求める。これは依頼の共通入力フローに合わせた意図的な変更である。既存文書に不足する入力は編集画面で追加させる。FIXED だけで全体の両端がつながる場合は検索対象 gap が0件でも、「経路を検索」で行程を検証・プレビューしてから確定する。

### 1a. Builderの画面状態

Builderはcreate/edit/Event-linkedの全モードで次の同じ状態遷移を使う。

| 状態 | 主要表示 | 主な遷移 |
| --- | --- | --- |
| `input` | 出発地、target、任意の固定移動と「経路を検索」または「経路を再検索」。公共交通結果・未設定ROUTEは表示しない | 有効入力で検索を押すと`searching` |
| `searching` | 二重送信を防ぐdisabled操作、spinner相当、「経路を検索中...」、完了数/全件数 | 全gap終了で`preview`。0 gapも検証後`preview` |
| `preview` | 完成した移動予定を一本のタイムラインとして主要表示。「別の候補を見る」「条件を変更」「この移動予定を確定」 | 条件を変更すると`input`。候補変更は`preview`内で完結 |

一部失敗は`preview`のpartial-result substateで成功部分と失敗地点間を示し、確定を無効にする。入力不備は`input`内のvalidation表示とする。`preview`で全入力欄と全候補一覧を常時併置しない。「条件を変更」で入力画面へ戻り、検索条件に実際の変更があれば結果をdirtyにする。変更せず戻る場合は有効な既存previewを保持して戻れる。変更後は全gapの「経路を再検索」が完了するまで確定不可とする。edit modeは保存済みrouteと現在の入力が一致すれば初期`preview`を表示できるが、候補一覧を新たに得る場合も全gap再検索を使う。

### 2. gap 生成と固定移動の整列

入力 FIXED を出発日時、同時刻なら入力順で安定ソートし、各 FIXED の `arrival_at >= departure_at`、隣接固定移動の時刻が逆転しないことを確認する。先頭に origin → 最初の乗車地点、各 FIXED 間に前の降車地点 → 次の乗車地点、末尾に最後の降車地点 → target を導出する。FIXED が0件なら origin → target の1 gap。1件なら前後2 gap。n件なら原則 n+1 gap とする。

固定移動の追加は`input`で表示する「固定移動を追加」1操作だけとする。`preview`の公共交通要素や内部gap上に固定移動の追加・挿入操作を置かない。追加したい場合は「条件を変更」で`input`へ戻る。配置は入力した地点と時刻だけで決め、section位置をユーザーに指定させない。

両端が同一地点と確認できる場合（同じ非空 place_id、または双方に有限な同一座標）はその境界 gap を省略する。名称だけの一致では省略しない。省略した境界の待機時間は section 間の時刻差として表す。異なる地点の gap は Places 座標を必須とし、欠ければ一括検索を開始せず該当地点の選択を促す。省略後に FIXED が連続しても既存 serializer の地点接続と時刻順検証を通す。FIXED 0件で origin と target が同一地点なら移動なしとして入力エラーを示し、空 Journey は作らない。

### 3. 時間制約

各 gap の下限は直前 FIXED の到着時刻、上限は直後 FIXED の出発時刻または target 到着期限とする。下限なしなら `{type: arrival, at: upper}`。下限ありなら `{type: departure, at: lower, latest_arrival_at: upper}`。API とフロントエンド双方で候補の実時刻を検証する。前 FIXED → 次 FIXED で `lower > upper` は検索前の入力エラー。先頭固定移動前は上限だけ、末尾固定移動後は下限と target 上限、FIXED なしは target 上限だけとなる。日時は既存 Journey の `YYYY-MM-DDTHH:mm` を日本時間として扱い、日跨ぎも同じ比較 helper を使う。

### 4. 全 gap の検索と一部失敗

gap の上下限は固定入力と target だけで決まり、別 gap の検索結果に依存しない。クライアントから既存 endpoint へ最大3件ずつの bounded parallel request を行う。backend batch endpoint は追加しない。各結果を gap key で集約し、完了数/全件数を更新する。検索中は操作を重複送信できないようにし、ボタン disabled、spinner 相当、`経路を検索中...` と進捗を示す。結果は `Promise.allSettled` 相当で個別に扱い、一部 404/時間条件外/通信失敗でも成功した gap を表示し、失敗 gap を `地点A → 地点B` と理由で表示する。保存は全 gap 成功まで無効。再試行は一つの `経路を再検索` 操作で全 gap を再実行する。入力 revision または検索 run ID が変わった古い応答は破棄する。

### 5. 候補、確定、dirty state

各 gap の有効候補から `recommended_candidate_id` が存在すればそれを、なければ先頭を自動選択する。backend はフィルタ後に先頭を推奨 ID へ更新する場合があるため、API が返した ID を正とする。最大3候補は普段閉じ、タイムライン内の公共交通区間の `別の候補を見る` から表示する。出発/到着、所要時間、乗換、徒歩、運賃は既存 formatter を使い、nullable 値を0と表示しない。候補変更は当該 gap の選択だけを更新し、他の gap の候補・選択を保持する。選択後にも上下限を検証する。

地点・日時・FIXED の追加/削除/並べ替えを含む検索条件の変更は、結果一式を dirty として確定を無効にする。label の変更だけは検索条件に影響しないため選択済み経路を維持する。候補変更も dirty にしない。変更後は `経路を再検索` で全 gap を作り直す。確定時に検索条件だけの revision と検索 revision の一致、全 gap 成功、地点・時刻接続を確認してから既存 `serializeJourney` に渡す。保存境界でも検証し、draft、未選択候補、candidate ID、warning、Transit 生データを保存しない。

### 6. create / edit / Event-linked

単一 Builder に `mode=create|edit`、`event?`、`journey?` を渡す。Event-linked は現在の Event の地点と `getEventArrivalDeadline` を target に使い、再入力させない。現在の Event と保存済み target が異なる場合、開いた時点で結果を dirty にし、再検索を求める。保存済み Journey から最初の section の origin、最後の target、FIXED 一覧を復元し、既存 ROUTE が現在の入力と一致し有効なら編集前プレビューへ表示できる。候補一覧は保存されないので既存 route を選択済み1件として扱い、別候補を見るには一括再検索が必要である。Standalone 編集は同じ ID に `setDoc` し、新規 ID を発行しない。Event-linked も既存 `event-{eventId}` を置換する。詳細の `編集` から Builder を開き、`削除` は対象 Journey 文書のみを確認後削除する。Event 自体と準備項目は削除しない。既存 Event-linked 再計画の警告と Event からの導線を維持する。

### 7. Places state と検索不能の切り分け

`EventPlaceField` の選択済み表示を汎用のshared place-field/presentationへ切り出し、EventとJourneyの双方が同じコンポーネントと `selected-place-card` CSSを使用する。Journey専用の類似デザインは作らない。選択済み状態は📍、地点名、✓、取得済み住所、`変更`を同一構造で表示する。Standalone の両端、FIXED の両端、必要な Event 由来の表示に適用する。選択時に `point` 全体を保持する。変更または自由入力開始時には旧 `point` をクリアし、名前だけが残っていても検索可能と扱わない。選択済み point の name/address/place_id/lat/lng/types を gap 生成と request へ欠落・入れ替えなく渡すテストを置く。有効座標でも検索失敗した場合はフロントエンドの state/request 構築、API endpoint 解決、Transit の経路なしを別々に確認し、原因に応じて修正する。Transit の真の経路なしは地点間の失敗として表示する。

### 8. 一続きの表示と追加モーダル

**Journey用の独立したvisual languageを新設しない。** 現行のmodal header、modal form fields、modal actions、primary/secondary buttons、`DateTimePicker`、`selected-place-card`、`RouteDetails`、`route-timeline`を直接再利用する。旧 `TravelPlanDetails` の取得済みmetricsも取り込む。Journey固有の新しいカード、ボタン、色、spacing、modal shellを増やす前に既存primitiveの組み合わせと必要最小限の拡張を選ぶ。

Builder の結果と保存済み詳細で `RouteDetails` の segment 時刻・駅名・路線情報、旧 `TravelPlanDetails` の取得済み metrics、既存 `route-timeline` / `route-place` / `route-segment-line` を共有する。Journey 直下に一つの timeline rail を置き、ROUTE と FIXED をその上の連続した行程要素として描く。ROUTE ごとの外側カード/独立 rail/重複した origin・destination heading は統合し、FIXED は同じ線上の固定移動行として配置する。待機時間は線上の時刻差として表す。検索後プレビューも保存済み詳細も同じ行程表示を使う。候補一覧はデフォルトで閉じ、公共交通要素の小さな「別の候補を見る」からだけ開く。ユーザー向けには「移動予定」「固定移動」を使い、ROUTE/section/gap/Journey Builder の語や番号を出さない。

グローバル追加は現行 Event 追加フォームと Standalone Builder を `予定 / 移動予定` タブで切り替える。旧 `AddItemModal` の `item-type-tabs` と現行 `modal-header`/`modal-actions` を参照し、独立した中間2択ダイアログを外す。月セル・週/日の時間軸選択は従来どおり Event 追加へ直接進める。タブ切替中の未保存入力は各タブで保持し、確定または閉じるまで他タブに漏らさない。

Builderを状態・入力・検索・previewを担う**content/flow**と、backdrop・dialog・headerを担う**modal shell**へ分ける。グローバル追加のタブ内にはcontentだけを置き、外側の追加modal shellを共有する。Event詳細から開くときも、Event詳細の既存dialog内でcontentを切り替えるか既存dialogを閉じて単一のBuilder shellを開く。いずれも同時にbackdrop/dialogを二重描画しない。edit modeも同じcontentと状態遷移を使う。

## Risks / Trade-offs

- Transit の最大3候補を出発時刻で取得して上限で絞る方式では、実在する経路でも3件が全て上限外なら「候補なし」になる。追加探索や最適化は本 change の対象外とし、区間理由を明示する。
- 複数 gap の同時通信は provider 負荷と timeout を増やす可能性があるため、同時実行数を3以下に制限し、各 gap の失敗を個別に保持する。
- `unify-event-place-field` と `introduce-journey-builder` は実装済みの現行コードを基準にcanonicalへ同期・archive済み。先行changeに残るEmulator/ブラウザ未確認事項はarchiveのtasksに記録する。
- 保存済み旧 FIXED-only Standalone の target は null であり、新入力要件へ復元しきれない。詳細は表示し、編集確定前に目的地と期限を入力させる。
- 共通タイムラインは既存 `RouteDetails` のネスト構造を調整する必要がある。既存 Event/Route 表示の視覚的回帰を確認する。

## Open Questions

なし。上記の同一地点判定、0 gap、旧 FIXED-only 文書、全 gap 再検索は本 change の設計判断とする。
