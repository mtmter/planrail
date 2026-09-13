## 1. Place Entry and Search Eligibility

- [x] 1.1 Consolidate new and editable event forms to one Places-backed location field while preserving existing Firestore fields, and verify selected and free-text save payloads.
- [x] 1.2 Prevent every event and adjacent-route search entry point from submitting a location without latitude and longitude, and verify the user receives a candidate-selection explanation.

## 2. Route Labels

- [x] 2.1 Normalize LS8H Transit API route labels to avoid numeric-only internal identifiers while retaining human-readable route names, and verify backend converter tests cover both cases.
- [x] 2.2 Render the normalized label consistently in route results and saved travel-block details, and verify focused frontend tests cover the fallback label.

## 3. Verification and Documentation

- [x] 3.1 Run backend unit tests, frontend tests, lint and build, and verify a coordinate-free search is blocked before the API request.
- [x] 3.2 Update README and current specs for the single location field and coordinate-required route search, and verify OpenSpec validation passes.

## 4. LS8H Transit Candidate Selection

- [x] 4.1 Request multiple LS8H journeys with an extended timeout, and select a journey containing public transit over an earlier walk-only journey.
- [x] 4.2 Add regression coverage for a walk-first response, document the selection behavior, and run backend and frontend verification.

## 5. Route Re-search for Existing Data

- [x] 5.1 Restore route-search entry points in event details and let a coordinate-free saved event place be reselected for that search.
- [x] 5.2 Let a coordinate-free saved travel-block endpoint be reselected in adjacent-route search, and verify both re-search screens with frontend tests.
