# Tasks: replace-route-provider-with-transit

## 1. Replace provider integration

- [x] Add a Transit provider for `/api/v1/guidance/plan` with arrival-time query construction, one itinerary, balanced strategy, live disabled, and tracking disabled.
- [x] Add request-time station/stop normalization through `/api/v1/places/reverse` for origin and destination, using the 300-meter bound, conservative normalized-name equality, nearest matching candidate, and `geo:` fallback on no match or reverse lookup failure.
- [x] Add explicit internal errors for timeout, connection failure, HTTP error, invalid JSON/response, no route, and endpoint resolution failure; map endpoint resolution to 400, no route to 404, and Transit service/conversion errors to 502.
- [x] Make `transit` and `mock` the only provider names and `transit` the unset default; remove the Ekispert provider and API-key-specific error path.

## 2. Convert Transit responses and retain mock behavior

- [x] Implement the guidance-plan-to-common-Route converter, including service-date timezone and seconds conversion, `WALK`/`TRANSIT` segments, transit `routeName`, and integer minute durations.
- [x] Reject absent options as route-not-found and reject a selected itinerary with no public-transit leg as route-not-found.
- [x] Replace the Ekispert fixture with a Transit guidance-plan fixture and make the mock provider use the same converter without external requests.
- [x] Keep the route response shape and Google Places / Firestore fields unchanged; do not return or persist Transit IDs or Transit-specific metrics.

## 3. Update tests, documentation, and verification

- [x] Replace Ekispert tests with provider and converter tests for query values, normal conversion, WALK/TRANSIT mapping, date/time and duration conversion, no route, walking-only rejection, HTTP error, timeout, invalid JSON/response, and unknown provider.
- [x] Add reverse-lookup tests for successful station resolution, name mismatch fallback, API failure fallback, unrelated nearby facility rejection, nearest match selection, and normalization at both origin and destination.
- [x] Remove Google Routes `TRANSIT` implementation and its dedicated tests while retaining Google Places code.
- [x] Update `docs/route-providers.md`, `docs/architecture.md`, `docs/deployment.md`, `openspec/config.yaml`, `backend/.env.example`, and relevant README provider/setup text; remove Ekispert API-key references and document `ROUTE_PROVIDER=transit` for production.
- [x] Run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'`.
- [x] Run `npm run lint` and `npm run build` from `frontend/` to confirm the unchanged route UI still builds against the existing response contract.
