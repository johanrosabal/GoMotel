'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Home,
  Package,
  Users,
  Cog,
  Sun,
  Moon,
  Sparkles,
  Percent,
  BarChart3,
  CalendarPlus,
  Receipt,
  ShoppingCart,
  ShoppingBasket,
  MonitorPlay,
  QrCode,
  Building,
  BedDouble,
  Bell,
  BookCopy,
  Layout,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useTheme } from 'next-themes';
import { useUserProfile } from '@/hooks/use-user-profile';

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandMenu({ open, setOpen }: Props) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { userProfile } = useUserProfile();

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, [setOpen]);

  if (!userProfile) return null;
  const role = userProfile.role;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Escriba un comando o busque..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        <CommandGroup heading="Navegación">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Panel de Control</span>
          </CommandItem>
          
          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/pos'))}>
                <ShoppingBasket className="mr-2 h-4 w-4" />
                <span>Punto de Venta (POS)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => window.open('/public/menu', '_blank'))}>
                <MonitorPlay className="mr-2 h-4 w-4" />
                <span>Menú Digital (TV)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => window.open('/public/order', '_blank'))}>
                <QrCode className="mr-2 h-4 w-4" />
                <span>Auto-Pedido (Móvil)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/reports'))}>
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Reportes y Estadísticas</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion' || role === 'Conserje') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/rooms'))}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Panel de Habitaciones</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion' || role === 'Conserje') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/cleaning'))}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Cola de Limpieza</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/reservations'))}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>Reservaciones</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/billing/invoices'))}>
                <Receipt className="mr-2 h-4 w-4" />
                <span>Facturación</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem onSelect={() => runCommand(() => router.push('/inventory'))}>
                <Package className="mr-2 h-4 w-4" />
                <span>Inventario</span>
            </CommandItem>
          )}

          {role === 'Administrador' && (
            <CommandGroup heading="Ajustes y Configuración">
                <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Panel de Ajustes</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/company'))}>
                    <Building className="mr-2 h-4 w-4" />
                    <span>Información Comercial</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/room-types'))}>
                    <BedDouble className="mr-2 h-4 w-4" />
                    <span>Tipos de Habitación</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/sounds'))}>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Sonido de Alarma</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/catalog'))}>
                    <BookCopy className="mr-2 h-4 w-4" />
                    <span>Catálogo de Productos</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/landing-page'))}>
                    <Layout className="mr-2 h-4 w-4" />
                    <span>Administración de Inicio</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/system'))}>
                    <Cog className="mr-2 h-4 w-4" />
                    <span>Sistema General</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/users'))}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Gestión de Usuarios</span>
                </CommandItem>
            </CommandGroup>
          )}

          {(role === 'Administrador' || role === 'Contador') && (
            <CommandGroup heading="Finanzas">
                <CommandItem onSelect={() => runCommand(() => router.push('/settings/taxes'))}>
                    <Percent className="mr-2 h-4 w-4" />
                    <span>Gestión de Impuestos</span>
                </CommandItem>
            </CommandGroup>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tema">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            Claro
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            Oscuro
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
