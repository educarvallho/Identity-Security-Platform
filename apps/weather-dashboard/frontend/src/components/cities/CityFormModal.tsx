"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { City } from "@/types";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  city: City | null;
  onClose: () => void;
  onSave: () => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
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

function getStateAbbr(stateName: string | undefined): string {
  if (!stateName) return "";
  return BR_STATE_ABBR[stateName] ?? stateName.slice(0, 2).toUpperCase();
}

export function CityFormModal({ city, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: city?.name || "",
    state: city?.state || "",
    country: city?.country || "Brasil",
    latitude: city?.latitude?.toString() || "",
    longitude: city?.longitude?.toString() || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=6&addressdetails=1&accept-language=pt-BR`,
          { headers: { "Accept-Language": "pt-BR" } }
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelect = (r: NominatimResult) => {
    const cityName = r.address.city || r.address.town || r.address.village || r.address.municipality || "";
    setForm({
      name: cityName,
      state: getStateAbbr(r.address.state),
      country: r.address.country || "Brasil",
      latitude: parseFloat(r.lat).toFixed(4),
      longitude: parseFloat(r.lon).toFixed(4),
    });
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) };
    try {
      if (city) {
        await api.put(`/cities/${city.id}`, body);
      } else {
        await api.post("/cities", body);
      }
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "name", label: "Nome", type: "text", placeholder: "São Paulo" },
    { key: "state", label: "Estado (UF)", type: "text", placeholder: "SP", maxLength: 2 },
    { key: "country", label: "País", type: "text", placeholder: "Brasil" },
    { key: "latitude", label: "Latitude", type: "number", placeholder: "-23.5505" },
    { key: "longitude", label: "Longitude", type: "number", placeholder: "-46.6333" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{city ? "Editar Cidade" : "Nova Cidade"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

          {/* Geocoding search */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar cidade</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Digite para buscar e preencher automaticamente..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
            </div>
            {showResults && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
                {results.map((r) => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-teal-50 hover:text-teal-700 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium">{r.address.city || r.address.town || r.address.village || r.address.municipality}</span>
                      {r.address.state && <span className="text-gray-400 ml-1">— {r.address.state}</span>}
                      {r.address.country && <span className="text-gray-400 ml-1">({r.address.country})</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type}
                step={f.type === "number" ? "any" : undefined}
                maxLength={"maxLength" in f ? f.maxLength : undefined}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {saving ? <><Spinner size="sm" />Salvando...</> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
