'use client';

import { useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const publicRoutes = ['/', '/register', '/public/menu', '/public/order'];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user status is determined
    }

    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/invoices/');

    if (!user && !isPublicRoute) {
      // If user is not logged in and not on a public route, redirect to login
      router.push('/');
    } else if (user && (pathname === '/' || pathname === '/register')) {
      // If user is logged in and on a base public route (login/register), redirect to home
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router, pathname]);

  // While loading auth state, show a loading screen to prevent flicker
  if (isUserLoading) {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-30 w-full border-b bg-background">
                <div className="container flex h-16 items-center">
                    <Skeleton className="h-8 w-32" />
                    <div className="ml-auto">
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </div>
            </header>
            <main className="flex-1 container py-8">
                <Skeleton className="h-40 w-full" />
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </main>
      </div>
    );
  }

  // If user is not logged in and not on a public page, we are about to redirect, so show nothing.
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/invoices/');
  if (!user && !isPublicRoute) {
      return null;
  }
  
  // If user is logged in and on a base public page, redirect
  if(user && (pathname === '/' || pathname === '/register')) {
      return null;
  }

  return <>{children}</>;
}
