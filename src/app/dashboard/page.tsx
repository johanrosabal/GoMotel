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
} from 'lucide-react';
import { getRooms } from '@/lib/actions/room.actions';
import { getServices } from '@/lib/actions/service.actions';
import { formatCurrency } from '@/lib/utils';
import BillingTrendChart from '@/components/dashboard/charts/BillingTrendChart';
import StockDistributionChart from '@/components/dashboard/charts/StockDistributionChart';
import type { Service } from '@/types';

// Define a type for navigation sections
type NavSection = {
  title: string;
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
      description: 'Gestión de habitaciones, servicios y inventario.',
      links: [
        {
          href: '/dashboard/rooms',
          title: 'Panel de Habitaciones',
          description: 'Vista y gestión de todas las habitaciones.',
          icon: LayoutGrid,
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
      description: 'Ajustes del sistema y gestión de usuarios.',
      links: [
        {
          href: '/settings/room-types',
          title: 'Tipos de Habitación',
          description: 'Define las categorías de tus habitaciones.',
          icon: Cog,
        },
        {
          href: '#', // Placeholder for user management
          title: 'Gestión de Usuarios',
          description: 'Administra los roles y accesos del personal.',
          icon: Users,
        },
        {
            href: '#', // Placeholder for reports
            title: 'Reportes',
            description: 'Visualiza reportes de ventas y ocupación.',
            icon: FileText,
        }
      ],
    },
     {
      title: 'Ayuda y Recursos',
      description: 'Manuales de operación y soporte técnico.',
      links: [
        {
          href: '#',
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
    <div className="flex-1 bg-background text-foreground">
      <main className="p-4 sm:p-6 lg:p-8 space-y-8">
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
                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {section.links.map((link) => (
                    <Link key={link.title} href={link.href} className="group">
                        <Card className="h-full hover:border-primary transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-base font-semibold">
                                    {link.title}
                                </CardTitle>
                                <link.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{link.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
                </div>
            </div>
        ))}
      </main>
    </div>
  );
}
