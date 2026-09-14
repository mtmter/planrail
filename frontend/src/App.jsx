import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import AddEventModal from "./components/AddEventModal";
import AccountMenu from "./components/AccountMenu";
import CalendarToolbar from "./components/CalendarToolbar";
import DayCalendar from "./components/DayCalendar";
import EventDetailsModal from "./components/EventDetailsModal";
import MiniCalendar from "./components/MiniCalendar";
import MonthCalendar from "./components/MonthCalendar";
import PreparationReminderList from "./components/PreparationReminderList";
import PreparationReminderSettingsModal from "./components/PreparationReminderSettingsModal";
import WeekCalendar from "./components/WeekCalendar";
import useAuth from "./auth/useAuth";
import {
  createEvent as createFirestoreEvent,
  createPreparation as createFirestorePreparation,
  deleteEvent as deleteFirestoreEvent,
  deletePreparation as deleteFirestorePreparation,
  getTravelPlan as getFirestoreTravelPlan,
  loadScheduleData,
  saveTravelPlan as saveFirestoreTravelPlan,
  updateEvent as updateFirestoreEvent,
  updatePreparation as updateFirestorePreparation,
} from "./firestoreService";
import {
  addDays,
  addMonths,
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  getWeekDates,
  isSameDay,
  parseDateTime,
  toDateTimeInputValue,
} from "./dateUtils";
import { requestRouteSearch } from "./routeSearchApi";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL;
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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [events, setEvents] = useState([]);
  const [preparations, setPreparations] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [preparationErrorMessage, setPreparationErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [addModalValues, setAddModalValues] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [routeSearchResult, setRouteSearchResult] = useState(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [preparationReminderMinutes, setPreparationReminderMinutes] = useState(
    getInitialPreparationReminderMinutes,
  );
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    async function loadSchedule() {
      try {
        const scheduleData = await loadScheduleData(user.uid);
        setEvents(scheduleData.events);
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
    const today = new Date();

    if (activeView === "month") {
      const isCurrentMonth =
        selectedDate.getFullYear() === today.getFullYear() &&
        selectedDate.getMonth() === today.getMonth();
      const targetDate = isCurrentMonth
        ? today
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      setAddModalValues(createInitialValues(targetDate));
      return;
    }

    if (activeView === "day") {
      setAddModalValues(createInitialValues(selectedDate));
      return;
    }

    const weekDates = getWeekDates(selectedDate);
    const targetDate = weekDates.some((date) => isSameDay(date, today))
      ? today
      : weekDates[0];
    setAddModalValues(createInitialValues(targetDate));
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
    const updatedEvent = await updateFirestoreEvent(
      user.uid,
      eventId,
      eventData,
    );
    setEvents((currentEvents) =>
      currentEvents.map((currentEvent) =>
        currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
      ),
    );
    setSelectedEvent(updatedEvent);
    setRouteSearchResult(null);
  }

  async function handleDeleteEvent(eventId) {
    await deleteFirestoreEvent(user.uid, eventId);

    setEvents((currentEvents) =>
      currentEvents.filter((currentEvent) => currentEvent.id !== eventId),
    );
    setPreparations((currentPreparations) =>
      currentPreparations?.filter(
        (preparation) => preparation.event_id !== eventId,
      ) ?? null,
    );
    setSelectedEvent(null);
    setRouteSearchResult(null);
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

  async function handleRouteSearch(eventId, originRequest) {
    const event = events.find((currentEvent) => currentEvent.id === eventId);

    if (!event) {
      throw new Error("予定が見つかりません");
    }

    return requestRouteSearch(`${API_BASE_URL}/route-search`, {
      ...originRequest,
      event: {
        start_at: event.start_at,
        location_name: event.location_name,
        destination: event.destination,
        destination_lat: event.destination_lat,
        destination_lng: event.destination_lng,
        destination_place_types: event.destination_place_types ?? [],
        arrival_buffer_minutes: event.arrival_buffer_minutes,
      },
    });
  }

  async function handleRouteRegister(eventId, route) {
    const savedTravelPlan = await saveFirestoreTravelPlan(
      user.uid,
      eventId,
      route,
    );
    setRouteSearchResult(null);
    return savedTravelPlan;
  }

  const handleTravelPlanLoad = useCallback(
    (eventId) => getFirestoreTravelPlan(user.uid, eventId),
    [user.uid],
  );

  return (
    <div className="schedule-app calendar-view-active">
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
          ) : activeView === "day" ? (
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
              onClick={() => {
                if (activeView === "month") {
                  const today = new Date();
                  const isCurrentMonth =
                    selectedDate.getFullYear() === today.getFullYear() &&
                    selectedDate.getMonth() === today.getMonth();

                  handleCalendarDateChange(
                    isCurrentMonth
                      ? today
                      : new Date(
                          selectedDate.getFullYear(),
                          selectedDate.getMonth(),
                          1,
                        ),
                  );
                }
                setActiveView("week");
              }}
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

      {(authErrorMessage || errorMessage || preparationErrorMessage) && (
        <div className="error-message" role="alert">
          <span>
            {authErrorMessage || errorMessage || preparationErrorMessage}
          </span>
          {!authErrorMessage && (
            <button type="button" onClick={handleRetry}>
              再読み込み
            </button>
          )}
        </div>
      )}

      {!isLoading && (
        <div className="top-preparation-reminders">
          <PreparationReminderList
            reminders={preparationReminders}
            onEventClick={setSelectedEvent}
          />
        </div>
      )}

      <main className="app-content">
        {isLoading ? (
          <p className="status-message">読み込み中...</p>
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
              <div className="sidebar-preparation-reminders">
                <PreparationReminderList
                  reminders={preparationReminders}
                  onEventClick={setSelectedEvent}
                />
              </div>
            </aside>

            <div className="calendar-main-panel">
              {activeView === "month" ? (
                <MonthCalendar
                  events={events}
                  selectedDate={selectedDate}
                  onDateClick={handleMonthDateClick}
                  onEventClick={setSelectedEvent}
                />
              ) : activeView === "week" ? (
                <WeekCalendar
                  events={events}
                  selectedDate={selectedDate}
                  onEventClick={setSelectedEvent}
                  onTimeClick={handleWeekTimeClick}
                />
              ) : (
                <DayCalendar
                  events={events}
                  selectedDate={selectedDate}
                  onEventClick={setSelectedEvent}
                  onTimeClick={handleWeekTimeClick}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {addModalValues && (
        <AddEventModal
          initialValues={addModalValues}
          onClose={() => setAddModalValues(null)}
          onSubmit={handleCreateEvent}
        />
      )}

      {isReminderSettingsOpen && (
        <PreparationReminderSettingsModal
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
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onPreparationAdd={handleCreatePreparation}
          onPreparationDelete={handleDeletePreparation}
          onPreparationUpdate={handleUpdatePreparation}
          onTravelPlanLoad={handleTravelPlanLoad}
          onRouteRegister={handleRouteRegister}
          onRouteSearch={handleRouteSearch}
          onRouteSearchSuccess={(result) =>
            setRouteSearchResult({ eventId: selectedEvent.id, result })
          }
          onUpdate={handleUpdateEvent}
          preparations={
            preparations?.filter(
              (preparation) => preparation.event_id === selectedEvent.id,
            ) ?? null
          }
          routeSearchResult={routeSearchResult}
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
