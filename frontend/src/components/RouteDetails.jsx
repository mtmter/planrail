import { formatTime } from "../dateUtils";
import { getTransitModeLabel } from "../routeFormatters";

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function getTransportLabel(type) {
  if (type === "WALK") {
    return "徒歩";
  }

  if (type === "TRANSIT") {
    return "公共交通";
  }

  return hasValue(type) ? type : null;
}

function getFormattedTime(value) {
  return typeof value === "string" ? formatTime(value) : "";
}

function getPlaceLabel(from, to) {
  const hasFrom = hasValue(from);
  const hasTo = hasValue(to);

  if (hasFrom && hasTo) {
    return `${from} → ${to}`;
  }

  if (hasFrom) {
    return `出発：${from}`;
  }

  if (hasTo) {
    return `到着：${to}`;
  }

  return null;
}

function getTimeLabel(departureAt, arrivalAt) {
  const departureTime = getFormattedTime(departureAt);
  const arrivalTime = getFormattedTime(arrivalAt);

  if (departureTime && arrivalTime) {
    return `${departureTime} → ${arrivalTime}`;
  }

  if (departureTime) {
    return `出発 ${departureTime}`;
  }

  if (arrivalTime) {
    return `到着 ${arrivalTime}`;
  }

  return null;
}

function getPlatformLabel(fromPlatform, toPlatform) {
  const hasFromPlatform = hasValue(fromPlatform);
  const hasToPlatform = hasValue(toPlatform);

  if (hasFromPlatform && hasToPlatform) {
    return `ホーム：${fromPlatform} → ${toPlatform}`;
  }

  if (hasFromPlatform) {
    return `乗車ホーム：${fromPlatform}`;
  }

  if (hasToPlatform) {
    return `降車ホーム：${toPlatform}`;
  }

  return null;
}

function RouteDetails({ heading, route = {}, embedded = false }) {
  const segments = Array.isArray(route?.segments)
    ? route.segments.filter(
        (segment) => segment && typeof segment === "object",
      )
    : [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const origin = hasValue(route?.origin) ? route.origin : firstSegment?.from;
  const destination = hasValue(route?.destination)
    ? route.destination
    : lastSegment?.to;
  const departureTime = getFormattedTime(route?.departure_at);
  const arrivalTime = getFormattedTime(route?.arrival_at);
  const hasSummary =
    departureTime || arrivalTime || hasValue(route?.duration_minutes);

  const timeline = <>
        {!embedded && hasValue(origin) && (
          <div className="route-place route-origin">
            <span aria-hidden="true" />
            <strong>{origin}</strong>
          </div>
        )}

        {segments.map((segment, index) => {
          const transportLabel = getTransportLabel(segment.type);
          const segmentTitle = hasValue(segment.line_name) ? segment.line_name : transportLabel;
          const segmentDescription = [transportLabel, hasValue(segment.duration_minutes) ? `${segment.duration_minutes}分` : null].filter(Boolean).join("・");
          const placeLabel = getPlaceLabel(segment.from, segment.to);
          const timeLabel = getTimeLabel(segment.departure_at, segment.arrival_at);
          const platformLabel = getPlatformLabel(segment.from_platform, segment.to_platform);
          const modeLabel = hasValue(segment.mode) ? getTransitModeLabel(segment.mode) : null;

          return <div className="route-segment-group" key={`${segment.departure_at || segment.from || segment.to || "segment"}-${index}`}>
            <div className="route-segment">
              <span className="route-segment-line" aria-hidden="true" />
              <div className="route-segment-details">
                {segmentTitle && <strong>{segmentTitle}</strong>}
                {segmentDescription && <span>{segmentDescription}</span>}
                {placeLabel && <span>{placeLabel}</span>}
                {timeLabel && <span>{timeLabel}</span>}
                {modeLabel && <span>{modeLabel}</span>}
                {hasValue(segment.train_type) && <span>列車種別：{segment.train_type}</span>}
                {hasValue(segment.headsign) && <span>行先：{segment.headsign}</span>}
                {platformLabel && <span>{platformLabel}</span>}
                {segment.headway_based != null && <span>{segment.headway_based ? "運行間隔方式" : "時刻表ベース"}</span>}
              </div>
            </div>
            {hasValue(segment.to) && <div className="route-place"><span aria-hidden="true" /><strong>{segment.to}</strong></div>}
          </div>;
        })}

        {segments.length === 0 && hasValue(route?.transport_mode) && (hasValue(origin) || hasValue(destination)) && (
          <div className="route-segment-group"><div className="route-segment"><span className="route-segment-line" aria-hidden="true" />
            <div className="route-segment-details"><strong>{getTransportLabel(route.transport_mode) || route.transport_mode}</strong>
              {getPlaceLabel(origin, destination) && <span>{getPlaceLabel(origin, destination)}</span>}</div></div>
            {hasValue(destination) && <div className="route-place"><span aria-hidden="true" /><strong>{destination}</strong></div>}
          </div>
        )}
        {!embedded && hasValue(destination) && <p className="route-destination-label">目的地：{destination}</p>}
      </>;

  if (embedded) return timeline;

  return (
    <section className="route-details" aria-label="経路詳細">
      {heading || hasSummary ? (
        <div className="route-result-heading">
          {heading && <h3>{heading}</h3>}
          {hasSummary && (
            <div
              className="route-result-times"
              aria-label="経路全体の出発時刻、到着時刻、所要時間"
            >
              {departureTime && (
                <div>
                  <strong>
                    <time dateTime={route.departure_at}>{departureTime}</time>
                  </strong>
                  <span>出発</span>
                </div>
              )}
              {hasValue(route?.duration_minutes) && (
                <p>{route.duration_minutes}分</p>
              )}
              {arrivalTime && (
                <div>
                  <strong>
                    <time dateTime={route.arrival_at}>{arrivalTime}</time>
                  </strong>
                  <span>到着</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      <div className="route-timeline">{timeline}</div>
    </section>
  );
}

export default RouteDetails;
