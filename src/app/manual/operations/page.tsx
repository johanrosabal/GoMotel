import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble, 
    ConciergeBell, ShoppingCart, ArchiveX, Database, BookCopy, Truck, Users, 
    Percent, Smartphone, Wallet, CheckCircle
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
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {statuses.map(status => (
                            <div key={`${status.type}-${status.name}`}>
                                <span className="text-[10px] font-black uppercase text-muted-foreground">{status.type}: </span>
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

const SettingsStep = ({ icon, title, usage, useCase, href }: { icon: React.ElementType, title: string, usage: string, useCase: string, href: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 border-2 border-indigo-200 shadow-sm dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50">
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <div className="mt-1 text-sm text-muted-foreground space-y-2">
                    <p><b>Uso:</b> {usage}</p>
                    <p><b>Caso de Uso Profesional:</b> {useCase} <Link href={href} className="text-primary underline font-bold">Ir a la sección.</Link></p>
                </div>
            </div>
        </div>
    )
}

export default function ManualOperationsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-8 w-8 text-primary" />
                    Manual Operativo del Sistema
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Guía de flujos de trabajo actuales: desde la reservación con asistente hasta el cobro inteligente y control de inventarios.
                </p>
            </div>

            <Card className="border-primary/20 bg-primary/[0.01]">
                <CardHeader>
                    <CardTitle className="text-primary">Ciclo de Vida del Huésped (Flujo Actualizado)</CardTitle>
                    <CardDescription>
                        Procesos guiados para asegurar el registro correcto y la liquidación de cuentas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-16 max-w-3xl mx-auto py-8">
                        <Step
                            icon={CalendarPlus}
                            title="1. Registro con Asistente de 3 Pasos"
                            description="Toda nueva estancia utiliza un asistente guiado obligatorio: 1. Datos del Huésped (con búsqueda en CRM), 2. Configuración de Estancia (Plan de precios y fechas) y 3. Definición de Pago (Cobro inmediato o Cuenta Abierta). Solo las habitaciones 'Disponibles' son elegibles."
                            statuses={[
                                { type: 'Estado', name: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
                                { type: 'Validación', name: '3 Pasos Obligatorios', color: 'bg-green-100 text-green-800' },
                                { type: 'Habitación', name: 'Solo Disponibles', color: 'bg-indigo-100 text-indigo-800' },
                            ]}
                        />
                        <Step
                            icon={LogIn}
                            title="2. Estancia Activa e Indicadores"
                            description="Al ingresar, la habitación muestra un distintivo de estado debajo del título: 'Hospedaje Pagado' (Verde) o 'Hospedaje Pendiente' (Ámbar). Durante este tiempo se pueden añadir pedidos que descuentan stock automáticamente."
                            statuses={[
                                { type: 'Visual', name: 'Estado de Pago visible', color: 'bg-amber-100 text-amber-800' },
                                { type: 'Servicios', name: 'Descuento Stock en vivo', color: 'bg-primary/10 text-primary' },
                            ]}
                        />
                         <Step
                            icon={LogOut}
                            title="3. Check-out Inteligente"
                            description="El sistema calcula el saldo en tiempo real. Si el 'Total Pendiente' es 0.00 (porque ya pagó por adelantado), el sistema salta automáticamente al comprobante final. Si hay deuda, permite seleccionar método de pago antes de liberar la habitación."
                            statuses={[
                                { type: 'Lógica', name: 'Cobro Dinámico', color: 'bg-green-100 text-green-800' },
                                { type: 'Comprobante', name: 'WhatsApp e Impresión', color: 'bg-primary text-white border-none' },
                            ]}
                        />
                        <Step
                            icon={Sparkles}
                            title="4. Proceso de Limpieza"
                            description="Las habitaciones pasan automáticamente a 'Limpieza' al terminar la estancia. El personal debe marcarlas como 'Disponibles' para que vuelvan a aparecer en la lista de reservaciones."
                            statuses={[
                                { type: 'Estado', name: 'Limpieza Requerida', color: 'bg-yellow-100 text-yellow-800' },
                            ]}
                            isLast
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />Inventario y Compras</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                <Plus className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Entradas de Stock</h4>
                                <p className="text-sm text-muted-foreground">El registro de facturas de proveedores aumenta automáticamente el stock y actualiza el costo unitario de los productos.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                <ArchiveX className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Mermas y Ajustes</h4>
                                <p className="text-sm text-muted-foreground">Permite dar de baja productos dañados o vencidos directamente desde el inventario o la factura de compra.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Métodos de Pago</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                <Smartphone className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">SINPE Móvil con Rotación</h4>
                                <p className="text-sm text-muted-foreground">El sistema elige automáticamente la cuenta activa que no haya superado su límite mensual, asegurando la recepción de pagos.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Tarjeta y Efectivo</h4>
                                <p className="text-sm text-muted-foreground">Soporte para registro de voucher y cálculo automático de vuelto en transacciones de contado.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" />Configuraciones de Sistema</CardTitle>
                    <CardDescription>Parámetros fundamentales que controlan la lógica de negocio.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-8 pt-6 lg:grid-cols-2">
                    <SettingsStep 
                        icon={BedDouble}
                        title="Planes de Tiempo"
                        usage="Define tarifas por horas o días. El sistema calcula automáticamente la fecha de check-out basada en el plan seleccionado durante el registro."
                        useCase="Crear un plan de 4 horas para estadías cortas y uno de 12 horas para pernoctación, cada uno con su precio específico."
                        href="/settings/room-types"
                    />
                    <SettingsStep 
                        icon={BookCopy}
                        title="Catálogo de Productos"
                        usage="Diferencia productos 'Comprados' (con stock) de 'Producción Interna' (cocina/bar). Estos últimos no requieren control de existencias."
                        useCase="Configurar 'Cerveza' como producto comprado y 'Club Sándwich' como producción interna."
                        href="/catalog"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
