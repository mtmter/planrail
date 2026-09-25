export function journeyDocumentId(journey, existingId = null) {
  if (journey.event_id) return `event-${journey.event_id}`;
  if (existingId && String(existingId).startsWith("standalone-")) return String(existingId);
  return null;
}
