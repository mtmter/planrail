## Context

See `proposal.md` for the problem statement. The Transit provider currently shares one 10-second timeout across guidance-plan and reverse-places requests. `resolve_planner_endpoint` intentionally absorbs reverse-lookup provider errors and falls back to a `geo:` endpoint. In contrast, `search_route` wraps all other `TransitProviderError` values as the same `RouteProviderError`, and `/api/route-search` maps service errors to HTTP 502 without logging. The frontend has a dedicated 502 branch, and the frontend package currently has lint and build scripts but no test runner.

## Goals / Non-Goals

**Goals:**

- Keep endpoint-specific timeouts and the existing reverse-lookup fallback behavior explicit.
- Preserve timeout identity through the provider and service layers so the API can return 504 while retaining 400, 404, and other provider failures as 502.
- Record enough sanitized exception context to diagnose 5xx failures without logging request data.
- Make 502/504 messaging and the no-retry behavior testable without adding a frontend test dependency.

**Non-Goals:**

- Change how Google Places locations resolve to Transit endpoints or how `geo:` routes are constructed.
- Change routing algorithms, provider selection, route response shape, retry policy, fallback providers, persistence, or the route-search UI layout.

## Decisions

1. **Pass a timeout at each Transit request call site.** Replace the shared timeout use with guidance-plan and reverse-lookup constants and let `_request_json` accept the selected timeout. The guidance request uses 30 seconds; reverse lookup uses 10 seconds. Keep `resolve_planner_endpoint`'s current provider-error fallback so a reverse timeout still uses `geo:` and does not become a route-search 504. A single global 30-second constant would unnecessarily extend the optional reverse lookup.

2. **Translate guidance-plan timeout into a dedicated service exception.** In `search_route`, catch `TransitTimeoutError` before its `TransitProviderError` base class and raise a timeout-specific `RoutesServiceError` subclass using exception chaining. The route handler maps that subclass to 504 before the existing generic service-error branch; endpoint-resolution errors remain 400, route-not-found remains 404, and all remaining service/provider/response/conversion failures remain 502. Keeping the distinction in the service layer makes the mapping explicit and directly unit-testable.

3. **Log at the API boundary where 5xx statuses are assigned.** Use Python's standard logger with exception information for both 504 and 502 branches. Preserve each exception type and traceback frame in a sanitized cause chain, and make a nested `TransitHttpError.status_code` visible in the log record. Omit raw exception messages because HTTP client diagnostics can contain request URLs; do not include request objects, input values, or raw response bodies. Tests should use sentinel place IDs and coordinates to verify that diagnostics do not disclose them. The logger belongs in the error-conversion path so expected 400/404 outcomes do not produce server-error logs.

4. **Extract the route-search request/error mapping into a small frontend module for unit tests.** Keep `RouteSearchModal` and its `Error.message` display unchanged. Have the request function map 504 and 502 to the specified messages, leave current 422 and response-detail behavior intact, and make one fetch per user submission with no retry loop. Use Node's built-in test runner for these pure request/error behaviors instead of adding a test framework dependency; inject or otherwise control fetch in tests.

## Risks / Trade-offs

- [A 30-second plan timeout can still reject an unusually slow legitimate search] → Keep the bound finite, return a distinct timeout message, and allow the user to initiate another search.
- [Exception causes or HTTP client diagnostics can contain request URLs] → Log a sanitized exception chain with cause types and original traceback frames, include provider HTTP status separately, and test output against sensitive sentinel values.
- [Clients may treat HTTP 504 differently from the previous 502] → Keep the response body and successful response schema unchanged, and update the frontend status mapping in the same change.

## Migration Plan

No data migration is required. Deploy the backend and frontend changes together so 504 receives its dedicated message. Rollback consists of reverting the code change; the previous 10-second timeout and 502 classification return with that rollback.
