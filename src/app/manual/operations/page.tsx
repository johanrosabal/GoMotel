import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble, 
    ConciergeBell, ShoppingCart, ArchiveX, Database, BookCopy, Truck, Users, 
    Percent, Smartphone 
} from 'lucide-react';
import Link from 'next/link';

const Step = ({ icon, title, description, statuses, isLast = false }: { icon: React.ElementType, title: string, description: string, statuses: { type: string, name: string, color: string }[], isLast?: boolean }) => {
    const Icon = icon;
    return (
        <div className="relative">
            <div className="flex items-start gap-6">
                <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border-2 border-primary/20 shadow-sm">
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
                <div className="flex-1 pt-1.5">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-muted-foreground">{description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {statuses.map(status => (
                            <div key={`${status.type}-${status.name}`}>
                                <span className="text-xs font-semibold text-muted-foreground">{status.type}: </span>
                                <Badge variant="outline" className={status.color}>{status.name}</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {!isLast && <ArrowDown className="absolute left-6 -bottom-10 h-8 w-8 -translate-x-1/2 text-border" />}
        </div>
    );
};

const SettingsStep = ({ icon, title, description, href }: { icon: React.ElementType, title: string, description: string, href: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 border-2 border-indigo-200 shadow-sm dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50">
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground">
                    {description} <Link href={href} className="text-primary underline">Ir a la sección.</Link>
                </p>
            </div>
        </div>
    )
}

export default function ManualOperationsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-8 w-8" />
                    Manual Operativo del Sistema
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Una guía completa sobre los flujos de trabajo principales de la aplicación, desde la gestión de huéspedes hasta el control de inventario y configuraciones.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ciclo de Vida del Huésped</CardTitle>
                    <CardDescription>
                        Desde la reservación inicial hasta que la habitación está lista para el siguiente cliente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-16 max-w-3xl mx-auto py-8">
                        <Step
                            icon={CalendarPlus}
                            title="Paso 1: Reservación o Check-in Directo"
                            description="Inicie el proceso agendando una reservación para una fecha futura o realizando un check-in inmediato (walk-in). Puede registrar pagos por adelantado (generando una factura inicial) o manejarlo como 'Cuenta Abierta'."
                            statuses={[
                                { type: 'Reservación', name: 'Confirmada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
                                { type: 'Habitación', name: 'Disponible', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
                                { type: 'Pago', name: 'Pagado / Pendiente', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
                            ]}
                        />
                        <Step
                            icon={LogIn}
                            title="Paso 2: Estancia Activa del Huésped"
                            description="Una vez que el huésped hace check-in, se crea una 'Estancia' activa. Durante este tiempo, puede añadir pedidos de servicio (comida, bebidas) y extender la duración de la estancia según sea necesario."
                            statuses={[
                                { type: 'Habitación', name: 'Ocupada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
                                { type: 'Pedido', name: 'Entregado', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400' },
                                { type: 'Estancia', name: 'Extendida', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
                            ]}
                        />
                         <Step
                            icon={LogOut}
                            title="Paso 3: Check-out y Facturación Final"
                            description="Al finalizar, el sistema calcula la factura final, sumando los cargos de la habitación y todos los servicios consumidos, y restando cualquier pago adelantado. La habitación pasa automáticamente a limpieza."
                            statuses={[
                                { type: 'Estancia', name: 'Completada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
                                { type: 'Factura', name: 'Pagada', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
                                { type: 'Habitación', name: 'Limpieza', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
                            ]}
                        />
                        <Step
                            icon={Sparkles}
                            title="Paso 4: Proceso de Limpieza"
                            description="Las habitaciones que requieren atención aparecen en la 'Cola de Limpieza'. El personal de limpieza se encarga de prepararlas."
                            statuses={[
                                { type: 'Habitación', name: 'Limpieza', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
                            ]}
                        />
                        <Step
                            icon={BedDouble}
                            title="Paso 5: Habitación Disponible"
                            description="Una vez finalizada la limpieza, la habitación se marca como 'Disponible' desde la cola de limpieza o los detalles de la habitación, dejándola lista para el próximo ciclo."
                            statuses={[
                                { type: 'Habitación', name: 'Disponible', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
                            ]}
                            isLast
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Flujo de Inventario y Compras</CardTitle>
                    <CardDescription>
                        Cómo se gestionan las existencias de los productos comprados y de producción interna.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 border-2 border-blue-200 shadow-sm dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50">
                            <ShoppingCart className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">1. Registrar Compra</h3>
                            <p className="text-muted-foreground">Vaya a <Link href="/purchases" className="text-primary underline">Historial de Compras</Link> y registre una nueva factura de su proveedor. Esto añadirá automáticamente las cantidades compradas al stock de cada producto.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 border-2 border-green-200 shadow-sm dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50">
                            <ConciergeBell className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">2. Descuento por Venta</h3>
                            <p className="text-muted-foreground">Cuando un huésped pide un servicio, el stock de los productos 'Comprados' se descuenta automáticamente al crear el pedido. Los productos de 'Producción Interna' no descuentan stock.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 border-2 border-red-200 shadow-sm dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50">
                            <ArchiveX className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">3. Registro de Merma</h3>
                            <p className="text-muted-foreground">Si un producto se daña o vence, puede registrar una merma desde el <Link href="/purchases" className="text-primary underline">Historial de Compras</Link> para ajustar el inventario y mantener los datos precisos.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" />Datos Maestros y Configuraciones</CardTitle>
                    <CardDescription>
                        Aprenda a configurar los parámetros fundamentales que controlan las operaciones del motel.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <SettingsStep 
                        icon={BedDouble}
                        title="Tipos de Habitación"
                        description="Defina las categorías de sus habitaciones (ej. Sencilla, Suite), su capacidad, características y, lo más importante, los planes de precios que se usarán para la facturación."
                        href="/settings/room-types"
                    />
                    <SettingsStep 
                        icon={BookCopy}
                        title="Catálogo de Productos y Servicios"
                        description="Organice su inventario creando categorías y subcategorías. Añada productos, establezca precios, y gestione el stock para productos comprados y la disponibilidad para los de cocina."
                        href="/catalog"
                    />
                    <SettingsStep 
                        icon={Truck}
                        title="Proveedores"
                        description="Mantenga un registro de sus proveedores. Almacenar esta información facilita y agiliza el registro de nuevas facturas de compra."
                        href="/suppliers"
                    />
                     <SettingsStep 
                        icon={Users}
                        title="Clientes"
                        description="Cree una base de datos de sus clientes para agilizar el proceso de check-in, registrar sus visitas y ofrecer un servicio personalizado marcándolos como VIP."
                        href="/clients"
                    />
                     <SettingsStep 
                        icon={Percent}
                        title="Impuestos"
                        description="Configure los diferentes tipos de impuestos (ej. IVA) que se aplicarán a los productos y servicios vendidos en su motel."
                        href="/settings/taxes"
                    />
                     <SettingsStep 
                        icon={Smartphone}
                        title="Cuentas SINPE Móvil"
                        description="Administre las cuentas bancarias que utiliza para recibir pagos mediante SINPE Móvil, incluyendo la configuración de límites de saldo mensuales para la rotación automática."
                        href="/settings/sinpe-accounts"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
