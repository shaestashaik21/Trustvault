'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      // Store token in localStorage and cookie for client-side and server-side navigation
      localStorage.setItem('tv_token', data.token);
      localStorage.setItem('tv_user', JSON.stringify(data.user));
      document.cookie = `trustvault_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
      window.location.href = '/dashboard';
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* Left Panel */}
      <div className={styles.leftPanel}>
        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
              <path d="M24 4L6 12V24C6 33.94 14.06 43.28 24 46C33.94 43.28 42 33.94 42 24V12L24 4Z" fill="url(#shield-grad)"/>
              <path d="M18 24l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="shield-grad" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00d4aa"/>
                  <stop offset="1" stopColor="#0057ff"/>
                </linearGradient>
              </defs>
            </svg>
            <span className={styles.logoText}>TrustVault</span>
          </div>
          <h1 className={styles.tagline}>Your data.<br />Protected.</h1>
          <p className={styles.sub}>
            Enterprise document security with granular permissions,
            real-time access control and a full audit trail.
          </p>
          <div className={styles.features}>
            {['End-to-end encrypted storage', 'Granular role permissions', 'Immutable audit logs'].map(f => (
              <div key={f} className={styles.featureItem}>
                <span className={styles.featureDot} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Welcome Back</h2>
            <p>Sign in to your secure workspace</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} id="login-form">
            <div className={styles.field}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className={styles.errorBanner} role="alert">{error}</div>}

            <button
              id="login-submit"
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? <span className={styles.spinner} /> : 'Sign In'}
            </button>
          </form>

          <p className={styles.footNote}>
            Don&apos;t have an account? Contact your administrator.
          </p>

          <div className={styles.demoSwitcher}>
            <div className={styles.demoTitle}>
              <span>⚡ Team Members Role Matrix (1-Click Fill)</span>
            </div>
            <div className={styles.demoGrid}>
              <button
                type="button"
                className={styles.demoCard}
                onClick={() => { setEmail('john.doe@trustvault.local'); setPassword('Admin@123456'); }}
              >
                <div className={styles.demoRole}>
                  👑 John Doe <span className={`${styles.demoBadge} ${styles.badgeAdmin}`}>Administrator</span>
                </div>
                <div className={styles.demoEmail}>Manage users, security logs, system settings</div>
              </button>

              <button
                type="button"
                className={styles.demoCard}
                onClick={() => { setEmail('sarah.wilson@trustvault.local'); setPassword('Sarah@123456'); }}
              >
                <div className={styles.demoRole}>
                  📁 Sarah Wilson <span className={`${styles.demoBadge} ${styles.badgeUser}`}>Doc Owner</span>
                </div>
                <div className={styles.demoEmail}>Upload, edit own docs, grant/revoke access</div>
              </button>

              <button
                type="button"
                className={styles.demoCard}
                onClick={() => { setEmail('mike.chen@trustvault.local'); setPassword('Mike@123456'); }}
              >
                <div className={styles.demoRole}>
                  ✏️ Mike Chen <span className={`${styles.demoBadge} ${styles.badgeUser}`}>Editor</span>
                </div>
                <div className={styles.demoEmail}>Read and edit docs shared with him</div>
              </button>

              <button
                type="button"
                className={styles.demoCard}
                onClick={() => { setEmail('alex.brown@trustvault.local'); setPassword('Alex@123456'); }}
              >
                <div className={styles.demoRole}>
                  👀 Alex Brown <span className={`${styles.demoBadge} ${styles.badgeUser}`}>Viewer</span>
                </div>
                <div className={styles.demoEmail}>Read and download docs shared with him</div>
              </button>

              <button
                type="button"
                className={styles.demoCard}
                style={{ gridColumn: 'span 2' }}
                onClick={() => { setEmail('emily.davis@trustvault.local'); setPassword('Emily@123456'); }}
              >
                <div className={styles.demoRole}>
                  📖 Emily Davis <span className={`${styles.demoBadge} ${styles.badgeUser}`}>Viewer</span>
                </div>
                <div className={styles.demoEmail}>Read docs shared with her (restricted permissions)</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
