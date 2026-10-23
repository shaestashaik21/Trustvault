'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '../documents/documents.module.css';

interface SharedDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  file_url: string;
  file_size: number;
  file_type: string;
  owner_id: string;
  created_at: string;
  owner?: { email: string };
  access_level?: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📕',
  'image/': '🖼️',
  'video/': '🎬',
  'application/zip': '📦',
  default: '📄',
};

function getFileIcon(type: string) {
  for (const [k, v] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(k)) return v;
  }
  return FILE_ICONS.default;
}

export default function SharedDocumentsPage() {
  const [docs, setDocs] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
    'Content-Type': 'application/json',
  }), []);

  const loadSharedDocs = useCallback(async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('tv_user');
      const currentUser = stored ? JSON.parse(stored) : null;

      const res = await fetch('/api/documents', { headers: authHeaders() });
      const data = await res.json();
      
      // Filter documents where current user is NOT the owner
      if (currentUser && Array.isArray(data.documents)) {
        const shared = data.documents.filter((d: SharedDocument) => d.owner_id !== currentUser.id);
        setDocs(shared);
      } else {
        setDocs([]);
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadSharedDocs();
  }, [loadSharedDocs]);

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase()) ||
    (d.owner?.email && d.owner.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Shared with me</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Documents that other team members have granted you access to
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          id="shared-doc-search"
          className={styles.search}
          placeholder="Search shared documents or owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className={styles.count}>{filtered.length} shared document{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Document</th>
              <th>Owner / Shared By</th>
              <th>Category</th>
              <th>Size</th>
              <th>Shared Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.empty}>Loading shared documents...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No documents have been shared with you yet</td></tr>
            ) : filtered.map(doc => (
              <tr key={doc.id} className={styles.row}>
                <td className={styles.nameCell}>
                  <span className={styles.fileIcon}>{getFileIcon(doc.file_type)}</span>
                  <div>
                    <div className={styles.docName}>{doc.name}</div>
                    {doc.description && <div className={styles.docDesc}>{doc.description}</div>}
                  </div>
                </td>
                <td className={styles.ownerCell}>{doc.owner?.email ?? 'Unknown'}</td>
                <td><span className={styles.badge}>{doc.category}</span></td>
                <td className={styles.meta}>{formatBytes(doc.file_size)}</td>
                <td className={styles.meta}>{timeAgo(doc.created_at)}</td>
                <td className={styles.actions}>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.actionBtn}
                    id={`view-shared-${doc.id}`}
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
