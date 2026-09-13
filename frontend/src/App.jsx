import { useEffect, useRef, useState } from "react";
import "./App.css";
import AddItemModal from "./components/AddItemModal";
import AccountMenu from "./components/AccountMenu";
import CalendarToolbar from "./components/CalendarToolbar";
import DayCalendar from "./components/DayCalendar";
import EventDetailsModal from "./components/EventDetailsModal";
import MiniCalendar from "./components/MiniCalendar";
import MonthCalendar from "./components/MonthCalendar";
import PreparationReminderList from "./components/PreparationReminderList";
import PreparationReminderSettingsModal from "./components/PreparationReminderSettingsModal";
import TravelBlockDetailsModal from "./components/TravelBlockDetailsModal";
import TripDetailsModal from "./components/TripDetailsModal";
import TripList from "./components/TripList";
import WeekCalendar from "./components/WeekCalendar";
import GoogleCalendarSettings from "./components/GoogleCalendarSettings";
import useAuth from "./auth/useAuth";
import {
  createEvent as createFirestoreEvent,
  createPreparation as createFirestorePreparation,
  createTravelBlock as createFirestoreTravelBlock,
  createTrip as createFirestoreTrip,
  createTripFromEvent as createFirestoreTripFromEvent,
  deleteEvent as deleteFirestoreEvent,
  deletePreparation as deleteFirestorePreparation,
  deleteTravelBlock as deleteFirestoreTravelBlock,
  deleteTrip as deleteFirestoreTrip,
  loadScheduleData,
  getGoogleCalendarIntegration,
  listGoogleCalendarEventIds,
  saveGoogleCalendarIntegration,
  saveGoogleCalendarSyncState,
  writeGoogleCalendarEvents,
  updateEvent as updateFirestoreEvent,
  updatePreparation as updateFirestorePreparation,
  updateTravelBlock as updateFirestoreTravelBlock,
  updateTrip as updateFirestoreTrip,
} from "./firestoreService";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarAccessToken,
} from "./googleCalendarAuth";
import {
  getGoogleCalendarStartupAction,
  GoogleCalendarAuthError,
  listGoogleCalendars,
  syncGoogleCalendar,
} from "./googleCalendarSync";
import { defaultSelectedCalendarIds } from "./googleCalendarPersistence";
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
import {
  eventToPlace,
  routeToTravelBlock,
  visibleCalendarEvents,
} from "./travelUtils";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL;
const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
const PREPARATION_REMINDER_STORAGE_KEY =
  "planrail_preparation_reminder_minutes";
const LEGACY_PREPARATION_REMINDER_STORAGE_KEY =
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
    const currentValue = window.localStorage.getItem(
      PREPARATION_REMINDER_STORAGE_KEY,
    );
    const savedValue = Number(
      currentValue ??
        window.localStorage.getItem(LEGACY_PREPARATION_REMINDER_STORAGE_KEY),
    );
    const isValidValue = PREPARATION_REMINDER_OPTIONS.some(
      (option) => option.minutes === savedValue,
    );

    if (!isValidValue) {
      return DEFAULT_PREPARATION_REMINDER_MINUTES;
    }
    if (currentValue === null) {
      window.localStorage.setItem(
        PREPARATION_REMINDER_STORAGE_KEY,
        String(savedValue),
      );
    }
    return savedValue;
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

function createInitialValues(
  date,
  itemType,
  eventStartMinutes = 9 * 60,
) {
  const eventStart = createDateAtMinutes(date, eventStartMinutes);
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
  return {
    itemType,
    eventStartAt: toDateTimeInputValue(eventStart),
    eventEndAt: toDateTimeInputValue(eventEnd),
  };
}

