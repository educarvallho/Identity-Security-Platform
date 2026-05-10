import { Dashboard } from "@/types";

export const CACHE_TTL = 5 * 60 * 1000;
let _cache: { data: Dashboard; fetchedAt: number } | null = null;

export function readDashboardCache(): { data: Dashboard; fetchedAt: number } | null {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL) return _cache;
  return null;
}

export function writeDashboardCache(data: Dashboard): number {
  const now = Date.now();
  _cache = { data, fetchedAt: now };
  return now;
}

export function invalidateDashboardCache(): void {
  _cache = null;
}
