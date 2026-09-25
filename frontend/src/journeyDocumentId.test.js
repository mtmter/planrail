import assert from "node:assert/strict";
import test from "node:test";
import { journeyDocumentId } from "./journeyDocumentId.js";

test("saved standalone edits keep their ID and Event-linked saves use the deterministic ID", () => {
  assert.equal(journeyDocumentId({ event_id: null }, "standalone-original"), "standalone-original");
  assert.equal(journeyDocumentId({ event_id: "e1" }, "standalone-original"), "event-e1");
  assert.equal(journeyDocumentId({ event_id: null }), null);
  assert.equal(journeyDocumentId({ event_id: null }, "event-e1"), null);
});
