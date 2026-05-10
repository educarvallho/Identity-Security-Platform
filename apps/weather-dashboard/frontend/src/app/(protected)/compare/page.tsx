"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Thermometer, Droplets, Wind, MapPin } from "lucide-react";
import { Dashboard } from "@/types";
import { api } from "@/lib/api";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { readDashboardCache, writeDashboardCache } from "@/lib/dashboardCache";
import { readLocationCache, augmentDashboardWithLocation } from "@/lib/locationWeatherCache";

export default function ComparePage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const cached = readDashboardCache();
    if (cached) {
      const loc = readLocationCache();
      const data = loc ? augmentDashboardWithLocation(cached.data, loc) : cached.data;
      setDashboard(data);
      setSelected(new Set(data.risk_ranking.slice(0, 3).map((c) => c.city_id)));
      setLoading(false);
      return;
    }
    api.get<Dashboard>("/weather/dashboard")
      .then((data) => {
        writeDashboardCache(data);
        const loc = readLocationCache();
        const augmented = loc ? augmentDashboardWithLocation(data, loc) : data;
        setDashboard(augmented);
        setSelected(new Set(augmented.risk_ranking.slice(0, 3).map((c) => c.city_id)));
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>;
  if (error) return <div className="pt-8"><ErrorMessage message={error} /></div>;
  if (!dashboard) return null;

  const allCities = dashboard.risk_ranking;
  const selectedCities = allCities.filter((c) => selected.has(c.city_id));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chartData = selectedCities.map((c) => ({
    name: c.city_name,
    temperature: c.temperature,
    rain_probability: c.rain_probability,
    wind_speed_kmh: c.wind_speed_kmh,
  }));

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Comparação de Cidades</h1>
        <p className="text-sm text-gray-500 mt-0.5">Selecione as cidades para comparar condições climáticas atuais</p>
      </div>

      {/* City selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3">Cidades</h2>
        <div className="flex flex-wrap gap-2">
          {allCities.map((city) => (
            <button
              key={city.city_id}
              onClick={() => toggle(city.city_id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors border ${
                selected.has(city.city_id)
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-teal-400"
              }`}
            >
              {city.city_id === -1 && <MapPin className="h-3 w-3" />}
              {city.city_name}
              {city.state && <span className="text-xs opacity-70">{city.state}</span>}
            </button>
          ))}
        </div>
      </div>

      {selectedCities.length === 0 && (
        <p className="text-center py-12 text-gray-400 text-sm">Selecione pelo menos uma cidade para ver a comparação.</p>
      )}

      {selectedCities.length > 0 && (
        <>
          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Condições Atuais</h2>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 text-left">Cidade</th>
                  <th className="pb-3 text-right">Temp.</th>
                  <th className="pb-3 text-right">Prob. Chuva</th>
                  <th className="pb-3 text-right">Vento</th>
                  <th className="pb-3 text-right">Score</th>
                  <th className="pb-3 text-right">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {selectedCities.map((city) => (
                  <tr key={city.city_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 font-medium text-gray-900">
                      {city.city_id === -1 && <MapPin className="inline h-3 w-3 text-teal-600 mr-1" />}
                      {city.city_name}
                      {city.state && <span className="ml-1.5 text-gray-400 text-xs">{city.state}</span>}
                    </td>
                    <td className="py-3 text-right font-mono">{city.temperature}°C</td>
                    <td className="py-3 text-right font-mono">{city.rain_probability}%</td>
                    <td className="py-3 text-right font-mono">{city.wind_speed_kmh} km/h</td>
                    <td className="py-3 text-right font-mono">{city.risk_score}</td>
                    <td className="py-3 text-right"><RiskBadge level={city.risk_level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-teal-600" />
                Temperatura (°C)
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} unit="°C" />
                  <Tooltip formatter={(v: number) => [`${v}°C`, "Temperatura"]} />
                  <Bar dataKey="temperature" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-500" />
                Probabilidade de Chuva (%)
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Prob. Chuva"]} />
                  <Bar dataKey="rain_probability" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm lg:col-span-2">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Wind className="h-4 w-4 text-gray-500" />
                Velocidade do Vento (km/h)
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} unit=" km/h" />
                  <Tooltip formatter={(v: number) => [`${v} km/h`, "Vento"]} />
                  <Bar dataKey="wind_speed_kmh" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
