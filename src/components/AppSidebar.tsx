'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import AppLogo from './AppLogo';
import { LayoutDashboard, Package, Cog } from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Panel', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventario', icon: Package },
  { href: '/settings', label: 'Ajustes', icon: Cog },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const isSubpath = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <AppLogo className="w-8 h-8 text-primary" />
          <span className="text-lg font-semibold">Go Motel</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={isSubpath(item.href)}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
