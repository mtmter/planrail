## Context

See [proposal.md](proposal.md) for the problem statement. `PlaceAutocompleteInput` uses Google Maps JavaScript Places API (New), but currently requests only `id`, `displayName`, `formattedAddress`, and `location`. Origin selection is passed from `RouteSearchModal`; event destinations retain coordinates and Place ID in Firestore and are sent to `/api/route-search` from `App.jsx`. The Transit provider resolves both coordinates sequentially and calls `/api/v1/places/reverse` for any nonempty display name; route services then convert the returned payload into the existing RouteCandidate response. Current plan and reverse timeouts are 30 and 10 seconds. Existing tests cover exact normalized station/stop matching, geo fallback, 504 classification, candidate response, and sanitized 5xx logs.

The current Places API (New) `Place` exposes a `types` field retrievable through `fetchFields`; Google's current type list includes the rail, subway, transit, bus station/stop categories used by the change. See [Google Maps JavaScript API Place Types](https://developers.google.com/maps/documentation/javascript/place-types).

## Goals / Non-Goals

**Goals:**

- Carry selected Places type metadata only as far as endpoint resolution needs it, while preserving the existing coordinate and display-label flow.
- Measure each existing synchronous route-search stage where it runs, without changing the public response or introducing request concurrency.
- Keep location values out of timing and endpoint-resolution logs.

**Non-Goals:**

- Re-querying Places by Place ID to recover missing type metadata.
- Inferring a station from a place name or from nearby Transit results when the user selected a general POI.
- Changing Transit's matching policy, route candidate conversion, or the existing Transit-provided access/egress walking behavior.

## Decisions

### Carry Google Places types with the selected location

Request the `types` field alongside the fields already fetched from the selected `Place`. Keep the returned string array with origin selection state. Persist the destination array additively as `destination_place_types` when an event is created or edited, and hydrate it when editing a saved event so an edit does not discard the metadata. Pass it as `origin_place_types` for the selected origin and as `event.destination_place_types` for the saved destination. Do not add type metadata to RouteCandidate or the route-search response.

The backend treats the known transport types listed in the spec as explicit permission to try station/stop resolution. Unknown values and absent arrays are not transport evidence. Place names, Place IDs, addresses, coordinates, and raw type arrays are never emitted in diagnostic logs.

An alternative was to retrieve place details from Google at route-search time using the saved Place ID. That would add another provider request, credentials/dependency behavior, and another latency/failure path to solve a problem caused by unnecessary Transit requests. Persisting the type returned with the already-selected candidate keeps the route-search flow bounded.

### Limit reverse lookup to explicitly selected transport places

For each endpoint, start with the saved `geo:<lat>,<lon>` value. If its Places type array contains a recognized transport type, run the existing Transit reverse lookup and retain the existing safeguards: only `station` or `stop` candidates with a nonempty planner endpoint, within 300m, and with a normalized name exactly matching the selected display name may replace the geographic endpoint. Preserve nearest-match selection. A failed lookup, no exact match, or invalid endpoint keeps `geo:` and does not prevent planning.

Do not use name suffixes such as `駅` or words such as “station” to decide whether to call reverse lookup. That heuristic would issue the same unnecessary requests for general POIs and could incorrectly snap campuses, shops, parks, or commercial facilities to nearby stations.

Existing events and direct API callers without the new type array use `geo:`. This is the safe compatibility rule because their category cannot be established without a new external lookup or a name-based guess. It can reduce station snapping precision for older saved events; no data migration or speculative inference is introduced.

### Record stage timings at the existing layer boundaries

Use a monotonic clock for elapsed durations. Record origin and destination endpoint resolution in the Transit provider, including whether reverse lookup ran and only the resulting endpoint category (`geo`, `station`, or `stop`). Record the `/guidance/plan` request duration around that request, RouteCandidate conversion around the existing converter, and total `/api/route-search` duration at the API boundary. Emit an elapsed-millisecond value for every stage that runs, including a provider stage that ends in timeout or error. The API response remains unchanged.

