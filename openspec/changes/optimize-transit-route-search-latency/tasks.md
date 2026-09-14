## 1. Places type propagation

- [x] 1.1 Fetch Google Places `types` with the selected Place and carry them in origin selection state; verify the selected type array reaches the route-search request and `npm run lint` / `npm run build` pass.
- [x] 1.2 Persist destination types as `destination_place_types` on event create/update, hydrate them in the edit flow, and send them with the destination route-search event; verify existing events without this field still load and submit successfully.
- [x] 1.3 Add optional origin and destination type fields to the backend request models and pass them to the Transit provider; verify type-less coordinate requests remain accepted and requests lacking coordinates retain HTTP 400 validation.

## 2. Transit endpoint resolution and timeout

- [x] 2.1 Restrict reverse lookup to the recognized Google Places transport types; keep exact normalized station/stop matching and `geo:` fallback, and verify general POI pairs make zero reverse requests while station-to-POI and POI-to-station requests reverse only the typed endpoint.
- [x] 2.2 Verify missing/unknown type metadata uses `geo:`, station lookup failures still fall back to `geo:`, and the existing station access/egress walking behavior remains Transit-driven; cover these cases with backend unit tests.
- [x] 2.3 Change the guidance-plan timeout to 45 seconds while retaining the 10-second reverse timeout; verify the mocked request timeouts and that plan timeout still maps to HTTP 504.

## 3. Timing diagnostics and contract regression

- [x] 3.1 Record origin resolution, destination resolution, plan request, candidate conversion, and total route-search durations in milliseconds; verify each stage is observable on success and applicable failure paths, with only endpoint categories and reverse-lookup booleans in endpoint diagnostics.
- [x] 3.2 Capture successful and failed diagnostic logs containing sensitive sentinel request values; verify names, addresses, coordinates, Place IDs, request bodies, and location-bearing exception messages do not appear.
- [x] 3.3 Verify `POST /api/route-search`, existing RouteCandidate/segment fields, maximum three candidates, recommended candidate, and existing 400/404/502/504 behavior remain unchanged; run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'`, `cd frontend && npm run lint`, and `cd frontend && npm run build`.

## 4. Manual acceptance

- [ ] 4.1 Follow the manual acceptance procedure in `design.md` for a nearby general-POI pair, station-to-POI, POI-to-station, and Hiroshima University to Kyushu University Ito Campus; verify endpoint categories, reverse-lookup decisions, route response behavior, stage timings, the 45-second plan bound, and sanitized logs.
