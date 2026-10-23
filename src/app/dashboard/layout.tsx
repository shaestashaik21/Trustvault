'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './layout.module.css';

interface User { id: string; email: string; role: string; }

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '⊞' },
  { href: '/dashboard/documents', label: 'Documents', icon: '📄' },
  { href: '/dashboard/shared', label: 'Shared with me', icon: '👥' },
  { href: '/dashboard/permissions', label: 'Permissions', icon: '🔑' },
  { href: '/dashboard/audit', label: 'Audit Logs', icon: '🕐' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tv_user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('tv_token');
    localStorage.removeItem('tv_user');
    router.push('/login');
  }

  if (!user) return null;

  const allNav = user.role === 'admin'
    ? [...navItems, { href: '/dashboard/admin', label: 'Admin Panel', icon: '⚙️' }]
    : navItems;

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <svg viewBox="0 0 48 48" fill="none" width="28" height="28">
            <path d="M24 4L6 12V24C6 33.94 14.06 43.28 24 46C33.94 43.28 42 33.94 42 24V12L24 4Z" fill="url(#sg)"/>
            <path d="M18 24l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="sg" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00d4aa"/><stop offset="1" stopColor="#0057ff"/>
            </linearGradient></defs>
          </svg>
          <span>TrustVault</span>
        </div>

        <nav className={styles.nav}>
          {allNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{user.email[0].toUpperCase()}</div>
            <div className={styles.userDetails}>
              <div className={styles.userEmail}>{user.email}</div>
              <div className={styles.userRole}>{user.role}</div>
            </div>
          </div>
          <button id="logout-btn" onClick={handleLogout} className={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
