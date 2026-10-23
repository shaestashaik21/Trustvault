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

      // Store token in localStorage for client-side use (cookie also set by server)
      localStorage.setItem('tv_token', data.token);
      localStorage.setItem('tv_user', JSON.stringify(data.user));
      router.push('/dashboard');
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
        </div>
      </div>
    </div>
  );
}
