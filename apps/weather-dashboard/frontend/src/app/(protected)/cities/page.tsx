"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from "lucide-react";
import { City } from "@/types";
import { api } from "@/lib/api";
import { invalidateDashboardCache } from "@/lib/dashboardCache";
import { useAuth } from "@/hooks/useAuth";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { CityFormModal } from "@/components/cities/CityFormModal";

export default function CitiesPage() {
  const { user } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editCity, setEditCity] = useState<City | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "operator";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<City[]>(`/cities?active_only=${activeOnly}`);
      setCities(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeOnly]);

  const handleToggle = async (id: number) => {
    try {
      await api.patch(`/cities/${id}/toggle`);
      invalidateDashboardCache();
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Deseja excluir a cidade "${name}"?`)) return;
    try {
      await api.delete(`/cities/${id}`);
      invalidateDashboardCache();
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cidades Monitoradas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cities.length} cidades {activeOnly ? "ativas" : "no total"}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="rounded border-gray-300 text-teal-600" />
            Apenas ativas
          </label>
          {canManage && (
            <button onClick={() => { setEditCity(null); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
              <Plus className="h-4 w-4" />
              Nova Cidade
            </button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <div className="flex justify-center pt-10"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cidade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">País</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                {canManage && <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cities.map((city) => (
                <tr key={city.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium">
                    <Link href={`/cities/${city.id}`} className="text-gray-900 hover:text-teal-600">
                      {city.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{city.state}</td>
                  <td className="px-4 py-3.5 text-gray-600">{city.country}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${city.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {city.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleToggle(city.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-teal-600 transition-colors" title={city.is_active ? "Desativar" : "Ativar"}>
                          {city.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button onClick={() => { setEditCity(city); setShowModal(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        {user?.role === "admin" && (
                          <button onClick={() => handleDelete(city.id, city.name)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {cities.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhuma cidade encontrada</div>
          )}
        </div>
      )}

      {showModal && (
        <CityFormModal
          city={editCity}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); invalidateDashboardCache(); load(); }}
        />
      )}
    </div>
  );
}
