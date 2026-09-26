## MODIFIED Requirements

### Requirement: カレンダー表示を切り替える

システムは月、週、日、Timelineの4つの表示を提供し、初期表示を月表示としなければならない（MUST）。4表示は同じ表示基準日を共有しなければならない（MUST）。

#### Scenario: 表示を選択する

- **WHEN** ユーザーが月、週、日、Timelineのいずれかのタブを選択する
- **THEN** システムは選択した表示へ切り替える

#### Scenario: カレンダー間で表示を切り替える

- **WHEN** ユーザーが月、週、日、Timelineの表示を切り替える
- **THEN** システムは共有している表示基準日を新しい表示に引き継ぐ

#### Scenario: Timelineから他の表示へ戻る

- **WHEN** ユーザーがTimelineで選択日を移動してから月、週、日のいずれかへ切り替える
- **THEN** システムはTimelineで選択した日を表示基準日として引き継ぐ
