"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { User } from "@/types";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { UserFormModal } from "@/components/admin/UserFormModal";
import { useRouter } from "next/navigation";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  useEffect(() => {
    if (!loading && currentUser?.role !== "admin") router.replace("/dashboard");
  }, [currentUser, loading, router]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<User[]>("/users");
      setUsers(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUser?.id) return alert("Você não pode excluir seu próprio usuário.");
    if (!confirm(`Excluir usuário "${name}"?`)) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const ROLE_LABELS: Record<string, string> = { admin: "Administrador", operator: "Operador", viewer: "Visualizador" };
  const ROLE_COLORS: Record<string, string> = { admin: "bg-purple-100 text-purple-700", operator: "bg-blue-100 text-blue-700", viewer: "bg-gray-100 text-gray-600" };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Apenas administradores têm acesso a esta área</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true); }} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <div className="flex justify-center pt-10"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.id === currentUser?.id ? "bg-teal-50/30" : ""}`}>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{u.full_name} {u.id === currentUser?.id && <span className="text-xs text-teal-600">(você)</span>}</td>
                  <td className="px-4 py-3.5 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditUser(u); setShowModal(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id, u.full_name)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600" disabled={u.id === currentUser?.id}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserFormModal user={editUser} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}
