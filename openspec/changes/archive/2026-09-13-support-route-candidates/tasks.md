## 1. Backend candidate contract

- [x] 1.1 Set Transit `numItineraries` to 3 and update the mock guidance-plan fixture with representative multiple options; verify the mocked provider test asserts all preserved query parameters and makes no live request.
- [x] 1.2 Convert options to ordered RouteCandidates, filter pure-walk options, map nullable comparison/fare/segment fields, and assign response-local IDs; add unit tests for 1–3 results, order, all-walk 404, missing fields, IC fare priority, and extended segments.
- [x] 1.3 Resolve Transit recommendation IDs/flags with the documented fallback and map known warning notices to Japanese while ignoring info, unknown, and malformed notices; verify each case with offline converter tests.
- [x] 1.4 Update FastAPI response models to expose candidates, `recommended_candidate_id`, and warnings, plus verify `/api/route-search` returns the candidate contract and retains the specified 400/404/502 behavior in API tests.

## 2. Candidate selection and persistence

- [x] 2.1 Update the route-search modal/result to show up to three comparison cards, recommendation, warnings, null-value markers, and the active candidate's existing timeline; verify lint/build and inspect that only the active candidate is passed to registration (manually select another card when a browser runtime is available).
- [x] 2.2 Update saved travel-plan details to display available fare, comparison, and expanded segment information while tolerating old documents and null fields; verify lint/build and inspect the old-field/null guards (manually inspect both displays when a browser runtime is available).
- [x] 2.3 Replace Firestore route spreading with explicit top-level and segment allowlists, and pass only the active candidate to registration; verify the serialized payload excludes candidate IDs, other candidates, warnings, ranking metadata, and geometry, and inspect the stored document when a development Firestore is configured.

## 3. Documentation and integration verification

- [x] 3.1 Update `docs/route-providers.md`, `docs/architecture.md`, and `docs/deployment.md` with the multi-candidate response, persistence boundary, and coordinated frontend/backend release requirement; verify the docs agree with the spec delta and implementation contract.
- [x] 3.2 Run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` and `cd frontend && npm run lint && npm run build`; review the end-to-end search/selection/serialization path and manually verify search, registration, and saved-detail reload when backend and development Firestore access are available.
