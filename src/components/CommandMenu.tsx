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

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandMenu({ open, setOpen }: Props) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, [setOpen]);

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
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/rooms'))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Panel de Habitaciones</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/cleaning'))}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Cola de Limpieza</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/inventory'))}>
            <Package className="mr-2 h-4 w-4" />
            <span>Inventario</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings/room-types'))}>
            <Cog className="mr-2 h-4 w-4" />
            <span>Tipos de Habitación</span>
          </CommandItem>
           <CommandItem onSelect={() => runCommand(() => router.push('/users'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Gestión de Usuarios</span>
          </CommandItem>
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
