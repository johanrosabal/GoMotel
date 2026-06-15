import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble, 
    ConciergeBell, ShoppingCart, ArchiveX, Database, BookCopy, Truck, Users, 
    Percent, Smartphone, Wallet, CheckCircle, Plus, CreditCard, GitGraph,
    Clock, RefreshCw, AlertTriangle, Utensils, LayoutGrid, Receipt
} from 'lucide-react';
import Link from 'next/link';
import { Mermaid } from '@/components/ui/mermaid';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const Step = ({ icon, title, description, statuses, isLast = false }: { icon: React.ElementType, title: string, description: string, statuses: { type: string, name: string, color: string }[], isLast?: boolean }) => {
    const Icon = icon;
    return (
        <div className="relative">
            <div className="flex items-start gap-6">
                <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary border-2 border-primary shadow-sm">
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 border-2 border-indigo-200 shadow-sm dark:bg-indigo-900 dark:text-indigo-400 dark:border-indigo-800">
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <div className="mt-1 text-sm text-muted-foreground space-y-2">
                    <p><b>Uso:</b> {usage}</p>
                    <p><b>Caso de Uso Profesional:</b> {useCase} <Link href={href} className="text-primary underline font-bold" id="page-link-ir-a-la" data-testid="operations-action-link">Ir a la sección.</Link></p>
                </div>
            </div>
        </div>
    )
}

