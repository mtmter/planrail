import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import AddEventModal from "./components/AddEventModal";
import AddChoiceModal from "./components/AddChoiceModal";
import AccountMenu from "./components/AccountMenu";
import CalendarToolbar from "./components/CalendarToolbar";
import DayCalendar from "./components/DayCalendar";
import TimelineView from "./components/TimelineView";
import EventDetailsModal from "./components/EventDetailsModal";
import JourneyBuilderModal from "./components/JourneyBuilderModal";
import JourneyDetailsModal from "./components/JourneyDetailsModal";
import MiniCalendar from "./components/MiniCalendar";
import MobileMonthCalendar from "./components/MobileMonthCalendar";
import MobilePreparationPage from "./components/MobilePreparationPage";
import MonthCalendar from "./components/MonthCalendar";
import PreparationReminderList from "./components/PreparationReminderList";
import PreparationReminderSettingsModal from "./components/PreparationReminderSettingsModal";
import WeekCalendar from "./components/WeekCalendar";
import useAuth from "./auth/useAuth";
import {
  createEvent as createFirestoreEvent,
  createPreparation as createFirestorePreparation,
  deleteEvent as deleteFirestoreEvent,
  deleteJourney as deleteFirestoreJourney,
  deletePreparation as deleteFirestorePreparation,
  getJourney as getFirestoreJourney,
  loadScheduleData,
  saveJourney as saveFirestoreJourney,
  updateEvent as updateFirestoreEvent,
  updatePreparation as updateFirestorePreparation,
} from "./firestoreService";
import {
  addDays,
  addMonths,
  WEEKDAY_NAMES,
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  getWeekDates,
  getDateKey,
  isSameDay,
  parseDateTime,
  toDateTimeInputValue,
} from "./dateUtils";
import { journeyDisplayName } from "./journeySerializer";
import {
  getMobileDateStripDates,
  getUpcomingPreparationGroups,
} from "./mobileScheduleModel";

const PREPARATION_REMINDER_STORAGE_KEY =
  "ryuute_preparation_reminder_minutes";
const DEFAULT_PREPARATION_REMINDER_MINUTES = 3 * 24 * 60;
const PREPARATION_REMINDER_OPTIONS = [
  { label: "1時間前", minutes: 60 },
  { label: "3時間前", minutes: 3 * 60 },
  { label: "1日前", minutes: 24 * 60 },
  { label: "3日前", minutes: 3 * 24 * 60 },
  { label: "7日前", minutes: 7 * 24 * 60 },
];
const FULL_WEEKDAY_NAMES = [
  "日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日",
];

function getInitialPreparationReminderMinutes() {
  try {
    const savedValue = Number(
      window.localStorage.getItem(PREPARATION_REMINDER_STORAGE_KEY),
    );
    const isValidValue = PREPARATION_REMINDER_OPTIONS.some(
      (option) => option.minutes === savedValue,
    );

    return isValidValue
      ? savedValue
      : DEFAULT_PREPARATION_REMINDER_MINUTES;
  } catch {
    return DEFAULT_PREPARATION_REMINDER_MINUTES;
  }
}

