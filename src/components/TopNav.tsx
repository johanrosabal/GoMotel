'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from './AppLogo';
import { cn } from '@/lib/utils';
import UserMenu from './UserMenu';
import { useFirebase } from '@/firebase';
import { ThemeToggle } from './ThemeToggle';

const menuItems = [
  { href: '/dashboard', label: 'Panel de Habitaciones' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/settings', label: 'Ajustes' },
];

const publicRoutes = ['/', '/register'];

export default function TopNav() {
  const pathname = usePathname();
  const { user } = useFirebase();
  const showNav = user && !publicRoutes.includes(pathname);

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
            <Link href={user ? '/dashboard' : '/'} className="mr-8 flex items-center space-x-2">
              <AppLogo className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Go Motel</span>
            </Link>
            {showNav && (
              <nav className="flex items-center space-x-6 text-sm font-medium">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "transition-colors hover:text-primary",
                      pathname.startsWith(item.href) ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
            <div className="ml-auto flex items-center space-x-4">
              <ThemeToggle />
              <UserMenu />
            </div>
        </div>
    </header>
  );
}
