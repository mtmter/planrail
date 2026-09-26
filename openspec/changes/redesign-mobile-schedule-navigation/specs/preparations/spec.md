## ADDED Requirements

### Requirement: スマホの準備画面に未来の未完了項目を集約する

幅720px以下の「準備」画面は、開始日時が現在より後のEventに紐づく未完了Preparationを、通知期間に入っているかどうかに関係なく表示しなければならない（MUST）。Event開始日時が近い順にEventごとにまとめ、Eventの開始日時・タイトルと各項目を表示しなければならない（MUST）。Eventが存在しない項目、開始済み/過去のEventの項目、完了済み項目、開始日時が不正なEventの項目を集計対象にしてはならない（MUST NOT）。新しいPreparation保存形やCRUD体系を作ってはならない（MUST NOT）。

#### Scenario: 通知期間より先の予定がある

- **WHEN** 未来のEventに未完了Preparationがあり、そのEvent開始が設定済み通知期間の外にある
- **THEN** システムはそのEventと未完了項目を準備画面に表示する

#### Scenario: 準備項目を完了する

- **WHEN** ユーザーが準備画面で未完了項目をチェックする
- **THEN** システムは既存のPreparation更新処理で完了状態へ保存し、一覧とbadgeを更新する

#### Scenario: 予定詳細を開く

- **WHEN** ユーザーが準備グループのEvent名またはEvent部分を選ぶ
- **THEN** システムは既存のEvent詳細を開き、そこで準備の追加・編集・削除を行える

#### Scenario: 対象がない、または取得できない

- **WHEN** 対象の未完了項目が0件で、Preparationを正常に取得できている
- **THEN** システムは空状態を表示する
- **WHEN** Preparationの取得に失敗した
- **THEN** システムは準備画面内に取得失敗と再読み込み導線を示し、0件と誤表示しない

### Requirement: スマホではPreparation単独の取得失敗を準備画面で扱う

Events/Journeysの取得が成功しPreparationだけ取得に失敗した場合、幅720px以下では、システムは準備画面内に取得失敗と再読み込み導線を示し、準備badgeを表示してはならない（MUST）。スマホのタイムラインとカレンダーにPreparation専用のglobal error bannerを重複表示してはならない（MUST NOT）。スケジュール全体の取得失敗など他のデータにも影響する既存global error、およびPCの既存エラー表示は維持しなければならない（MUST）。

#### Scenario: Preparationだけ取得できない

- **WHEN** Events/Journeysは取得でき、Preparationだけ取得に失敗した状態でスマホのタイムラインまたはカレンダーを開く
- **THEN** システムはその画面にPreparation専用のglobal error bannerを表示せず、準備badgeを隠し、準備画面に取得失敗と再読み込み導線を表示する

#### Scenario: スケジュール全体を取得できない

- **WHEN** Events/Journeysを含むスケジュール取得に失敗した
- **THEN** システムは従来のglobal errorと再読み込み導線を表示する

### Requirement: 準備badgeは未来の未完了項目数を示す

スマホの「準備」タブのbadgeは、準備画面の対象に含まれる未完了Preparationの総件数を示さなければならない（MUST）。Event件数または通知期間内の件数を示してはならない（MUST NOT）。0件またはPreparation未取得時はbadgeを表示してはならない（MUST NOT）。

#### Scenario: 複数Eventの項目を数える

- **WHEN** 未来のEvent Aに未完了2件、Event Bに未完了1件、過去のEventに未完了1件がある
- **THEN** システムは準備badgeを3件と表示する

#### Scenario: 時間または項目状態が変わる

- **WHEN** 項目を完了する、Eventを変更・削除する、または時刻がEvent開始を過ぎる
- **THEN** システムは一覧とbadgeを再計算し、対象が0件になればbadgeを隠す

### Requirement: 通知期間内の準備を強調する

スマホの準備画面は、未来のEvent開始までが設定済み準備通知期間以内のグループを「まもなく必要」等の既存の注意表現で区別しなければならない（MUST）。この強調条件を一覧やbadgeの表示条件として使ってはならない（MUST NOT）。

#### Scenario: 期限が近づく

- **WHEN** 一覧を開いたままEvent開始までの残り時間が通知期間内に入る
- **THEN** システムは既存の分単位の時刻更新またはfocus/visibility復帰でそのEventを強調し、他の未来の準備も表示し続ける

## MODIFIED Requirements

### Requirement: カレンダーの画面幅に応じて準備案内を配置する

幅721px以上の月・週・日表示では、システムは従来どおり準備通知期間内の案内を左サイドバーのミニカレンダー下へ表示しなければならない（MUST）。PCのTimelineに案内一覧を重複表示してはならない（MUST NOT）。幅720px以下では、月・週・日/Timeline画面上部の準備案内を表示せず、未来の未完了準備は専用の「準備」画面へ集約しなければならない（MUST）。

#### Scenario: PCのカレンダーを開く

- **WHEN** 幅721px以上でユーザーが月・週・日のいずれかを開く
- **THEN** システムは通知対象の準備案内を左サイドバー内のスクロール可能な領域へ表示する

#### Scenario: スマホで画面を切り替える

- **WHEN** 幅720px以下でユーザーがタイムラインまたはカレンダーを見る
- **THEN** システムは上部の準備案内一覧を表示せず、「準備」タブから集約画面へ進める

### Requirement: 通知期間をブラウザへ保存する

通知期間は1時間前、3時間前、1日前、3日前、7日前から選択でき、初期値を3日前としなければならない（MUST）。選択値は `ryuute_preparation_reminder_minutes` としてlocalStorageへ保存しなければならない（MUST）。スマホでは「準備」画面のtop barから既存の設定ダイアログを開けるようにし、設定が準備一覧の表示開始時刻だと誤解させてはならない（MUST）。PCの既存headerからの設定操作は維持しなければならない（MUST）。

#### Scenario: スマホで通知期間を変更する

- **WHEN** ユーザーが準備画面の設定操作から通知期間を変える
- **THEN** システムは既存の設定値を保存し、通知期間内の強調を再計算するが、期間外の未来の項目は一覧から除外しない

#### Scenario: 保存値がないまたは不正である

- **WHEN** localStorageに有効な選択肢が保存されていない
- **THEN** システムは3日前を使用する
