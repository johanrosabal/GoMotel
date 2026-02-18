'use client';

import Link from 'next/link';
import UserMenu from './UserMenu';
import { useFirebase } from '@/firebase';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';

export default function TopNav() {
  const { user } = useFirebase();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
            <Link href={user ? '/dashboard' : '/'} className="mr-auto flex items-center">
              <span className="font-bold text-lg">Go Motel</span>
            </Link>
            <div className="flex items-center space-x-2">
              {user && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard">
                        <LayoutDashboard />
                        Panel Principal
                    </Link>
                  </Button>
              )}
              <ThemeToggle />
              <UserMenu />
            </div>
        </div>
    </header>
  );
}
