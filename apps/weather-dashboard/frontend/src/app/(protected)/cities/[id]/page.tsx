"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Thermometer, Droplets, Wind } from "lucide-react";
import { CityForecast } from "@/types";
import { api } from "@/lib/api";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ForecastCard } from "@/components/forecast/ForecastCard";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function CityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CityForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CityForecast>(`/weather/cities/${id}/forecast`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>;
  if (error) return <div className="pt-8 max-w-2xl"><ErrorMessage message={error} /></div>;
  if (!data) return null;

  const { current } = data;

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{data.city_name}</h1>
            <p className="text-gray-500 text-sm sm:text-base">{data.state} · Brasil</p>
          </div>
          <RiskBadge level={current.risk.level} size="md" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { icon: <Thermometer className="h-4 w-4 text-red-500" />, label: "Temperatura", value: `${current.temperature.toFixed(1)}°C` },
            { icon: <Thermometer className="h-4 w-4 text-orange-400" />, label: "Sensação", value: `${current.apparent_temperature.toFixed(1)}°C` },
            { icon: <Droplets className="h-4 w-4 text-blue-500" />, label: "Prob. Chuva", value: `${current.rain_probability}%` },
            { icon: <Wind className="h-4 w-4 text-gray-500" />, label: "Vento", value: `${current.wind_speed_kmh.toFixed(0)} km/h` },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">{item.icon}<span className="text-xs text-gray-500">{item.label}</span></div>
              <p className="font-bold text-lg text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {current.risk.reasons.length > 0 && (
          <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-100 px-4 py-2.5 text-sm text-yellow-800">
            <strong>Fatores de risco: </strong>{current.risk.reasons.join(" · ")}
          </div>
        )}
      </div>

      {/* 7-day forecast */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Previsão para os próximos 7 dias</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {data.daily.map((day) => (
            <ForecastCard key={day.date} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
}
