'use client';

import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';

interface Stats { totalDocuments: number; sharedWithMe: number; recentActivity: number; }
interface AuditLog { id: string; action: string; resource_name: string; created_at: string; success: boolean; }

export default function DashboardHome() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ totalDocuments: 0, sharedWithMe: 0, recentActivity: 0 });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('tv_user');
    if (stored) setUser(JSON.parse(stored));

    async function load() {
      const token = localStorage.getItem('tv_token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [docsRes, auditRes] = await Promise.all([
          fetch('/api/documents', { headers }),
          fetch('/api/audit?page=1', { headers }),
        ]);
        const docs = await docsRes.json();
        const audit = await auditRes.json();

        setStats({
          totalDocuments: docs.total ?? 0,
          sharedWithMe: (docs.documents ?? []).filter((d: any) => d.owner_id !== user?.id).length,
          recentActivity: audit.total ?? 0,
        });
        setRecentLogs((audit.logs ?? []).slice(0, 5));
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = user?.email?.split('@')[0] ?? 'User';

  function formatAction(action: string) {
    return action.replace('.', ' → ').replace(/_/g, ' ');
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{greeting}, {name}</h1>
          <p className={styles.subGreeting}>Here&apos;s what&apos;s happening with your documents today.</p>
        </div>
        <button id="upload-doc-btn" className={styles.uploadBtn} onClick={() => location.href='/dashboard/documents'}>
          ↑ Upload Document
        </button>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        {[
          { label: 'Total Documents', value: stats.totalDocuments, icon: '📄', color: '#0057ff' },
          { label: 'Shared with Me', value: stats.sharedWithMe, icon: '👥', color: '#00d4aa' },
          { label: 'Activity Events', value: stats.recentActivity, icon: '🕐', color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
            <div>
              <div className={styles.statValue}>{loading ? '—' : s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Activity</h2>
          <a href="/dashboard/audit" className={styles.viewAll}>View all →</a>
        </div>
        <div className={styles.activityList}>
          {loading ? (
            <div className={styles.empty}>Loading...</div>
          ) : recentLogs.length === 0 ? (
            <div className={styles.empty}>No activity yet</div>
          ) : recentLogs.map(log => (
            <div key={log.id} className={styles.activityItem}>
              <div className={`${styles.activityDot} ${log.success ? styles.dotSuccess : styles.dotFail}`} />
              <div className={styles.activityContent}>
                <span className={styles.activityAction}>{formatAction(log.action)}</span>
                {log.resource_name && (
                  <span className={styles.activityResource}> — {log.resource_name}</span>
                )}
              </div>
              <span className={styles.activityTime}>{timeAgo(log.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
