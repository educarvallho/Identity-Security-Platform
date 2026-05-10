import Link from "next/link";
import { MapPin } from "lucide-react";
import { CityRiskItem } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { EmptyState } from "@/components/ui/EmptyState";

export function RiskRankingTable({ items }: { items: CityRiskItem[] }) {
  if (items.length === 0) return <EmptyState title="Sem dados de risco" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4">#</th>
            <th className="pb-3 pr-4">Cidade</th>
            <th className="pb-3 pr-4 text-right">Temp.</th>
            <th className="pb-3 pr-4 text-right">Chuva</th>
            <th className="pb-3 pr-4 text-right">Vento</th>
            <th className="pb-3">Risco</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, i) => (
            <tr key={item.city_id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4 text-gray-400 font-mono">{i + 1}</td>
              <td className="py-3 pr-4">
                {item.city_id === -1 ? (
                  <Link href="/cities/location" className="font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {item.city_name}
                    {item.state && <span className="ml-1 text-gray-400 font-normal">{item.state}</span>}
                  </Link>
                ) : (
                  <>
                    <Link href={`/cities/${item.city_id}`} className="font-medium text-gray-900 hover:text-teal-600">
                      {item.city_name}
                    </Link>
                    <span className="ml-1.5 text-gray-400">{item.state}</span>
                  </>
                )}
              </td>
              <td className="py-3 pr-4 text-right font-mono">{item.temperature}°C</td>
              <td className="py-3 pr-4 text-right font-mono">{item.rain_probability}%</td>
              <td className="py-3 pr-4 text-right font-mono">{item.wind_speed_kmh} km/h</td>
              <td className="py-3"><RiskBadge level={item.risk_level} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
