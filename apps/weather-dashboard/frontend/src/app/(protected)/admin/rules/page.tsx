"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { RiskRules } from "@/types";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useRouter } from "next/navigation";

export default function AdminRulesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<RiskRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user?.role !== "admin") router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    api.get<RiskRules>("/admin/rules")
      .then((data) => { setRules(data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof RiskRules, value: string) => {
    if (!rules) return;
    const num = parseFloat(value);
    if (!isNaN(num)) setRules({ ...rules, [field]: num });
  };

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const updated = await api.put<RiskRules>("/admin/rules", rules);
      setRules(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
          Regras de Risco Operacional
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Calibre os limiares de pontuação. Apenas administradores têm acesso.</p>
        {rules?.updated_at && (
          <p className="text-xs text-gray-400 mt-1">
            Última atualização: {new Date(rules.updated_at).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      {error && <ErrorMessage message={error} />}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Regras atualizadas com sucesso.
        </div>
      )}

      {rules && (
        <div className="space-y-6">
          <Section title="Probabilidade de Chuva">
            <Field label="Risco alto acima de (%)" value={rules.rain_prob_high} onChange={(v) => handleChange("rain_prob_high", v)} note="+2 pontos" />
            <Field label="Risco médio acima de (%)" value={rules.rain_prob_medium} onChange={(v) => handleChange("rain_prob_medium", v)} note="+1 ponto" />
          </Section>

          <Section title="Velocidade do Vento">
            <Field label="Risco alto acima de (km/h)" value={rules.wind_high} onChange={(v) => handleChange("wind_high", v)} note="+2 pontos" />
            <Field label="Risco médio acima de (km/h)" value={rules.wind_medium} onChange={(v) => handleChange("wind_medium", v)} note="+1 ponto" />
          </Section>

          <Section title="Temperatura">
            <Field label="Extremo quente acima de (°C)" value={rules.temp_extreme_high} onChange={(v) => handleChange("temp_extreme_high", v)} note="+2 pontos" />
            <Field label="Extremo frio abaixo de (°C)" value={rules.temp_extreme_low} onChange={(v) => handleChange("temp_extreme_low", v)} note="+2 pontos" />
            <Field label="Elevado acima de (°C)" value={rules.temp_high} onChange={(v) => handleChange("temp_high", v)} note="+1 ponto" />
            <Field label="Baixo abaixo de (°C)" value={rules.temp_low} onChange={(v) => handleChange("temp_low", v)} note="+1 ponto" />
          </Section>

          <Section title="Volume de Chuva">
            <Field label="Alto acima de (mm)" value={rules.rain_volume_high} onChange={(v) => handleChange("rain_volume_high", v)} note="+1 ponto" />
          </Section>

          <Section title="Classificação por Score">
            <Field label="Score mínimo para risco ALTO" value={rules.score_high_threshold} onChange={(v) => handleChange("score_high_threshold", v)} note="Score ≥ N = Alto" />
            <Field label="Score mínimo para risco MÉDIO" value={rules.score_medium_threshold} onChange={(v) => handleChange("score_medium_threshold", v)} note="Score ≥ N = Médio" />
          </Section>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Spinner size="sm" /> : null}
            {saving ? "Salvando..." : "Salvar Regras"}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
      <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  note: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <label className="text-sm text-gray-700">{label}</label>
        <p className="text-xs text-gray-400">{note}</p>
      </div>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  );
}
