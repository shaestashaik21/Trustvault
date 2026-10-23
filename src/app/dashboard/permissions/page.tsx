'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './permissions.module.css';

interface Permission { id: string; permission_level: string; granted_at: string; user: { id: string; email: string }; }
interface UserOption { id: string; email: string; }

const LEVEL_COLORS: Record<string, string> = {
  read: '#00d4aa', edit: '#f59e0b', admin: '#ef4444',
};

export default function PermissionsPage() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('doc') ?? '';

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantForm, setGrantForm] = useState({ userId: '', level: 'read' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
    'Content-Type': 'application/json',
  }), []);

  const loadPermissions = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const [permRes, usersRes] = await Promise.all([
        fetch(`/api/permissions?document_id=${docId}`, { headers: headers() }),
        fetch('/api/admin/users', { headers: headers() }),
      ]);
      const p = await permRes.json();
      const u = await usersRes.json();
      setPermissions(p.permissions ?? []);
      setUsers(u.users ?? []);
    } catch {}
    setLoading(false);
  }, [docId, headers]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ document_id: docId, target_user_id: grantForm.userId, permission_level: grantForm.level }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else { setGrantForm({ userId: '', level: 'read' }); loadPermissions(); }
    setSaving(false);
  }

  async function handleRevoke(userId: string) {
    await fetch('/api/permissions', {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ document_id: docId, target_user_id: userId }),
    });
    loadPermissions();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Permissions</h1>
        <p className={styles.sub}>Manage who can access each document and what they can do.</p>
      </div>

      {!docId ? (
        <div className={styles.noDoc}>
          <p>Select a document from the <a href="/dashboard/documents">Documents</a> page to manage its permissions.</p>
        </div>
      ) : (
        <>
          {/* Grant access form */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>+ Add Access</h2>
            <form onSubmit={handleGrant} className={styles.grantForm} id="grant-access-form">
              <select
                id="select-user"
                value={grantForm.userId}
                onChange={e => setGrantForm(p => ({ ...p, userId: e.target.value }))}
                required
                className={styles.select}
              >
                <option value="">— Select a user —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <select
                id="select-level"
                value={grantForm.level}
                onChange={e => setGrantForm(p => ({ ...p, level: e.target.value }))}
                className={styles.select}
              >
                <option value="read">Read</option>
                <option value="edit">Edit</option>
                <option value="admin">Admin</option>
              </select>
              <button id="grant-btn" type="submit" className={styles.grantBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Grant Access'}
              </button>
            </form>
            {error && <div className={styles.errMsg}>{error}</div>}
          </div>

          {/* Permission matrix */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Current Permissions</h2>
            {loading ? (
              <div className={styles.empty}>Loading...</div>
            ) : permissions.length === 0 ? (
              <div className={styles.empty}>No permissions set — only the owner can access this document.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Level</th>
                    <th>Granted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map(perm => (
                    <tr key={perm.id}>
                      <td className={styles.emailCell}>
                        <div className={styles.avatar}>{perm.user.email[0].toUpperCase()}</div>
                        {perm.user.email}
                      </td>
                      <td>
                        <span className={styles.levelBadge} style={{ background: `${LEVEL_COLORS[perm.permission_level]}22`, color: LEVEL_COLORS[perm.permission_level] }}>
                          {perm.permission_level}
                        </span>
                      </td>
                      <td className={styles.meta}>{new Date(perm.granted_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          id={`revoke-${perm.user.id}`}
                          onClick={() => handleRevoke(perm.user.id)}
                          className={styles.revokeBtn}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
