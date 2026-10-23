'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './audit.module.css';

interface AuditLog {
  id: string; actor_email: string; action: string; resource_type: string;
  resource_name: string; ip_address: string; success: boolean;
  failure_reason: string; created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: '#00d4aa', logout: '#6b7280',
  'document.upload': '#0057ff', 'document.view': '#a855f7',
  'document.download': '#0057ff', 'document.delete': '#ef4444',
  'document.update': '#f59e0b', 'permission.grant': '#00d4aa',
  'permission.revoke': '#f59e0b', 'user.create': '#0057ff',
  'user.delete': '#ef4444', 'user.update': '#f59e0b',
};

const FILTERS = ['All', 'login', 'document.upload', 'document.view', 'document.delete', 'permission.grant', 'permission.revoke', 'user.create'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
  }), []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== 'All') params.set('action', filter);
    try {
      const res = await fetch(`/api/audit?${params}`, { headers: headers() });
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  }, [page, filter, headers]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter(l =>
    !search ||
    l.actor_email?.includes(search) ||
    l.action.includes(search) ||
    l.resource_name?.includes(search)
  );

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Audit Logs</h1>
        <p className={styles.sub}>Track all document activity and security events.</p>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          id="audit-search"
          className={styles.search}
          placeholder="Search by user, action or document..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterChips}>
          {FILTERS.map(f => (
            <button
              key={f}
              id={`filter-${f.replace('.', '-')}`}
              className={`${styles.chip} ${filter === f ? styles.chipActive : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f === 'All' ? 'All Events' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className={styles.timeline}>
        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No log entries found</div>
        ) : filtered.map((log, i) => (
          <div key={log.id} className={styles.entry}>
            <div className={styles.entryLeft}>
              <div
                className={styles.dot}
                style={{ background: log.success ? (ACTION_COLORS[log.action] ?? '#6b7280') : '#ef4444' }}
              />
              {i < filtered.length - 1 && <div className={styles.line} />}
            </div>
            <div className={styles.entryContent}>
              <div className={styles.entryHeader}>
                <span className={styles.action} style={{ color: ACTION_COLORS[log.action] ?? '#6b7280' }}>
                  {log.action}
                </span>
                {!log.success && <span className={styles.failBadge}>FAILED</span>}
                <span className={styles.timestamp}>{fmt(log.created_at)}</span>
              </div>
              <div className={styles.entryMeta}>
                <span className={styles.actor}>👤 {log.actor_email}</span>
                {log.resource_name && <span className={styles.resource}>📄 {log.resource_name}</span>}
                {log.ip_address && log.ip_address !== 'unknown' && (
                  <span className={styles.ip}>🌐 {log.ip_address}</span>
                )}
              </div>
              {log.failure_reason && (
                <div className={styles.failReason}>Reason: {log.failure_reason}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className={styles.pagination}>
          <button id="prev-page" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={styles.pageBtn}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} · {total} events</span>
          <button id="next-page" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total} className={styles.pageBtn}>Next →</button>
        </div>
      )}
    </div>
  );
}
