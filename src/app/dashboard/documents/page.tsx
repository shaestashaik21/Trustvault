'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './documents.module.css';

interface Document {
  id: string; name: string; description: string; category: string;
  file_url: string; file_size: number; file_type: string;
  owner_id: string; created_at: string; owner?: { email: string };
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

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', description: '', category: 'General', file: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
    'Content-Type': 'application/json',
  }), []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents', { headers: authHeaders() });
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {}
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError('');
    if (!uploadForm.name) { setUploadError('Name is required'); return; }
    setUploading(true);

    try {
      let file_url = 'https://storage.trustvault.internal/placeholder.pdf';
      let file_size = uploadForm.file?.size ?? 0;
      let file_type = uploadForm.file?.type ?? 'application/octet-stream';

      if (uploadForm.file) {
        const formData = new FormData();
        formData.append('file', uploadForm.file);

        const uploadRes = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('tv_token')}`,
          },
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          file_url = uploadData.file_url;
          file_size = uploadData.file_size;
          file_type = uploadData.file_type;
        }
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: uploadForm.name,
          description: uploadForm.description,
          category: uploadForm.category,
          file_url,
          file_size,
          file_type,
        }),
      });
      if (!res.ok) { const d = await res.json(); setUploadError(d.error); return; }
      setShowUpload(false);
      setUploadForm({ name: '', description: '', category: 'General', file: null });
      loadDocs();
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeaders() });
    setDeleteId(null);
    loadDocs();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Documents</h1>
        <button id="open-upload-modal" className={styles.uploadBtn} onClick={() => setShowUpload(true)}>
          ↑ Upload Document
        </button>
      </div>

      {/* Search & filter bar */}
      <div className={styles.toolbar}>
        <input
          id="doc-search"
          className={styles.search}
          placeholder="Search documents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className={styles.count}>{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Category</th>
              <th>Size</th>
              <th>Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.empty}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No documents found</td></tr>
            ) : filtered.map(doc => (
              <tr key={doc.id} className={styles.row}>
                <td className={styles.nameCell}>
                  <span className={styles.fileIcon}>{getFileIcon(doc.file_type)}</span>
                  <div>
                    <div className={styles.docName}>{doc.name}</div>
                    {doc.description && <div className={styles.docDesc}>{doc.description}</div>}
                  </div>
                </td>
                <td className={styles.ownerCell}>{doc.owner?.email ?? '—'}</td>
                <td><span className={styles.badge}>{doc.category}</span></td>
                <td className={styles.meta}>{formatBytes(doc.file_size)}</td>
                <td className={styles.meta}>{timeAgo(doc.created_at)}</td>
                <td className={styles.actions}>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className={styles.actionBtn} id={`view-doc-${doc.id}`}>View</a>
                  <a href={`/dashboard/permissions?doc=${doc.id}`}
                    className={styles.actionBtn} id={`perm-doc-${doc.id}`}>Perms</a>
                  <button onClick={() => setDeleteId(doc.id)}
                    className={`${styles.actionBtn} ${styles.deleteBtn}`} id={`del-doc-${doc.id}`}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className={styles.overlay} onClick={() => setShowUpload(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Upload Document</h2>
              <button className={styles.closeBtn} onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload} id="upload-form">
              <div className={styles.field}>
                <label>Document Name *</label>
                <input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Project Proposal.pdf" />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <input value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description..." />
              </div>
              <div className={styles.field}>
                <label>Category</label>
                <select value={uploadForm.category} onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
                  {['General', 'Finance', 'Legal', 'HR', 'Design', 'Engineering'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>File</label>
                <input type="file" onChange={e => setUploadForm(p => ({ ...p, file: e.target.files?.[0] ?? null }))} />
              </div>
              {uploadError && <div className={styles.errMsg}>{uploadError}</div>}
              <button id="submit-upload" type="submit" className={styles.submitBtn} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className={styles.overlay} onClick={() => setDeleteId(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <h3>Delete document?</h3>
            <p>This cannot be undone. All permissions will also be removed.</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setDeleteId(null)} className={styles.cancelBtn}>Cancel</button>
              <button id="confirm-delete" onClick={() => handleDelete(deleteId)} className={styles.confirmDeleteBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
