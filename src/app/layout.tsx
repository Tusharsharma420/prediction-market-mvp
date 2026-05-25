import React from 'react';
import '@/css/globals.css';
import { Providers } from '@/components/Providers';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Nebula Predict - Production Prediction Market MVP',
  description: 'A production-level order book prediction market platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Navbar />
            <main style={{
              flex: 1,
              maxWidth: '1280px',
              width: '100%',
              margin: '0 auto',
              padding: '0 20px 40px 20px'
            }}>
              {children}
            </main>
            <footer style={{
              textAlign: 'center',
              padding: '24px',
              borderTop: '1px solid var(--border-glass)',
              fontSize: '0.8rem',
              color: 'var(--text-dark)',
              marginTop: 'auto'
            }}>
              &copy; 2026 Nebula Predict. Built with Next.js, Express, Socket.io, and Prisma.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
