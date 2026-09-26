## MODIFIED Requirements

### Requirement: カレンダー表示を切り替える

システムは月、週、日、Timelineの4つの表示を提供し、初期表示を月表示としなければならない（MUST）。4表示は同じ `selectedDate` 相当の表示基準日を共有し、表示viewの切替だけでその日付を変更してはならない（MUST NOT）。

#### Scenario: 表示を選択する

- **WHEN** ユーザーが月、週、日、Timelineのいずれかのタブを選択する
- **THEN** システムは選択した表示へ切り替える

#### Scenario: カレンダー間で表示を切り替える

- **WHEN** ユーザーが月、週、日、Timelineのいずれかから別の表示へ切り替える
- **THEN** システムは切替直前の表示基準日を変更せず、新しい表示にそのまま引き継ぐ

#### Scenario: 月から週へ切り替える

- **WHEN** ユーザーが月表示から週表示へ切り替える
- **THEN** システムは今日または月初へ表示基準日を置き換えず、選択済みの日付を含む週を表示する

#### Scenario: Timelineから他の表示へ戻る

- **WHEN** ユーザーがTimelineで選択日を移動してから月、週、日のいずれかへ切り替える
- **THEN** システムはTimelineで選択した日を表示基準日として引き継ぐ

### Requirement: 予定を管理する

Eventはタイトル、開始日時、終了日時、説明、場所情報、到着余裕時間を保持し、Firestoreで作成、更新、削除できなければならない（MUST）。Event削除時は関連する準備項目とEvent-linked Journeyを同時に削除し、Standalone Journeyには影響させてはならない（MUST NOT）。Event更新でJourney targetの目的地または `getEventArrivalDeadline(event)` 相当の到着期限が変わるか、検索可能だった目的地の有効座標を失う場合は、既存Event-linked Journeyを同じ原子的な保存処理で削除しなければならない（MUST）。targetに影響しない更新ではJourneyを維持しなければならない（MUST）。

#### Scenario: 予定を保存する

- **WHEN** タイトル、開始日時、終了日時が入力され、終了日時が開始日時より前でなく、到着余裕時間が空または0以上の整数である
- **THEN** システムは予定を保存する

#### Scenario: 必須項目または日時が不正である

- **WHEN** タイトルまたは日時が空、終了日時が開始日時より前、または到着余裕時間が負数か整数でない
- **THEN** システムは予定を保存せず入力エラーを表示する

#### Scenario: 予定を削除する

- **WHEN** ユーザーがEventの削除を確定する
- **THEN** システムはEvent、関連する準備項目、Event-linked Journeyを同じ削除処理に含め、Standalone Journeyを残す

#### Scenario: 目的地または到着期限を変えて予定を更新する

- **WHEN** Eventの更新でJourney targetの目的地または到着期限が変わる
- **THEN** システムはEventを更新し、対応するEvent-linked Journeyを削除する。更新と削除のどちらか一方だけを成功させない

#### Scenario: 目的地の検索可能な情報を失う

- **WHEN** Eventの確定済みPlaces目的地を自由入力等に変え、経路検索に必要な座標が失われる
- **THEN** システムはEvent更新と同時に対応するEvent-linked Journeyを削除する

#### Scenario: targetに影響しない内容を変える

- **WHEN** Eventのタイトル、説明、終了時刻、または同一地点と判定できるPlaceの表示文字列だけを変更し、導出される到着期限と目的地の検索可能性も同じである
- **THEN** システムはEvent-linked Journeyを維持する