const TestCase = ({ id, description, precondition, steps, data, expectedResult }: { id: string, description: string, precondition: string, steps: string[], data: string, expectedResult: string }) => {
    return (
        <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <p className="text-xs font-black uppercase text-primary">{id}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                <div><b className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">Descripción:</b><p>{description}</p></div>
                <div><b className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">Precondición:</b><p>{precondition}</p></div>
                <div><b className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">Datos (Data):</b><p>{data}</p></div>
                <div><b className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">Resultado Esperado:</b><p>{expectedResult}</p></div>
            </div>
            <div className="text-sm text-slate-300">
                <b className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">Pasos (Steps):</b>
                <ol className="list-decimal pl-5 space-y-1">
                    {steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
            </div>
        </div>
    );
}

const lifecycleChart = `
graph TD
    Start[Asistente de Reservación] --> CheckBlacklist{¿Está en Lista Negra?}
    CheckBlacklist -- "Sí" --> Deny[Acceso Denegado]
    CheckBlacklist -- "No" --> CheckType{¿Tipo de Ingreso?}
    
    CheckType -- "Check-in Ahora (Walk-in)" --> FilterDisp[Selector: Solo Hab. Disponibles]
    CheckType -- "Reserva Futura" --> FilterDisp
    
    FilterDisp --> Step3{Paso 3: Cobro}
    
    Step3 -- "Pago Adelantado" --> PaidState[Estado: Hospedaje Pagado]
    Step3 -- "Cuenta Abierta" --> OpenState[Estado: Hospedaje Pendiente]
    
    PaidState --> Active[Estancia Activa o Reservada]
    OpenState --> Active
    
    Active --> Services[Añadir Consumos o Servicios]
    Services --> Stock[Deducción Automática de Stock]
    
    Active --> Checkout[Check-out]
    Checkout --> ApplyTaxes[Cálculo de Impuestos]
    ApplyTaxes --> Balance{¿Saldo Pendiente?}
    
    Balance -- "0.00 (Ya pagó)" --> DirectConfirm[Factura Directa]
    Balance -- "> 0.00" --> PaymentScreen[Selector de Pago]
    
    PaymentScreen -- "Efectivo o SINPE o Tarjeta" --> DirectConfirm
    
    DirectConfirm --> Cleaning[Estado: Limpieza]
    Cleaning --> Finish[Estado: Disponible]
    
    style PaidState fill:#dcfce7,stroke:#166534,color:#000
    style OpenState fill:#fef3c7,stroke:#92400e,color:#000
    style DirectConfirm fill:#10b981,stroke:#059669,color:#fff
    style CheckType fill:#e0e7ff,stroke:#4338ca,color:#000
    style Deny fill:#fecaca,stroke:#b91c1c,color:#000
`;

const qrFlowChart = `
graph TD
    Client[Cliente: Escanea QR en Mesa] --> Menu[Accede a Menú Digital]
    Menu --> Cart[Arma Carrito con Notas]
    Cart --> Checkout[Confirma Pedido]
    
    Checkout --> System{¿Cuenta Activa?}
    System -- Sí --> AddItems[Añade ítems a cuenta]
    System -- No --> CreateAccount[Crea nueva 'Cuenta de Mesa']
    
    AddItems --> Queue[Cola de Cocina y Barra]
    CreateAccount --> Queue
    
    Queue --> Prep[Staff: Estado 'Cocinando']
    Prep --> Ready[Staff: Estado 'Entregado']
    
    Ready --> POS[Cajero visualiza consumos en POS]
    POS --> ClientPay{Cliente Pide la Cuenta}
    
    ClientPay --> PayProcess[Pago: Efectivo, SINPE o Tarjeta]
    PayProcess --> DirectInvoice[Facturación Final]
    
    DirectInvoice --> Inventory[Deducción de Stock e Histórico]
    Inventory --> FreeTable[Libera Ubicación]
    
    style Queue fill:#e0e7ff,stroke:#4338ca,color:#111827
    style Prep fill:#fef3c7,stroke:#92400e,color:#111827
    style Ready fill:#dcfce7,stroke:#166534,color:#111827
    style DirectInvoice fill:#10b981,stroke:#059669,color:#fff
    style FreeTable fill:#f3f4f6,stroke:#4b5563,color:#111827
`;

const clientBlacklistFlow = `
graph TD
    Admin[Administrador] --> FindClient[Busca Cliente en Activos]
    FindClient --> Action[Selecciona 'Mover a Lista Negra']
    Action --> Reason[Ingresa Motivo del Bloqueo]
    Reason --> Save[Guarda Cambios]
    Save --> Blacklist[Cliente en Lista Negra]
    
    CheckIn[Recepcionista: Intenta Check-in] --> Verify[Sistema Verifica Cédula]
    Verify --> Check{¿Está en Lista Negra?}
    Check -- "Sí" --> Alert[Alerta de Bloqueo]
    Alert --> DenyEntry[Denegar Entrada]
    Check -- "No" --> Proceed[Proceder con Check-in]
    
    style Blacklist fill:#fecaca,stroke:#b91c1c,color:#000
    style Alert fill:#fecaca,stroke:#b91c1c,color:#000
`;

const sinpeFlow = `
graph TD
    Client[Cliente] --> Pay[Paga por SINPE Móvil]
    Pay --> SendComprobante[Envía Comprobante]
    Admin[Cajero] --> VerifyApp[Verifica en App Bancaria]
    VerifyApp --> SelectAccount[Selecciona Cuenta SINPE en POS]
    SelectAccount --> Record[Registra Pago]
    Record --> Accumulate[Suma al Saldo de la Cuenta]
    Accumulate --> CheckLimit{¿Supera Límite?}
    CheckLimit -- "Sí" --> Warn[Alerta de Límite Superado]
    CheckLimit -- "No" --> Done[Venta Completada]
    
    style Warn fill:#fef3c7,stroke:#92400e,color:#000
`;

const productCatalogFlow = `
graph TD
    Admin[Administrador] --> CreateCat[Crea Categoría]
    CreateCat --> CreateSub[Crea Subcategoría]
    CreateSub --> CreateProd[Crea Producto]
    CreateProd --> SetFields[Asigna Precio, Stock e Impuestos]
    SetFields --> SaveProd[Guarda Producto]
    SaveProd --> POS[Disponible en POS]
`;

export default function ManualOperationsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-primary" />
                        Manual Operativo del Sistema
                    </h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Guía completa de flujos de trabajo: desde la gestión de estados hasta el cobro inteligente y rotación de cuentas.
                    </p>
                </div>
                <Link href="/manual/print" target="_blank" className="shrink-0">
                    <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                        <Receipt className="h-5 w-5" />
                        Versión de Impresión (PDF)
                    </button>
                </Link>
            </div>
            
            <div className="space-y-8">
                <Card className="border-primary bg-background">
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

            <Card className="border-indigo-200 bg-indigo-50/10">
                <CardHeader>
                    <CardTitle className="text-indigo-600 flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        Flujo de Pedidos por QR y POS
                    </CardTitle>
                    <CardDescription>
                        Proceso de auto-servicio para clientes y gestión de barra/cocina en tiempo real.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="rounded-xl border border-indigo-200 bg-white p-2 overflow-hidden shadow-inner dark:bg-indigo-950 dark:border-indigo-800">
                        <Mermaid chart={qrFlowChart} />
                    </div>
                    <div className="space-y-12 max-w-3xl mx-auto py-8">
                        <Step
                            icon={Smartphone}
                            title="1. Auto-Servicio por QR"
                            description="El cliente escanea el código en su mesa y accede al menú digital. Al confirmar su carrito, el sistema crea automáticamente una 'Cuenta de Mesa' o añade los productos a la cuenta activa, notificando instantáneamente a la Cocina o Barra."
                            statuses={[
                                { type: 'Acceso', name: 'Escaneo de QR', color: 'bg-indigo-100 text-indigo-800' },
                                { type: 'Integración', name: 'Sincronización POS', color: 'bg-green-100 text-green-800' },
                            ]}
                        />
                        <Step
                            icon={Utensils}
                            title="2. Preparación y Rastreo en Vivo"
                            description="Cada producto aparece en la Cola de Cocina. El personal actualiza el estado (Pendiente -> Cocinando -> Entregado). El cliente ve estos cambios en su celular en tiempo real, reduciendo la ansiedad de espera y mejorando la percepción de servicio."
                            statuses={[
                                { type: 'Estado', name: 'Pendiente / Listo', color: 'bg-amber-100 text-amber-800' },
                                { type: 'Feedback', name: 'Real-time Client UI', color: 'bg-blue-600 text-white border-none' },
                            ]}
                        />
                        <Step
                            icon={CreditCard}
                            title="3. Pago Consolidado en POS"
                            description="Al finalizar, el cajero ve el consumo acumulado en el POS. Puede procesar el pago mediante Efectivo, Tarjeta o SINPE Móvil. Al facturar, el sistema libera la ubicación para el siguiente cliente y guarda el histórico de mermas e inventario automáticamente."
                            statuses={[
                                { type: 'Cierre', name: 'Facturación Final', color: 'bg-green-600 text-white' },
                            ]}
                            isLast
                        />
                    </div>
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

            <div className="space-y-8">
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
                        usage="Diferencia productos 'Comprados' (con stock) de 'Producción Interna' (cocina o bar). Estos últimos no requieren control de existencias."
                        useCase="Configurar 'Cerveza' como producto comprado y 'Club Sándwich' como producción interna."
                        href="/catalog"
                    />
                </CardContent>
            </Card>

            <div className="space-y-6">
                <div className="space-y-6 pt-4">
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <LayoutGrid className="h-6 w-6 text-primary" />
                    Manual por Pantalla (Dashboard Admin)
                </h2>
                
                {/* Panel de Habitaciones */}
                <Card className="border-primary bg-background">
                    <CardHeader>
                        <CardTitle className="text-primary flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5" />
                            Panel de Habitaciones
                        </CardTitle>
                        <CardDescription>
                            Monitoreo y gestión del estado de todas las habitaciones en tiempo real.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Permitir a la recepción y administración visualizar qué habitaciones están libres, ocupadas, en limpieza o mantenimiento, y gestionar los ingresos y salidas.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Opciones del Panel Izquierdo (Barra Lateral)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><b>Panel de Habitaciones:</b> Es tu centro de mando. Aquí ves y controlas todas las habitaciones.</p>
                                <p><b>Venta Directa (POS):</b> Usa esto para vender productos a clientes que no están en una habitación.</p>
                                <p><b>Facturación:</b> Aquí buscas y revisas facturas pasadas o anulas errores.</p>
                                <p><b>Inventario:</b> Para revisar cuánto stock queda de cada producto.</p>
                                <p><b>Reportes:</b> Para ver las ganancias del día y estadísticas.</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pasos de Uso</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><b>1. Ver Estados:</b> Cada habitación tiene un color que indica su estado (Verde: Disponible, Rojo: Ocupada, Amarillo: Limpieza, Gris: Mantenimiento).</p>
                                <p><b>2. Acciones Rápidas:</b> Haz clic en una habitación para abrir el modal de acciones. Si está libre, puedes iniciar un Check-in. Si está ocupada, puedes agregar consumos o iniciar Check-out.</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Explicación del Modal de Habitación</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en una habitación, se abre un modal con dos paneles:</p>
                                <p><b>Panel Izquierdo:</b> Muestra la información básica de la suite (Nombre, Tarifa Base, Capacidad, Descripción) y el botón principal <b>REGISTRAR HUÉSPED</b>.</p>
                                <p><b>Panel Derecho:</b> Si la suite está disponible, muestra el estado 'SUITE DISPONIBLE' y el botón <b>INICIAR ESTANCIA</b>.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">Vista de la Habitación (Modal)</p>
                                    <img src="/media__1778796813688.png" alt="Modal de Habitación" className="rounded-xl border border-white" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">Formulario de Registro Rápido</p>
                                    <img src="/media__1778796879604.png" alt="Registro Rápido" className="rounded-xl border border-white" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Explicación de la Ficha de Estancia Activa</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Cuando una habitación está ocupada, el modal muestra la información detallada de la estancia en curso:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Campos de Información:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Estado de Pago:</b> Indica si la estancia ya fue cancelada (Hospedaje Pagado) o si está pendiente.</li>
                                            <li><b>Tarifa Seleccionada:</b> El monto base cobrado por el plan de tiempo.</li>
                                            <li><b>Huésped Principal:</b> Nombre de la persona a la que se registró la habitación.</li>
                                            <li><b>Registrada Por:</b> Usuario del sistema que realizó el ingreso.</li>
                                            <li><b>Plan Seleccionado:</b> El tiempo contratado (Ej: 1 Minuto, 4 Horas).</li>
                                            <li><b>Método de Pago:</b> Icono y nombre del método usado (Ej: SINPE MÓVIL).</li>
                                            <li><b>Tiempo en Suite:</b> Barra de progreso visual y tiempo restante en tiempo real.</li>
                                            <li><b>Entrada y Salida Est.:</b> Horas exactas de inicio y finalización prevista.</li>
                                        </ul>
                                        <p className="mt-4"><b>Funciones de Botones:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>PEDIR SERVICIO:</b> Abre el menú para añadir consumos (comida, bebidas) a la cuenta de la habitación.</li>
                                            <li><b>REALIZAR CHECK-OUT:</b> Inicia el proceso de salida, cobro de saldos pendientes y liberación de la habitación.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Ficha de Estancia Activa</p>
                                        <img src="/media__1778798409099.png" alt="Ficha de Estancia Activa" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Características cuando la Habitación está Vencida</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Cuando el tiempo contratado por el huésped se cumple, el sistema cambia visualmente para alertar al personal:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Cambios Visuales y Alertas:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Badge VENCIDA:</b> Aparece una etiqueta roja con un icono de advertencia, reemplazando el estado normal.</li>
                                            <li><b>Barra de Progreso:</b> Se llena al 100% y cambia a color rojo brillante, mostrando el texto "(Tiempo cumplido)".</li>
                                            <li><b>Hora de Salida:</b> El texto de la hora estimada de salida se vuelve rojo para resaltar el retraso.</li>
                                        </ul>
                                        <p className="mt-4"><b>Nuevo Botón de Gestión:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>GESTIONAR VENCIDA:</b> Este botón rojo prominente permite al recepcionista abrir las opciones para extender la estancia, llamar a la habitación o proceder con el cobro final.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Ficha de Habitación Vencida</p>
                                        <img src="/media__1778798631945.png" alt="Ficha de Habitación Vencida" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Extender el Tiempo (Gestionar Vencida)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en el botón <b>GESTIONAR VENCIDA</b>, se abre un modal que permite registrar una extensión de tiempo para el huésped:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Explicación de Campos:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>NUEVO PLAN DE ESTANCIA:</b> Desplegable para seleccionar el tiempo adicional que el cliente desea quedarse.</li>
                                            <li><b>NUEVA SALIDA ESTIMADA:</b> Calcula y muestra automáticamente la nueva hora de salida sumando el tiempo del nuevo plan.</li>
                                            <li><b>MÉTODO DE PAGO:</b> Selector para indicar cómo pagará el cliente la extensión.</li>
                                            <li><b>Información de SINPE (Si aplica):</b> Si se elige SINPE Móvil, muestra el número y nombre del titular de la cuenta.</li>
                                            <li><b>PAGO VERIFICADO:</b> Casilla obligatoria para que el recepcionista confirme que revisó el ingreso del dinero en la cuenta bancaria.</li>
                                            <li><b>TOTAL A COBRAR:</b> El monto total que el cliente debe pagar por el tiempo adicional.</li>
                                        </ul>
                                        <p className="mt-4"><b>Acción Final:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>PAGAR Y EXTENDER:</b> Botón para guardar los cambios y reiniciar el reloj de la habitación con el nuevo tiempo.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Modal de Gestionar Vencida</p>
                                        <img src="/media__1778798737487.png" alt="Modal de Gestionar Vencida" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Realizar Check-Out (Cierre de Estancia)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Si en lugar de extender el tiempo, el usuario decide finalizar la estancia haciendo clic en <b>REALIZAR CHECK-OUT</b>, el sistema abrirá un modal de auditoría:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Explicación de la Auditoría:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>TIEMPO TRANSCURRIDO:</b> Indica el tiempo total que el huésped ha permanecido en la habitación (Ej: 17 minutos).</li>
                                            <li><b>HOSPEDAJE:</b> Muestra el costo del plan contratado.</li>
                                            <li><b>PAGOS REALIZADOS:</b> Refleja el dinero que ya fue cancelado por el cliente (aparece restando en verde).</li>
                                            <li><b>TOTAL NETO A PAGAR:</b> Es el saldo final. Si está en zero, se muestra el sello de <b>SALDADO</b> en verde.</li>
                                        </ul>
                                        <p className="mt-4"><b>Botones de Acción:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>CANCELAR:</b> Vuelve a la pantalla anterior sin cerrar la estancia.</li>
                                            <li><b>CERRAR ESTANCIA:</b> Finaliza oficialmente la estancia, libera la habitación y la envía a estado de limpieza.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Resumen de Check-Out</p>
                                        <img src="/media__1778799434778.png" alt="Resumen de Check-Out" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                                <div className="border-t border-white/5 pt-4 mt-4">
                                    <p className="font-bold text-white mb-2">Paso Final: Procesar Liquidación (Sin Saldos Pendientes)</p>
                                    <p className="text-sm text-muted-foreground mb-4">Si al presionar "Cerrar Estancia" el cliente no tiene deudas pendientes, el sistema mostrará esta pantalla de confirmación:</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>Confirmación de Salida:</b> El sistema valida que la cuenta está en cero.</li>
                                                <li><b>Alerta de Factura:</b> Muestra el mensaje "NO SE GENERARÁ FACTURA" si no hay montos nuevos por cobrar.</li>
                                            </ul>
                                            <p className="mt-4"><b>Botones:</b></p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>CANCELAR:</b> Vuelve al modal de auditoría anterior.</li>
                                                <li><b>CONFIRMAR SALIDA:</b> Completa el proceso, liberando la habitación definitivamente.</li>
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500 uppercase tracking-widest">Procesar Liquidación</p>
                                            <img src="/media__1778799522758.png" alt="Procesar Liquidación" className="rounded-xl border border-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Gestión de Limpieza de Habitaciones</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Cuando una habitación es liberada (después del check-out), pasa automáticamente al estado de <b>Limpieza</b> (color amarillo). El personal puede gestionar este estado desde las siguientes vistas:</p>
                                
                                <div className="border-t border-white/5 pt-4 mt-4">
                                    <p className="font-bold text-white mb-2">1. Vista de Habitación en Limpieza</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <p>En esta vista, el sistema indica que la suite está siendo preparada:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>Estado:</b> Se muestra el distintivo amarillo de <b>LIMPIEZA</b>.</li>
                                                <li><b>Panel Derecho:</b> Muestra el mensaje "SUITE EN PREPARACIÓN".</li>
                                                <li><b>Acción Principal:</b> El botón amarillo <b>MARCAR COMO DISPONIBLE</b> permite iniciar el proceso de liberación.</li>
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500 uppercase tracking-widest">Vista de Limpieza</p>
                                            <img src="/media__1778799609261.png" alt="Vista de Limpieza" className="rounded-xl border border-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-4 mt-4">
                                    <p className="font-bold text-white mb-2">2. Modal de Reporte de Limpieza</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <p>Al presionar el botón de disponibilidad, se debe llenar un reporte:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>ESTADO DE LA HABITACIÓN:</b> Permite reportar si todo quedó en orden o si hay algún daño/novedad.</li>
                                                <li><b>OBSERVACIONES / DETALLES:</b> Espacio para que la mucama o personal de limpieza anote cualquier detalle relevante.</li>
                                                <li><b>FINALIZAR Y LIBERAR:</b> Guarda el reporte y pone la habitación en color verde (Disponible).</li>
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500 uppercase tracking-widest">Reporte de Limpieza</p>
                                            <img src="/media__1778799624912.png" alt="Reporte de Limpieza" className="rounded-xl border border-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: CÓMO REGISTRAR UN HUÉSPED"
                                    description="Proceso para registrar el ingreso de un huésped a una habitación disponible."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en estado 'Disponible' (Verde)."
                                    steps={[
                                        "Hacer clic en una habitación verde.",
                                        "En el modal (Panel Izquierdo), hacer clic en 'REGISTRAR HUÉSPED'.",
                                        "En el formulario 'Registro Rápido':",
                                        "  - Seleccionar Origen: 'Nacional' o 'Extranjero' (Ej: Nacional).",
                                        "  - Ingresar Cédula (Ej: 9-9999-9999) y clic en 'VERIFICAR'.",
                                        "  - Ingresar Nombre del Cliente (Ej: Juan Pérez).",
                                        "  - Seleccionar Plan de Estancia (Ej: 4 Horas).",
                                        "  - Seleccionar Método de Pago (Ej: Efectivo).",
                                        "Hacer clic en 'FINALIZAR E INGRESAR'."
                                    ]}
                                    data="Plan de tiempo (4h), Cédula (9-9999-9999), Nombre (Juan Pérez), Pago (Efectivo)."
                                    expectedResult="La habitación cambia a color rojo (Ocupada) y el tiempo empieza a correr."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: ALERTA DE TIEMPO VENCIDO"
                                    description="Verificar que el sistema alerte visualmente cuando una estancia supera su tiempo."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. Una habitación debe estar ocupada con una estancia cuyo tiempo ya caducó."
                                    steps={[
                                        "Esperar a que el tiempo de la estancia se cumpla.",
                                        "Observar el Panel de Habitaciones."
                                    ]}
                                    data="Estancia con fecha y hora de salida anterior a la actual."
                                    expectedResult="La habitación muestra un distintivo rojo o parpadeo de 'Vencida' y se emite una alerta sonora."
                                />
                                <TestCase 
                                    id="ESCENARIO 3: CÓMO EXTENDER ESTANCIA"
                                    description="Proceso para añadir más tiempo a una habitación ocupada."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en estado 'Ocupada' (Rojo)."
                                    steps={[
                                        "Hacer clic en la habitación ocupada.",
                                        "Seleccionar la opción 'Extender Tiempo' o 'Cambiar Plan'.",
                                        "Elegir el tiempo adicional.",
                                        "Confirmar y guardar."
                                    ]}
                                    data="Tiempo adicional."
                                    expectedResult="La hora de salida se actualiza sumando el nuevo tiempo."
                                />
                                <TestCase 
                                    id="ESCENARIO 4: LIBERAR HABITACIÓN EN LIMPIEZA"
                                    description="Verificar que una habitación en estado de limpieza pueda ser marcada como disponible."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en estado 'Limpieza' (Amarillo)."
                                    steps={[
                                        "Navegar al Panel de Habitaciones.",
                                        "Hacer clic en una habitación en color amarillo.",
                                        "En el modal, seleccionar la opción 'Marcar como Disponible'."
                                    ]}
                                    data="ID de Habitación (ej. 'Habitación 101')"
                                    expectedResult="El color de la habitación cambia a verde (Disponible) y el estado se actualiza en la base de datos."
                                />
                                <TestCase 
                                    id="ESCENARIO 5: CÓMO HACER UN CHECK-OUT"
                                    description="Proceso para registrar la salida del huésped y liberar la habitación."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en estado 'Ocupada' (Rojo)."
                                    steps={[
                                        "Hacer clic en la habitación ocupada.",
                                        "Seleccionar 'Iniciar Check-out'.",
                                        "Verificar saldo 0.00 (cobrar si hay pendientes).",
                                        "Confirmar la salida."
                                    ]}
                                    data="Monto a cobrar si hay consumos pendientes."
                                    expectedResult="La habitación pasa a color amarillo (Limpieza) y se genera el comprobante."
                                />
                                <TestCase 
                                    id="ESCENARIO 6: CÓMO REALIZAR UN PEDIDO PARA UNA HABITACIÓN"
                                    description="Proceso para añadir consumos (comida, bebidas) a la cuenta de una habitación ocupada."
                                    precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en estado 'Ocupada' (Rojo)."
                                    steps={[
                                        "Hacer clic en la habitación ocupada.",
                                        "Seleccionar la opción 'Añadir Pedido' o 'Venta a Habitación'.",
                                        "Seleccionar los productos del catálogo.",
                                        "Confirmar el pedido."
                                    ]}
                                    data="Productos seleccionados, Cantidad."
                                    expectedResult="Los productos se añaden a la cuenta de la habitación y se notifica a la cola correspondiente (Cocina o Bar)."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Venta Directa (POS) */}
                <Card className="border-primary bg-background">
                    <CardHeader>
                        <CardTitle className="text-primary flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Venta Directa (POS)
                        </CardTitle>
                        <CardDescription>
                            Venta de productos y servicios de forma directa sin estar vinculados a una habitación.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Permitir a los vendedores registrar ventas rápidas de productos (bebidas, snacks, etc.) a clientes de paso o directamente desde el bar/restaurante.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pasos de Uso</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><b>1. Seleccionar Productos:</b> Navega por las categorías o busca productos por nombre y haz clic para añadirlos al carrito.</p>
                                <p><b>2. Procesar Pago:</b> Haz clic en "Pagar" y selecciona el método de pago (Efectivo, SINPE, Tarjeta). Completa los datos requeridos.</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: VENTA CON SINPE MÓVIL"
                                    description="Verificar que el proceso de pago por SINPE Móvil muestre la información correcta."
                                    precondition="Debe haber al menos una cuenta SINPE activa en el sistema."
                                    steps={[
                                        "En el Dashboard, hacer clic en 'Venta Directa (POS)'.",
                                        "Agregar un producto al carrito.",
                                        "Hacer clic en 'Pagar'.",
                                        "Seleccionar 'SINPE Móvil' como método de pago."
                                    ]}
                                    data="Producto seleccionado, Monto de la venta."
                                    expectedResult="El sistema muestra el número de teléfono o código QR de la cuenta SINPE activa para que el cliente realice el pago."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: CONTROL DE STOCK INSUFICIENTE"
                                    description="Verificar que no se puedan vender productos sin stock si el control está activo."
                                    precondition="El producto seleccionado debe tener stock 0 y requerir control de inventario."
                                    steps={[
                                        "En el Dashboard, hacer clic en 'Venta Directa (POS)'.",
                                        "Buscar un producto con stock 0.",
                                        "Intentar agregarlo al carrito o procesar la venta."
                                    ]}
                                    data="Producto con stock 0."
                                    expectedResult="El sistema muestra una alerta de 'Stock Insuficiente' y bloquea la acción."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Reservaciones */}
                <Card className="border-primary bg-background">
                    <CardHeader>
                        <CardTitle className="text-primary flex items-center gap-2">
                            <CalendarPlus className="h-5 w-5" />
                            Gestión de Reservaciones
                        </CardTitle>
                        <CardDescription>
                            Agenda y control de futuras estancias para los huéspedes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Permitir a la recepción agendar habitaciones para fechas posteriores, asegurando que no se dupliquen reservas y gestionando el estado de las mismas.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pasos de Uso</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><b>1. Crear Reserva:</b> Selecciona la fecha, hora y habitación deseada, e ingresa los datos del cliente.</p>
                                <p><b>2. Gestionar Estado:</b> Puedes buscar reservas existentes para editarlas, cancelarlas o marcarlas como completadas.</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: CÓMO HACER UNA RESERVACIÓN"
                                    description="Proceso para agendar una habitación para una fecha futura."
                                    precondition="En el Dashboard, hacer clic en 'Crear Reservaciones'. La habitación seleccionada debe estar libre en el rango de fecha y hora solicitado."
                                    steps={[
                                        "Seleccionar la fecha y hora deseadas.",
                                        "Elegir una habitación disponible.",
                                        "Ingresar los datos del cliente (Nombre, Teléfono).",
                                        "Hacer clic en 'Guardar Reservación'."
                                    ]}
                                    data="Fecha y Hora, Habitación, Datos del cliente."
                                    expectedResult="La reservación queda registrada y aparece en el calendario o lista de reservas."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: CÓMO CANCELAR UNA RESERVACIÓN"
                                    description="Proceso para anular una reservación previamente registrada."
                                    precondition="En el Dashboard, hacer clic en 'Crear Reservaciones'. Debe existir una reservación activa en el sistema."
                                    steps={[
                                        "Buscar la reservación en la lista o calendario.",
                                        "Hacer clic en la reservación para ver detalles.",
                                        "Seleccionar la opción 'Cancelar Reservación'.",
                                        "Confirmar la acción."
                                    ]}
                                    data="ID de reservación."
                                    expectedResult="El estado de la reserva cambia a 'Cancelada' y la habitación se libera para esa fecha."
                                />
                                <TestCase 
                                    id="ESCENARIO 3: CÓMO MARCAR COMO NO SE PRESENTÓ (NO-SHOW)"
                                    description="Proceso para marcar una reservación cuyo cliente no llegó."
                                    precondition="En el Dashboard, hacer clic en 'Crear Reservaciones'. La hora de la reservación debe haber pasado y el cliente no haber llegado."
                                    steps={[
                                        "Buscar la reservación que no se presentó.",
                                        "Seleccionar la opción 'Marcar como No Presentó' o 'No-show'."
                                    ]}
                                    data="ID de reservación."
                                    expectedResult="El estado de la reserva cambia a 'No-show' y se libera la habitación."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Facturación */}
                <Card className="border-primary bg-background">
                    <CardHeader>
                        <CardTitle className="text-primary flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Facturación
                        </CardTitle>
                        <CardDescription>
                            Consulta y gestión del historial de todas las facturas generadas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Permitir a la administración y contabilidad revisar todas las ventas realizadas, anular facturas si es necesario y descargar comprobantes.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pasos de Uso</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p><b>1. Buscar Facturas:</b> Usa los filtros por fecha, cliente o número de factura para encontrar registros específicos.</p>
                                <p><b>2. Ver Detalles:</b> Haz clic en una factura para ver el desglose de productos, método de pago y datos del cliente.</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: ANULACIÓN DE FACTURA"
                                    description="Verificar que una factura pueda ser anulada y se refleje en los totales."
                                    precondition="En el Dashboard, hacer clic en 'Facturación'. Debe existir una factura con estado 'Pagada' y el usuario debe tener permisos de Admin o Contador."
                                    steps={[
                                        "Buscar y seleccionar una factura pagada.",
                                        "Hacer clic en el botón 'Anular'.",
                                        "Confirmar la acción en el modal."
                                    ]}
                                    data="Número de factura a anular."
                                    expectedResult="El estado de la factura cambia a 'Anulada' y los montos ya no suman en los reportes de ingresos."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: REENVÍO DE COMPROBANTE"
                                    description="Verificar que se pueda compartir el enlace del comprobante."
                                    precondition="En el Dashboard, hacer clic en 'Facturación'. Debe existir al menos una factura en el sistema."
                                    steps={[
                                        "Seleccionar una factura.",
                                        "Hacer clic en 'Compartir' o el icono de WhatsApp."
                                    ]}
                                    data="Número de factura."
                                    expectedResult="Se abre la opción de compartir o se copia el enlace público único de la factura."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">📦</span>
                            Gestión de Inventario
                        </CardTitle>
                        <CardDescription>
                            Control de productos, stock, precios y destinos de preparación.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Administrar el catálogo de productos disponibles para la venta en el motel, controlando sus costos, precios, existencias y el destino de preparación de cada uno.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal: Control de Inventario</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>La pantalla principal de inventario ofrece una vista panorámica del estado de los productos y el capital invertido:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Métricas Clave (KPIs):</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>VALOR FÍSICO (COSTO):</b> El dinero total invertido en la mercadería que está en bodega (basado en el precio de costo).</li>
                                            <li><b>VALOR VENTA (POTENCIAL):</b> El dinero proyectado que ingresaría si se vende todo el stock actual.</li>
                                            <li><b>UTILIDAD BRUTA ESTIMADA:</b> La ganancia total proyectada (Diferencia entre el valor de venta y el costo).</li>
                                            <li><b>TOTAL UNIDADES:</b> La suma total de todos los productos físicos disponibles.</li>
                                        </ul>
                                        <p className="mt-4"><b>Funcionalidades:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Buscador y Filtros:</b> Permite buscar productos por nombre o código, y filtrar por categoría, estado de stock, etc.</li>
                                            <li><b>Exportación:</b> Botones para descargar el reporte de inventario completo en formato PDF o Excel.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Panel de Control de Inventario</p>
                                        <img src="/media__1778800446891.png" alt="Panel de Control de Inventario" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Registro de Mermas (Bajas de Inventario)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Para dar de baja productos del inventario sin que cuenten como una venta (por daño, vencimiento, etc.), se utiliza el modal de mermas:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Campos del Formulario:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Cantidad a Dar de Baja:</b> El número de unidades que se van a retirar del stock.</li>
                                            <li><b>Notas / Motivo (Opcional):</b> Texto para justificar la baja (Ej: "Producto vencido", "Botella quebrada").</li>
                                        </ul>
                                        <p className="mt-4"><b>Botones:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Cancelar:</b> Cierra el modal sin aplicar cambios.</li>
                                            <li><b>Confirmar Merma:</b> Aplica la rebaja en el stock del producto de forma permanente.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Registrar Merma</p>
                                        <img src="/media__1778800545129.png" alt="Registrar Merma" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Agregar un Producto</h4>
                            <div className="space-y-4 text-sm text-muted-foreground">
                                <p>Al hacer clic en <b>Añadir Producto</b>, se abrirá un formulario con los siguientes campos agrupados:</p>
                                
                                <div className="border-t border-white/5 pt-4">
                                    <p className="font-bold text-white mb-2">1. Identificación y Origen</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><b>Fuente del Producto:</b> 
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>Comprado:</b> Productos que se adquieren a proveedores (Gaseosas, snacks, etc.). Habilita el control de stock y costo.</li>
                                                <li><b>Producción Interna:</b> Productos que se preparan en el motel (Cocina, bar). Oculta los campos de stock y costo ya que dependen de insumos.</li>
                                            </ul>
                                        </li>
                                        <li><b>Nombre del Producto:</b> El nombre que verá el usuario y el cliente.</li>
                                        <li><b>Código:</b> Se genera automáticamente ("Auto").</li>
                                        <li><b>Descripción Promocional:</b> Texto descriptivo para el Menú de TV (Opcional).</li>
                                    </ul>
                                </div>

                                <div className="border-t border-white/5 pt-4">
                                    <p className="font-bold text-white mb-2">2. Imagen y Visibilidad</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><b>Imagen del Producto:</b> Espacio para subir la foto que se mostrará en el menú digital y en las pantallas.</li>
                                        <li><b>Mostrar en Pantallas Públicas (TV Board):</b> Si se activa, el producto aparecerá en el menú de la TV de las habitaciones y en la app de auto-pedido de los huéspedes.</li>
                                        <li><b>Producto Activo:</b> Si se desactiva, el producto se oculta de todos los menús y no se puede vender.</li>
                                    </ul>
                                </div>

                                <div className="border-t border-white/5 pt-4">
                                    <p className="font-bold text-white mb-2">3. Clasificación y Colas de Trabajo</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><b>Categoría y Sub-Categoría:</b> Para organizar el menú (Ej: Bebidas -&gt; Gaseosas).</li>
                                        <li><b>Categoría de Cola (Destino):</b> ¡Muy importante! Define a qué pantalla de trabajo se enviará la orden cuando un cliente lo pida:
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>Cola de Bar:</b> Para licores, cocteles, etc.</li>
                                                <li><b>Cola de Cocina:</b> Para comidas preparadas, platos fuertes, etc.</li>
                                                <li><b>Cola de Amenidades:</b> Para artículos de uso personal, kits, etc.</li>
                                                <li><b>Cola de Artículos:</b> Para productos que no requieren preparación y se entregan directamente.</li>
                                            </ul>
                                        </li>
                                        <li><b>Proveedor:</b> Para asociar el producto a un proveedor registrado (Opcional).</li>
                                    </ul>
                                </div>

                                <div className="border-t border-white/5 pt-4">
                                    <p className="font-bold text-white mb-2">4. Precios, Stock e Impuestos</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><b>Precio de Costo:</b> Lo que cuesta adquirirlo (Solo para Comprados).</li>
                                        <li><b>Precio de Venta:</b> El precio final al público.</li>
                                        <li><b>Existencias:</b> Cantidad actual en inventario.</li>
                                        <li><b>Exist. Mínimas:</b> El límite para generar alertas de reabastecimiento.</li>
                                        <li><b>Impuestos:</b> 
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li><b>IVA (13%) y Servicio (10%):</b> Puedes activar uno o ambos según aplique al producto.</li>
                                                <li><b>Toggle 'INCLUIDO':</b> Si está activo, el precio de venta ya incluye los impuestos. Si está apagado, los impuestos se sumarán ADICIONAL al precio de venta.</li>
                                            </ul>
                                        </li>
                                        <li><b>Resumen de Cálculo:</b> Calcula automáticamente el margen y la utilidad estimada.</li>
                                    </ul>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Producto Comprado</p>
                                        <img src="/media__1778799867083.png" alt="Producto Comprado" className="rounded-xl border border-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Producción Interna</p>
                                        <img src="/media__1778799890584.png" alt="Producción Interna" className="rounded-xl border border-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Colas de Trabajo</p>
                                        <img src="/media__1778799900738.png" alt="Colas de Trabajo" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: AGREGAR PRODUCTO COMPRADO"
                                    description="Verificar que un producto comprado se guarde con su stock y costo."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de Inventario'."
                                    steps={[
                                        "Hacer clic en 'Añadir Producto'.",
                                        "Seleccionar Fuente: 'Comprado'.",
                                        "Ingresar Nombre (Ej: Coca Cola 600ml).",
                                        "Seleccionar Categoría y Cola de Destino (Ej: Cola de Bar).",
                                        "Ingresar Precio de Costo (Ej: 500) y Precio de Venta (Ej: 1000).",
                                        "Ingresar Existencias (Ej: 50).",
                                        "Hacer clic en el recuadro de imagen y seleccionar una foto.",
                                        "Hacer clic en 'Guardar Producto'."
                                    ]}
                                    data="Datos del producto."
                                    expectedResult="El producto aparece en la lista con 50 unidades y disponible para la venta."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: AGREGAR PRODUCTO DE COCINA"
                                    description="Verificar que un producto de producción interna no pida stock."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de Inventario'."
                                    steps={[
                                        "Hacer clic en 'Añadir Producto'.",
                                        "Seleccionar Fuente: 'Producción Interna'.",
                                        "Ingresar Nombre (Ej: Hamburguesa con Papas).",
                                        "Seleccionar Cola de Destino: 'Cola de Cocina'.",
                                        "Ingresar Precio de Venta (Ej: 3500).",
                                        "Hacer clic en el recuadro de imagen y seleccionar una foto.",
                                        "Notar que los campos de stock y costo están ocultos.",
                                        "Hacer clic en 'Guardar Producto'."
                                    ]}
                                    data="Datos del plato."
                                    expectedResult="El plato se guarda y las comandas se enviarán a la pantalla de cocina."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">👥</span>
                            Gestión de Clientes
                        </CardTitle>
                        <CardDescription>
                            Administración de huéspedes, historial de visitas y control de lista negra.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Llevar un registro detallado de los clientes, permitiendo identificar huéspedes frecuentes (VIP), gestionar sus datos de contacto y aplicar bloqueos preventivos (Lista Negra) en caso de incidentes.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Flujo de Bloqueo y Verificación</h4>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 overflow-hidden">
                                <Mermaid chart={clientBlacklistFlow} />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>La vista muestra el listado de huéspedes registrados con su información clave:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Buscador:</b> Permite buscar por nombre, correo o cédula.</li>
                                            <li><b>Pestañas (Tabs):</b> 
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li><b>Huéspedes Activos:</b> Clientes en estado normal.</li>
                                                    <li><b>Lista Negra:</b> Clientes bloqueados con prohibición de entrada.</li>
                                                </ul>
                                            </li>
                                            <li><b>Estrellas Amarillas:</b> Indican que el cliente es un huésped frecuente o VIP.</li>
                                            <li><b>Visitas:</b> Contador de cuántas veces ha visitado el motel.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Listado de Huéspedes</p>
                                        <img src="/media__1778800645199.png" alt="Listado de Huéspedes" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Acciones de Huésped</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en los tres puntos (...) a la derecha de cada cliente, se despliegan las siguientes opciones:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>EDITAR PERFIL:</b> Para modificar datos personales o de contacto.</li>
                                            <li><b>QUITAR VALIDACIÓN:</b> Elimina el estado de verificación del cliente.</li>
                                            <li><b>MOVER A LISTA NEGRA:</b> Inicia el proceso de bloqueo.</li>
                                            <li><b>ELIMINAR REGISTRO:</b> Borra al cliente de la base de datos de forma permanente.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Menú de Acciones</p>
                                        <img src="/media__1778800670760.png" alt="Menú de Acciones" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Proceso de Bloqueo y Restauración (Lista Negra)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Para proteger al personal y las instalaciones, se puede bloquear a un cliente, y también revertir el proceso si es necesario:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>1. Bloquear Cliente:</b> Al seleccionar "Mover a Lista Negra", el sistema solicita obligatoriamente el motivo. El cliente aparecerá con un icono de calavera y el motivo en texto rojo.</p>
                                        <p className="mt-4"><b>2. Restaurar Cliente:</b> Si el cliente está en la pestaña de Lista Negra y se desea perdonar o habilitar de nuevo:</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>Ir a la pestaña <b>LISTA NEGRA</b>.</li>
                                            <li>Hacer clic en los tres puntos (...) del cliente.</li>
                                            <li>Seleccionar la opción verde <b>RESTAURAR HUÉSPED</b>.</li>
                                            <li>El cliente volverá automáticamente a la pestaña de Huéspedes Activos.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Confirmar Bloqueo</p>
                                        <img src="/media__1778800681047.png" alt="Confirmar Bloqueo" className="rounded-xl border border-white mb-2" />
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Opción de Restaurar en Lista Negra</p>
                                        <img src="/media__1778800833709.png" alt="Restaurar Huésped" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: MOVER CLIENTE A LISTA NEGRA"
                                    description="Verificar que un cliente pueda ser bloqueado y aparezca en la lista negra."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de Clientes'. Debe existir al menos un cliente en 'Huéspedes Activos'."
                                    steps={[
                                        "Buscar al cliente en la pestaña 'Huéspedes Activos'.",
                                        "Hacer clic en los tres puntos (...).",
                                        "Seleccionar 'MOVER A LISTA NEGRA'.",
                                        "Escribir el motivo (Ej: Test de Bloqueo).",
                                        "Hacer clic en 'Confirmar Bloqueo'.",
                                        "Ir a la pestaña 'LISTA NEGRA' y verificar que el cliente aparezca ahí."
                                    ]}
                                    data="Nombre del cliente y motivo."
                                    expectedResult="El cliente se mueve a la pestaña de Lista Negra con el icono de calavera y el motivo visible."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: RESTAURAR CLIENTE DE LISTA NEGRA"
                                    description="Verificar que un cliente bloqueado pueda ser restaurado."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de Clientes'. Debe existir al menos un cliente en 'LISTA NEGRA'."
                                    steps={[
                                        "Ir a la pestaña 'LISTA NEGRA'.",
                                        "Hacer clic en los tres puntos (...) del cliente bloqueado.",
                                        "Seleccionar 'RESTAURAR HUÉSPED'.",
                                        "Ir a la pestaña 'HUÉSPEDES ACTIVOS' y verificar que el cliente aparezca de nuevo ahí."
                                    ]}
                                    data="Nombre del cliente."
                                    expectedResult="El cliente vuelve a la lista normal y se le quita la restricción."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">📱</span>
                            Gestión de Cuentas SINPE Móvil
                        </CardTitle>
                        <CardDescription>
                            Administración de cuentas telefónicas para recibir pagos por SINPE Móvil.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Administrar las cuentas telefónicas asociadas a SINPE Móvil para recibir pagos de los clientes, controlando los límites mensuales y el saldo acumulado en cada una para evitar sobrepasos.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Flujo de Pago y Control de Límite</h4>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 overflow-hidden">
                                <Mermaid chart={sinpeFlow} />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>La vista muestra las cuentas SINPE configuradas en el sistema:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p><b>Información de la Cuenta:</b></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Titular:</b> Nombre de la persona dueña de la cuenta.</li>
                                            <li><b>Teléfono y Banco:</b> Datos para que el cliente realice el depósito.</li>
                                            <li><b>Saldo / Límite Mensual:</b> Muestra cuánto dinero ha recibido en el mes y el tope máximo permitido (Ej: ₡50,000,000).</li>
                                            <li><b>Estado (Activa):</b> Solo las cuentas marcadas como activas estarán disponibles para recibir pagos en el POS.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Listado de Cuentas SINPE</p>
                                        <img src="/media__1778801020884.png" alt="Listado de Cuentas SINPE" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Agregar una Cuenta</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en <b>Añadir Cuenta SINPE</b>, se abrirá un formulario con los siguientes campos:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Titular de la Cuenta:</b> Nombre completo.</li>
                                            <li><b>Número de Teléfono:</b> Número de 8 dígitos.</li>
                                            <li><b>Nombre del Banco:</b> Entidad financiera.</li>
                                            <li><b>Monto Límite Mensual:</b> El tope de dinero que puede recibir la cuenta por mes.</li>
                                            <li><b>Saldo Actual:</b> Permite iniciar la cuenta con un monto ya acumulado (Normalmente 0).</li>
                                            <li><b>Cuenta Activa:</b> Switch para habilitar o deshabilitar la cuenta.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Nueva Cuenta SINPE</p>
                                        <img src="/media__1778801003206.png" alt="Nueva Cuenta SINPE" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Acciones de Cuenta</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en los tres puntos (...) de una cuenta, se despliegan las siguientes opciones:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Editar:</b> Abre el formulario para modificar los datos de la cuenta.</li>
                                            <li><b>Resetear Saldo:</b> Pone el saldo acumulado en 0 (Ideal para usar al inicio de cada mes).</li>
                                            <li><b>Eliminar:</b> Borra la cuenta del sistema (Opción en rojo).</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Menú de Acciones</p>
                                        <img src="/media__1778801041920.png" alt="Menú de Acciones" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: AGREGAR CUENTA SINPE"
                                    description="Verificar que una nueva cuenta se cree correctamente y aparezca activa."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de SINPE'."
                                    steps={[
                                        "Hacer clic en 'Añadir Cuenta SINPE'.",
                                        "Ingresar Titular (Ej: Juan Pérez).",
                                        "Ingresar Teléfono (Ej: 8888-8888).",
                                        "Ingresar Banco (Ej: Banco Nacional).",
                                        "Ingresar Monto Límite (Ej: 500000).",
                                        "Asegurarse de que 'Cuenta Activa' esté encendido.",
                                        "Hacer clic en 'Guardar'."
                                    ]}
                                    data="Datos de la cuenta."
                                    expectedResult="La cuenta aparece en el listado con el badge verde de 'Activa'."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: RESETEAR SALDO DE CUENTA"
                                    description="Verificar que el saldo acumulado de una cuenta vuelva a cero."
                                    precondition="En el Dashboard, hacer clic en 'Gestión de SINPE'. Debe existir una cuenta con saldo mayor a cero."
                                    steps={[
                                        "Identificar la cuenta con saldo.",
                                        "Hacer clic en los tres puntos (...).",
                                        "Seleccionar 'Resetear Saldo'.",
                                        "Confirmar la acción si el sistema lo solicita."
                                    ]}
                                    data="Ninguno."
                                    expectedResult="El saldo de la cuenta cambia a ₡0.00."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">🏨</span>
                            Gestión de Tipos de Habitación
                        </CardTitle>
                        <CardDescription>
                            Definición de categorías de habitaciones, características y planes de precios.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Configurar los diferentes tipos de habitaciones que ofrece el motel (Ej: Sencilla, Doble, Suite VIP), especificando sus comodidades y las tarifas por tiempo (Planes de Precios).
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Muestra el catálogo de tipos de habitación configurados:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Código y Nombre:</b> Identificador y nombre comercial.</li>
                                            <li><b>Características:</b> Lista de extras (Jacuzzi, Cama King, etc.).</li>
                                            <li><b>Planes de Precios:</b> Tarifas desglosadas por horas y capacidad.</li>
                                            <li><b>Landing Page:</b> Indica si el tipo de habitación es visible en el sitio web público.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Listado de Tipos de Habitación</p>
                                        <img src="/media__1778801190882.png" alt="Listado de Tipos de Habitación" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Agregar o Editar</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al crear o editar un tipo de habitación, se completan los siguientes datos:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Nombre y Capacidad:</b> Nombre de la categoría y límite de personas.</li>
                                            <li><b>Mostrar en Landing Page:</b> Switch para publicar u ocultar en la web.</li>
                                            <li><b>Características:</b> Se pueden agregar etiquetas escribiendo y presionando el botón (+).</li>
                                            <li><b>Planes de Precios:</b> Se definen ingresando la duración, unidad (Horas/Minutos), precio y capacidad de huéspedes para esa tarifa.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Formulario de Edición</p>
                                        <img src="/media__1778801218257.png" alt="Formulario de Edición" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: CREAR TIPO DE HABITACIÓN CON PLAN DE PRECIOS"
                                    description="Verificar que se pueda crear una categoría y asignarle precios."
                                    precondition="En el Dashboard, hacer clic en 'Ajustes del Sistema'."
                                    steps={[
                                        "Hacer clic en 'Añadir Tipo de Habitación'.",
                                        "Ingresar Nombre (Ej: Suite Presidencial).",
                                        "Ingresar Capacidad (Ej: 2).",
                                        "En la sección de Precios, ingresar Duración (Ej: 12), Unidad (Horas), Precio (Ej: 40000) y Capacidad (Ej: 2).",
                                        "Hacer clic en 'Añadir Plan'.",
                                        "Hacer clic en 'Guardar'."
                                    ]}
                                    data="Datos de la categoría y precio."
                                    expectedResult="La nueva categoría aparece en la lista con su plan de precios visible."
                                />
                                <TestCase 
                                    id="ESCENARIO 2: OCULTAR DE LANDING PAGE"
                                    description="Verificar que se pueda ocultar una categoría del sitio público."
                                    precondition="En el Dashboard, hacer clic en 'Ajustes del Sistema'. Debe existir una categoría visible."
                                    steps={[
                                        "Hacer clic en Editar en la categoría deseada.",
                                        "Apagar el switch 'Mostrar en Landing Page'.",
                                        "Hacer clic en 'Guardar'."
                                    ]}
                                    data="Ninguno."
                                    expectedResult="El estado en la tabla cambia a 'Oculto' en color gris."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">📚</span>
                            Gestión de Catálogo de Productos
                        </CardTitle>
                        <CardDescription>
                            Organización de productos en categorías y subcategorías para el menú.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Organizar el menú de productos y servicios del motel en categorías y subcategorías para facilitar la toma de pedidos y el control de inventario.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Flujo de Creación de Productos</h4>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 overflow-hidden">
                                <Mermaid chart={productCatalogFlow} />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Estructura en Cascada (Tres Columnas)</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>El catálogo se maneja en una vista de tres columnas vinculadas entre sí:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>1. Categorías:</b> El nivel más alto (Ej: Bebidas, Comidas).</li>
                                            <li><b>2. Sub-Categorías:</b> Divisiones dentro de la categoría seleccionada (Ej: Si seleccionas Bebidas, verás Cervezas, Licores, etc.).</li>
                                            <li><b>3. Productos:</b> Los artículos finales que se venden (Ej: Si seleccionas Cervezas, verás Birra, Corona, Heineken).</li>
                                        </ul>
                                        <p className="mt-2"><b>Nota:</b> Cada columna tiene su propio botón <b>Añadir</b> en la esquina superior derecha.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Vista del Catálogo</p>
                                        <img src="/media__1778801385907.png" alt="Vista del Catálogo" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Acciones sobre Productos</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al pasar el mouse sobre un producto en la tercera columna, aparecerán dos iconos de acción:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Icono de Lápiz (Verde):</b> Abre el formulario para editar los detalles del producto.</li>
                                            <li><b>Icono de Basurero (Rojo):</b> Elimina el producto del catálogo.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Iconos de Acción</p>
                                        <img src="/media__1778801416920.png" alt="Iconos de Acción" className="rounded-sm border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Formulario de Producto</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al crear o editar un producto, se gestionan los siguientes bloques de información:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Identificación y Origen:</b> Fuente (Comprado/Producción), Nombre, Código y Descripción.</li>
                                            <li><b>Clasificación:</b> Categoría, Sub-Categoría y Cola de Trabajo (Destino).</li>
                                            <li><b>Imagen y Visibilidad:</b> Foto del producto.</li>
                                            <li><b>Precios y Stock:</b> Precio de costo, precio de venta, stock actual y mínimo.</li>
                                            <li><b>Impuestos:</b> Selección de IVA o Servicio, y si están incluidos en el precio.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Formulario de Edición</p>
                                        <img src="/media__1778801401586.png" alt="Formulario de Edición" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">🌐</span>
                            Administración de Contenido de Página Pública
                        </CardTitle>
                        <CardDescription>
                            Personalización de los textos, imágenes y enlaces del sitio web público (Landing Page).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Modificar directamente el contenido visual y textual que ven los clientes en la página web principal del motel, sin necesidad de programar.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Estructura del Formulario (Por Secciones)</h4>
                            <div className="space-y-4 text-sm text-muted-foreground">
                                
                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">1. Sección Hero (Principal)</p>
                                    <p>Es la primera pantalla que ve el usuario al entrar a la web.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Título Inicial (Blanco) y (Brillante):</b> El texto grande principal (Ej: HOTEL DU MANOLO).</li>
                                        <li><b>Subtítulo (Blanco) y (Brillante):</b> La frase que acompaña al título.</li>
                                        <li><b>Imágenes de Fondo:</b> Permite subir una versión vertical para celulares y una horizontal para computadoras.</li>
                                    </ul>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">2. Sección Por qué somos Diferentes</p>
                                    <p>Bloque para destacar las ventajas competitivas.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Títulos:</b> Encabezado de la sección.</li>
                                        <li><b>Descripción:</b> Párrafo introductorio.</li>
                                        <li><b>Cajas de Características:</b> Permite editar el icono, título y texto de cada beneficio (Ej: Discreción Total).</li>
                                    </ul>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">3. Sección Nuestras Amenidades</p>
                                    <p>Muestra los servicios o lujos que ofrece el motel.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Títulos:</b> Encabezado de la sección.</li>
                                        <li><b>Listado:</b> Permite agregar amenidades con su nombre, descripción y una foto ilustrativa (Ej: Jacuzzi, Aire Acondicionado).</li>
                                    </ul>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">4. Sección Explore Bajo (Galería)</p>
                                    <p>Álbum de fotos del motel.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Títulos:</b> Encabezado de la sección.</li>
                                        <li><b>Fotos de la Galería:</b> Lista de imágenes que se mostrarán en cuadrícula en la web.</li>
                                    </ul>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">5. Sección Nosotros / Quiénes Somos</p>
                                    <p>Espacio para contar la historia o misión del motel.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Títulos:</b> Encabezado (Ej: Nuestra Historia).</li>
                                        <li><b>Párrafo de Historia:</b> Texto largo para redactar la reseña.</li>
                                    </ul>
                                </div>

                                <div>
                                    <p className="font-bold text-white mb-1">6. Sección Pie de Página (Footer)</p>
                                    <p>Datos de contacto y redes sociales en el fondo de la web.</p>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        <li><b>Texto de Derechos de Autor:</b> Ej: "Hotel Du Manolo 2026".</li>
                                        <li><b>Dirección Física y Teléfono:</b> Datos visibles para el cliente.</li>
                                        <li><b>Link de Google Maps:</b> URL para que los clientes puedan trazar la ruta.</li>
                                        <li><b>Redes Sociales:</b> Links a Facebook, Instagram, etc.</li>
                                    </ul>
                                </div>

                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Vista del Formulario Completo</h4>
                            <div className="text-sm text-muted-foreground mb-4">
                                <p className="mb-2">Debido a que es un formulario muy extenso que cubre toda la página, se maneja de forma vertical continua:</p>
                                <img src="/media__1778801517090.png" alt="Formulario de Contenido Completo" className="rounded-xl border border-white w-full max-w-lg mx-auto" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">🔔</span>
                            Configuración de Sonido de Alarma
                        </CardTitle>
                        <CardDescription>
                            Elección del sonido para las alertas importantes del sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Personalizar el sonido que emitirá el sistema cuando ocurra un evento que requiera atención inmediata, como cuando una habitación cumple su tiempo de estancia.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Opciones Disponibles</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>El sistema ofrece tres tipos de sonidos con diferentes niveles de urgencia:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Bip Clásico:</b> Un sonido simple y agudo. Efectivo y discreto.</li>
                                            <li><b>Campana de Hotel:</b> Un tono de campana claro y resonante. Profesional.</li>
                                            <li><b>Alarma Digital:</b> Un sonido de alarma moderno y persistente. Urgente.</li>
                                        </ul>
                                        <p className="mt-2"><b>Cómo Probar:</b> Al lado de cada opción hay un icono de bocina. Al hacer clic en él, se reproducirá una muestra del sonido para que puedas elegir el que mejor se adapte a tu entorno de trabajo.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Pantalla de Configuración</p>
                                        <img src="/media__1778801675467.png" alt="Configuración de Sonido de Alarma" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">%</span>
                            Gestión de Impuestos
                        </CardTitle>
                        <CardDescription>
                            Administración de los impuestos aplicables a los productos y servicios del motel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Configurar los porcentajes de impuestos (como el IVA o cargos por servicio) que se aplicarán a las ventas de productos y servicios en el motel.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Muestra el listado de impuestos configurados en el sistema:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Nombre:</b> Identificador del impuesto (Ej: IVA, Servicio).</li>
                                            <li><b>Porcentaje:</b> El valor porcentual que se sumará al precio (Ej: 13%, 10%).</li>
                                            <li><b>Descripción:</b> Nota aclaratoria sobre el impuesto.</li>
                                        </ul>
                                        <p className="mt-2"><b>Acciones:</b> El botón de tres puntos (...) permite editar o eliminar el impuesto.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Listado de Impuestos</p>
                                        <img src="/media__1778801734841.png" alt="Listado de Impuestos" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Agregar un Impuesto</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en <b>Añadir Impuesto</b>, se abre un modal con los siguientes campos:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Nombre del Impuesto:</b> Ej: IVA.</li>
                                            <li><b>Porcentaje (%):</b> Solo el número (Ej: 13).</li>
                                            <li><b>Descripción (Opcional):</b> Texto breve para identificarlo.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Formulario de Nuevo Impuesto</p>
                                        <img src="/media__1778801747038.png" alt="Formulario de Nuevo Impuesto" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: CREAR NUEVO IMPUESTO"
                                    description="Verificar que se pueda agregar un impuesto correctamente."
                                    precondition="En el Dashboard, hacer clic en 'Ajustes del Sistema'."
                                    steps={[
                                        "Hacer clic en 'Añadir Impuesto'.",
                                        "Ingresar Nombre (Ej: Impuesto Turismo).",
                                        "Ingresar Porcentaje (Ej: 5).",
                                        "Ingresar una descripción breve.",
                                        "Hacer clic en 'Guardar'."
                                    ]}
                                    data="Datos del impuesto."
                                    expectedResult="El nuevo impuesto aparece en la tabla con el 5%."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">📢</span>
                            Centro de Notificaciones
                        </CardTitle>
                        <CardDescription>
                            Programación de avisos informativos para clientes y personal administrativo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Gestionar los mensajes informativos, advertencias o urgencias que se muestran en la plataforma, pudiendo dirigirlos al público general o al equipo interno.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pantalla Principal</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>La pantalla se divide en dos pestañas principales:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Notificaciones Públicas:</b> Avisos que verán los clientes al ingresar a la plataforma (Landing Page).</li>
                                            <li><b>Notificaciones Internas:</b> Mensajes dirigidos exclusivamente al personal administrativo.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Listado de Notificaciones</p>
                                        <img src="/media__1778801792040.png" alt="Listado de Notificaciones" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Cómo Crear una Notificación</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Al hacer clic en <b>Nueva Notificación</b>, se abre un modal para configurar el mensaje:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Tipo de Aviso:</b> Selecciona si es Público o Interno.</li>
                                            <li><b>Prioridad / Color:</b> Define la urgencia (Informativa, Aviso, Urgente).</li>
                                            <li><b>Título y Contenido:</b> El texto que leerá el usuario.</li>
                                            <li><b>Vigencia:</b> Fecha de inicio y fin para que el mensaje aparezca automáticamente en ese rango.</li>
                                            <li><b>Notificación Activa:</b> Switch para apagar el aviso manualmente sin borrarlo.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Formulario de Notificación</p>
                                        <img src="/media__1778801802291.png" alt="Formulario de Notificación" className="rounded-xl border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-4 mt-4">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Niveles de Prioridad</h4>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                <p>Cada prioridad tiene un color asociado para llamar la atención visualmente:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Informativa (Azul):</b> Avisos generales, novedades.</li>
                                            <li><b>Aviso (Naranja):</b> Recordatorios, mantenimientos cercanos.</li>
                                            <li><b>Urgente (Rojo):</b> Alertas críticas, fallos o acciones inmediatas.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Opciones de Prioridad</p>
                                        <img src="/media__1778801813124.png" alt="Opciones de Prioridad" className="rounded-sm border border-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Escenarios de Prueba</h4>
                            <div className="space-y-4">
                                <TestCase 
                                    id="ESCENARIO 1: CREAR AVISO PÚBLICO URGENTE"
                                    description="Verificar que se pueda programar una alerta para los clientes."
                                    precondition="En el Dashboard, hacer clic en 'Centro de Marketing'."
                                    steps={[
                                        "Hacer clic en 'Nueva Notificación'.",
                                        "Seleccionar Tipo: Público (Web Site).",
                                        "Seleccionar Prioridad: Urgente (Rojo).",
                                        "Ingresar Título: 'Corte de Agua Programado'.",
                                        "Ingresar Contenido con los detalles del horario.",
                                        "Definir las fechas de vigencia.",
                                        "Hacer clic en 'Publicar Aviso'."
                                    ]}
                                    data="Datos del aviso."
                                    expectedResult="La notificación aparece en la lista con estado activo y color rojo."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <CardHeader className="border-b border-white/10 pb-4">
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-primary/10 text-primary">🏢</span>
                            Información Comercial
                        </CardTitle>
                        <CardDescription>
                            Configuración de datos legales, fiscales y presencia digital oficial de la organización.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Objetivo</h4>
                            <p className="text-sm text-muted-foreground">
                                Mantener actualizados los datos corporativos de la empresa, los cuales se utilizan para la facturación, contacto y visualización en la página web.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-2">Pestañas de Configuración</h4>
                            <div className="space-y-4 text-sm text-muted-foreground">
                                
                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">1. Pestaña: Identidad</p>
                                    <p>Contiene la información básica y legal de la empresa.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Logo:</b> Imagen oficial del motel.</li>
                                            <li><b>Nombre Comercial y Cédula Jurídica:</b> Datos legales.</li>
                                            <li><b>Dirección Física y Link de Maps:</b> Ubicación exacta.</li>
                                            <li><b>Sitio Web Oficial:</b> URL de la landing page.</li>
                                        </ul>
                                        <img src="/media__1778801920032.png" alt="Pestaña Identidad" className="rounded-xl border border-white" />
                                    </div>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <p className="font-bold text-white mb-1">2. Pestaña: Contacto</p>
                                    <p>Permite gestionar múltiples vías de comunicación.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Números de Teléfono:</b> Permite añadir varios números asignándoles una etiqueta (Ej: Principal, Recepción).</li>
                                            <li><b>Correos Electrónicos:</b> Lista de emails con sus respectivas etiquetas.</li>
                                        </ul>
                                        <img src="/media__1778801928063.png" alt="Pestaña Contacto" className="rounded-xl border border-white" />
                                    </div>
                                </div>

                                <div>
                                    <p className="font-bold text-white mb-1">3. Pestaña: Social y Bancos</p>
                                    <p>Enlaces externos y datos para pagos.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><b>Redes Sociales:</b> Links a las cuentas oficiales de la empresa.</li>
                                            <li><b>Cuentas Bancarias:</b> Información de cuentas para transferencias.</li>
                                        </ul>
                                        <img src="/media__1778801936348.png" alt="Pestaña Social y Bancos" className="rounded-xl border border-white" />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </CardContent>
                </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
