import { LocationWeather, CityRiskItem, Dashboard } from "@/types";

const CACHE_TTL = 5 * 60 * 1000;

export interface LocationCacheEntry {
  data: LocationWeather;
  city?: string;
  state?: string;
  approximate?: boolean;
  fetchedAt: number;
}

let _cache: LocationCacheEntry | null = null;

export function readLocationCache(): LocationCacheEntry | null {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL) return _cache;
  return null;
}

export function writeLocationCache(entry: Omit<LocationCacheEntry, "fetchedAt">): void {
  _cache = { ...entry, fetchedAt: Date.now() };
}

export function augmentDashboardWithLocation(
  dashboard: Dashboard,
  loc: LocationCacheEntry,
): Dashboard {
  const { data, city, state } = loc;
  const displayName = city || "Sua Localização";
  const displayState = state || "";

  const virtualItem: CityRiskItem = {
    city_id: -1,
    city_name: displayName,
    state: displayState,
    temperature: parseFloat(data.current.temperature.toFixed(1)),
    rain_probability: data.current.rain_probability,
    wind_speed_kmh: Math.round(data.current.wind_speed_kmh),
    risk_score: data.current.risk.score,
    risk_level: data.current.risk.level,
    risk_reasons: data.current.risk.reasons,
  };

  // Insert preserving temperature-desc, rain_probability-desc sort order
  const ranking = [...dashboard.risk_ranking];
  const insertIdx = ranking.findIndex(
    (c) =>
      c.temperature < virtualItem.temperature ||
      (c.temperature === virtualItem.temperature &&
        c.rain_probability < virtualItem.rain_probability),
  );
  if (insertIdx === -1) ranking.push(virtualItem);
  else ranking.splice(insertIdx, 0, virtualItem);

  const alerts = [...dashboard.alerts];
  if (data.current.risk.level !== "low" && data.current.risk.reasons.length > 0) {
    alerts.unshift({
      city_id: -1,
      city_name: displayName,
      risk_level: data.current.risk.level,
      risk_score: data.current.risk.score,
      reasons: data.current.risk.reasons,
    });
  }

  return {
    ...dashboard,
    risk_ranking: ranking,
    alerts,
    temperature_comparison: [
      ...dashboard.temperature_comparison,
      { city_id: -1, city_name: displayName, temperature: data.current.temperature },
    ],
    rain_comparison: [
      ...dashboard.rain_comparison,
      {
        city_id: -1,
        city_name: displayName,
        rain_probability: data.current.rain_probability,
        rain_volume_mm: data.current.rain_volume_mm,
      },
    ],
  };
}
