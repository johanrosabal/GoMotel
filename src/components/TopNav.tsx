
'use client';

import Link from 'next/link';
import UserMenu from './UserMenu';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import SearchCommand from './SearchCommand';
import { usePathname } from 'next/navigation';
import Notifications from './Notifications';
import { doc } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';

export default function TopNav() {
  const { user, firestore } = useFirebase();
  const pathname = usePathname();
  
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  // Ocultar el TopNav en las rutas públicas (TV y Móvil Cliente) para permitir experiencia a pantalla completa
  const isPublicRoute = pathname?.includes('/public/') || pathname?.startsWith('/invoices/');
  if (isPublicRoute) return null;

  const showBackButton = user && pathname !== '/dashboard' && pathname !== '/';

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
            <div className="flex flex-1 items-center justify-start gap-2 md:gap-4">
              {showBackButton ? (
                  <Button variant="secondary" className="h-9 rounded-md font-bold px-3 border-primary/10 shadow-sm transition-all hover:bg-secondary/80" asChild>
                    <Link href="/dashboard">
                        <ChevronLeft className="h-4 w-4 sm:mr-1 text-primary" />
                        <span className="hidden sm:inline">Inicio</span>
                    </Link>
                  </Button>
              ) : <div className='w-9 h-9 hidden sm:block'/>}
              {user && <SearchCommand />}
            </div>

            <div className="hidden sm:flex flex-none items-center justify-center mx-4">
              <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 group">
                  {company?.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" className="h-8 w-8 object-contain transition-transform group-hover:scale-110" />
                  ) : null}
                  <span className="font-black text-lg tracking-tighter uppercase transition-colors group-hover:text-primary">
                      {company?.tradeName || 'Go Motel'}
                  </span>
              </Link>
            </div>
            
            <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
              {user && <Notifications />}
              <ThemeToggle />
              <UserMenu />
            </div>
        </div>
    </header>
  );
}
