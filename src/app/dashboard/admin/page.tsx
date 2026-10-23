'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './admin.module.css';

interface User { id: string; email: string; role: string; is_active: boolean; created_at: string; }

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
    'Content-Type': 'application/json',
  }), []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users', { headers: headers() });
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, [headers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: headers(),
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else { setShowCreate(false); setForm({ email: '', password: '', role: 'user' }); loadUsers(); }
    setSaving(false);
  }

  async function toggleActive(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    loadUsers();
  }

  async function promoteAdmin(user: User) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Admin Panel</h1>
          <p className={styles.sub}>Manage users and system access.</p>
        </div>
        <button id="create-user-btn" className={styles.createBtn} onClick={() => setShowCreate(true)}>
          + Create User
        </button>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Users ({users.length})</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={styles.empty}>Loading...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={styles.row}>
                <td className={styles.emailCell}>
                  <div className={styles.avatar}>{u.email[0].toUpperCase()}</div>
                  {u.email}
                </td>
                <td>
                  <span className={u.role === 'admin' ? styles.adminBadge : styles.userBadge}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={u.is_active ? styles.activeBadge : styles.inactiveBadge}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className={styles.meta}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className={styles.actions}>
                  <button
                    id={`toggle-active-${u.id}`}
                    className={styles.actionBtn}
                    onClick={() => toggleActive(u)}
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    id={`toggle-role-${u.id}`}
                    className={styles.actionBtn}
                    onClick={() => promoteAdmin(u)}
                  >
                    {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create User</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} id="create-user-form">
              <div className={styles.field}>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required placeholder="user@company.com" />
              </div>
              <div className={styles.field}>
                <label>Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required placeholder="Min 8 characters" minLength={8} />
              </div>
              <div className={styles.field}>
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error && <div className={styles.errMsg}>{error}</div>}
              <button id="submit-create-user" type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
