import { useState, useEffect } from 'react';
import api from '../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', email: '', phone: '', password: '', roleName: 'cashier' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => { loadUsers(); }, []);

  function loadUsers() {
    api.get('/users').then(({ data }) => setUsers(data.users)).catch(() => {});
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!form.fullName || !form.username || !form.password) {
      setError('Full name, username, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', form);
      setForm({ fullName: '', username: '', email: '', phone: '', password: '', roleName: 'cashier' });
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user) {
    try {
      await api.patch(`/users/${user.id}/status`, { isActive: !user.is_active });
      loadUsers();
    } catch {
      // silently ignore; list will just not update
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    try {
      await api.post(`/users/${resetTargetId}/reset-password`, { newPassword: resetPassword });
      setResetTargetId(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Could not reset password.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">User Management</h1>
        <button onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Full name *</label>
            <input value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Username *</label>
            <input value={form.username} onChange={(e) => updateField('username', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <input value={form.email} onChange={(e) => updateField('email', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Password *</label>
            <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Role</label>
            <select value={form.roleName} onChange={(e) => updateField('roleName', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2">Name</th><th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Login</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{u.full_name}</td>
                <td className="px-3 py-2 text-slate-500">{u.username}</td>
                <td className="px-3 py-2 capitalize">{u.role_name}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button onClick={() => toggleStatus(u)} className="text-xs text-slate-600 hover:underline">
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => { setResetTargetId(u.id); setResetError(''); }} className="text-xs text-emerald-700 hover:underline">
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTargetId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={handleResetPassword} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-slate-800">Reset Password</h2>
            <input type="password" placeholder="New password (min 8 characters)" value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoFocus />
            {resetError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetTargetId(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm">Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">Reset</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
