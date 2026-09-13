export function formatUnknownMinutes(value) {
  return value === null || value === undefined ? "不明" : `${value}分`;
}

export function formatUnknownCount(value) {
  return value === null || value === undefined ? "不明" : `${value}回`;
}

export function formatFare(fare) {
  const isIcFare = fare?.ic !== null && fare?.ic !== undefined;
  const amount = isIcFare ? fare.ic : fare?.ticket;
  if (amount === null || amount === undefined) {
    return "運賃情報なし";
  }

  const formattedAmount = Number(amount).toLocaleString("ja-JP");
  const amountLabel =
    fare?.currency === "JPY"
      ? `${formattedAmount}円`
      : fare?.currency
        ? `${fare.currency} ${formattedAmount}`
        : formattedAmount;

  return `${amountLabel}（${isIcFare ? "IC" : "きっぷ"}）`;
}

export function getTransitModeLabel(mode) {
  const labels = {
    tram: "路面電車",
    subway: "地下鉄",
    rail: "鉄道",
    bus: "バス",
    ferry: "フェリー",
    cableTram: "ケーブルカー",
    aerialLift: "ロープウェイ",
    funicular: "ケーブルカー",
    trolleybus: "トロリーバス",
    monorail: "モノレール",
    air: "航空機",
  };
  return labels[mode] || mode;
}