Each timing log contains only a fixed stage name, duration, and the endpoint category/boolean reverse-lookup fields when relevant. Never include request bodies, exception messages from external clients, candidate labels, type arrays, addresses, Place IDs, or coordinates. Preserve the existing sanitized 502/504 exception logging and HTTP classification from the error-handling change.

### Extend only the plan timeout

Set the Transit guidance-plan timeout to 45 seconds while keeping reverse lookup at 10 seconds. Preserve the dedicated timeout exception path to HTTP 504 and all other existing 400/404/502 classifications. The longer bound applies only to the single sequential plan call; it does not add retries or parallel lookup behavior.

### Verify with deterministic tests and live manual checks

Use mocked Transit HTTP responses to prove that two general POIs cause no reverse requests and produce two `geo:` endpoints, while a typed station still uses exact-match resolution. Cover a mixed station/POI request, missing legacy type data, lookup failure fallback, response contract, 45-second plan timeout, unchanged 10-second reverse timeout, and timeout-to-504 behavior. Capture both successful timing logs and error-path logs with sensitive sentinel values and assert that none appear.

Run the repository's backend unittest suite and frontend lint/build. Keep live Transit calls out of automated tests. Record manual acceptance steps for a nearby general-POI route, station-to-POI, POI-to-station, and Hiroshima University to Kyushu University Ito Campus; inspect logs only for stage durations and categorical endpoint results.

### Manual acceptance procedure

Use a frontend and backend built from the same change, with Google Places available and `ROUTE_PROVIDER=transit`. Create or choose a future event whose destination was selected from Google Places. Capture backend logs locally and inspect only timing fields and categorical endpoint results; do not copy location data into tickets or shared logs.

1. Select two nearby general POIs with a public-transit itinerary (not a walking-only pair), using one as the origin and the other as the saved event destination. Search and verify both endpoint resolutions are `geo`, neither runs reverse lookup, and the response still contains the existing candidate/recommendation contract.
2. Select a station or bus stop as the origin and use a general POI as the event destination. Verify only the origin attempts reverse lookup; when a nearby Transit endpoint has an exact normalized name match, verify the station/stop endpoint is used.
3. Use a general POI as the origin and a selected station or bus stop as the event destination. Verify only the destination attempts reverse lookup and the same exact-match/fallback rules apply.
4. Select Hiroshima University as the origin and Kyushu University Ito Campus as the event destination. Verify both are resolved directly from their saved coordinates without reverse lookup, the Transit plan stage is measured, and the search completes within the 45-second timeout when Transit returns a route.

For all four searches, verify origin resolution, destination resolution, plan, candidate conversion, and total durations appear in milliseconds. Confirm no log contains the selected names, addresses, coordinates, Place IDs, or request body. If a station endpoint is used, confirm walking segments still come only from Transit response data.

## Risks / Trade-offs

- [A previously saved station has no `destination_place_types` field and now uses `geo:`] → Prefer safe location semantics over guessing from its name; retain coordinates, make no migration, and verify a newly selected station continues to snap through Places type metadata.
- [Google may return a transport category outside the recognized set or no types] → Treat it as a general coordinate endpoint until an official type value is reviewed and explicitly added; never fall back to name inference.
- [The 45-second plan bound permits longer waits] → Keep the timeout finite and retain the existing 504 message and no-automatic-retry behavior.
- [Diagnostic instrumentation could accidentally disclose request data] → Use fixed field names and categorical values only, omit external exception messages, and test captured logs against sentinels for names, addresses, IDs, and coordinates.

## Migration Plan

No Firestore migration is required. Deploy the frontend and backend changes together; newly selected destinations write `destination_place_types`, and older documents without it remain valid and use coordinate endpoints. On rollback, old clients continue to use the existing stored coordinates and old backend endpoint policy; the additive Firestore field requires no cleanup.

## Open Questions

None. Missing type metadata, recognized transport categories, endpoint fallback, timeout classification, response compatibility, and log privacy are defined in the spec and decisions above.
