## 1. Builder入力モデルとgap導出

- [x] 1.1 出発地、target、固定移動一覧を検索結果から分離した入力stateを作り、`input` / `searching` / `preview` の画面状態を共通Builderに導入する。完了条件: 初期`input`はStandaloneの出発地・目的地・期限、Event-linkedのEvent由来targetと出発地を主要表示し、未設定ROUTEや区間別検索操作を出さない。
- [x] 1.2 FIXED 0件・1件・複数件を時刻順に整列し、同一地点の境界を省略してgapを導出する。完了条件: A→F、A→B/C→F、A→B/C→D/E→Fと0 gap、逆転日時、日跨ぎの単体テストが通る。
- [x] 1.3 各gapの出発下限・到着上限を導出する。完了条件: 先頭FIXED前、FIXED間、末尾FIXED後、FIXEDなしでAPI向け制約と候補時刻の検証が一致する。

## 2. 固定移動とPlaces入力

- [x] 2.1 固定移動の追加・編集・削除を`input`の検索条件として実装する。完了条件: 追加導線は「固定移動を追加」1種類のみ、複数FIXEDは時刻順に表示、previewの公共交通要素やgapに挿入ボタンはなく、名称だけの変更は検索結果を無効化しない。
- [x] 2.2 `EventPlaceField` の選択済み表示をshared componentへ共通化し、Standalone両端・FIXED両端・Event-linked targetへ適用する。完了条件: EventとJourneyが同じcomponent/`selected-place-card` CSSで📍、地点名、✓、取得済み住所を表示する。Standalone/FIXEDはeditable modeで「変更」からAutocompleteに戻り旧選択情報を検索から外す。Event-linked targetは現在のEventの目的地をreadOnly modeで表示し、Builder内に「変更」を出さず、変更はEvent編集から行う。Journey専用の別デザインを作らない。
- [ ] 2.3 Places選択→Builder state→gap→route-search requestを検証する。完了条件: name/address/place_id/lat/lng/typesが両端とFIXED端点で失われず、有効座標の選択済み地点がフロントエンドstateだけを理由に検索不可にならない。再現事例がAPI地点解決またはTransit経路なしなら原因を記録し、契約内の不具合だけ修正する。
  - PlacePoint全fieldのrequest伝搬は自動テスト済み。実際のGoogle Places候補選択とTransit接続を通した再現・原因確定は未確認。

## 3. 全gap一括検索

- [x] 3.1 既存 `POST /api/route-search` へ全gapを同時実行数3以下で送る検索制御を実装する。完了条件: ユーザーの1操作で`input`→`searching`へ遷移して全gapを検索し、ボタンdisabled、spinner相当、「経路を検索中...」、完了数/全件数を表示して重複実行を防ぐ。
- [x] 3.2 gap単位の成功・失敗を集約し、古い非同期結果を破棄する。完了条件: 1gapだけ404/timeout/通信失敗になっても成功gapをpreviewに保持し、失敗した地点間と理由を示して確定を禁止する。入力を変えずに押せる「経路を再検索」で全gapを一括再実行し、自動retryもgap単位の再検索も行わない。入力変更後に古い応答が新stateを上書きしない。
- [x] 3.3 推奨IDまたは先頭の有効候補を自動選択し、各候補の実発着時刻を上下限で検証する。完了条件: 検索完了直後に有効な移動全体をプレビューでき、条件外候補や0件のgapでは保存できない。

## 4. 結果プレビューと候補変更

- [x] 4.1 `RouteDetails`、旧 `TravelPlanDetails` のmetrics、既存timeline CSSを使い、検索後は`preview`へ切り替えてJourney全体を主要表示する。完了条件: 公共交通・固定移動・待機が一本に連続し、入力フォームと全結果カードを常時併置せず、ROUTE番号/section/gapを見せない。
- [x] 4.2 各公共交通部分の小さな「別の候補を見る」で最大3件を比較・選択できるようにする。完了条件: 候補一覧は初期状態で閉じ、時刻・所要時間・乗換・徒歩・運賃の取得済み値だけを表示し、1区間の差し替えが他区間の選択を変えない。
- [x] 4.3 `preview`の「条件を変更」で`input`に戻し、検索条件のdirty判定と復帰操作を実装する。完了条件: 出発地、目的地、到着期限、FIXED乗車地点・降車地点・出発日時・到着日時・追加・削除の変更後は古い結果で確定できず、全gapの「経路を再検索」が必要。FIXED名称だけの変更または条件変更なしなら選択済みROUTEを維持し、再検索なしの「確認に戻る」でpreviewへ復帰できる。previewに大量の入力欄を出さない。

