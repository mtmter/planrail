## 1. 日時と保存モデル

- [x] 1.1 Journeyの日時文字列を日本時間として扱う比較・日割り処理を設計どおり実装し、ブラウザのタイムゾーンと夜行移動の日境界をテストする。
- [x] 1.2 現行serializerからRoute/Segment allowlistをJourney用に切り出し、検索専用項目を保存しないことをテストする。

## 2. JourneyモデルとFirestore

- [x] 2.1 PlacePoint、JourneySection、Journeyのシリアライズ/検証を追加する。FIXEDのみ、複数section、日跨ぎ、未設定gap・逆転時刻と、Event-linked FIXEDのみのplace_id/到着期限条件を確認する。
- [x] 2.2 `journeys` の読み込み・作成/置換・必要な削除をFirestore serviceへ追加する。Event-linkedは決定的ID、Standaloneは別接頭辞のIDとし、同一Eventの再保存で二重作成されないことを確認する。
- [ ] 2.3 現行Firestore rulesが `journeys` に適用されることと異なるuidへの拒否をFirestore Emulator等で確認する。正規UIで決定的IDを使い同一Eventへ二件目を作らないことを検証する。（Emulatorでの確認が未実施）
- [ ] 2.4 Event削除処理へlinked Journeyを含め、準備項目とともに削除し、Standalone Journeyを残す。batch上限と失敗時の整合性を確認する。（上限超過時は削除前に拒否する実装。Firestoreでの失敗時確認が未実施）
- [x] 2.5 旧 `travelPlans` の読み書きとEvent削除連携をアプリから除き、既存文書があってもEvent詳細・カレンダーへ表示されないことを確認する。既存文書の削除はアプリ実装と分けた運用作業として記録する。

## 3. Journey section検索API

- [x] 3.1 `POST /api/route-search` をJourney section用の地点ペア・arrival/departure制約を受ける契約に変え、新規UIから旧Event形式への依存を廃止する。既存の地点解決とHTTPエラー分類、欠損座標、不正時刻、未知制約をテストする。
- [x] 3.2 `routes_service.py`、Transit/Mock Providerへ制約種別を伝搬する。Transitの`type=departure`、日本時間、候補3件、既存converter/警告/ログの維持をテストする。
- [x] 3.3 Builder側でFIXED前後・FIXED間・FIXEDなしの区間ごとの境界を計算し、候補の実発着時刻を上下限で絞る。次FIXEDに間に合う候補がない場合、未設定のまま保存不可となることを確認する。

## 4. Journey Builderと導線

- [x] 4.1 共通Builderの画面内draft stateを作り、Standaloneでは目的地・到着希望日時・出発地入力、Event-linkedではEventからの目的地・到着期限自動設定を提供する。保存前の閉じる/再検索でFirestoreにdraftが残らないことを確認する。
- [x] 4.2 Places候補を使うFIXED両端入力とROUTE/FIXED section編集・順序表示を追加する。固定区間を検索前に追加し、複数gapを個別に検索できること、FIXEDの地点・時刻変更で影響する選択済みROUTEを再検証することを確認する。
- [x] 4.3 各gapで最大3候補を比較し1件を確定するUIを既存Route形式とRouteDetailsから再利用する。sectionごとの候補変更が他の確定sectionを消さず、未選択候補を保存しないことを確認する。
- [x] 4.4 保存可能条件を画面と保存境界の両方で検証し、FIXEDのみのStandaloneと同じplace_idで目的地へ期限内に着くEvent-linkedは保存でき、目的地と期限のみ・未設定ROUTE・接続不整合は保存できないことを確認する。
- [x] 4.5 グローバル`+`に「予定を追加」「移動予定を追加」を追加し、Event詳細の「移動を計画」から同じBuilderを開く。Eventの目的地座標が欠ける場合は現行と同様に操作を無効化し、月セル/週・日の時間軸によるEvent追加を維持する。

## 5. Journey表示

- [x] 5.1 Event詳細でEvent-linked Journeyを読み込み、旧travelPlanしかないEventは移動未登録として表示する。旧データのfallbackや表示用変換を残さない。
- [x] 5.2 Journey詳細を既存縦型Route UIから拡張し、ROUTE内部のsegmentとFIXEDの名称・固定表示・発着地点/時刻を一本のタイムラインで確認する。Routeのnullableな追加項目は利用可能な部分だけ表示する。
- [x] 5.3 Journeyの表示名生成と詳細選択を実装し、Event-linked、target付きStandalone、FIXEDのみの名前を確認する。
- [x] 5.4 Eventの目的地または到着期限が保存済みtargetと変わった場合、Event詳細とJourney詳細に再計画案内を出し、保存済みsectionsとカレンダーの時間ブロックを維持することを確認する。

## 6. カレンダーと統合検証

- [x] 6.1 `loadScheduleData` と画面stateにJourneyを追加し、月表示でEvent/Journeyを時刻順に表示して上限・残件数へ両方を含める。Journey選択時にJourney詳細が開くことを確認する。
- [x] 6.2 週・日表示でJourneyを独立ブロックとして表示し、Eventと重なる場合も各ブロックを選択可能にする。夜行バスなど日跨ぎを両日で正しくクリップすることを確認する。
- [ ] 6.3 backend unittest、frontendの既存serializer/APIテスト、`npm run lint`、`npm run build` を実行する。現行frontendに自動UIテストスクリプトがないため、Builder、旧travelPlan非表示、カレンダー3表示、Event削除の手動受け入れ確認を行い、未実施範囲を報告する。（自動検証は完了。ブラウザでの手動確認が未実施）
