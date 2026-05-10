import { AlertTriangle, CheckCircle } from "lucide-react";
import { Alert } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Nenhum alerta climático ativo</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.city_id}
          className={`rounded-lg p-3 border ${alert.risk_level === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${alert.risk_level === "high" ? "text-red-500" : "text-yellow-500"}`} />
              <span className="font-medium text-sm text-gray-900">{alert.city_name}</span>
            </div>
            <RiskBadge level={alert.risk_level} />
          </div>
          <p className="text-xs text-gray-600 ml-6">{alert.reasons.join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}
