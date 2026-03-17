import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble, 
    ConciergeBell, ShoppingCart, ArchiveX, Database, BookCopy, Truck, Users, 
    Percent, Smartphone, Wallet, CheckCircle, Plus, CreditCard, GitGraph,
    Clock, RefreshCw, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { Mermaid } from '@/components/ui/mermaid';

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

const lifecycleChart = `
graph TD
    Start[Asistente de Reservación] --> CheckType{¿Tipo de Ingreso?}
    CheckType -- "Check-in Ahora (Walk-in)" --> FilterDisp[Selector: Solo Hab. Disponibles]
    CheckType -- "Reserva Futura" --> FilterDisp
    
    FilterDisp --> Step3{Paso 3: Cobro}
    
    Step3 -- "Pago Adelantado" --> PaidState[Estado: Hospedaje Pagado]
    Step3 -- "Cuenta Abierta" --> OpenState[Estado: Hospedaje Pendiente]
    
    PaidState --> Active[Estancia Activa / Reservada]
    OpenState --> Active
    
    Active --> Services[Añadir Consumos / Servicios]
    Services --> Stock[Deducción Automática de Stock]
    
    Active --> Checkout[Check-out]
    Checkout --> Balance{¿Saldo Pendiente?}
    
    Balance -- "0.00 (Ya pagó)" --> DirectConfirm[Factura Directa]
    Balance -- "> 0.00" --> PaymentScreen[Selector de Pago]
    
    PaymentScreen -- "Efectivo / SINPE / Tarjeta" --> DirectConfirm
    
    DirectConfirm --> Cleaning[Estado: Limpieza]
    Cleaning --> Finish[Estado: Disponible]
    
    style PaidState fill:#dcfce7,stroke:#166534
    style OpenState fill:#fef3c7,stroke:#92400e
    style DirectConfirm fill:#10b981,stroke:#059669,color:#fff
    style CheckType fill:#e0e7ff,stroke:#4338ca
`;

export default function ManualOperationsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-8 w-8 text-primary" />
                    Manual Operativo del Sistema
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Guía completa de flujos de trabajo: desde la gestión de estados hasta el cobro inteligente y rotación de cuentas.
                </p>
            </div>

            <Card className="border-primary/20 bg-primary/[0.01]">
                <CardHeader>
                    <CardTitle className="text-primary flex items-center gap-2">
                        <GitGraph className="h-5 w-5" />
                        Mapa Visual del Ciclo de Vida del Huésped
                    </CardTitle>
                    <CardDescription>
                        Diagrama de flujo que detalla las decisiones de registro, cobro y cambios de estado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Mermaid chart={lifecycleChart} />
                </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/[0.01]">
                <CardHeader>
                    <CardTitle className="text-primary">Flujos Detallados</CardTitle>
                    <CardDescription>
                        Procesos guiados para asegurar el registro correcto y la liquidación de cuentas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-16 max-w-3xl mx-auto py-8">
                        <Step
                            icon={CalendarPlus}
                            title="1. Registro: Walk-in vs Reserva Futura"
                            description="El asistente permite dos modalidades: 'Check-in Inmediato' (el tiempo corre ya) o 'Reserva Futura' (agenda con fecha posterior). El selector de habitaciones filtra automáticamente para mostrar SOLO habitaciones con estado 'Disponible', evitando colisiones con unidades ocupadas o en limpieza."
                            statuses={[
                                { type: 'Filtro', name: 'Solo Disponibles', color: 'bg-green-100 text-green-800 border-green-200' },
                                { type: 'Modalidad', name: 'Inmediata / Futura', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                            ]}
                        />
                        <Step
                            icon={Wallet}
                            title="2. Gestión de Pago en el Paso 3"
                            description="Al registrar, se debe decidir: 'Pago Adelantado' (genera factura inmediata y marca la estancia como saldada) o 'Cuenta Abierta' (permite añadir cargos y cobrar al final). Si se paga por adelantado, la habitación mostrará el distintivo verde 'Hospedaje Pagado'."
                            statuses={[
                                { type: 'Control', name: 'Hospedaje Pagado', color: 'bg-green-600 text-white border-none' },
                                { type: 'Control', name: 'Hospedaje Pendiente', color: 'bg-amber-100 text-amber-800 border-amber-500' },
                            ]}
                        />
                         <Step
                            icon={LogOut}
                            title="3. Check-out Inteligente (Saldo 0.00)"
                            description="El sistema audita el saldo automáticamente. Si el huésped pagó por adelantado y no tiene consumos extras (Saldo = 0.00), el botón 'Pasar a Cobro' se transforma en 'Finalizar Check-out' y cierra la estancia en un solo clic, enviando directo al comprobante final."
                            statuses={[
                                { type: 'Lógica', name: 'Salto de Cobro Automático', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                                { type: 'Estado Final', name: 'Limpieza', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                            ]}
                        />
                        <Step
                            icon={Sparkles}
                            title="4. Ciclo de Limpieza y Disponibilidad"
                            description="Al terminar el check-out, la habitación pasa a 'Limpieza'. En este estado, NO es visible en el selector de nuevas reservaciones para asegurar que ninguna habitación sea asignada sin antes ser higienizada. Una vez lista, el personal la marca como 'Disponible'."
                            statuses={[
                                { type: 'Estado', name: 'No Elegible para Reservar', color: 'bg-red-100 text-red-800 border-red-200' },
                            ]}
                            isLast
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Métodos de Pago Avanzados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                <RefreshCw className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Rotación de Cuentas SINPE</h4>
                                <p className="text-sm text-muted-foreground">El sistema gestiona múltiples cuentas SINPE. Al elegir este método, se selecciona automáticamente la cuenta activa que aún no ha alcanzado su límite de saldo mensual, asegurando que los fondos siempre lleguen a una cuenta disponible.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Tarjeta y Voucher</h4>
                                <p className="text-sm text-muted-foreground">Para pagos con tarjeta, el sistema requiere obligatoriamente el número de voucher. Este dato queda registrado en la factura y en la estancia para facilitar auditorías de datafonos al final del día.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Alertas y Vencimientos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Detección de Atrasos</h4>
                                <p className="text-sm text-muted-foreground">El sistema monitorea en tiempo real si un huésped ha superado su hora de salida o si una reservación confirmada no ha llegado (No-show). Estas habitaciones se marcan en rojo y disparan una alerta sonora en recepción.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                                <Smartphone className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold">Envío de Comprobantes</h4>
                                <p className="text-sm text-muted-foreground">Al finalizar cualquier cobro (Hospedaje o Servicios), el sistema genera un enlace público único. Este enlace puede enviarse directamente al WhatsApp del cliente, permitiéndole descargar su factura en PDF en cualquier momento.</p>
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
