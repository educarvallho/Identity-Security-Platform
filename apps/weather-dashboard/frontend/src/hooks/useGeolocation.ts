"use client";

import { useState, useEffect } from "react";

type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number; approximate?: boolean; city?: string; state?: string }
  | { status: "error"; message: string };

type SuccessState = Extract<GeolocationState, { status: "success" }>;

interface IPLocation {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

const log = (...args: unknown[]) => console.warn("[useGeolocation]", ...args);

// Module-level cache: avoids re-fetching geolocation on every page navigation
const GEO_CACHE_TTL = 5 * 60 * 1000;
let _geoCache: { state: SuccessState; at: number } | null = null;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const BR_STATE_ABBR: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA",
  "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
  "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE",
  "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR",
  "Santa Catarina": "SC", "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO",
};

async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; state: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR`;
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return null;
    const d = await res.json();
    const addr = d?.address;
    if (!addr) return null;
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    const rawState: string = addr.state || "";
    const state = BR_STATE_ABBR[rawState] ?? (rawState ? rawState.slice(0, 2).toUpperCase() : "");
    return city ? { city, state } : null;
  } catch {
    return null;
  }
}

// Chamadas diretas ao browser: ipapi.co e freeipapi.com suportam CORS (Access-Control-Allow-Origin: *).
// NÃO usar proxy Next.js — o proxy faria o fetch server-side e as APIs veriam o IP do servidor,
// não o IP real do cliente.

async function tryIpApiCo(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://ipapi.co/json/", 8000);
    if (!res.ok) {
      log("ipapi.co status", res.status);
      return null;
    }
    const d = await res.json();
    if (d.error || typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("ipapi.co payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city || "",
      state: d.region_code || d.region || "",
    };
  } catch (e) {
    log("ipapi.co falhou", e);
    return null;
  }
}

async function tryFreeIpApi(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://freeipapi.com/api/json", 8000);
    if (!res.ok) {
      log("freeipapi.com status", res.status);
      return null;
    }
    const d = await res.json();
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("freeipapi.com payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.cityName || "",
      state: d.regionCode || d.regionName || "",
    };
  } catch (e) {
    log("freeipapi.com falhou", e);
    return null;
  }
}

async function ipGeolocation(): Promise<IPLocation | null> {
  const a = await tryIpApiCo();
  if (a) {
    log("ipapi.co OK", a);
    return a;
  }
  const b = await tryFreeIpApi();
  if (b) {
    log("freeipapi.com OK", b);
    return b;
  }
  return null;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>(() => {
    if (_geoCache && Date.now() - _geoCache.at < GEO_CACHE_TTL) return _geoCache.state;
    return { status: "idle" };
  });

  useEffect(() => {
    // Cache hit — state already initialized from useState, nothing to do
    if (_geoCache && Date.now() - _geoCache.at < GEO_CACHE_TTL) return;

    setState({ status: "loading" });

    let resolved = false;

    const resolve = (next: GeolocationState) => {
      if (resolved) return;
      resolved = true;
      if (next.status === "success") {
        _geoCache = { state: next, at: Date.now() };
      }
      setState(next);
    };

    const runIpFallback = async (reason: string) => {
      log("executando IP fallback —", reason);
      const loc = await ipGeolocation();
      if (loc) {
        resolve({ status: "success", ...loc, approximate: true });
      } else {
        resolve({ status: "error", message: "Não foi possível obter sua localização" });
      }
    };

    // Watchdog: 25s cobre o dialog de permissão + cold start de GPS mobile.
    // getCurrentPosition({ timeout: 10000 }) não conta o tempo do dialog.
    const hardTimer = setTimeout(() => runIpFallback("watchdog 25s"), 25000);

    if (!navigator.geolocation) {
      clearTimeout(hardTimer);
      runIpFallback("navigator.geolocation indisponível");
      return;
    }

    log("solicitando navigator.geolocation.getCurrentPosition");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(hardTimer);
        log("GPS OK", pos.coords);
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        log("reverse geocode", geo);
        resolve({
          status: "success",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...(geo ?? {}),
        });
      },
      (err) => {
        clearTimeout(hardTimer);
        log("GPS falhou", err.code, err.message);
        runIpFallback(`GPS error code=${err.code}`);
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );

    return () => {
      clearTimeout(hardTimer);
      resolved = true;
    };
  }, []);

  return state;
}
