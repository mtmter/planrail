## Context

See [proposal.md](proposal.md) for motivation and the two affected capabilities. Change 1 (`replace-route-provider-with-transit`) is archived. Before this change, `transit_provider.get_route()` requested one itinerary, `convert_transit_route()` converted `options[0]`, FastAPI validated one `Route`, and the React result component passed that whole route to `saveTravelPlan()`, which spread it into Firestore. Route results and saved travel plans shared the same seven top-level route fields and the same seven segment fields.

The official [Transit OpenAPI document](https://api.transit.ls8h.com/api/openapi.json) permits `numItineraries` from 1 through 6 and defines guidance options with `rank`, `recommended`, `metrics`, and `journey`; `decision.recommendedOptionId`; fare fields `currency`, `ticket`, and optional `ic`; transit-leg fields such as `mode`, `trainType`, `headsign`, `color`, `headwayBased`, and endpoint `platformCode`; and coverage notice codes. The original fixture covered one option and omitted fares and most optional segment detail; it was expanded to representative multi-option data for offline verification.

## Goals / Non-Goals

**Goals:**

- Keep one common candidate/segment contract across Transit conversion, FastAPI, React selection, Firestore persistence, and saved-plan display.
- Make the route search response contain no more than the three options actually returned by Transit, in Transit order after pure-walk filtering.
- Keep the selected persisted route self-contained while preventing search response data from crossing into Firestore.
- Preserve existing saved travel plans and avoid introducing a migration or test framework.

**Non-Goals:**

- Re-ranking or requesting extra options, changing endpoint resolution or arrival-time calculation, or adding a new provider.
- Compatibility with an independently deployed old frontend or backend; deploy both halves of the changed response contract together.
- A map, geometry, pure-walking search, Transit walking-leg replacement, or broad UI restyling.

## Decisions

### Convert options into response-scoped candidates

Keep the existing provider and converter boundary. Change the Transit query to `numItineraries=3`; keep `type=arrival`, `strategy=balanced`, `live=false`, and `tracking=none`. Convert options in response order and discard only options whose journey has no `TRANSIT` segment. Do not sort by a locally interpreted rank and do not retry to fill slots after filtering.

Assign PlanRail IDs such as `candidate-1` to the filtered candidates in their response order. These IDs are only selectors within one search response; do not expose Transit option IDs or persist PlanRail candidate IDs. Resolve recommendation in this order: a valid `decision.recommendedOptionId`, the first valid option marked `recommended`, then the first valid candidate. If Transit's recommendation points to a pure-walk option or an unknown option ID, use the next fallback. This uses Transit recommendation metadata without making it part of the common candidate model.

Keep existing required route conversion rules: journey times come from service-date seconds and `duration_minutes` from `journey.durationSecs`, rounded up to minutes. Use `option.metrics.transferCount`, `walkSecs`, and `waitSecs` for comparison values; use `journey.transferCount` only when the option metric is absent. Missing optional values map to null. Read fare from `option.metrics.fare`, falling back to `journey.fare` when the option metric is absent; retain currency, ticket, and IC values independently so a missing fare type remains null. The UI chooses IC for display when available and otherwise ticket. A present but malformed core route value remains a provider conversion error (HTTP 502); missing optional comparison values do not invalidate a candidate.

For transit legs, map the existing required names and timestamps as before, and map the new values from Transit `mode`, `trainType`, `headsign`, `color`, `headwayBased`, `from.platformCode`, and `to.platformCode`. Keep these optional segment values nullable. Do not add geometry, Transit identifiers, scores, confidence, ranking factors, or other API response fields to the common model.

### Keep coverage handling at the search boundary

Inspect `coverage.notices` without requiring it for a valid route. Include only `severity=warning` notices whose code is recognized. Map the official codes to fixed Japanese strings: `loadedDataScope` to limited coverage, `stationRailCandidateMissing` to missing nearby rail candidates, `noRouteInLoadedData` to insufficient route coverage in loaded data, `constraintsApplied` and `constraintsNoRoute` to search-constraint notices, and `staleFeedData` to possibly stale timetable data. Ignore info notices, unknown codes, and malformed notices; never show the Transit-supplied `message` or fail an otherwise valid search because of a notice. Return these as `warnings: string[]` and keep them out of the saved-plan model.

### Keep selection state in the route-search modal

Keep the modal's existing search and registration flow. Store the full candidate response for the result view and track one `activeCandidateId`, initialized from `recommended_candidate_id`. Render one compact button/card per returned candidate with its comparison fields and recommendation marker. On selection, change only the active candidate and feed that candidate to the existing route timeline. Keep warnings visible in the search result view. Registration receives only the active candidate; changing search conditions clears the response and active selection.

Use a visible unavailable marker for null comparison values rather than formatting them as zero. Format fare from IC first, ticket second, and show that fare is unavailable if neither amount exists. The compact saved-plan section can reuse its existing route layout, adding optional data labels for values that exist without requiring a map or detailed visual treatment of route colors.

### Build Firestore documents from an allowlist

Replace the current top-level object spread in `saveTravelPlan()` with an explicit PlanRail serialization step. Persist `event_id`, the RouteCandidate's common route fields, nullable comparison fields, fare, and each segment's common and extended fields. Remove `candidate_id` even though it is part of the API candidate. Construct each segment separately from its allowlist so extra nested keys cannot leak through. Do not persist `recommended_candidate_id`, warnings, unselected candidates, Transit `id`/`rank`/`score`/`recommended`/`decisionFactors`/`load`, or map geometry.

Extend the existing travel-plan display to use optional fare, comparison, and segment values that were saved. Old Firestore documents remain valid because their original route fields are unchanged and every newly added field is optional or nullable; no backfill is needed. Keep the existing `users/{uid}/travelPlans/{eventId}` path and replace-on-register behavior.

### Validate the shared contract without a new frontend test framework

Use backend unit tests with synthetic Transit payloads and mocked HTTP; tests must not call the live API. Cover request size, candidate order and filtering, recommendation fallback, metrics/fare precedence, optional leg mappings, coverage mapping, and the 404/502 boundary. Verify at the API boundary that the response model exposes the candidate envelope.

The repository has no frontend test runner. Do not add one for this change. Keep selection, display formatting, and Firestore serialization explicit and reviewable; run the existing lint/build checks and include a manual acceptance pass for candidate selection, registering one route, and reloading that saved route. Update `docs/route-providers.md` and `docs/architecture.md` to match the new contract; note the coordinated deployment requirement in `docs/deployment.md` because the frontend and backend are separate Vercel projects.

## Risks / Trade-offs

- [Transit may omit optional metrics or fare] → Return null for absent values, distinguish unknown from zero in the UI, and test sparse option payloads.
- [Transit option order or recommendation metadata may be inconsistent] → Preserve returned order, match recommendation only to a converted candidate, and fall back deterministically to the first valid candidate.
- [Coverage code set may grow] → Ignore unknown codes and keep the route search successful; add a mapping only after confirming its meaning in the official API schema.
- [Frontend and backend response contracts are breaking and deploy separately] → Promote both from the same source revision as one coordinated release and verify the live response and frontend flow before completing rollout.
- [Older Firestore records lack the new fields] → Treat additional saved fields as optional and retain the existing required route and segment display behavior.

## Migration Plan

1. Deploy the backend and frontend built from the same change/source revision in one coordinated release window; do not leave one Vercel project on the old route-search contract after promoting the other.
2. Verify `/api/route-search` returns 1–3 candidates and the frontend can select and register one candidate; confirm the saved document contains only the selected route fields and no warnings or candidate list.
3. Open the event again and verify the saved route and optional segment details load without route search. Existing documents need no migration.
4. Roll back the backend and frontend together if the shared contract fails. No Firestore rollback or data rewrite is required because the existing route fields remain present and the added fields are additive.

## Open Questions

None. The candidate IDs, recommendation precedence, missing-value handling, fare source precedence, warning policy, and response deployment coupling are defined above.