async function getResponseError(response, defaultMessage) {
  try {
    const errorData = await response.json();
    if (typeof errorData.detail === "string") {
      return errorData.detail;
    }
  } catch {
    // JSONではないエラーの場合は、画面用の既定メッセージを使います。
  }

  return defaultMessage;
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
  const [trips, setTrips] = useState([]);
  const [travelBlocks, setTravelBlocks] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [preparationErrorMessage, setPreparationErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [addModalValues, setAddModalValues] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedTravelBlock, setSelectedTravelBlock] = useState(null);
  const [routeSearchResult, setRouteSearchResult] = useState(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [preparationReminderMinutes, setPreparationReminderMinutes] = useState(
    getInitialPreparationReminderMinutes,
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [googleIntegration, setGoogleIntegration] = useState(null);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState("disconnected");
  const [googleCalendarError, setGoogleCalendarError] = useState("");
  const startupSyncAttemptedRef = useRef(false);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const [scheduleData, integration] = await Promise.all([
          loadScheduleData(user.uid),
          getGoogleCalendarIntegration(user.uid),
        ]);
        setEvents(scheduleData.events);
        setPreparations(scheduleData.preparations);
        setTrips(scheduleData.trips);
        setTravelBlocks(scheduleData.travelBlocks);
        setGoogleIntegration(integration);
        setGoogleCalendarStatus(getGoogleCalendarStartupAction(integration, getCalendarAccessToken()));
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
    const accessToken = getCalendarAccessToken();
    if (
      startupSyncAttemptedRef.current ||
      !googleIntegration ||
      getGoogleCalendarStartupAction(googleIntegration, accessToken) !== "sync"
    ) return;
    startupSyncAttemptedRef.current = true;
    listGoogleCalendars(accessToken)
      .then((calendars) => setGoogleCalendars(calendars))
      .catch(() => setGoogleCalendars(googleIntegration.selected_calendars));
    performGoogleCalendarSync(googleIntegration.selected_calendars, accessToken, googleIntegration);
  // Startup sync intentionally runs once after the saved integration has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleIntegration]);

  async function refreshSchedule() {
    const scheduleData = await loadScheduleData(user.uid);
    setEvents(scheduleData.events);
    setPreparations(scheduleData.preparations);
    setTrips(scheduleData.trips);
    setTravelBlocks(scheduleData.travelBlocks);
  }

  async function performGoogleCalendarSync(selectedCalendars, accessToken, baseIntegration = googleIntegration) {
    if (!accessToken) {
      setGoogleCalendarStatus("reconnect");
      return;
    }
    setGoogleCalendarStatus("syncing");
    setGoogleCalendarError("");
    let nextIntegration = baseIntegration;
    try {
      for (const calendar of selectedCalendars) {
        const result = await syncGoogleCalendar({
          calendar,
          accessToken,
          syncToken: nextIntegration?.sync_state?.[calendar.id]?.sync_token,
          listExistingEventIds: (calendarId) => listGoogleCalendarEventIds(user.uid, calendarId),
          writeEvents: (items) => writeGoogleCalendarEvents(user.uid, items),
          commitSyncState: async (calendarId, state) => {
            nextIntegration = await saveGoogleCalendarSyncState(user.uid, calendarId, state);
          },
        });
        nextIntegration = {
          ...nextIntegration,
          sync_state: { ...nextIntegration.sync_state, [calendar.id]: result.syncState },
        };
      }
      setGoogleIntegration(nextIntegration);
      await refreshSchedule();
      setGoogleCalendarStatus("connected");
    } catch (error) {
      setGoogleCalendarError(error.message);
      setGoogleCalendarStatus(error instanceof GoogleCalendarAuthError ? "reconnect" : "connected");
    }
  }

  async function handleGoogleCalendarConnect() {
    setGoogleCalendarError("");
    try {
      const accessToken = await connectGoogleCalendar(GOOGLE_OAUTH_CLIENT_ID);
      const calendars = await listGoogleCalendars(accessToken);
      const savedIds = googleIntegration?.selected_calendars?.map((calendar) => calendar.id) ?? [];
      const selectedIds = defaultSelectedCalendarIds(calendars, savedIds);
      const selectedCalendars = calendars.filter((calendar) => selectedIds.includes(calendar.id));
      const integration = await saveGoogleCalendarIntegration(user.uid, {
        selected_calendars: selectedCalendars,
        sync_state: googleIntegration?.sync_state ?? {},
      });
      startupSyncAttemptedRef.current = true;
      setGoogleCalendars(calendars);
      setGoogleIntegration(integration);
      await performGoogleCalendarSync(selectedCalendars, accessToken, integration);
    } catch (error) {
      setGoogleCalendarError(error.message);
      setGoogleCalendarStatus(googleIntegration?.selected_calendars?.length ? "reconnect" : "disconnected");
    }
  }

  async function handleGoogleCalendarDisconnect() {
    await disconnectGoogleCalendar();
    setGoogleCalendars([]);
    setGoogleCalendarStatus(googleIntegration?.selected_calendars?.length ? "reconnect" : "disconnected");
  }

  async function handleGoogleCalendarSelectionChange(selectedIds) {
    const selectedCalendars = googleCalendars.filter((calendar) => selectedIds.includes(calendar.id));
    const integration = await saveGoogleCalendarIntegration(user.uid, {
      ...googleIntegration,
      selected_calendars: selectedCalendars,
    });
    setGoogleIntegration(integration);
  }

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
      setTrips(scheduleData.trips);
      setTravelBlocks(scheduleData.travelBlocks);
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

    if (activeView === "trips") {
      setAddModalValues(createInitialValues(today, "trip"));
      return;
    }

    if (activeView === "month") {
      const isCurrentMonth =
        selectedDate.getFullYear() === today.getFullYear() &&
        selectedDate.getMonth() === today.getMonth();
      const targetDate = isCurrentMonth
        ? today
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      setAddModalValues(createInitialValues(targetDate, "event"));
      return;
    }

    if (activeView === "day") {
      setAddModalValues(createInitialValues(selectedDate, "event"));
      return;
    }

    const weekDates = getWeekDates(selectedDate);
    const targetDate = weekDates.some((date) => isSameDay(date, today))
      ? today
      : weekDates[0];
    setAddModalValues(createInitialValues(targetDate, "event"));
  }

  function handleMonthDateClick(date) {
    setAddModalValues(createInitialValues(date, "event"));
  }

  function handleWeekTimeClick(date, startMinutes) {
    setAddModalValues(
      createInitialValues(date, "event", startMinutes),
    );
  }

  async function handleCreateItem(itemType, itemData) {
    let createdItem;
    if (itemType === "event") {
      createdItem = await createFirestoreEvent(user.uid, itemData);
    } else if (itemType === "travel") {
      createdItem = await createFirestoreTravelBlock(user.uid, itemData);
    } else if (itemType === "trip") {
      createdItem = await createFirestoreTrip(user.uid, itemData);
    } else {
      throw new Error("追加する種類が不正です");
    }
    if (itemType === "event") {
      setEvents((currentEvents) => [...currentEvents, createdItem]);
    } else if (itemType === "travel") {
      setTravelBlocks((currentBlocks) => [...currentBlocks, createdItem]);
    } else if (itemType === "trip") {
      setTrips((currentTrips) => [...currentTrips, createdItem]);
    }
    setAddModalValues(null);
  }

  async function handleUpdateEvent(eventId, eventData) {
    const previousEvent = events.find((event) => event.id === eventId);
    const routeFields = [
      "start_at",
      "end_at",
      "location_name",
      "destination",
      "destination_place_id",
      "destination_lat",
      "destination_lng",
      "arrival_buffer_minutes",
    ];
    const routeFieldsChanged = routeFields.some(
      (field) => previousEvent?.[field] !== eventData[field],
    );
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
    if (routeFieldsChanged) setTravelBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.origin_event_id === eventId || block.destination_event_id === eventId
          ? {
              ...block,
              needs_review: true,
              review_reasons: [
                ...new Set([...(block.review_reasons ?? []), "linked_event_changed"]),
              ],
            }
          : block,
      ),
    );
    setRouteSearchResult(null);
  }

  async function handleDeleteEvent(eventId, travelBlockAction) {
    await deleteFirestoreEvent(user.uid, eventId, travelBlockAction);

    setEvents((currentEvents) =>
      currentEvents.filter((currentEvent) => currentEvent.id !== eventId),
    );
    setPreparations((currentPreparations) =>
      currentPreparations?.filter(
        (preparation) => preparation.event_id !== eventId,
      ) ?? null,
    );
    setSelectedEvent(null);
    setTravelBlocks((currentBlocks) =>
      travelBlockAction === "delete"
        ? currentBlocks.filter(
            (block) =>
              block.origin_event_id !== eventId &&
              block.destination_event_id !== eventId,
          )
        : currentBlocks.map((block) => {
            if (
              block.origin_event_id !== eventId &&
              block.destination_event_id !== eventId
            ) return block;
            return {
              ...block,
              origin_event_id:
                block.origin_event_id === eventId ? null : block.origin_event_id,
              destination_event_id:
                block.destination_event_id === eventId
                  ? null
                  : block.destination_event_id,
              needs_review: true,
              review_reasons: [
                ...new Set([...(block.review_reasons ?? []), "linked_event_deleted"]),
              ],
            };
          }),
    );
    setRouteSearchResult(null);
  }

  async function handleCreatePreparation(ownerType, ownerId, title) {
    const createdPreparation = await createFirestorePreparation(
      user.uid,
      ownerType,
      ownerId,
      title,
    );
    setPreparations((currentPreparations) => [
      ...(currentPreparations ?? []),
      createdPreparation,
    ]);
    return createdPreparation;
  }

  async function handleUpdatePreparation(
    ownerType,
    ownerId,
    preparationId,
    preparationData,
  ) {
    const updatedPreparation = await updateFirestorePreparation(
      user.uid,
      preparationId,
      {
        ...preparationData,
        owner_type: ownerType,
        event_id: ownerType === "event" ? String(ownerId) : null,
        trip_id: ownerType === "trip" ? String(ownerId) : null,
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

  async function handleDeletePreparation(ownerType, ownerId, preparationId) {
    await deleteFirestorePreparation(
      user.uid,
      ownerType,
      ownerId,
      preparationId,
    );

    setPreparations((currentPreparations) =>
      currentPreparations?.filter(
        (preparation) => preparation.id !== preparationId,
      ) ?? null,
    );
  }

  async function handleRouteSearch(eventId, direction, externalPlace, eventPlaceOverride) {
    let response;
    const event = events.find((currentEvent) => currentEvent.id === eventId);

    if (!event) {
      throw new Error("予定が見つかりません");
    }

    const eventPlace = eventPlaceOverride ?? eventToPlace(event);
    const isOutbound = direction === "outbound";
    const startDate = parseDateTime(event.start_at);
    const arrivalAt = startDate
      ? toDateTimeInputValue(
          new Date(
            startDate.getTime() -
              (event.arrival_buffer_minutes ?? 0) * 60 * 1000,
          ),
        )
      : event.start_at;

    try {
      response = await fetch(`${API_BASE_URL}/route-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: isOutbound ? eventPlace : externalPlace,
          destination: isOutbound ? externalPlace : eventPlace,
          timing: {
            type: isOutbound ? "departure" : "arrival",
            at: isOutbound ? event.end_at : arrivalAt,
          },
        }),
      });
    } catch {
      throw new Error("経路検索サービスとの通信に失敗しました");
    }

    if (!response.ok) {
      if (response.status === 422) {
        throw new Error("入力内容を確認してください");
      }

      if (response.status === 502) {
        throw new Error("経路検索サービスとの通信に失敗しました");
      }

      throw new Error(
        await getResponseError(response, "経路を検索できませんでした"),
      );
    }

    return response.json();
  }

  async function handleDirectRouteSearch(request) {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/route-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    } catch {
      throw new Error("経路検索サービスとの通信に失敗しました");
    }
    if (!response.ok) {
      throw new Error(
        await getResponseError(response, "経路を検索できませんでした"),
      );
    }
    return response.json();
  }

  async function handleDirectRouteRegister(route, request) {
    const saved = await createFirestoreTravelBlock(
      user.uid,
      routeToTravelBlock(route, {
        origin: request.origin,
        destination: request.destination,
        tripId: request.tripId,
      }),
    );
    setTravelBlocks((currentBlocks) => [...currentBlocks, saved]);
    setSelectedTravelBlock(null);
    return saved;
  }

  async function handleRouteRegister(eventId, direction, route, externalPlace, eventPlaceOverride) {
    const event = events.find((candidate) => candidate.id === eventId);
    if (!event) throw new Error("予定が見つかりません");
    const isOutbound = direction === "outbound";
    const savedTravelPlan = await createFirestoreTravelBlock(
      user.uid,
      routeToTravelBlock(route, {
        origin: isOutbound ? (eventPlaceOverride ?? eventToPlace(event)) : externalPlace,
        destination: isOutbound ? externalPlace : (eventPlaceOverride ?? eventToPlace(event)),
        originEventId: isOutbound ? eventId : null,
        destinationEventId: isOutbound ? null : eventId,
        tripId: event.trip_id,
      }),
    );
    setTravelBlocks((currentBlocks) => [...currentBlocks, savedTravelPlan]);
    setRouteSearchResult(null);
    return savedTravelPlan;
  }

  async function handleUpdateTravelBlock(travelBlockId, travelBlockData) {
    const transientKeys = new Set([
      "id",
      "calendar_kind",
      "position",
      "column",
      "columnCount",
      "hasOverlap",
      "leftPercent",
      "widthPercent",
    ]);
    const documentData = Object.fromEntries(
      Object.entries(travelBlockData).filter(
        ([key]) => !transientKeys.has(key),
      ),
    );
    const updated = await updateFirestoreTravelBlock(
      user.uid,
      travelBlockId,
      documentData,
    );
    setTravelBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.id === updated.id ? updated : block)),
    );
    setSelectedTravelBlock(updated);
  }

  async function handleDeleteTravelBlock(travelBlockId) {
    await deleteFirestoreTravelBlock(user.uid, travelBlockId);
    setTravelBlocks((currentBlocks) =>
      currentBlocks.filter((block) => block.id !== travelBlockId),
    );
    setSelectedTravelBlock(null);
  }

  async function handleCreateTripFromEvent(event) {
    const result = await createFirestoreTripFromEvent(user.uid, event);
    setTrips((currentTrips) => [...currentTrips, result.trip]);
    setEvents((currentEvents) =>
      currentEvents.map((candidate) =>
        candidate.id === result.event.id ? result.event : candidate,
      ),
    );
    setSelectedEvent(result.event);
  }

  async function handleUpdateTrip(tripId, tripData) {
    const updated = await updateFirestoreTrip(user.uid, tripId, tripData);
    setTrips((currentTrips) =>
      currentTrips.map((trip) => (trip.id === updated.id ? updated : trip)),
    );
    setSelectedTrip(updated);
  }

  async function handleDeleteTrip(tripId, childAction) {
    const childEventIds = new Set(
      events.filter((event) => event.trip_id === tripId).map((event) => event.id),
    );
    await deleteFirestoreTrip(user.uid, tripId, childAction);
    setTrips((currentTrips) => currentTrips.filter((trip) => trip.id !== tripId));
    if (childAction === "delete") {
      setEvents((currentEvents) => currentEvents.filter((event) => event.trip_id !== tripId));
      setTravelBlocks((currentBlocks) =>
        currentBlocks.filter(
          (block) =>
            block.trip_id !== tripId &&
            !childEventIds.has(block.origin_event_id) &&
            !childEventIds.has(block.destination_event_id),
        ),
      );
    } else {
      setEvents((currentEvents) => currentEvents.map((event) => event.trip_id === tripId ? { ...event, trip_id: null, calendar_visibility: "normal" } : event));
      setTravelBlocks((currentBlocks) => currentBlocks.map((block) => block.trip_id === tripId ? { ...block, trip_id: null } : block));
    }
    setPreparations(
      (currentPreparations) =>
        currentPreparations?.filter(
          (item) =>
            item.trip_id !== tripId &&
            !(childAction === "delete" && childEventIds.has(item.event_id)),
        ) ?? null,
    );
    setSelectedTrip(null);
  }

  const calendarEvents = visibleCalendarEvents(events);

  return (
    <div
      className={`schedule-app${["month", "week", "day"].includes(activeView) ? " calendar-view-active" : ""}`}
    >
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
              className={activeView === "trips" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveView("trips")}
            >
              Trip
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
        ) : activeView === "trips" ? (
          <TripList trips={trips} onSelect={setSelectedTrip} />
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
              <GoogleCalendarSettings
                calendars={googleCalendars}
                selectedIds={googleIntegration?.selected_calendars?.map((calendar) => calendar.id) ?? []}
                status={googleCalendarStatus}
                errorMessage={googleCalendarError}
                onConnect={handleGoogleCalendarConnect}
                onDisconnect={handleGoogleCalendarDisconnect}
                onSelectionChange={handleGoogleCalendarSelectionChange}
                onSync={() => performGoogleCalendarSync(googleIntegration?.selected_calendars ?? [], getCalendarAccessToken())}
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
                  events={calendarEvents}
                  travelBlocks={travelBlocks}
                  selectedDate={selectedDate}
                  onDateClick={handleMonthDateClick}
                  onEventClick={setSelectedEvent}
                  onTravelBlockClick={setSelectedTravelBlock}
                />
              ) : activeView === "week" ? (
                <WeekCalendar
                  events={calendarEvents}
                  travelBlocks={travelBlocks}
                  selectedDate={selectedDate}
                  onEventClick={setSelectedEvent}
                  onTravelBlockClick={setSelectedTravelBlock}
                  onTimeClick={handleWeekTimeClick}
                />
              ) : (
                <DayCalendar
                  events={calendarEvents}
                  travelBlocks={travelBlocks}
                  selectedDate={selectedDate}
                  onEventClick={setSelectedEvent}
                  onTravelBlockClick={setSelectedTravelBlock}
                  onTimeClick={handleWeekTimeClick}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {addModalValues && (
        <AddItemModal
          initialValues={addModalValues}
          trips={trips}
          onClose={() => setAddModalValues(null)}
          onSubmit={handleCreateItem}
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
          onCreateTripFromEvent={handleCreateTripFromEvent}
          onTravelBlockSelect={(block) => {
            setSelectedEvent(null);
            setSelectedTravelBlock(block);
          }}
          onRouteRegister={handleRouteRegister}
          onRouteSearch={handleRouteSearch}
          onRouteSearchSuccess={(direction, result) =>
            setRouteSearchResult({
              eventId: selectedEvent.id,
              direction,
              result,
            })
          }
          onUpdate={handleUpdateEvent}
          preparations={
            preparations?.filter(
              (preparation) => preparation.event_id === selectedEvent.id,
            ) ?? null
          }
          routeSearchResult={routeSearchResult}
          travelBlocks={travelBlocks.filter(
            (block) =>
              block.origin_event_id === selectedEvent.id ||
              block.destination_event_id === selectedEvent.id,
          )}
          trips={trips}
        />
      )}

      {selectedTravelBlock && (
        <TravelBlockDetailsModal
          key={selectedTravelBlock.id}
          travelBlock={selectedTravelBlock}
          trips={trips}
          onClose={() => setSelectedTravelBlock(null)}
          onDelete={handleDeleteTravelBlock}
          onDirectRouteRegister={handleDirectRouteRegister}
          onDirectRouteSearch={handleDirectRouteSearch}
          onUpdate={handleUpdateTravelBlock}
        />
      )}

      {selectedTrip && (
        <TripDetailsModal
          key={selectedTrip.id}
          trip={selectedTrip}
          events={events.filter((event) => event.trip_id === selectedTrip.id)}
          travelBlocks={travelBlocks.filter(
            (block) => block.trip_id === selectedTrip.id,
          )}
          preparations={
            preparations?.filter(
              (preparation) => preparation.trip_id === selectedTrip.id,
            ) ?? null
          }
          onClose={() => setSelectedTrip(null)}
          onDelete={handleDeleteTrip}
          onUpdate={handleUpdateTrip}
          onPreparationAdd={handleCreatePreparation}
          onPreparationDelete={handleDeletePreparation}
          onPreparationUpdate={handleUpdatePreparation}
          onSelectEvent={(event) => {
            setSelectedTrip(null);
            setSelectedEvent(event);
          }}
          onSelectTravelBlock={(block) => {
            setSelectedTrip(null);
            setSelectedTravelBlock(block);
          }}
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
          <p>予定に移動と準備をまとめるスケジュール帳</p>
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
