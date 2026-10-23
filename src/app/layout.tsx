import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrustVault — Secure Document Management',
  description: 'Enterprise document security with granular permissions, real-time access control, and a full audit trail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
