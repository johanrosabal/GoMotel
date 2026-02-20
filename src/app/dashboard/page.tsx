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
  TrendingUp,
  PieChart,
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
} from 'lucide-react';
import { getRooms } from '@/lib/actions/room.actions';
import { getServices } from '@/lib/actions/service.actions';
import { formatCurrency, cn } from '@/lib/utils';
import BillingTrendChart from '@/components/dashboard/charts/BillingTrendChart';
import StockDistributionChart from '@/components/dashboard/charts/StockDistributionChart';
import type { Service } from '@/types';
import { Badge } from '@/components/ui/badge';

// Define a type for navigation sections
type NavSection = {
  title: string;
  scope: string;
  description: string;
  links: {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
  }[];
};

export default async function DashboardPage() {
  const rooms = await getRooms();
  const services = await getServices();

  const totalAssetValue = services.reduce(
    (acc, service) => acc + service.price * service.stock,
    0
  );
  const occupiedRooms = rooms.filter((room) => room.status === 'Occupied');
  const expectedRevenue = occupiedRooms.reduce(
    (acc, room) => acc + room.ratePerHour,
    0
  );
  const availableRooms = rooms.filter(
    (room) => room.status === 'Available'
  ).length;
  const lowStockItems = services.filter((service) => service.stock < 10).length;

  const kpiData = [
    {
      title: 'Valor Activo (Costo)',
      value: formatCurrency(totalAssetValue),
      description: 'Capital total en bodega.',
      icon: Wallet,
    },
    {
      title: 'Ventas por Hora (Potencial)',
      value: formatCurrency(expectedRevenue),
      description: 'Ingreso por hora de hab. ocupadas.',
      icon: ShoppingCart,
    },
    {
      title: 'Habitaciones Disponibles',
      value: availableRooms,
      description: 'Unidades listas para la venta.',
      icon: BedDouble,
    },
    {
      title: 'Stock Bajo',
      value: lowStockItems,
      description: 'Artículos por debajo del punto de reorden.',
      icon: TriangleAlert,
    },
  ];

  const navSections: NavSection[] = [
    {
      title: 'Operaciones Principales',
      scope: 'Flujo de trabajo diario y atención al cliente.',
      description: 'Gestión de habitaciones, servicios y inventario.',
      links: [
        {
          href: '/reservations',
          title: 'Crear Reservaciones',
          description: 'Agenda futuras estancias para los huéspedes.',
          icon: CalendarPlus,
          badge: 'PASO 1',
        },
        {
          href: '/cleaning',
          title: 'Cola de Limpieza',
          description: 'Gestione las habitaciones que requieren limpieza.',
          icon: Sparkles,
          badge: 'PASO 2',
        },
        {
          href: '/clients',
          title: 'Gestión de Clientes',
          description: 'Cree y administre la ficha de sus clientes frecuentes.',
          icon: Users,
        },
        {
          href: '/inventory',
          title: 'Inventario de Servicios',
          description: 'Administración de productos y servicios.',
          icon: Package,
        },
      ],
    },
    {
      title: 'Administración y Configuración',
      scope: 'Seguridad, parámetros del sistema y datos maestros.',
      description: 'Ajustes del sistema y gestión de usuarios.',
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
      links: [
        {
          href: '/manual/operations',
          title: 'Manual Operativo',
          description: 'Guía paso a paso del flujo de trabajo.',
          icon: BookOpen,
        },
        {
          href: '#',
          title: 'Centro de Ayuda',
          description: 'Preguntas frecuentes y contacto técnico.',
          icon: HelpCircle,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Bienvenido, Encargado
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Resumen ejecutivo de métricas clave, estado de habitaciones y accesos directos a los procesos críticos del motel.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencia de Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
              <BillingTrendChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución de Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
              <StockDistributionChart services={services} />
          </CardContent>
        </Card>
      </div>

      {/* Navigation Sections */}
      {navSections.map((section) => (
          <div key={section.title}>
              <div className="space-y-1">
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
              {section.links.map((link) => (
                  <Link key={link.title} href={link.href} className="group relative">
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
                          : "bg-card border-primary/5"
                      )}>
                          <div className="flex flex-col space-y-1.5 p-6 pb-3 relative">
                              {link.badge?.startsWith('PASO') && (
                                  <div className="absolute top-4 right-4">
                                      <Badge variant="default" className={cn("font-black text-[10px] px-2 h-5",
                                        link.badge === 'PASO 1' ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
                                      )}>{link.badge}</Badge>
                                  </div>
                              )}
                              <div className={cn(
                                  "mb-4 p-2.5 w-fit rounded-xl transition-all group-hover:scale-110 duration-300 border shadow-sm",
                                  link.badge === 'PASO 1' ? "text-accent bg-accent/10" : "bg-primary/10 text-primary"
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