## 5. 確定と保存済みJourneyの編集・削除

- [x] 5.1 選択中ROUTEとFIXEDから既存Journeyモデルを構成し、確定操作へ既存serializerの検証を適用する。完了条件: 入力途中・検索中・dirty・1gap失敗状態で保存されず、完成したJourneyは検索専用データを含まず既存Firestore形に保存される。
- [x] 5.2 Journey詳細から同じBuilderのedit modeを開き、入力条件を復元する。完了条件: 有効な保存済みrouteは初期`preview`に使うが候補cacheはなく、「別の候補を見る」を直接出さない。「候補を再検索」は全gapを一括検索して推奨候補を自動選択し、その後のpreviewでは各公共交通部分で候補変更できる。「条件を変更」→`input`→`searching`→`preview`はcreateと共通で、Standaloneは同じIDを更新する。Event-linkedは現在のEvent targetを使い、変更時は全gap再検索を求め、二重作成しない。既存 `target:null` 文書の編集では不足入力を求める。
- [x] 5.3 Journey詳細に確認付き削除を追加する。完了条件: カレンダーと詳細から対象Journeyだけが消え、Eventと準備項目は残る。

## 6. 追加導線と保存済み詳細

- [x] 6.1 グローバル追加を旧 `AddItemModal` の`item-type-tabs`を再利用した「予定 / 移動予定」へ変更し、Builder contentとmodal shellを分離する。完了条件: 予定は現行Eventフォーム、移動予定はshellを持たないBuilder contentとなり、タブ間の未保存入力が混ざらず、月セルと週/日の時間軸はEventフォームを直接開く。グローバル追加とEvent詳細の両方でbackdrop/dialog/headerがnestedしない。
- [x] 6.2 Builderプレビューと保存済み詳細に共通のJourney縦型タイムラインを適用する。完了条件: ROUTE/FIXED/ROUTEが一本の線上で自然に読め、各sectionが別カードの縦積みにならず、Event由来の再計画警告と既存Routeの詳細を維持する。既存PlanRailのmodal/form/button/DateTimePicker/timeline primitiveを再利用し、Journeyだけが視覚的に浮かない。
- [x] 6.3 画面タイトル・操作名・エラー文をユーザー向け用語に揃える。完了条件: 通常画面にJourney Builder、ROUTE番号、section、gapが表示されず、「移動予定」「固定移動」「移動予定を追加/編集」を使う。

## 7. 統合検証

- [x] 7.1 純粋な入力/gap/制約/候補処理とFirestore更新境界のテストを追加する。完了条件: FIXED 0/1/複数、時間上下限、一部失敗から入力変更なしの全gap再検索と自動retryなし、推奨自動選択、1区間候補変更、保存済み初期previewの候補cacheなし、検索条件変更時のdirty判定と名称のみ変更時の非dirty復帰、未完成保存不可を確認する。
- [ ] 7.2 Builder、Event-linked再計画、保存済み編集・削除、選択済みPlaces、グローバル追加タブ、Journey詳細のブラウザ受け入れ確認を行う。完了条件: Journeyだけ別アプリに見えない、EventとJourneyの選択済みPlaces表示が同一でEvent-linked targetだけreadOnly、検索中が一目で分かる、検索前にROUTE番号がない、検索後は完成した一本のJourneyが主役で候補一覧が閉じる、保存済み初期previewでは「候補を再検索」を使う、名称だけの変更は「確認に戻る」で反映される、「固定移動を追加」の類似ボタンがない、nested backdrop/dialogがない、保存済みJourneyを編集できる、選択済み有効地点がfrontend state不整合で検索不能にならないことを目視確認して記録する。
  - ローカルfixtureをヘッドレスChromeで確認済み: タブ、単一dialog、保存済み初期preview、label変更復帰、Event target readOnly、一部失敗、全gap再検索、区間候補変更。認証済み実アプリ、実Places選択、Firestore編集・削除の受け入れ確認は未実施。
- [x] 7.3 変更範囲に応じてfrontendテスト、`npm run lint`、`npm run build`、backend unittestを実行し、既存Route表示とAPI契約の回帰を確認する。完了条件: 実行結果と未確認範囲を報告する。
