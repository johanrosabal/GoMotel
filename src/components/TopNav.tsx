'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from './AppLogo';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', label: 'Panel de Habitaciones' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/settings', label: 'Ajustes' },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
            <Link href="/" className="mr-8 flex items-center space-x-2">
              <AppLogo className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Go Motel</span>
            </Link>
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
        </div>
    </header>
  );
}
