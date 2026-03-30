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
  Truck,
  ShoppingBag,
  UtensilsCrossed,
  Wine,
  Contact,
  CreditCard,
  Image,
  Megaphone,
  Mail,
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
import { formatCurrency } from '@/lib/utils';

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
          <CommandItem value="panel de control dashboard inicio home" onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Panel de Control</span>
          </CommandItem>
          
          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="punto de venta pos venta directa terminal" onSelect={() => runCommand(() => router.push('/pos'))}>
                <ShoppingBasket className="mr-2 h-4 w-4" />
                <span>Punto de Venta (POS)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="menu digital tv pantallas publico" onSelect={() => runCommand(() => window.open('/public/menu', '_blank'))}>
                <MonitorPlay className="mr-2 h-4 w-4" />
                <span>Menú Digital (TV)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="auto-pedido movil qr pedidos publico" onSelect={() => runCommand(() => window.open('/public/order', '_blank'))}>
                <QrCode className="mr-2 h-4 w-4" />
                <span>Auto-Pedido (Móvil)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador') && (
            <CommandItem value="reportes estadisticas analitica ventas" onSelect={() => runCommand(() => router.push('/reports'))}>
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Reportes y Estadísticas</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion' || role === 'Conserje') && (
            <CommandItem value="panel de habitaciones estados disponibilidad layout" onSelect={() => runCommand(() => router.push('/dashboard/rooms'))}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Panel de Habitaciones</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion' || role === 'Conserje') && (
            <CommandItem value="cola de limpieza aseo camareras spark" onSelect={() => runCommand(() => router.push('/cleaning'))}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Cola de Limpieza</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="reservaciones calendario agenda reservas" onSelect={() => runCommand(() => router.push('/reservations'))}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>Reservaciones</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem value="facturacion documentos electronicos facturas docu" onSelect={() => runCommand(() => router.push('/billing/invoices'))}>
                <Receipt className="mr-2 h-4 w-4" />
                <span>Facturación</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem value="gestion de inventario stock suministros productos" onSelect={() => runCommand(() => router.push('/inventory'))}>
                <Package className="mr-2 h-4 w-4" />
                <span>Gestión de Inventario</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem value="gestion de clientes huespedes contactos base de datos" onSelect={() => runCommand(() => router.push('/clients'))}>
                <Contact className="mr-2 h-4 w-4" />
                <span>Gestión de Clientes</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem value="gestion de proveedores suministros compras distribucion" onSelect={() => runCommand(() => router.push('/suppliers'))}>
                <Truck className="mr-2 h-4 w-4" />
                <span>Gestión de Proveedores</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Contador' || role === 'Recepcion') && (
            <CommandItem value="gestion de compras facturas recibidas gastos proveedores" onSelect={() => runCommand(() => router.push('/purchases'))}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                <span>Gestión de Compras</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="cola de cocina live pedidos comida" onSelect={() => runCommand(() => router.push('/kitchen'))}>
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                <span>Cola de Cocina (Live)</span>
            </CommandItem>
          )}

          {(role === 'Administrador' || role === 'Recepcion') && (
            <CommandItem value="cola de bar live pedidos bebidas" onSelect={() => runCommand(() => router.push('/bar'))}>
                <Wine className="mr-2 h-4 w-4" />
                <span>Cola de Bar (Live)</span>
            </CommandItem>
          )}
        </CommandGroup>

        {role === 'Administrador' && (
          <CommandGroup heading="Ajustes y Configuración">
            <CommandItem value="panel de ajustes configuracion settings generales" onSelect={() => runCommand(() => router.push('/settings'))}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Panel de Ajustes</span>
            </CommandItem>
            <CommandItem value="informacion comercial datos legales emisor empresa" onSelect={() => runCommand(() => router.push('/settings/company'))}>
                <Building className="mr-2 h-4 w-4" />
                <span>Información Comercial</span>
            </CommandItem>
            <CommandItem value="tipos de habitacion categorias planes precios" onSelect={() => runCommand(() => router.push('/settings/room-types'))}>
                <BedDouble className="mr-2 h-4 w-4" />
                <span>Tipos de Habitación</span>
            </CommandItem>
            <CommandItem value="sonido de alarma notificaciones audios alertas" onSelect={() => runCommand(() => router.push('/settings/sounds'))}>
                <Bell className="mr-2 h-4 w-4" />
                <span>Sonido de Alarma</span>
            </CommandItem>
            <CommandItem value="catalogo de productos servicios lista menu inventario" onSelect={() => runCommand(() => router.push('/catalog'))}>
                <BookCopy className="mr-2 h-4 w-4" />
                <span>Catálogo de Productos</span>
            </CommandItem>
            <CommandItem value="administracion de inicio landing page home web" onSelect={() => runCommand(() => router.push('/settings/landing-page'))}>
                <Layout className="mr-2 h-4 w-4" />
                <span>Administración de Inicio</span>
            </CommandItem>
            <CommandItem value="sistema general configuracion avanzada ajustes" onSelect={() => runCommand(() => router.push('/settings/system'))}>
                <Cog className="mr-2 h-4 w-4" />
                <span>Sistema General</span>
            </CommandItem>
            <CommandItem value="manual de usuario ayuda documentacion guiada" onSelect={() => runCommand(() => router.push('/manual'))}>
                <BookCopy className="mr-2 h-4 w-4" />
                <span>Manual de Usuario</span>
            </CommandItem>
            <CommandItem value="centro de ayuda soporte asistencia tecnica" onSelect={() => runCommand(() => router.push('/help-center'))}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Centro de Ayuda</span>
            </CommandItem>
            <CommandItem value="gestion de usuarios personal perfiles staff administradores" onSelect={() => runCommand(() => router.push('/users'))}>
                <Users className="mr-2 h-4 w-4" />
                <span>Gestión de Usuarios</span>
            </CommandItem>
            <CommandItem value="plantillas de email correo notificaciones marketing publicidad" onSelect={() => runCommand(() => router.push('/marketing/templates'))}>
                <Mail className="mr-2 h-4 w-4" />
                <span>Plantillas de Email</span>
            </CommandItem>
            <CommandItem value="galeria de imagenes videos fotos multimedia" onSelect={() => runCommand(() => router.push('/gallery'))}>
                <Image className="mr-2 h-4 w-4" />
                <span>Galería Multimedia</span>
            </CommandItem>
            <CommandItem value="notificaciones globales avisos alertas mkt mensajes" onSelect={() => runCommand(() => router.push('/settings/notifications'))}>
                <Megaphone className="mr-2 h-4 w-4" />
                <span>Avisos del Sistema</span>
            </CommandItem>
            <CommandItem value="pagina de quienes somos historia nosotros contenido" onSelect={() => runCommand(() => router.push('/settings/quienes-somos'))}>
                <Building className="mr-2 h-4 w-4" />
                <span>Página Quiénes Somos</span>
            </CommandItem>
          </CommandGroup>
        )}

        {(role === 'Administrador' || role === 'Contador') && (
          <CommandGroup heading="Finanzas y Contabilidad">
              <CommandItem value="gestion de impuestos tributacion tasas iva" onSelect={() => runCommand(() => router.push('/settings/taxes'))}>
                  <Percent className="mr-2 h-4 w-4" />
                  <span>Gestión de Impuestos</span>
              </CommandItem>
              <CommandItem value="cuentas sinpe movil bancos transferencias pagos" onSelect={() => runCommand(() => router.push('/settings/sinpe-accounts'))}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Cuentas SINPE</span>
              </CommandItem>
          </CommandGroup>
        )}

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
