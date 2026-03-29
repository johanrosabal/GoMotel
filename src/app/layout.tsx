import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import TopNav from '@/components/TopNav';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import AuthWrapper from '@/components/AuthWrapper';
import { ThemeProvider } from '@/components/ThemeProvider';
import * as React from 'react';
import { ToastStateProvider } from '@/components/ToastProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    template: '%s | Hotel Du Manolo',
    default: 'Hotel Du Manolo - Privacidad y Lujo en Costa Rica',
  },
  description: 'Descubra la máxima discreción y confort en Hotel Du Manolo. Habitaciones premium, servicio de lujo y experiencias exclusivas en Costa Rica.',
  keywords: ['motel', 'hotel', 'costa rica', 'habitaciones parejas', 'privacidad', 'jacuzzi', 'escapada romantica', 'motel de lujo'],
  openGraph: {
    title: 'Hotel Du Manolo - Privacidad y Lujo',
    description: 'Descubra la máxima discreción y confort en Hotel Du Manolo.',
    type: 'website',
    locale: 'es_CR',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastStateProvider>
            <FirebaseClientProvider>
              <AuthWrapper>
                <div className="flex flex-col min-h-screen">
                  <TopNav />
                  <main className="flex-1">{children}</main>
                </div>
              </AuthWrapper>
            </FirebaseClientProvider>
            <Toaster />
          </ToastStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
