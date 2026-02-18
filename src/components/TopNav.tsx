'use client';

import Link from 'next/link';
import AppLogo from './AppLogo';
import UserMenu from './UserMenu';
import { useFirebase } from '@/firebase';
import { ThemeToggle } from './ThemeToggle';

export default function TopNav() {
  const { user } = useFirebase();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
            <Link href={user ? '/dashboard' : '/'} className="mr-auto flex items-center space-x-2">
              <AppLogo className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Go Motel</span>
            </Link>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <UserMenu />
            </div>
        </div>
    </header>
  );
}
