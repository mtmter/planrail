import assert from "node:assert/strict";
import test from "node:test";
import { requestRouteSearch } from "./routeSearchApi.js";

function createResponse(status, payload = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("504 shows the timeout message and does not retry", async () => {
  let fetchCalls = 0;
  const fetchImplementation = async () => {
    fetchCalls += 1;
    return createResponse(504);
  };

  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, fetchImplementation),
    {
      message: "経路検索に時間がかかりすぎました。もう一度お試しください。",
    },
  );
  assert.equal(fetchCalls, 1);
});

test("502 shows the service error message", async () => {
  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, async () =>
      createResponse(502),
    ),
    {
      message:
        "経路検索サービスでエラーが発生しました。もう一度お試しください。",
    },
  );
});

test("422 keeps the existing input error message", async () => {
  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, async () =>
      createResponse(422),
    ),
    { message: "入力内容を確認してください" },
  );
});

test("400 and 404 keep API details and the existing fallback", async () => {
  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, async () =>
      createResponse(400, { detail: "出発地を選択してください" }),
    ),
    { message: "出発地を選択してください" },
  );

  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, async () =>
      createResponse(404),
    ),
    { message: "経路を検索できませんでした" },
  );
});

test("network failure keeps the existing message", async () => {
  await assert.rejects(
    requestRouteSearch("/api/route-search", {}, async () => {
      throw new Error("network unavailable");
    }),
    { message: "経路検索サービスとの通信に失敗しました" },
  );
});

test("success sends one POST request and returns its JSON body", async () => {
  let fetchCalls = 0;
  const body = { origin_name: "出発地" };
  const result = await requestRouteSearch(
    "/api/route-search",
    body,
    async (url, options) => {
      fetchCalls += 1;
      assert.equal(url, "/api/route-search");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), body);
      return createResponse(200, { candidates: [] });
    },
  );

  assert.equal(fetchCalls, 1);
  assert.deepEqual(result, { candidates: [] });
});
