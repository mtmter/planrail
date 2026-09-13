const TIMEOUT_ERROR_MESSAGE =
  "経路検索に時間がかかりすぎました。もう一度お試しください。";
const SERVICE_ERROR_MESSAGE =
  "経路検索サービスでエラーが発生しました。もう一度お試しください。";
const NETWORK_ERROR_MESSAGE = "経路検索サービスとの通信に失敗しました";

async function getResponseError(response, defaultMessage) {
  try {
    const errorData = await response.json();
    if (typeof errorData.detail === "string") {
      return errorData.detail;
    }
  } catch {
    // JSONではないエラーの場合は、画面用の既定メッセージを使います。
  }

  return defaultMessage;
}

export async function requestRouteSearch(
  url,
  requestBody,
  fetchImplementation = fetch,
) {
  let response;
  try {
    response = await fetchImplementation(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    if (response.status === 504) {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    if (response.status === 502) {
      throw new Error(SERVICE_ERROR_MESSAGE);
    }

    if (response.status === 422) {
      throw new Error("入力内容を確認してください");
    }

    throw new Error(
      await getResponseError(response, "経路を検索できませんでした"),
    );
  }

  return response.json();
}