function formatRemainingTime(milliseconds) {
  if (milliseconds < 60 * 1000) {
    return "1分未満";
  }

  const totalMinutes = Math.floor(milliseconds / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}日${hours}時間` : `${days}日`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
  }

  return `${minutes}分`;
}

function getPreparationReminders(
  events,
  preparations,
  reminderMinutes,
  currentTime,
) {
  if (preparations === null) {
    return [];
  }

  const incompleteCounts = new Map();
  preparations.forEach((preparation) => {
    if (!preparation.completed) {
      incompleteCounts.set(
        preparation.event_id,
        (incompleteCounts.get(preparation.event_id) ?? 0) + 1,
      );
    }
  });

  const reminderMilliseconds = reminderMinutes * 60 * 1000;

  return events
    .map((event) => {
      const eventStart = parseDateTime(event.start_at);
      const remainingMilliseconds = eventStart
        ? eventStart.getTime() - currentTime.getTime()
        : 0;

      return {
        event,
        eventStart,
        incompleteCount: incompleteCounts.get(event.id) ?? 0,
        remainingMilliseconds,
      };
    })
    .filter(
      (reminder) =>
        reminder.eventStart &&
        !Number.isNaN(reminder.eventStart.getTime()) &&
        reminder.remainingMilliseconds > 0 &&
        reminder.remainingMilliseconds <= reminderMilliseconds &&
        reminder.incompleteCount > 0,
    )
    .sort(
      (firstReminder, secondReminder) =>
        firstReminder.eventStart - secondReminder.eventStart,
    )
    .map((reminder) => ({
      ...reminder,
      remainingText: formatRemainingTime(reminder.remainingMilliseconds),
    }));
}

function createDateAtMinutes(date, minutes) {
  const dateAtTime = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  dateAtTime.setMinutes(minutes);
  return dateAtTime;
}

function createInitialValues(date, eventStartMinutes = 9 * 60) {
  const eventStart = createDateAtMinutes(date, eventStartMinutes);
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

  return {
    eventStartAt: toDateTimeInputValue(eventStart),
    eventEndAt: toDateTimeInputValue(eventEnd),
  };
}

function ScheduleApp({ authErrorMessage, onLogout, user }) {
  const [activeView, setActiveView] = useState("month");
  const [mobileTab, setMobileTab] = useState("timeline");
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 720px)").matches,
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [events, setEvents] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [preparations, setPreparations] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [preparationErrorMessage, setPreparationErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [addModalValues, setAddModalValues] = useState(null);
  const [addChoiceValues, setAddChoiceValues] = useState(null);
  const [editingJourney, setEditingJourney] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventInitialMode, setEventInitialMode] = useState("details");
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [preparationReminderMinutes, setPreparationReminderMinutes] = useState(
    getInitialPreparationReminderMinutes,
  );
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    function handleWidthChange(event) {
      setIsMobile(event.matches);
    }

    mediaQuery.addEventListener("change", handleWidthChange);
    return () => mediaQuery.removeEventListener("change", handleWidthChange);
  }, []);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const scheduleData = await loadScheduleData(user.uid);
        setEvents(scheduleData.events);
        setJourneys(scheduleData.journeys ?? []);
        setPreparations(scheduleData.preparations);
        setPreparationErrorMessage(
          scheduleData.preparations === null
            ? "準備項目を取得できなかったため、準備案内を表示できません"
            : "",
        );
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadSchedule();
  }, [user.uid]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREPARATION_REMINDER_STORAGE_KEY,
        String(preparationReminderMinutes),
      );
    } catch {
      // ブラウザが保存を許可しない場合も、開いている間は現在の設定を使います。
    }
  }, [preparationReminderMinutes]);

  useEffect(() => {
    function updateCurrentTime() {
      setCurrentTime(new Date());
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        updateCurrentTime();
      }
    }

    const intervalId = window.setInterval(updateCurrentTime, 60 * 1000);
    window.addEventListener("focus", updateCurrentTime);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updateCurrentTime);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const preparationReminders = getPreparationReminders(
    events,
    preparations,
    preparationReminderMinutes,
    currentTime,
  );
  const upcomingPreparationGroups = getUpcomingPreparationGroups(
    events,
    preparations,
    preparationReminderMinutes,
    currentTime,
  );
  const upcomingPreparationCount = upcomingPreparationGroups?.reduce(
    (count, group) => count + group.items.length,
    0,
  ) ?? 0;
  const selectedReminderOption = PREPARATION_REMINDER_OPTIONS.find(
    (option) => option.minutes === preparationReminderMinutes,
  );

  function handlePreparationReminderMinutesChange(minutes) {
    setPreparationReminderMinutes(minutes);
    setCurrentTime(new Date());
  }

  function handleCalendarDateChange(date) {
    setSelectedDate(date);
    setMiniCalendarMonth(
      new Date(date.getFullYear(), date.getMonth(), 1),
    );
  }

  async function handleRetry() {
    setIsLoading(true);
    setErrorMessage("");
    setPreparationErrorMessage("");

    try {
      const scheduleData = await loadScheduleData(user.uid);
      setEvents(scheduleData.events);
      setJourneys(scheduleData.journeys ?? []);
      setPreparations(scheduleData.preparations);
      setPreparationErrorMessage(
        scheduleData.preparations === null
          ? "準備項目を取得できなかったため、準備案内を表示できません"
          : "",
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddButtonClick() {
    setAddChoiceValues(getGlobalAddValues());
  }

  function handleMobileAddButtonClick() {
    setAddChoiceValues({
      ...createInitialValues(selectedDate),
      journeyDeadline: toDateTimeInputValue(createDateAtMinutes(selectedDate, 9 * 60)),
    });
  }

  function handleMobileMonthDateClick(date) {
    handleCalendarDateChange(date);
    setMobileTab("timeline");
  }

  function getGlobalAddValues() {
    const today = new Date();

    if (activeView === "month") {
      const isCurrentMonth =
        selectedDate.getFullYear() === today.getFullYear() &&
        selectedDate.getMonth() === today.getMonth();
      const targetDate = isCurrentMonth
        ? today
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      return createInitialValues(targetDate);
    }

    if (activeView === "day" || activeView === "timeline") {
      return createInitialValues(selectedDate);
    }

    const weekDates = getWeekDates(selectedDate);
    const targetDate = weekDates.some((date) => isSameDay(date, today))
      ? today
      : weekDates[0];
    return createInitialValues(targetDate);
  }

  function handleMonthDateClick(date) {
    setAddModalValues(createInitialValues(date));
  }

  function handleWeekTimeClick(date, startMinutes) {
    setAddModalValues(createInitialValues(date, startMinutes));
  }

  async function handleCreateEvent(eventData) {
    const createdEvent = await createFirestoreEvent(user.uid, eventData);
    setEvents((currentEvents) => [...currentEvents, createdEvent]);
    setAddModalValues(null);
  }

  async function handleUpdateEvent(eventId, eventData) {
    const result = await updateFirestoreEvent(
      user.uid,
      eventId,
      eventData,
    );
    const updatedEvent = result.event;
    setEvents((currentEvents) =>
      currentEvents.map((currentEvent) =>
        currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
      ),
    );
    setSelectedEvent(updatedEvent);
    if (result.journeyInvalidated) {
      const invalidatedId = `event-${eventId}`;
      setJourneys((current) => current.filter((journey) => journey.id !== invalidatedId));
      setSelectedJourney((current) => current?.id === invalidatedId ? null : current);
      setEditingJourney((current) => current?.id === invalidatedId ? null : current);
    }
    return result;
  }

  async function handleDeleteEvent(eventId) {
    await deleteFirestoreEvent(user.uid, eventId);

    setEvents((currentEvents) =>
      currentEvents.filter((currentEvent) => currentEvent.id !== eventId),
    );
    setJourneys((currentJourneys) =>
      currentJourneys.filter((journey) => journey.event_id !== String(eventId)),
    );
    setPreparations((currentPreparations) =>
      currentPreparations?.filter(
        (preparation) => preparation.event_id !== eventId,
      ) ?? null,
    );
    setSelectedEvent(null);
  }

  async function handleCreatePreparation(eventId, title) {
    const createdPreparation = await createFirestorePreparation(
      user.uid,
      eventId,
      title,
    );
    setPreparations((currentPreparations) => [
      ...(currentPreparations ?? []),
      createdPreparation,
    ]);
    return createdPreparation;
  }

  async function handleUpdatePreparation(
    eventId,
    preparationId,
    preparationData,
  ) {
    const updatedPreparation = await updateFirestorePreparation(
      user.uid,
      preparationId,
      {
        ...preparationData,
        event_id: String(eventId),
      },
    );
    setPreparations((currentPreparations) =>
      currentPreparations?.map((preparation) =>
        preparation.id === updatedPreparation.id
          ? updatedPreparation
          : preparation,
      ) ?? null,
    );
    return updatedPreparation;
  }

  async function handleDeletePreparation(eventId, preparationId) {
    await deleteFirestorePreparation(user.uid, eventId, preparationId);

    setPreparations((currentPreparations) =>
      currentPreparations?.filter(
        (preparation) => preparation.id !== preparationId,
      ) ?? null,
    );
  }

  async function handleJourneySave(journey, journeyId = null) {
    const savedJourney = await saveFirestoreJourney(user.uid, journey, journeyId);
    setJourneys((current) => {
      const withoutExisting = current.filter((item) => item.id !== savedJourney.id);
      return [...withoutExisting, savedJourney];
    });
    setAddChoiceValues(null);
    setEditingJourney(null);
    setSelectedJourney(null);
    return savedJourney;
  }

  async function handleJourneyDelete(journeyId) {
    await deleteFirestoreJourney(user.uid, journeyId);
    setJourneys((current) => current.filter((item) => item.id !== journeyId));
    setSelectedJourney(null);
  }

  const handleJourneyLoad = useCallback(
    (journeyId) => getFirestoreJourney(user.uid, journeyId),
    [user.uid],
  );

  const calendarItems = [
    ...events,
    ...journeys.map((journey) => {
      const linkedEvent = events.find((event) => event.id === journey.event_id);
      return {
        ...journey,
        itemType: "journey",
        title: journeyDisplayName(journey, linkedEvent),
        start_at: journey.departure_at,
        end_at: journey.arrival_at,
      };
    }),
  ];

  function handleCalendarItemClick(item) {
    if (item.itemType === "journey") {
      setSelectedJourney(item);
    } else {
      setEventInitialMode("details");
      setSelectedEvent(item);
    }
  }

  function handleEventDetailsClick(event) {
    setEventInitialMode("details");
    setSelectedEvent(event);
  }

  const timelineContent = (
    <TimelineView
      key={getDateKey(selectedDate)}
      selectedDate={selectedDate}
      currentTime={currentTime}
      events={events}
      journeys={journeys}
      preparations={preparations}
      onEventClick={handleEventDetailsClick}
      onPlanEvent={(event) => { setEventInitialMode("route"); setSelectedEvent(event); }}
      onJourneyClick={setSelectedJourney}
      onJourneyEdit={setEditingJourney}
    />
  );
  const globalErrorMessage =
    authErrorMessage || errorMessage || (!isMobile ? preparationErrorMessage : "");

  return (
    <div className={`schedule-app calendar-view-active${isMobile ? " is-mobile-schedule" : ""}`}>
      {isMobile ? (
        <header className="mobile-topbar">
          {mobileTab === "timeline" ? (
            <div className="mobile-topbar-main">
              <h1>{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 {FULL_WEEKDAY_NAMES[selectedDate.getDay()]}</h1>
              {!isSameDay(selectedDate, currentTime) && (
                <button type="button" className="mobile-topbar-today" onClick={() => handleCalendarDateChange(new Date())}>今日</button>
              )}
            </div>
          ) : mobileTab === "calendar" ? (
            <div className="mobile-topbar-main">
              <h1>{formatMonthTitle(selectedDate)}</h1>
              <div className="mobile-topbar-calendar-actions">
                <button type="button" aria-label="前の月" onClick={() => handleCalendarDateChange(addMonths(selectedDate, -1))}>‹</button>
                <button type="button" aria-label="次の月" onClick={() => handleCalendarDateChange(addMonths(selectedDate, 1))}>›</button>
                <button type="button" className="mobile-topbar-today" onClick={() => handleCalendarDateChange(new Date())}>今日</button>
              </div>
            </div>
          ) : (
            <div className="mobile-topbar-main">
              <h1>準備</h1>
              <button type="button" className="mobile-settings-button" aria-label="準備通知の設定" onClick={() => setIsReminderSettingsOpen(true)}>⚙</button>
            </div>
          )}
          <AccountMenu user={user} onLogout={onLogout} />
        </header>
      ) : (
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            P
          </span>
          <h1>PlanRail</h1>
        </div>

        <div className="header-calendar-controls">
          {activeView === "month" ? (
            <CalendarToolbar
              title={formatMonthTitle(selectedDate)}
              onPrevious={() =>
                handleCalendarDateChange(addMonths(selectedDate, -1))
              }
              onToday={() => handleCalendarDateChange(new Date())}
              onNext={() =>
                handleCalendarDateChange(addMonths(selectedDate, 1))
              }
            />
          ) : activeView === "week" ? (
            <CalendarToolbar
              title={formatWeekTitle(getWeekDates(selectedDate))}
              onPrevious={() =>
                handleCalendarDateChange(addDays(selectedDate, -7))
              }
              onToday={() => handleCalendarDateChange(new Date())}
              onNext={() =>
                handleCalendarDateChange(addDays(selectedDate, 7))
              }
            />
          ) : activeView === "day" || activeView === "timeline" ? (
            <CalendarToolbar
              title={formatDayTitle(selectedDate)}
              onPrevious={() =>
                handleCalendarDateChange(addDays(selectedDate, -1))
              }
              onToday={() => handleCalendarDateChange(new Date())}
              onNext={() =>
                handleCalendarDateChange(addDays(selectedDate, 1))
              }
            />
          ) : null}
        </div>

        <div className="header-actions">
          <nav className="view-tabs" aria-label="表示を切り替える">
            <button
              className={activeView === "month" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView("month")}
            >
              月
            </button>
            <button
              className={activeView === "week" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView("week")}
            >
              週
            </button>
            <button
              className={activeView === "day" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView("day")}
            >
              日
            </button>
            <button
              className={activeView === "timeline" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView("timeline")}
            >
              Timeline
            </button>
          </nav>
          <button
            className="reminder-settings-button"
            type="button"
            onClick={() => setIsReminderSettingsOpen(true)}
          >
            準備通知: {selectedReminderOption?.label ?? "3日前"}
          </button>
          <button
            className="add-button"
            type="button"
            onClick={handleAddButtonClick}
          >
            <span aria-hidden="true">＋</span>
            追加
          </button>
          <div className="auth-user-controls">
            <AccountMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>
      )}

      {globalErrorMessage && (
        <div className="error-message" role="alert">
          <span>{globalErrorMessage}</span>
          {!authErrorMessage && (
            <button type="button" onClick={handleRetry}>
              再読み込み
            </button>
          )}
        </div>
      )}

      {!isMobile && !isLoading && activeView !== "timeline" && (
        <div className="top-preparation-reminders">
          <PreparationReminderList
            reminders={preparationReminders}
            onEventClick={setSelectedEvent}
          />
        </div>
      )}

      <main className={`app-content${isMobile ? " mobile-app-content" : ""}`}>
        {isLoading ? (
          <p className="status-message">読み込み中...</p>
        ) : isMobile ? (
          mobileTab === "timeline" ? (
            <div className="mobile-timeline-page">
              <nav className="mobile-date-strip" aria-label="タイムラインの日付">
                {getMobileDateStripDates(selectedDate).map((date) => (
                  <button
                    type="button"
                    className={isSameDay(date, selectedDate) ? "is-selected" : ""}
                    key={getDateKey(date)}
                    aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${FULL_WEEKDAY_NAMES[date.getDay()]}`}
                    aria-current={isSameDay(date, selectedDate) ? "date" : undefined}
                    onClick={() => handleCalendarDateChange(date)}
                  >
                    <span>{date.getDate()}</span>
                    <small>{WEEKDAY_NAMES[date.getDay()]}</small>
                  </button>
                ))}
              </nav>
              {timelineContent}
            </div>
          ) : mobileTab === "calendar" ? (
            <MobileMonthCalendar
              items={calendarItems}
              selectedDate={selectedDate}
              onDateSelect={handleMobileMonthDateClick}
            />
          ) : errorMessage && preparations === null ? (
            <p className="status-message">スケジュールを読み込めませんでした。上の再読み込みから再試行してください。</p>
          ) : (
            <MobilePreparationPage
              groups={upcomingPreparationGroups}
              onEventClick={handleEventDetailsClick}
              onRetry={handleRetry}
              onUpdate={handleUpdatePreparation}
            />
          )
        ) : (
          <div className="calendar-page-layout">
            <aside className="calendar-sidebar" aria-label="日付と準備案内">
              <MiniCalendar
                activeView={activeView}
                displayedMonth={miniCalendarMonth}
                selectedDate={selectedDate}
                onDateSelect={handleCalendarDateChange}
                onDisplayedMonthChange={setMiniCalendarMonth}
              />
              {activeView !== "timeline" && <div className="sidebar-preparation-reminders">
                <PreparationReminderList
                  reminders={preparationReminders}
                  onEventClick={setSelectedEvent}
                />
              </div>}
            </aside>

            <div className="calendar-main-panel">
              {activeView === "month" ? (
                <MonthCalendar
                  events={calendarItems}
                  selectedDate={selectedDate}
                  onDateClick={handleMonthDateClick}
                  onEventClick={handleCalendarItemClick}
                />
              ) : activeView === "week" ? (
                <WeekCalendar
                  events={calendarItems}
                  selectedDate={selectedDate}
                  onEventClick={handleCalendarItemClick}
                  onTimeClick={handleWeekTimeClick}
                />
              ) : activeView === "day" ? (
                <DayCalendar
                  events={calendarItems}
                  selectedDate={selectedDate}
                  onEventClick={handleCalendarItemClick}
                  onTimeClick={handleWeekTimeClick}
                />
              ) : timelineContent}
            </div>
          </div>
        )}
      </main>

      {isMobile && mobileTab !== "preparation" && !isLoading && (
        <button
          type="button"
          className="mobile-add-fab"
          aria-label="予定または移動予定を追加"
          onClick={handleMobileAddButtonClick}
        >
          ＋
        </button>
      )}

      {isMobile && (
        <nav className="mobile-bottom-nav" aria-label="主要画面">
          {[
            { id: "timeline", label: "タイムライン" },
            { id: "calendar", label: "カレンダー" },
            { id: "preparation", label: "準備" },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={mobileTab === tab.id ? "is-active" : ""}
              aria-current={mobileTab === tab.id ? "page" : undefined}
              onClick={() => setMobileTab(tab.id)}
            >
              {tab.label}
              {tab.id === "preparation" && upcomingPreparationCount > 0 && (
                <span className="mobile-preparation-badge" aria-label={`未完了の準備${upcomingPreparationCount}件`}>
                  {upcomingPreparationCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}

      {addModalValues && (
        <AddEventModal
          initialValues={addModalValues}
          onClose={() => setAddModalValues(null)}
          onSubmit={handleCreateEvent}
        />
      )}

      {addChoiceValues && (
        <AddChoiceModal
          initialValues={addChoiceValues}
          onClose={() => setAddChoiceValues(null)}
          onCreateEvent={async (data) => { await handleCreateEvent(data); setAddChoiceValues(null); }}
          onCreateJourney={handleJourneySave}
        />
      )}

      {editingJourney && (
        <JourneyBuilderModal
          key={editingJourney.id}
          journey={editingJourney}
          event={events.find((event) => event.id === editingJourney.event_id) ?? null}
          onClose={() => setEditingJourney(null)}
          onSave={handleJourneySave}
        />
      )}

      {isReminderSettingsOpen && (
        <PreparationReminderSettingsModal
          isMobile={isMobile}
          value={preparationReminderMinutes}
          options={PREPARATION_REMINDER_OPTIONS}
          onChange={handlePreparationReminderMinutesChange}
          onClose={() => setIsReminderSettingsOpen(false)}
        />
      )}

      {selectedEvent && (
        <EventDetailsModal
          key={selectedEvent.id}
          event={selectedEvent}
          initialMode={eventInitialMode}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onPreparationAdd={handleCreatePreparation}
          onPreparationDelete={handleDeletePreparation}
          onPreparationUpdate={handleUpdatePreparation}
          onJourneyLoad={handleJourneyLoad}
          onJourneySave={handleJourneySave}
          onUpdate={handleUpdateEvent}
          preparations={
            preparations?.filter(
              (preparation) => preparation.event_id === selectedEvent.id,
            ) ?? null
          }
        />
      )}

      {selectedJourney && (
        <JourneyDetailsModal
          journey={selectedJourney}
          event={events.find((event) => event.id === selectedJourney.event_id) ?? null}
          onClose={() => setSelectedJourney(null)}
          onEdit={() => { setEditingJourney(selectedJourney); setSelectedJourney(null); }}
          onDelete={() => handleJourneyDelete(selectedJourney.id)}
        />
      )}

    </div>
  );
}

function App() {
  const { isAuthLoading, loginWithGoogle, logout, user } = useAuth();
  const [authErrorMessage, setAuthErrorMessage] = useState("");
  const [isAuthActionPending, setIsAuthActionPending] = useState(false);
  const loginAttemptIdRef = useRef(0);

  useEffect(() => {
    if (!isAuthActionPending || user) {
      return undefined;
    }

    let resetTimerId;

    function handleWindowFocus() {
      // ポップアップを閉じてもFirebaseのPromiseが完了しない場合があるため、
      // 元の画面へ戻った時点でログインボタンを再操作できるようにします。
      resetTimerId = window.setTimeout(() => {
        setIsAuthActionPending(false);
      }, 300);
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.clearTimeout(resetTimerId);
    };
  }, [isAuthActionPending, user]);

  async function handleLogin() {
    const loginAttemptId = loginAttemptIdRef.current + 1;
    loginAttemptIdRef.current = loginAttemptId;
    setIsAuthActionPending(true);
    setAuthErrorMessage("");

    try {
      await loginWithGoogle();
    } catch (error) {
      const wasSuperseded = loginAttemptId !== loginAttemptIdRef.current;
      const wasPopupCancelled = [
        "auth/cancelled-popup-request",
        "auth/popup-closed-by-user",
      ].includes(error?.code);

      if (!wasSuperseded && !wasPopupCancelled) {
        setAuthErrorMessage(
          "Googleログインに失敗しました。もう一度お試しください",
        );
      }
    } finally {
      if (loginAttemptId === loginAttemptIdRef.current) {
        setIsAuthActionPending(false);
      }
    }
  }

  async function handleLogout() {
    setIsAuthActionPending(true);
    setAuthErrorMessage("");

    try {
      await logout();
    } catch {
      setAuthErrorMessage("ログアウトに失敗しました。もう一度お試しください");
    } finally {
      setIsAuthActionPending(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="auth-screen">
        <p className="status-message">認証状態を確認しています...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-labelledby="login-title">
          <span className="app-logo" aria-hidden="true">
            P
          </span>
          <h1 id="login-title">PlanRail</h1>
          <p>予定に向かうための移動と準備を支援するスケジュール帳</p>
          {authErrorMessage && (
            <p className="auth-error-message" role="alert">
              {authErrorMessage}
            </p>
          )}
          <button
            className="google-login-button"
            type="button"
            disabled={isAuthActionPending}
            onClick={handleLogin}
          >
            {isAuthActionPending
              ? "ログインしています..."
              : "Googleでログイン"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <ScheduleApp
      authErrorMessage={authErrorMessage}
      onLogout={handleLogout}
      user={user}
    />
  );
}

export default App;
