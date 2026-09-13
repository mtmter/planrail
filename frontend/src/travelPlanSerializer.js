function routeSegmentForStorage(segment) {
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

function routeFareForStorage(fare) {
  if (fare === null || fare === undefined) {
    return null;
  }

  return {
    currency: fare.currency ?? null,
    ticket: fare.ticket ?? null,
    ic: fare.ic ?? null,
  };
}

export function serializeTravelPlan(eventId, route) {
  return {
    event_id: String(eventId),
    origin: route.origin,
    destination: route.destination,
    departure_at: route.departure_at,
    arrival_at: route.arrival_at,
    duration_minutes: route.duration_minutes,
    transport_mode: route.transport_mode,
    transfer_count: route.transfer_count ?? null,
    walk_minutes: route.walk_minutes ?? null,
    wait_minutes: route.wait_minutes ?? null,
    fare: routeFareForStorage(route.fare),
    segments: Array.isArray(route.segments)
      ? route.segments.map(routeSegmentForStorage)
      : [],
  };
}
