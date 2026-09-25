function nullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isJourneyDateTime(value) {
  if (typeof value !== "string") return false;
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day && hour < 24 && minute < 60;
}

function placesConnect(firstPlace, secondPlace) {
  if (firstPlace.place_id && secondPlace.place_id && firstPlace.place_id === secondPlace.place_id) return true;
  if (
    Number.isFinite(firstPlace.lat) &&
    Number.isFinite(firstPlace.lng) &&
    Number.isFinite(secondPlace.lat) &&
    Number.isFinite(secondPlace.lng)
  ) {
    return firstPlace.lat === secondPlace.lat && firstPlace.lng === secondPlace.lng;
  }
  return false;
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validPlace(place) {
  return place && typeof place.name === "string" && place.name.trim();
}

function validateStoredRoute(route) {
  if (!route || !nullableText(route.origin) || !nullableText(route.destination) ||
      !isJourneyDateTime(route.departure_at) || !isJourneyDateTime(route.arrival_at) ||
      route.arrival_at < route.departure_at || !nonnegativeInteger(route.duration_minutes) ||
      !nullableText(route.transport_mode) || !Array.isArray(route.segments)) {
    throw new Error("経路の必須情報が不正です");
  }
  for (const value of [route.transfer_count, route.walk_minutes, route.wait_minutes]) {
    if (value !== null && value !== undefined && !nonnegativeInteger(value)) {
      throw new Error("経路の比較情報が不正です");
    }
  }
  if (route.fare && (
    (route.fare.currency != null && typeof route.fare.currency !== "string") ||
    [route.fare.ticket, route.fare.ic].some((value) => value != null && (!Number.isFinite(value) || value < 0))
  )) {
    throw new Error("運賃情報が不正です");
  }
  for (const segment of route.segments) {
    if (!segment || !nullableText(segment.type) || !nullableText(segment.from) ||
        !nullableText(segment.to) || !isJourneyDateTime(segment.departure_at) ||
        !isJourneyDateTime(segment.arrival_at) ||
        segment.arrival_at < segment.departure_at ||
        !nonnegativeInteger(segment.duration_minutes)) {
      throw new Error("経路のsegment情報が不正です");
    }
  }
}

export function serializePlacePoint(place = {}) {
  return {
    name: nullableText(place.name) || "",
    address: nullableText(place.address),
    place_id: nullableText(place.place_id),
    lat: Number.isFinite(place.lat) ? place.lat : null,
    lng: Number.isFinite(place.lng) ? place.lng : null,
    types: Array.isArray(place.types) ? place.types.filter((type) => typeof type === "string" && type.trim()) : [],
  };
}

function serializeRouteSegment(segment = {}) {
  return {
    type: segment.type,
    from: segment.from,
    to: segment.to,
    departure_at: segment.departure_at,
    arrival_at: segment.arrival_at,
    duration_minutes: segment.duration_minutes,
    line_name: segment.line_name ?? null,
    mode: segment.mode ?? null,
    train_type: segment.train_type ?? null,
    headsign: segment.headsign ?? null,
    from_platform: segment.from_platform ?? null,
    to_platform: segment.to_platform ?? null,
    color: segment.color ?? null,
    headway_based: segment.headway_based ?? null,
  };
}

export function serializeStoredRoute(route = {}) {
  return {
    origin: route.origin,
    destination: route.destination,
    departure_at: route.departure_at,
    arrival_at: route.arrival_at,
    duration_minutes: route.duration_minutes,
    transport_mode: route.transport_mode,
    transfer_count: route.transfer_count ?? null,
    walk_minutes: route.walk_minutes ?? null,
    wait_minutes: route.wait_minutes ?? null,
    fare: route.fare
      ? {
          currency: route.fare.currency ?? null,
          ticket: route.fare.ticket ?? null,
          ic: route.fare.ic ?? null,
        }
      : null,
    segments: Array.isArray(route.segments)
      ? route.segments.map(serializeRouteSegment)
      : [],
  };
}

export function validateJourney(journey) {
  if (!journey || !Array.isArray(journey.sections) || !journey.sections.length) {
    throw new Error("移動区間を1件以上追加してください");
  }
  if (!isJourneyDateTime(journey.departure_at) || !isJourneyDateTime(journey.arrival_at)) {
    throw new Error("Journeyの発着日時が不正です");
  }
  if (journey.arrival_at < journey.departure_at) {
    throw new Error("Journeyの到着日時は出発日時以降にしてください");
  }
  if (journey.target) {
    if (!validPlace(journey.target.destination) || !isJourneyDateTime(journey.target.arrival_deadline)) {
      throw new Error("Journeyの到着先または期限が不正です");
    }
    if (journey.target.arrival_deadline < journey.arrival_at) {
      throw new Error("Journeyは到着期限までに到着する必要があります");
    }
  }
  if (!journey.target && journey.sections.some((section) => section?.kind === "ROUTE")) {
    throw new Error("ROUTEを含むJourneyには目的地と到着期限が必要です");
  }

  let previousSection = null;
  journey.sections.forEach((section, index) => {
    if (!section || !["ROUTE", "FIXED"].includes(section.kind)) {
      throw new Error("移動区間の種類が不正です");
    }
    if (!validPlace(section.origin) || !validPlace(section.destination)) {
      throw new Error("移動区間の発着地点を入力してください");
    }
    const departureAt = section.kind === "ROUTE"
      ? section.route?.departure_at
      : section.departure_at;
    const arrivalAt = section.kind === "ROUTE"
      ? section.route?.arrival_at
      : section.arrival_at;
    if (!isJourneyDateTime(departureAt) || !isJourneyDateTime(arrivalAt) || arrivalAt < departureAt) {
      throw new Error("移動区間の発着日時が不正です");
    }
    if (section.kind === "ROUTE") {
      if (
        !Number.isFinite(section.origin.lat) ||
        !Number.isFinite(section.origin.lng) ||
        !Number.isFinite(section.destination.lat) ||
        !Number.isFinite(section.destination.lng) ||
        !section.route
      ) {
        throw new Error("経路区間の発着地点と検索結果を確定してください");
      }
      validateStoredRoute(section.route);
    }
    if (previousSection) {
      const previousArrival = previousSection.kind === "ROUTE"
        ? previousSection.route?.arrival_at
        : previousSection.arrival_at;
      const fixedNamesConnect = previousSection.kind === "FIXED" && section.kind === "FIXED" &&
        !previousSection.destination.place_id && !section.origin.place_id &&
        !Number.isFinite(previousSection.destination.lat) && !Number.isFinite(section.origin.lat) &&
        previousSection.destination.name.trim() === section.origin.name.trim();
      if (departureAt < previousArrival ||
          (!placesConnect(previousSection.destination, section.origin) && !fixedNamesConnect)) {
        throw new Error("隣接する移動区間の地点または時刻が接続していません");
      }
    }
    if (index === 0 && departureAt !== journey.departure_at) {
      throw new Error("Journeyの出発日時が先頭区間と一致しません");
    }
    previousSection = section;
  });

  const lastSection = journey.sections[journey.sections.length - 1];
  const lastArrival = lastSection.kind === "ROUTE" ? lastSection.route.arrival_at : lastSection.arrival_at;
  if (lastArrival !== journey.arrival_at) {
    throw new Error("Journeyの到着日時が最終区間と一致しません");
  }
  if (journey.target) {
    if (!placesConnect(lastSection.destination, journey.target.destination)) {
      throw new Error("最後の移動区間を目的地に接続してください");
    }
    if (journey.event_id && journey.sections.every((section) => section.kind === "FIXED")) {
      if (
        !lastSection.destination.place_id ||
        lastSection.destination.place_id !== journey.target.destination.place_id
      ) {
        throw new Error("Event-linkedの固定移動は目的地のplace_idと一致させてください");
      }
    }
  } else if (journey.event_id) {
    throw new Error("Event-linked Journeyには目的地と到着期限が必要です");
  }
  return true;
}

export function serializeJourney(journey) {
  if (!journey || !Array.isArray(journey.sections)) {
    throw new Error("移動区間を1件以上追加してください");
  }
  const serialized = {
    event_id: journey.event_id ? String(journey.event_id) : null,
    target: journey.target
      ? {
          destination: serializePlacePoint(journey.target.destination),
          arrival_deadline: journey.target.arrival_deadline,
        }
      : null,
    departure_at: journey.departure_at,
    arrival_at: journey.arrival_at,
    sections: journey.sections.map((section) => {
      const base = {
        kind: section.kind,
        origin: serializePlacePoint(section.origin),
        destination: serializePlacePoint(section.destination),
      };
      if (section.kind === "FIXED") {
        return {
          ...base,
          departure_at: section.departure_at,
          arrival_at: section.arrival_at,
          label: nullableText(section.label),
        };
      }
      return { ...base, route: serializeStoredRoute(section.route) };
    }),
  };
  validateJourney(serialized);
  return serialized;
}

export function journeyDisplayName(journey, event = null) {
  if (journey.event_id && event) {
    return `移動: ${event.title}`;
  }
  const targetName = journey.target?.destination?.name;
  if (targetName) {
    return `移動: ${targetName}`;
  }
  const sections = Array.isArray(journey.sections) ? journey.sections : [];
  const last = sections[sections.length - 1];
  return `移動: ${last?.destination?.name || "固定移動"}`;
}

export function journeyMatchesDate(journey, date) {
  if (!isJourneyDateTime(journey.departure_at) || !isJourneyDateTime(journey.arrival_at)) return false;
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const next = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1)).toISOString().slice(0, 10);
  return journey.departure_at < `${next}T00:00` && journey.arrival_at > `${day}T00:00`;
}
