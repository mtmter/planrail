## 1. Coordinate-based route-search availability

- [x] 1.1 Make the event-details route-search action depend on both saved destination coordinates; keep it visible but disabled with the required guidance when either coordinate is missing, including when no travel plan exists. Verify incomplete-coordinate cases are disabled and the guidance is shown, while an event with both coordinates enables search.

## 2. Compatibility and verification

- [x] 2.1 Verify free-text schedule locations can still be saved, a saved Places selection with both coordinates enables route search, and the route-search modal continues to show the destination without an edit control.
- [x] 2.2 Run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` to confirm the HTTP 400 validation remains, then run `cd frontend && npm run lint && npm run build` to verify the UI change.
