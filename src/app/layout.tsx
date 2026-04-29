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
import Schema from '@/components/Schema';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://hotel-du-manolo-cr.com'), // Placeholder URL
  title: {
    template: '%s | Hotel Du Manolo',
    default: 'Hotel Du Manolo - Privacidad, Lujo y Discreción en Costa Rica',
  },
  description: 'Descubra el máximo confort y discreción en Hotel Du Manolo. El mejor motel de lujo en Heredia, Costa Rica, con habitaciones premium, jacuzzi, y servicio exclusivo 24/7.',
  keywords: [
    'motel de lujo Heredia', 
    'hotel con jacuzzi Heredia', 
    'habitaciones para parejas Costa Rica', 
    'privacidad y discreción Heredia', 
    'motel premium Heredia', 
    'escapada romántica Costa Rica', 
    'Hotel Du Manolo',
    'mejor motel Heredia',
    'estancia por horas Heredia'
  ],
  authors: [{ name: 'Hotel Du Manolo' }],
  creator: 'Hotel Du Manolo',
  publisher: 'Hotel Du Manolo',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Hotel Du Manolo - Privacidad y Lujo Exclusivo',
    description: 'El refugio perfecto para la discreción y el confort premium en Costa Rica.',
    url: 'https://hotel-du-manolo-cr.com',
    siteName: 'Hotel Du Manolo',
    images: [
      {
        url: '/hero_bg_clean.png',
        width: 1200,
        height: 630,
        alt: 'Hotel Du Manolo Premium Suite',
      },
    ],
    locale: 'es_CR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hotel Du Manolo - Privacidad y Lujo',
    description: 'Descubra la máxima discreción y confort en Hotel Du Manolo.',
    images: ['/hero_bg_clean.png'],
  },
  alternates: {
    canonical: 'https://hotel-du-manolo-cr.com',
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
            <Schema />
          </ToastStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
