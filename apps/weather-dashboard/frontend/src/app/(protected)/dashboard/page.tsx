"use client";

import { useState, useEffect, useCallback } from "react";
import { Thermometer, AlertTriangle, CheckCircle2, Droplets, Building2, Wind } from "lucide-react";
import { Dashboard, LocationWeather } from "@/types";
import { api } from "@/lib/api";
import { KPICard } from "@/components/dashboard/KPICard";
import { RiskRankingTable } from "@/components/dashboard/RiskRankingTable";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { TemperatureChart } from "@/components/dashboard/TemperatureChart";
import { RainComparisonChart } from "@/components/dashboard/RainComparisonChart";
import { LocationWeatherCard } from "@/components/dashboard/LocationWeatherCard";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useGeolocation } from "@/hooks/useGeolocation";
import { readDashboardCache, writeDashboardCache, CACHE_TTL } from "@/lib/dashboardCache";
import { readLocationCache, writeLocationCache, augmentDashboardWithLocation } from "@/lib/locationWeatherCache";

type LocationState =
  | { status: "loading" }
  | { status: "error"; message: string; city?: string; state?: string }
  | { status: "success"; data: LocationWeather; approximate?: boolean; city?: string; state?: string };

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(() => readDashboardCache()?.data ?? null);
  const [loading, setLoading] = useState(() => readDashboardCache() === null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(() => readDashboardCache()?.fetchedAt ?? null);
  const [locationState, setLocationState] = useState<LocationState>(() => {
    const cached = readLocationCache();
    if (cached) return { status: "success", data: cached.data, approximate: cached.approximate, city: cached.city, state: cached.state };
    return { status: "loading" };
  });
  const geo = useGeolocation();

  const loadDashboard = useCallback(async (force = false) => {
    if (!force) {
      const cached = readDashboardCache();
      if (cached) {
        setDashboard(cached.data);
        setFetchedAt(cached.fetchedAt);
        setLoading(false);
        return;
      }
    }
    try {
      const data = await api.get<Dashboard>("/weather/dashboard");
      const fetched = writeDashboardCache(data);
      setDashboard(data);
      setFetchedAt(fetched);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh every 5 minutes — forces re-fetch and updates cache
  useEffect(() => {
    const interval = setInterval(() => loadDashboard(true), CACHE_TTL);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    if (geo.status === "error") {
      setLocationState({ status: "error", message: geo.message });
      return;
    }
    if (geo.status !== "success") return;

    // Use cached location weather if still fresh
    const cached = readLocationCache();
    if (cached) {
      setLocationState({ status: "success", data: cached.data, approximate: cached.approximate, city: cached.city, state: cached.state });
      return;
    }

    const { latitude, longitude, approximate, city, state } = geo;
    setLocationState({ status: "loading" });
    api.get<LocationWeather>(`/weather/location?lat=${latitude}&lon=${longitude}`)
      .then((data) => {
        writeLocationCache({ data, city, state, approximate });
        setLocationState({ status: "success", data, approximate, city, state });
      })
      .catch((e: unknown) => setLocationState({ status: "error", message: (e as Error).message, city, state }));
  }, [geo.status]);

  if (loading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>;
  if (error) return <div className="pt-8"><ErrorMessage message={error} /></div>;
  if (!dashboard) return null;

  // Augment dashboard with user's location city for display only (does not modify cache)
  const locCache = readLocationCache();
  const displayDashboard = locCache ? augmentDashboardWithLocation(dashboard, locCache) : dashboard;
  const { kpis, risk_ranking, alerts, temperature_comparison, rain_comparison } = displayDashboard;

  const formattedUpdate = fetchedAt
    ? new Date(fetchedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard Climático</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Visão geral das {kpis.active_cities} cidades monitoradas
          {formattedUpdate && (
            <span className="block sm:inline sm:ml-2 text-gray-400">
              <span className="hidden sm:inline">· </span>Atualizado: {formattedUpdate}
            </span>
          )}
        </p>
      </div>

      {/* KPIs — Visão Geral */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Visão Geral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          <KPICard
            title="Total de Cidades"
            value={kpis.total_cities}
            subtitle="cidades cadastradas"
            icon={<Building2 className="h-5 w-5" />}
            color="teal"
          />
          <KPICard
            title="Cidades Ativas"
            value={kpis.active_cities}
            subtitle={`de ${kpis.total_cities} cadastradas`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="teal"
          />
          <KPICard
            title="Temp. Média"
            value={`${kpis.avg_temperature}°C`}
            subtitle="entre as cidades ativas"
            icon={<Thermometer className="h-5 w-5" />}
            color="teal"
          />
          <KPICard
            title="Temp. Máxima"
            value={`${kpis.max_temperature}°C`}
            subtitle={kpis.hottest_city ? `em ${kpis.hottest_city.name}` : undefined}
            icon={<Thermometer className="h-5 w-5" />}
            color="red"
          />
          <KPICard
            title="Temp. Mínima"
            value={`${kpis.min_temperature}°C`}
            subtitle={kpis.coldest_city ? `em ${kpis.coldest_city.name}` : undefined}
            icon={<Thermometer className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title="Prob. Média de Chuva"
            value={`${kpis.avg_rain_probability}%`}
            subtitle="entre as cidades ativas"
            icon={<Droplets className="h-5 w-5" />}
            color="blue"
          />
        </div>
      </div>

      {/* KPIs — Destaques por Cidade */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Destaques por Cidade</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard
            title="Em Risco Alto"
            value={kpis.high_risk_count}
            subtitle={`de ${kpis.active_cities} cidades ativas`}
            icon={<AlertTriangle className="h-5 w-5" />}
            color={kpis.high_risk_count > 0 ? "red" : "teal"}
          />
          <KPICard
            title="Mais Quente"
            value={kpis.hottest_city?.name || "—"}
            subtitle={kpis.hottest_city ? `${kpis.hottest_city.temp}°C` : undefined}
            icon={<Thermometer className="h-5 w-5" />}
            color="red"
          />
          <KPICard
            title="Mais Fria"
            value={kpis.coldest_city?.name || "—"}
            subtitle={kpis.coldest_city ? `${kpis.coldest_city.temp}°C` : undefined}
            icon={<Thermometer className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title="Maior Prob. de Chuva"
            value={kpis.most_rain_prob_city?.name || "—"}
            subtitle={kpis.most_rain_prob_city ? `${kpis.most_rain_prob_city.prob}%` : undefined}
            icon={<Droplets className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title="Maior Vol. de Chuva"
            value={kpis.most_rain_volume_city?.name || "—"}
            subtitle={kpis.most_rain_volume_city ? `${kpis.most_rain_volume_city.volume} mm` : undefined}
            icon={<Droplets className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title="Maior Velocidade de Vento"
            value={kpis.windiest_city?.name || "—"}
            subtitle={kpis.windiest_city ? `${kpis.windiest_city.wind} km/h` : undefined}
            icon={<Wind className="h-5 w-5" />}
            color="yellow"
          />
          <KPICard
            title="Melhor p/ Operação"
            value={kpis.best_operation_city?.name || "—"}
            subtitle={kpis.best_operation_city ? `Score de risco: ${kpis.best_operation_city.risk_score}` : undefined}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="teal"
          />
        </div>
      </div>

      {/* Geolocation + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <LocationWeatherCard {...locationState} />
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Alertas Climáticos
          </h2>
          <AlertsList alerts={alerts} />
        </div>
      </div>

      {/* Risk Ranking */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Ranking de Risco Operacional</h2>
        <RiskRankingTable items={risk_ranking} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-teal-600" />
            Temperatura por Cidade
          </h2>
          <TemperatureChart data={temperature_comparison} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            Probabilidade de Chuva
          </h2>
          <RainComparisonChart data={rain_comparison} />
        </div>
      </div>
    </div>
  );
}
