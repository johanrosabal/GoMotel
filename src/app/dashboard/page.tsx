
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
  QrCode,
  Flame,
  GlassWater,
  Globe,
  Bell,
  AlertCircle,
  Info as InfoIcon,
  Mail,
  GraduationCap,
  Utensils
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { CompanyProfile, UserRole, Room, Service } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@/components/ui/skeleton';
import { getActiveNotifications } from '@/lib/actions/notification.actions';
import { useState, useEffect, useMemo } from 'react';
import type { AppNotification } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const HOTEL_ESSENTIAL_PATHS = [
  '/reservations',
  '/dashboard/rooms',
  '/cleaning',
  '/clients',
  '/billing/invoices',
  '/finance/payments',
  '/reports',
];

const BAR_ESSENTIAL_PATHS = [
  '/kitchen',
  '/bar',
  '/pos',
  '/inventory',
  '/public/menu',
  '/public/order',
  '/finance/payments',
  '/reports',
];

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

  const productsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'products')) : null, [firestore]);
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(productsQuery);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const [activeNotifications, setActiveNotifications] = useState<AppNotification[]>([]);
  const [dashboardMode, setDashboardMode] = useState<'all' | 'hotel' | 'bar'>('all');

  useEffect(() => {
    async function fetchNotifs() {
      const notifs = await getActiveNotifications('Internal');
      setActiveNotifications(notifs);
    }
    fetchNotifs();
  }, []);

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const ordersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders'), where('status', 'in', ['Pendiente', 'En preparación'])) : null, [firestore]);
  const { data: pendingOrders } = useCollection<any>(ordersQuery);

  const barInvoicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'invoices'), where('createdAt', '>=', Timestamp.fromDate(startOfDay))) : null, [firestore, startOfDay]);
  const { data: dayInvoices } = useCollection<any>(barInvoicesQuery);

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
  
  // Bar Specific Metrics Calculation
  const barSalesToday = (dayInvoices || [])
    .filter(inv => inv.status === 'Pagada' && (inv.orderId || inv.items?.some((item: any) => item.description.toLowerCase().includes('comida') || item.description.toLowerCase().includes('bebida'))))
    .reduce((acc, inv) => acc + (inv.total || 0), 0);

  const kpiData = [
    {
      title: dashboardMode === 'bar' ? 'Pedidos Activos' : 'Valor Activo (Venta)',
      value: dashboardMode === 'bar' ? (pendingOrders?.length || 0) : formatCurrency(totalAssetValue),
      description: dashboardMode === 'bar' ? 'Órdenes en cocina o bar.' : 'Capital total proyectado en inventario.',
      icon: dashboardMode === 'bar' ? Utensils : Wallet,
      visible: ['Administrador', 'Contador', 'Cocina', 'Vendedor POS'].includes(userRole),
    },
    {
      title: dashboardMode === 'bar' ? 'Ventas Bar Hoy' : 'Ventas por Hora (Potencial)',
      value: dashboardMode === 'bar' ? formatCurrency(barSalesToday) : formatCurrency(expectedRevenue),
      description: dashboardMode === 'bar' ? 'Ingresos por venta de productos.' : 'Ingreso por hora de hab. ocupadas.',
      icon: dashboardMode === 'bar' ? GlassWater : ShoppingCart,
      visible: ['Administrador', 'Recepcion', 'Contador', 'Vendedor POS'].includes(userRole),
    },
    {
      title: 'Habitaciones Disponibles',
      value: availableRooms,
      description: 'Unidades listas para la venta.',
      icon: BedDouble,
      visible: dashboardMode !== 'bar' && ['Administrador', 'Recepcion', 'Conserje'].includes(userRole),
    },
    {
      title: 'Stock Bajo',
      value: lowStockItems,
      description: 'Artículos por debajo del punto de reorden.',
      icon: TriangleAlert,
      visible: ['Administrador', 'Contador'].includes(userRole),
    },
  ];

  const navSections: NavSection[] = [
    {
      title: 'Centros de Preparación',
      scope: 'Gestión de colas de producción en tiempo real.',
      description: 'Pantallas para Cocineros y Bartenders.',
      roles: ['Administrador', 'Conserje', 'Contador', 'Vendedor POS', 'Cocina'],
      links: [
        {
          href: '/kitchen',
          title: 'Cola de Cocina',
          description: 'Gestione los pedidos de comida en preparación.',
          icon: Flame,
          badge: 'ENVIVO',
          roles: ['Administrador', 'Conserje', 'Contador', 'Cocina'],
        },
        {
          href: '/bar',
          title: 'Cola de Bar',
          description: 'Gestione los pedidos de bebidas en preparación.',
          icon: GlassWater,
          badge: 'ENVIVO',
          roles: ['Administrador', 'Conserje', 'Contador', 'Vendedor POS'],
        },
      ],
    },
    {
      title: 'Operaciones Principales',
      scope: 'Flujo de trabajo diario y atención al cliente.',
      description: 'Gestión de habitaciones, servicios y inventario.',
      roles: ['Administrador', 'Recepcion', 'Conserje', 'Vendedor POS'],
      links: [
        {
          href: '/pos',
          title: 'Venta Directa (POS)',
          description: 'Venda productos sin vincular a una habitación.',
          icon: ShoppingBasket,
          badge: 'NUEVO',
          roles: ['Administrador', 'Vendedor POS'],
        },
        {
          href: '/reservations',
          title: 'Crear Reservaciones',
          description: 'Agenda futuras estancias para los huéspedes.',
          icon: CalendarPlus,
          badge: 'SECUNDARIA',
          roles: ['Administrador', 'Recepcion'],
        },
        {
          href: '/dashboard/rooms',
          title: 'Panel de Habitaciones',
          description: 'Vista y estado interactivo de todas las unidades.',
          icon: LayoutGrid,
          badge: 'PRINCIPAL',
          roles: ['Administrador', 'Recepcion', 'Conserje'],
        },
        {
          href: '/cleaning',
          title: 'Cola de Limpieza',
          description: 'Gestione las habitaciones que requieren limpieza.',
          icon: Sparkles,
          badge: 'MONITOREO',
          roles: ['Administrador', 'Recepcion', 'Conserje'],
        },
        {
          href: '/clients',
          title: 'Gestión de Clientes',
          description: 'Cree y administre la ficha de sus clientes frecuentes.',
          icon: Users,
          badge: 'TERCIARIA',
          roles: ['Administrador', 'Recepcion', 'Vendedor POS'],
        },
        {
          href: '/inventory',
          title: 'Gestión de Inventario',
          description: 'Controle los niveles de stock y el valor de sus activos.',
          icon: Package,
          roles: ['Administrador', 'Contador'],
        },
      ],
    },
    {
      title: 'Marketing y Visualización',
      scope: 'Pantallas públicas y promoción.',
      description: 'Configuración de menús digitales y pedidos remotos.',
      roles: ['Administrador'],
      links: [
        {
          href: '/public/menu',
          title: 'Menú Digital (TV)',
          description: 'Abrir pantalla pública para televisores en modo kiosko.',
          icon: MonitorPlay,
          badge: 'PÚBLICO',
        },
        {
          href: '/public/order',
          title: 'Auto-Pedido (Móvil)',
          description: 'Interfaz para que el cliente pida desde su mesa vía QR.',
          icon: QrCode,
          badge: 'PÚBLICO',
        },
        {
          href: '/marketing',
          title: 'Centro de Marketing',
          description: 'Gestione plantillas de correo y notificaciones para sus clientes.',
          icon: Mail,
          badge: 'NUEVO',
        },
        {
          href: '/',
          title: 'Sitio Web Público',
          description: 'Vista previa de la página de aterrizaje y reservaciones externa.',
          icon: Globe,
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
            href: '/finance/payments',
            title: 'Resumen de Pagos',
            description: 'Historial detallado y saldos por Efectivo, SINPE y Tarjeta.',
            icon: Wallet,
            badge: 'NUEVO',
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
            href: '/reports/stays',
            title: 'Registro de Estancias',
            description: 'Consulta el historial de estancias activas y pasadas.',
            icon: FileText,
            roles: ['Administrador', 'Contador', 'Recepcion'],
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
      title: 'Administración y Seguridad',
      scope: 'Configuración de seguridad y operación global.',
      description: 'Panel general de ajustes y gestión de usuarios.',
      roles: ['Administrador'],
      links: [
        {
          href: '/settings',
          title: 'Ajustes del Sistema',
          description: 'Configura tipos de habitación, sonidos, catálogo, CMS y otros parámetros maestros de Hotel Du Manolo.',
          icon: Cog,
          badge: 'MAESTRO',
        },
        {
          href: '/users',
          title: 'Gestión de Usuarios',
          description: 'Administra los roles, pines y accesos del personal.',
          icon: Users,
        },
        {
          href: '/dashboard/tutorials/manage',
          title: 'Gestión de Tutoriales',
          description: 'Administre el contenido educativo del centro de aprendizaje.',
          icon: GraduationCap,
        },
      ],
    },
     {
      title: 'Ayuda y Recursos',
      scope: 'Documentación y asistencia técnica.',
      description: 'Manuales de operación y soporte técnico.',
      roles: ['Administrador', 'Recepcion', 'Conserje', 'Contador', 'Vendedor POS', 'Cocina'],
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
        {
          href: '/manual/tutorials',
          title: 'Tutoriales y Aprendizaje',
          description: 'Centro de formación interactivo con video-guías para su equipo.',
          icon: MonitorPlay,
          badge: 'NUEVO',
        },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:py-8 space-y-8">
      <div className="space-y-1.5 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Bienvenido a {company?.tradeName || 'Go Motel'}
          </h1>
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border flex items-center gap-1.5",
            process.env.NODE_ENV === 'production' 
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse",
              process.env.NODE_ENV === 'production' ? "bg-emerald-500" : "bg-amber-500"
            )} />
            {process.env.NODE_ENV === 'production' ? 'Ambiente PROD' : 'Ambiente DEV'}
            <span className="opacity-40">|</span>
            <span className="opacity-60">{firebaseConfig.projectId}</span>
          </div>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Resumen ejecutivo de métricas clave, estado de habitaciones y accesos directos a los procesos críticos del motel.
        </p>
      </div>

      {/* Mode Selector - Restrict to Administrator only */}
      {userRole === 'Administrador' && (
        <div className="flex justify-center md:justify-start">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl">
            <button
              onClick={() => setDashboardMode('all')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                dashboardMode === 'all' 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" />
              Vista Completa
            </button>
            <button
              onClick={() => setDashboardMode('hotel')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                dashboardMode === 'hotel' 
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20 scale-105" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building className="size-3.5" />
              Operación Hotel
            </button>
            <button
              onClick={() => setDashboardMode('bar')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                dashboardMode === 'bar' 
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40 scale-105" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Utensils className="size-3.5" />
              Operación Bar
            </button>
          </div>
        </div>
      )}

      {activeNotifications.length > 0 && (
        <div className="space-y-3">
          {activeNotifications.map((notif) => (
            <div 
              key={notif.id} 
              className={cn(
                "p-4 rounded-xl border flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-500",
                notif.priority === 'High' ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50 text-red-900 dark:text-red-200" :
                notif.priority === 'Medium' ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 text-amber-900 dark:text-amber-200" :
                "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 text-blue-900 dark:text-blue-200"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                notif.priority === 'High' ? "bg-red-100 dark:bg-red-900/40" :
                notif.priority === 'Medium' ? "bg-amber-100 dark:bg-amber-900/40" :
                "bg-blue-100 dark:bg-blue-900/40"
              )}>
                {notif.priority === 'High' ? <AlertCircle className="h-5 w-5" /> : 
                 notif.priority === 'Medium' ? <Bell className="h-5 w-5" /> : 
                 <InfoIcon className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-sm uppercase tracking-tight">{notif.title}</h4>
                <p className="text-sm opacity-90 leading-relaxed">{notif.message}</p>
                <div className="text-[10px] opacity-60 font-medium">Publicado el: {new Date(typeof notif.startDate === 'number' ? notif.startDate : (notif.startDate as any).toMillis?.() || Date.now()).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

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
      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {navSections
            .filter(section => section.roles.includes(userRole))
            .map((section) => {
              const filteredLinks = dashboardMode === 'hotel' 
                ? section.links.filter(link => HOTEL_ESSENTIAL_PATHS.some(path => link.href.startsWith(path)))
                : dashboardMode === 'bar'
                ? section.links.filter(link => BAR_ESSENTIAL_PATHS.some(path => link.href.startsWith(path)))
                : section.links;

              if (filteredLinks.length === 0) return null;

              return (
                <motion.div 
                  key={section.title} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-4"
                >
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
                  {filteredLinks.filter(link => !link.roles || link.roles.includes(userRole)).map((link) => (
                      <Link key={link.title} href={link.href} className="group relative" target={link.href.startsWith('/public') ? "_blank" : "_self"} id={`dashboard-link-${link.href.replaceAll('/', '-').replace(/^-/, '')}`} data-testid="dashboard-action-link">
                          {link.badge === 'PRINCIPAL' && (
                              <div className="absolute -top-2 -right-2 z-20">
                                  <div className="rounded-full border transition-colors hover:bg-primary/80 bg-accent text-accent-foreground border-accent shadow-lg animate-bounce text-[8px] font-black py-0 px-1.5 h-5 flex items-center gap-1">
                                      <Zap className="size-2.5 fill-current" />
                                      ACTIVIDAD PRINCIPAL
                                  </div>
                              </div>
                          )}
                          {link.badge === 'SECUNDARIA' && (
                              <div className="absolute -top-2 -right-2 z-20">
                                  <div className="rounded-full border transition-colors hover:bg-blue-600 bg-blue-500 text-white border-blue-400 shadow-lg text-[8px] font-black py-0 px-1.5 h-5 flex items-center gap-1">
                                      <LayoutGrid className="size-2.5 fill-current" />
                                      ACTIVIDAD SECUNDARIA
                                  </div>
                              </div>
                          )}
                          {link.badge === 'MONITOREO' && (
                              <div className="absolute -top-2 -right-2 z-20">
                                  <div className="rounded-full border transition-colors hover:bg-orange-600 bg-orange-500 text-white border-orange-400 shadow-lg text-[8px] font-black py-0 px-1.5 h-5 flex items-center gap-1">
                                      <MonitorPlay className="size-2.5 fill-current" />
                                      MONITOREO DE ACTIVIDAD
                                  </div>
                              </div>
                          )}
                          {link.badge === 'TERCIARIA' && (
                              <div className="absolute -top-2 -right-2 z-20">
                                  <div className="rounded-full border transition-colors hover:bg-slate-700 bg-slate-600 text-white border-slate-500 shadow-lg text-[8px] font-black py-0 px-1.5 h-5 flex items-center gap-1">
                                      <Users className="size-2.5 fill-current" />
                                      ACTIVIDAD TERCIARIA
                                  </div>
                              </div>
                          )}
                          <div className={cn(
                              "rounded-lg border text-card-foreground shadow-sm h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20",
                              link.badge === 'PRINCIPAL' 
                              ? "border-accent border-2 ring-4 ring-accent/10 bg-accent/[0.03]"
                              : link.badge === 'SECUNDARIA'
                              ? "border-blue-500/40 border-2 ring-4 ring-blue-500/10 bg-blue-500/[0.03]"
                              : link.badge === 'MONITOREO'
                              ? "border-orange-500/40 border-2 ring-4 ring-orange-500/5 bg-orange-500/[0.02]"
                              : link.badge === 'TERCIARIA'
                              ? "border-slate-500/40 border-2 ring-4 ring-slate-500/5 bg-slate-500/[0.02]"
                              : link.badge === 'PASO 2'
                              ? "border-primary border-2 ring-4 ring-primary/10 bg-primary/[0.03]"
                              : link.badge === 'NUEVO'
                              ? "border-primary/40 border-2 ring-4 ring-primary/5 bg-primary/[0.01]"
                              : link.badge === 'PÚBLICO'
                              ? "border-emerald-500/40 border-2 ring-4 ring-emerald-500/5 bg-emerald-500/[0.02]"
                              : link.badge === 'ENVIVO'
                              ? "border-orange-500/40 border-2 ring-4 ring-orange-500/5 bg-orange-500/[0.02]"
                              : "bg-card border-primary/5"
                          )}>
                              <div className="flex flex-col space-y-1.5 p-6 pb-3 relative">
                                  {link.badge && (
                                      <div className="absolute top-4 right-4">
                                          <Badge variant="default" className={cn("font-black text-[10px] px-2 h-5",
                                            link.badge === 'PRINCIPAL' ? 'bg-accent text-accent-foreground' : 
                                            link.badge === 'SECUNDARIA' ? 'bg-blue-600 text-white' : 
                                            link.badge === 'MONITOREO' ? 'bg-orange-600 text-white' :
                                            link.badge === 'TERCIARIA' ? 'bg-slate-600 text-white' :
                                            link.badge === 'NUEVO' ? 'bg-green-600 text-white' :
                                            link.badge === 'PÚBLICO' ? 'bg-emerald-600 text-white' :
                                            link.badge === 'ENVIVO' ? 'bg-orange-600 text-white' :
                                            'bg-primary text-primary-foreground'
                                          )}>{link.badge}</Badge>
                                      </div>
                                  )}
                                  <div className={cn(
                                      "mb-4 p-2.5 w-fit rounded-xl transition-all group-hover:scale-110 duration-300 border shadow-sm",
                                      link.badge === 'PRINCIPAL' ? "text-accent bg-accent/10" : 
                                      link.badge === 'SECUNDARIA' ? "text-blue-600 bg-blue-100 dark:bg-blue-900/50" : 
                                      link.badge === 'MONITOREO' ? "text-orange-600 bg-orange-100" :
                                      link.badge === 'TERCIARIA' ? "text-slate-400 bg-slate-100 dark:bg-slate-900/50" : 
                                      link.badge === 'PÚBLICO' ? "text-emerald-600 bg-emerald-100" :
                                      link.badge === 'ENVIVO' ? "text-orange-600 bg-orange-100" :
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
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}
