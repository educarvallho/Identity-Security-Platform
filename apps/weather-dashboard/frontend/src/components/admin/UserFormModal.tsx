"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { User, UserRole } from "@/types";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}

export function UserFormModal({ user, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    password: "",
    role: (user?.role || "viewer") as UserRole,
    is_active: user?.is_active ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (user) {
        await api.put(`/users/${user.id}`, { full_name: form.full_name, role: form.role, is_active: form.is_active });
      } else {
        if (!form.password) { setError("Senha obrigatória"); setSaving(false); return; }
        await api.post("/users", { email: form.email, full_name: form.full_name, password: form.password, role: form.role });
      }
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{user ? "Editar Usuário" : "Novo Usuário"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="viewer">Visualizador</option>
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-teal-600" />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Conta ativa</label>
            </div>
          )}

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
