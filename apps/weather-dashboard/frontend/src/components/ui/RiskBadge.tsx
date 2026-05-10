import { RiskLevel } from "@/types";

const RISK_CONFIG: Record<RiskLevel, { label: string; classes: string }> = {
  low: { label: "Baixo", classes: "bg-green-100 text-green-800 border border-green-200" },
  medium: { label: "Médio", classes: "bg-yellow-100 text-yellow-800 border border-yellow-200" },
  high: { label: "Alto", classes: "bg-red-100 text-red-800 border border-red-200" },
};

export function RiskBadge({ level, size = "sm" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"} ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}
