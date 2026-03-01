'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import Link from 'next/link';
import {
  Wallet,
  ShoppingCart,
  BedDouble,
  TriangleAlert,
  LayoutGrid,
  Package,
  Cog,
  Users,
  FileText,
  BookOpen,
  HelpCircle,
  ArrowRight,
  CalendarPlus,
  Zap,
  Sparkles,
  BookCopy,
  Percent,
  Smartphone,
  Receipt,
  Truck,
  FileCode,
  Building,
  BarChart3,
  ShoppingBasket,
  MonitorPlay,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { CompanyProfile, UserRole, Room, Service } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@/components/ui/skeleton';

// Define a type for navigation sections
type NavSection = {
  title: string;
  scope: string;
  description: string;
  roles: UserRole[];
  links: {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
    roles?: UserRole[];
  }[];
};

export default function DashboardPage() {
  const { firestore } = useFirebase();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile();

  const roomsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'rooms')) : null, [firestore]);
  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services')) : null, [firestore]);
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  if (isProfileLoading || isLoadingRooms || isLoadingServices) {
    return (
      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:py-8 space-y-8">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!userProfile) return null;
  const userRole = userProfile.role;

  const totalAssetValue = (services || []).reduce(
    (acc, service) => acc + (service.price * (service.stock || 0)),
    0
  );
  const occupiedRooms = (rooms || []).filter((room) => room.status === 'Occupied');
  const expectedRevenue = occupiedRooms.reduce(
    (acc, room) => acc + room.ratePerHour,
    0
  );
  const availableRooms = (rooms || []).filter(
    (room) => room.status === 'Available'
  ).length;
  const lowStockItems = (services || []).filter((service) => service.minStock != null && service.stock < service.minStock).length;

  const kpiData = [
    {
      title: 'Valor Activo (Venta)',
      value: formatCurrency(totalAssetValue),
      description: 'Capital total proyectado en inventario.',
      icon: Wallet,
      visible: ['Administrador', 'Contador'].includes(userRole),
    },
    {
      title: 'Ventas por Hora (Potencial)',
      value: formatCurrency(expectedRevenue),
      description: 'Ingreso por hora de hab. ocupadas.',
      icon: ShoppingCart,
      visible: ['Administrador', 'Recepcion', 'Contador'].includes(userRole),
    },
    {
      title: 'Habitaciones Disponibles',
      value: availableRooms,
      description: 'Unidades listas para la venta.',
      icon: BedDouble,
      visible: ['Administrador', 'Recepcion', 'Conserje'].includes(userRole),
    },
    {
      title: 'Stock Bajo',
      value: lowStockItems,
      description: 'Artículos por debajo del punto de reorden.',
      icon: TriangleAlert,
      visible: ['Administrador', 'Contador', 'Recepcion'].includes(userRole),
    },
  ];

  const navSections: NavSection[] = [
    {
      title: 'Operaciones Principales',
      scope: 'Flujo de trabajo diario y atención al cliente.',
      description: 'Gestión de habitaciones, servicios y inventario.',
      roles: ['Administrador', 'Recepcion', 'Conserje'],
      links: [
        {
          href: '/pos',
          title: 'Venta Directa (POS)',
          description: 'Venda productos sin vincular a una habitación.',
          icon: ShoppingBasket,
          badge: 'NUEVO',
          roles: ['Administrador', 'Recepcion'],
        },
        {
          href: '/reservations',
          title: 'Crear Reservaciones',
          description: 'Agenda futuras estancias para los huéspedes.',
          icon: CalendarPlus,
          badge: 'PASO 1',
          roles: ['Administrador', 'Recepcion'],
        },
        {
          href: '/cleaning',
          title: 'Cola de Limpieza',
          description: 'Gestione las habitaciones que requieren limpieza.',
          icon: Sparkles,
          badge: 'PASO 2',
          roles: ['Administrador', 'Recepcion', 'Conserje'],
        },
        {
          href: '/clients',
          title: 'Gestión de Clientes',
          description: 'Cree y administre la ficha de sus clientes frecuentes.',
          icon: Users,
          roles: ['Administrador', 'Recepcion'],
        },
        {
          href: '/inventory',
          title: 'Gestión de Inventario',
          description: 'Controle los niveles de stock y el valor de sus activos.',
          icon: Package,
          roles: ['Administrador', 'Recepcion', 'Contador'],
        },
      ],
    },
    {
      title: 'Marketing y Visualización',
      scope: 'Pantallas públicas y promoción.',
      description: 'Configuración de menús digitales para clientes.',
      roles: ['Administrador', 'Recepcion'],
      links: [
        {
          href: '/public/menu',
          title: 'Menú Digital (TV)',
          description: 'Abrir pantalla pública para televisores en modo kiosko.',
          icon: MonitorPlay,
          badge: 'PÚBLICO',
        },
      ],
    },
    {
      title: 'Finanzas y Contabilidad',
      scope: 'Auditoría, facturación y gestión fiscal.',
      description: 'Control de ingresos, pagos y proveedores.',
      roles: ['Administrador', 'Contador', 'Recepcion'],
      links: [
        {
            href: '/billing/invoices',
            title: 'Facturación',
            description: 'Consulte el historial de todas las facturas generadas.',
            icon: Receipt,
            roles: ['Administrador', 'Contador', 'Recepcion'],
        },
        {
          href: '/purchases',
          title: 'Registrar Compras',
          description: 'Añada productos al inventario registrando nuevas compras.',
          icon: ShoppingCart,
          roles: ['Administrador', 'Contador'],
        },
        {
          href: '/reports',
          title: 'Reportes y Estadísticas',
          description: 'Análisis de ingresos, ocupación e informes con IA.',
          icon: BarChart3,
          badge: 'ACTUALIZADO',
          roles: ['Administrador', 'Contador'],
        },
        {
          href: '/settings/taxes',
          title: 'Gestión de Impuestos',
          description: 'Define y gestiona los impuestos aplicables.',
          icon: Percent,
          roles: ['Administrador', 'Contador'],
        },
        {
            href: '/settings/sinpe-accounts',
            title: 'Gestión de SINPE',
            description: 'Administra las cuentas SINPE Móvil para pagos.',
            icon: Smartphone,
            roles: ['Administrador', 'Contador'],
        },
        {
          href: '/suppliers',
          title: 'Gestión de Proveedores',
          description: 'Administre los proveedores de sus productos.',
          icon: Truck,
          roles: ['Administrador', 'Contador'],
        },
      ],
    },
    {
      title: 'Administración y Parámetros',
      scope: 'Configuración global y seguridad.',
      description: 'Ajustes del sistema y gestión de usuarios.',
      roles: ['Administrador'],
      links: [
        {
          href: '/dashboard/rooms',
          title: 'Panel de Habitaciones',
          description: 'Vista y gestión de todas las habitaciones.',
          icon: LayoutGrid,
        },
        {
          href: '/catalog',
          title: 'Catálogo de Productos',
          description: 'Gestiona categorías, sub-categorías y productos.',
          icon: BookCopy,
        },
        {
            href: '/settings/company',
            title: 'Información Comercial',
            description: 'Gestiona los datos legales y fiscales de tu empresa.',
            icon: Building,
        },
        {
          href: '/settings',
          title: 'Ajustes del Sistema',
          description: 'Configura tipos de habitación, sonidos de alerta y otros parámetros.',
          icon: Cog,
        },
        {
          href: '/users',
          title: 'Gestión de Usuarios',
          description: 'Administra los roles y accesos del personal.',
          icon: Users,
        },
        {
            href: '/reports/stays',
            title: 'Registro de Estancias',
            description: 'Consulta el historial de estancias activas y pasadas.',
            icon: FileText,
        }
      ],
    },
     {
      title: 'Ayuda y Recursos',
      scope: 'Documentación y asistencia técnica.',
      description: 'Manuales de operación y soporte técnico.',
      roles: ['Administrador', 'Recepcion', 'Conserje', 'Contador'],
      links: [
        {
          href: '/manual/operations',
          title: 'Manual Operativo',
          description: 'Guía paso a paso del flujo de trabajo.',
          icon: BookOpen,
        },
        {
          href: '/manual/project-docs',
          title: 'Documentación Técnica',
          description: 'Detalles de arquitectura, datos y flujos.',
          icon: FileCode,
          roles: ['Administrador'],
        },
        {
          href: '/help-center',
          title: 'Centro de Ayuda',
          description: 'Preguntas frecuentes y contacto técnico.',
          icon: HelpCircle,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Bienvenido a {company?.tradeName || 'Go Motel'}
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Resumen ejecutivo de métricas clave, estado de habitaciones y accesos directos a los procesos críticos del motel.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.filter(kpi => kpi.visible).map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation Sections */}
      {navSections.filter(section => section.roles.includes(userRole)).map((section) => (
          <div key={section.title} className="space-y-4">
              <div className="space-y-1 mt-4">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-4">
                      {section.title}
                      <span className="h-px flex-1 bg-primary/10"></span>
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic">
                      Módulo / Alcance: {section.scope}
                  </p>
                  <p className="text-[10px] text-muted-foreground opacity-60 leading-none mt-1">
                      {section.description}
                  </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {section.links.filter(link => !link.roles || link.roles.includes(userRole)).map((link) => (
                  <Link key={link.title} href={link.href} className="group relative" target={link.href.startsWith('/public') ? "_blank" : "_self"}>
                      {link.badge === 'PASO 1' && (
                          <div className="absolute -top-2 -right-2 z-20">
                              <div className="rounded-full border transition-colors hover:bg-primary/80 bg-accent text-accent-foreground border-accent shadow-lg animate-bounce text-[8px] font-black py-0 px-1.5 h-5 flex items-center gap-1">
                                  <Zap className="size-2.5 fill-current" />
                                  ACTIVIDAD PRINCIPAL
                              </div>
                          </div>
                      )}
                      <div className={cn(
                          "rounded-lg border text-card-foreground shadow-sm h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20",
                          link.badge === 'PASO 1' 
                          ? "border-accent border-2 ring-4 ring-accent/10 bg-accent/[0.03]"
                          : link.badge === 'PASO 2'
                          ? "border-primary border-2 ring-4 ring-primary/10 bg-primary/[0.03]"
                          : link.badge === 'NUEVO'
                          ? "border-primary/40 border-2 ring-4 ring-primary/5 bg-primary/[0.01]"
                          : link.badge === 'PÚBLICO'
                          ? "border-emerald-500/40 border-2 ring-4 ring-emerald-500/5 bg-emerald-500/[0.02]"
                          : "bg-card border-primary/5"
                      )}>
                          <div className="flex flex-col space-y-1.5 p-6 pb-3 relative">
                              {link.badge && (
                                  <div className="absolute top-4 right-4">
                                      <Badge variant="default" className={cn("font-black text-[10px] px-2 h-5",
                                        link.badge === 'PASO 1' ? 'bg-accent text-accent-foreground' : 
                                        link.badge === 'NUEVO' ? 'bg-green-600 text-white' :
                                        link.badge === 'PÚBLICO' ? 'bg-emerald-600 text-white' :
                                        'bg-primary text-primary-foreground'
                                      )}>{link.badge}</Badge>
                                  </div>
                              )}
                              <div className={cn(
                                  "mb-4 p-2.5 w-fit rounded-xl transition-all group-hover:scale-110 duration-300 border shadow-sm",
                                  link.badge === 'PASO 1' ? "text-accent bg-accent/10" : 
                                  link.badge === 'PÚBLICO' ? "text-emerald-600 bg-emerald-100" :
                                  "bg-primary/10 text-primary"
                              )}>
                                  <link.icon className="size-6" />
                              </div>
                              <h3 className="tracking-tight text-lg font-bold">{link.title}</h3>
                              <p className="text-muted-foreground text-xs font-medium leading-relaxed mt-1 line-clamp-2">
                                  {link.description}
                              </p>
                          </div>
                          <div className="flex items-center p-6 pt-0 justify-end pb-4 px-6">
                              <div className="p-1 rounded-full bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
                                  <ArrowRight className="size-3" />
                              </div>
                          </div>
                      </div>
                  </Link>
              ))}
              </div>
          </div>
      ))}
    </div>
  );
}
