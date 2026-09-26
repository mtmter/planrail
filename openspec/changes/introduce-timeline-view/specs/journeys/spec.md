## MODIFIED Requirements

### Requirement: Journeyを一本の行程として詳細表示する

システムは保存済みJourneyのROUTEとFIXEDを同じ縦型タイムラインに順番どおり表示しなければならない（MUST）。ROUTEでは既存Route詳細と同等のsegment・時刻・利用可能な公共交通詳細を表示し、FIXEDでは固定区間であること、名称、乗降地点、出発・到着時刻を明示する。Journey用の必須タイトル入力を追加してはならない（MUST NOT）。TimelineでのJourneyの大見出しは、関連Eventまたは目的地から自然なユーザー向け名称にし、既存のカレンダー項目とJourney詳細の表示名は維持しなければならない（MUST）。

#### Scenario: ROUTEとFIXEDを表示する

- **WHEN** 保存済みJourneyにROUTE、FIXED、ROUTEが含まれる
- **THEN** システムは各区間を一本の縦線上に行程順で表示し、FIXEDの固定表示と時刻を確認できる

#### Scenario: Journey名を生成する

- **WHEN** Event-linked Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは `移動: {event.title}` と表示する
- **WHEN** targetのあるStandalone Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは `移動: {destination.name}` と表示する
- **WHEN** FIXEDのみのStandalone Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは末尾FIXEDの降車地点から表示名を生成する

#### Scenario: TimelineでJourney名を生成する

- **WHEN** Event-linked JourneyをTimelineの大見出しに表示する
- **THEN** システムは関連Event名を自然に使い、内部向けの `移動: ` 接頭辞を表示しない
- **WHEN** Standalone JourneyをTimelineの大見出しに表示する
- **THEN** システムはtargetの目的地、なければ最後の区間の降車地点から「天神へ移動」のような名称を生成する

#### Scenario: Eventの場所または到着期限が変更された

- **WHEN** Event-linked Journeyの保存済みtargetと現在のEventの目的地識別情報または到着期限が異なる
- **THEN** システムはEvent詳細とJourney詳細に再計画を促す案内を表示し、保存済みsectionsとカレンダーの時間ブロックを自動変更しない
