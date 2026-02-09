import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import TopNav from '@/components/TopNav';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import AuthWrapper from '@/components/AuthWrapper';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Administrador de Go Motel',
  description: 'Administre su motel con facilidad.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <FirebaseClientProvider>
          <AuthWrapper>
            <div className="flex flex-col min-h-screen">
              <TopNav />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </AuthWrapper>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
