## 1. Transit request timeouts

- [x] 1.1 Split the Transit timeout constants and pass the timeout per `_request_json` call; verify guidance plan uses 30 seconds and reverse lookup uses 10 seconds with mocked HTTP requests.
- [x] 1.2 Preserve reverse-lookup fallback on timeout; verify a mocked reverse timeout continues the plan request with the matching `geo:` endpoint.

## 2. Backend error classification and diagnostics

- [x] 2.1 Add a timeout-specific service exception and preserve the Transit timeout as its chained cause; verify timeout and other provider failures remain distinct in service unit tests.
- [x] 2.2 Map guidance-plan timeout to HTTP 504 while retaining provider/service failures as 502, endpoint resolution as 400, and route-not-found as 404; verify all four statuses with mocked service errors.
- [x] 2.3 Log 5xx route-search failures with exception chain, stack trace, and nested Transit HTTP status code while excluding request data; verify captured logs include diagnostics and omit sentinel user, Place ID, and coordinate values.

## 3. Frontend errors and retry behavior

- [x] 3.1 Extract the route-search request and status-to-message handling into a small testable module, preserving existing 400/404/422 and network-error behavior; verify the UI continues to display the resulting `Error.message` without a layout change.
- [x] 3.2 Add Node built-in unit tests for the exact 504 and 502 messages, existing status handling, and a single fetch call after a 504 response; verify them with `cd frontend && npm test` without adding a test framework dependency.

## 4. Full verification

- [x] 4.1 Run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` and confirm all backend tests pass without contacting Transit API.
- [x] 4.2 Run `cd frontend && npm test`, `npm run lint`, and `npm run build`; confirm the status handling and no-retry tests pass and the frontend builds cleanly.
