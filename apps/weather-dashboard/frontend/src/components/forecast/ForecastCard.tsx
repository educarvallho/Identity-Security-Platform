import { DailyForecast } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Droplets, Wind } from "lucide-react";

export function ForecastCard({ day }: { day: DailyForecast }) {
  const date = new Date(day.date + "T12:00:00");
  const dayName = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const dayNum = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className={`rounded-xl border p-4 text-sm ${day.risk.level === "high" ? "bg-red-50 border-red-200" : day.risk.level === "medium" ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
      <div className="text-center mb-3">
        <p className="font-semibold capitalize text-gray-700">{dayName}</p>
        <p className="text-xs text-gray-500">{dayNum}</p>
      </div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-center">
          <p className="text-xs text-gray-500">Máx</p>
          <p className="font-bold text-red-600">{day.max_temp.toFixed(0)}°</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Mín</p>
          <p className="font-bold text-blue-600">{day.min_temp.toFixed(0)}°</p>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Droplets className="h-3.5 w-3.5 text-blue-400" />
          <span>{day.rain_probability}% · {day.rain_volume_mm.toFixed(1)} mm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-gray-400" />
          <span>{day.max_wind_speed_kmh.toFixed(0)} km/h</span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <RiskBadge level={day.risk.level} />
      </div>
    </div>
  );
}
