'use client';

import { Badge } from '@/components/ui/badge';
import { 
    ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble, 
    ConciergeBell, ShoppingCart, ArchiveX, Database, BookCopy, Truck, Users, 
    Percent, Smartphone, Wallet, CheckCircle, Plus, CreditCard, GitGraph,
    Clock, RefreshCw, AlertTriangle, Utensils, LayoutGrid, Receipt
} from 'lucide-react';

const Step = ({ icon, title, description, statuses, isLast = false }: { icon: React.ElementType, title: string, description: string, statuses: { type: string, name: string, color: string }[], isLast?: boolean }) => {
    const Icon = icon;
    return (
        <div className="relative mb-8 break-inside-avoid">
            <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-sm">
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                <div className="flex-1 pt-0.5">
                    <h3 className="text-lg font-bold text-black">{title}</h3>
                    <p className="mt-1 text-sm text-slate-700">{description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {statuses.map(status => (
                            <div key={`${status.type}-${status.name}`}>
                                <span className="text-[10px] font-black uppercase text-slate-600">{status.type}: </span>
                                <Badge variant="outline" className="border-slate-400 text-black">{status.name}</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {!isLast && <ArrowDown className="absolute left-5 -bottom-8 h-6 w-6 -translate-x-1/2 text-slate-400" />}
        </div>
    );
};

const SettingsStep = ({ icon, title, usage, useCase }: { icon: React.ElementType, title: string, usage: string, useCase: string, href: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-start gap-4 break-inside-avoid border-b pb-4 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-sm">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-black">{title}</h3>
                <div className="mt-1 text-sm text-slate-700 space-y-1">
                    <p><b>Uso:</b> {usage}</p>
                    <p><b>Caso de Uso:</b> {useCase}</p>
                </div>
            </div>
        </div>
    )
}

const TestCase = ({ id, description, precondition, steps, data, expectedResult }: { id: string, description: string, precondition: string, steps: string[], data: string, expectedResult: string }) => {
    return (
        <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 break-inside-avoid mb-4">
            <p className="text-xs font-black uppercase text-slate-800">{id}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-800">
                <div><b className="text-slate-600 uppercase text-[10px] tracking-widest block mb-0.5">Descripción:</b><p>{description}</p></div>
                <div><b className="text-slate-600 uppercase text-[10px] tracking-widest block mb-0.5">Precondición:</b><p>{precondition}</p></div>
                <div><b className="text-slate-600 uppercase text-[10px] tracking-widest block mb-0.5">Datos (Data):</b><p>{data}</p></div>
                <div><b className="text-slate-600 uppercase text-[10px] tracking-widest block mb-0.5">Resultado Esperado:</b><p>{expectedResult}</p></div>
            </div>
            <div className="text-sm text-slate-800">
                <b className="text-slate-600 uppercase text-[10px] tracking-widest block mb-0.5">Pasos (Steps):</b>
                <ol className="list-decimal pl-5 space-y-0.5">
                    {steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
            </div>
        </div>
    );
}

export default function ManualPrintPage() {
    return (
        <div className="bg-white text-black p-8 max-w-[21cm] mx-auto print:p-0 font-sans">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 1.5cm;
                    }
                    body {
                        background-color: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
                .break-inside-avoid {
                    break-inside: avoid;
                }
                .break-before-page {
                    break-before: page;
                }
                .break-after-page {
                    break-after: page;
                }
            `}</style>

            {/* BARRA DE IMPRESIÓN (SOLO EN PANTALLA) */}
            <div className="no-print fixed top-0 left-0 right-0 bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-lg">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-slate-300" />
                    <span className="font-bold">Vista de Impresión</span>
                </div>
                <button 
                    onClick={() => window.print()} 
                    className="bg-slate-50 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Receipt className="h-5 w-5" />
                    Imprimir / Guardar PDF
                </button>
            </div>

            {/* Espaciador para que la portada no quede tapada por la barra fija */}
            <div className="no-print h-16"></div>

            {/* PORTADA */}
            <div className="min-h-[26cm] flex flex-col justify-between items-center text-center py-20 border-4 border-slate-800 mb-8 break-after-page">
                <div>
                    <div className="text-sm uppercase tracking-widest text-slate-500 mb-4">Documentación Oficial</div>
                    <h1 className="text-5xl font-black uppercase tracking-wider mb-2 text-slate-900">Manual Operativo</h1>
                    <h2 className="text-2xl font-bold text-slate-700 mb-8">HOTEL DU MANOLO</h2>
                    <div className="w-24 h-1 bg-slate-800 mx-auto mb-8"></div>
                    <p className="text-base text-slate-600 max-w-lg mx-auto">
                        Guía completa de flujos de trabajo, gestión de estados, cobro inteligente, administración de catálogo y configuración global del sistema.
                    </p>
                </div>
                
                <div className="space-y-4">
                    <img src="/media__1778796813688.png" alt="Hotel Logo" className="w-32 h-32 object-cover rounded-xl border-2 border-slate-300 mx-auto opacity-20" />
                    <div className="text-sm text-slate-500">
                        <p><b>Versión:</b> 1.0</p>
                        <p><b>Fecha de Emisión:</b> {new Date().toLocaleDateString()}</p>
                        <p><b>Confidencialidad:</b> Uso Interno</p>
                    </div>
                </div>
            </div>

            {/* ÍNDICE */}
            <div className="mb-12 break-after-page p-6 border border-slate-200 rounded-xl">
                <h2 className="text-2xl font-bold mb-6 text-slate-900 border-b-2 pb-2">Índice de Contenidos</h2>
                <nav className="text-base text-slate-800 space-y-3">
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>1. Mapa Visual del Ciclo de Vida del Huésped</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>2. Flujo de Pedidos por QR y POS</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>3. Flujos Detallados y Gestión de Pagos</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>4. Manual por Pantalla: Panel de Habitaciones</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>5. Manual por Pantalla: Venta Directa (POS)</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>6. Manual por Pantalla: Gestión de Inventario</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>7. Manual por Pantalla: Gestión de Clientes</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>8. Manual por Pantalla: Gestión de SINPE Móvil</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>9. Manual por Pantalla: Tipos de Habitación</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>10. Manual por Pantalla: Catálogo de Productos</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>11. Administración de Página Pública (Landing Page)</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>12. Centro de Notificaciones y Alertas</span>
                        <span className="font-bold">...</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-slate-400 pb-1">
                        <span>13. Información Comercial de la Empresa</span>
                        <span className="font-bold">...</span>
                    </div>
                </nav>
            </div>

            {/* CONTENIDO */}
            
            {/* Sección 1 */}
            <div className="mb-12 border-b-2 pb-6">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <GitGraph className="h-6 w-6" />
                    1. Mapa Visual del Ciclo de Vida del Huésped
                </h2>
                <p className="text-slate-700 mb-6">
                    Este diagrama detalla el flujo que sigue un cliente desde su llegada hasta su salida, incluyendo las verificaciones de seguridad y los estados de pago.
                </p>
                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 text-center text-sm text-slate-500">
                    [Diagrama de flujo removido para la versión impresa]
                </div>
            </div>

            {/* Sección 2 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Smartphone className="h-6 w-6" />
                    2. Flujo de Pedidos por QR y POS
                </h2>
                <p className="text-slate-700 mb-6">
                    Proceso de auto-servicio para clientes mediante escaneo de código QR en las mesas y su integración con la cocina y el punto de venta.
                </p>
                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 text-center text-sm text-slate-500 mb-6">
                    [Diagrama de flujo removido para la versión impresa]
                </div>
                
                <div className="space-y-6 mt-8">
                    <Step
                        icon={Smartphone}
                        title="1. Auto-Servicio por QR"
                        description="El cliente escanea el código en su mesa y accede al menú digital. Al confirmar su carrito, el sistema crea automáticamente una 'Cuenta de Mesa' o añade los productos a la cuenta activa."
                        statuses={[{ type: 'Acceso', name: 'Escaneo de QR', color: '' }]}
                    />
                    <Step
                        icon={Utensils}
                        title="2. Preparación y Rastreo en Vivo"
                        description="Cada producto aparece en la Cola de Cocina. El personal actualiza el estado (Pendiente -> Cocinando -> Entregado). El cliente ve estos cambios en tiempo real."
                        statuses={[{ type: 'Estado', name: 'Pendiente / Listo', color: '' }]}
                    />
                    <Step
                        icon={CreditCard}
                        title="3. Pago Consolidado en POS"
                        description="Al finalizar, el cajero ve el consumo acumulado en el POS. Puede procesar el pago mediante Efectivo, Tarjeta o SINPE Móvil."
                        statuses={[{ type: 'Cierre', name: 'Facturación Final', color: '' }]}
                        isLast
                    />
                </div>
            </div>

            {/* Sección 3 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Wallet className="h-6 w-6" />
                    3. Flujos Detallados y Gestión de Pagos
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="border p-4 rounded-lg border-slate-300">
                        <h3 className="font-bold mb-2 flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Rotación de Cuentas SINPE</h3>
                        <p className="text-sm text-slate-700">El sistema gestiona múltiples cuentas SINPE. Al elegir este método, se selecciona automáticamente la cuenta activa que aún no ha alcanzado su límite de saldo mensual.</p>
                    </div>
                    <div className="border p-4 rounded-lg border-slate-300">
                        <h3 className="font-bold mb-2 flex items-center gap-2"><CreditCard className="h-5 w-5" /> Tarjeta y Voucher</h3>
                        <p className="text-sm text-slate-700">Para pagos con tarjeta, el sistema requiere obligatoriamente el número de voucher. Este dato queda registrado en la factura para facilitar auditorías.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <Step
                        icon={CalendarPlus}
                        title="Registro: Walk-in vs Reserva Futura"
                        description="El asistente permite dos modalidades: 'Check-in Inmediato' o 'Reserva Futura'. El selector filtra automáticamente para mostrar SOLO habitaciones disponibles."
                        statuses={[{ type: 'Filtro', name: 'Solo Disponibles', color: '' }]}
                    />
                    <Step
                        icon={LogOut}
                        title="Check-out Inteligente"
                        description="El sistema audita el saldo automáticamente. Si el huésped ya pagó todo, el sistema permite cerrar la estancia en un solo clic."
                        statuses={[{ type: 'Lógica', name: 'Salto de Cobro', color: '' }]}
                        isLast
                    />
                </div>
            </div>

            {/* Sección 4 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <LayoutGrid className="h-6 w-6" />
                    4. Manual por Pantalla: Panel de Habitaciones
                </h2>
                <p className="text-slate-700 mb-6">
                    Es el centro de mando del sistema. Permite monitorear y gestionar el estado de todas las habitaciones en tiempo real.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 break-inside-avoid">
                    <div className="border p-4 rounded-lg border-slate-300">
                        <h4 className="font-bold mb-1 text-slate-800">Estados Visuales</h4>
                        <ul className="text-sm list-disc pl-5 text-slate-700 space-y-1">
                            <li><b>Verde:</b> Habitación Disponible.</li>
                            <li><b>Rojo:</b> Habitación Ocupada.</li>
                            <li><b>Amarillo:</b> En Limpieza.</li>
                            <li><b>Gris:</b> En Mantenimiento.</li>
                        </ul>
                    </div>
                    <div className="border p-4 rounded-lg border-slate-300">
                        <h4 className="font-bold mb-1 text-slate-800">Alertas</h4>
                        <p className="text-sm text-slate-700">Cuando el tiempo se cumple, la barra de progreso se vuelve roja y el estado cambia a <b>VENCIDA</b>, emitiendo una alerta sonora.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Ficha de Estancia Activa</p>
                        <img src="/media__1778798409099.png" alt="Ficha de Estancia" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Ficha de Habitación Vencida</p>
                        <img src="/media__1778798631945.png" alt="Habitación Vencida" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b pb-1">Casos de Prueba Clave</h4>
                    <TestCase 
                        id="ESCENARIO 1: CÓMO REGISTRAR UN HUÉSPED"
                        description="Proceso para registrar el ingreso de un huésped a una habitación disponible."
                        precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en 'Disponible'."
                        steps={[
                            "Hacer clic en una habitación verde.",
                            "En el modal, hacer clic en 'REGISTRAR HUÉSPED'.",
                            "Ingresar Cédula y Nombre.",
                            "Seleccionar Plan y Método de Pago.",
                            "Hacer clic en 'FINALIZAR E INGRESAR'."
                        ]}
                        data="Nombre, Cédula, Plan de tiempo."
                        expectedResult="La habitación cambia a rojo (Ocupada)."
                    />
                    <TestCase 
                        id="ESCENARIO 5: CÓMO HACER UN CHECK-OUT"
                        description="Proceso para registrar la salida del huésped."
                        precondition="En el Dashboard, hacer clic en 'Panel de Habitaciones'. La habitación debe estar en 'Ocupada'."
                        steps={[
                            "Hacer clic en la habitación ocupada.",
                            "Seleccionar 'Iniciar Check-out'.",
                            "Verificar saldo 0.00.",
                            "Confirmar la salida."
                        ]}
                        data="Monto a cobrar."
                        expectedResult="La habitación pasa a amarillo (Limpieza)."
                    />
                </div>
            </div>

            {/* Sección 5 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="h-6 w-6" />
                    5. Manual por Pantalla: Venta Directa (POS)
                </h2>
                <p className="text-slate-700 mb-6">
                    Permite registrar ventas rápidas de productos a clientes de paso sin estar vinculados a una habitación.
                </p>
                
                <TestCase 
                    id="ESCENARIO 1: VENTA CON SINPE MÓVIL"
                    description="Verificar que el proceso de pago por SINPE Móvil muestre la información correcta."
                    precondition="En el Dashboard, hacer clic en 'Venta Directa (POS)'. Debe haber una cuenta SINPE activa."
                    steps={[
                        "Agregar un producto al carrito.",
                        "Hacer clic en 'Pagar'.",
                        "Seleccionar 'SINPE Móvil'."
                    ]}
                    data="Monto de la venta."
                    expectedResult="El sistema muestra el número o código QR de la cuenta SINPE activa."
                />
            </div>

            {/* Sección 6 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Database className="h-6 w-6" />
                    6. Manual por Pantalla: Gestión de Inventario
                </h2>
                <p className="text-slate-700 mb-6">
                    Administración del catálogo de productos físicos y de producción, controlando sus costos, precios y existencias.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Métricas de Inventario</p>
                        <img src="/media__1778800446891.png" alt="Métricas" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Formulario de Producto</p>
                        <img src="/media__1778799867083.png" alt="Formulario" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>

                <div className="space-y-4">
                    <TestCase 
                        id="ESCENARIO 1: AGREGAR PRODUCTO COMPRADO"
                        description="Verificar que un producto comprado se guarde con su stock y costo."
                        precondition="En el Dashboard, hacer clic en 'Gestión de Inventario'."
                        steps={[
                            "Hacer clic en 'Añadir Producto'.",
                            "Seleccionar Fuente: 'Comprado'.",
                            "Ingresar Nombre, Costo y Venta.",
                            "Ingresar Existencias.",
                            "Hacer clic en 'Guardar Producto'."
                        ]}
                        data="Datos del producto."
                        expectedResult="El producto aparece en la lista con sus unidades."
                    />
                </div>
            </div>

            {/* Sección 7 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    7. Manual por Pantalla: Gestión de Clientes
                </h2>
                <p className="text-slate-700 mb-6">
                    Registro detallado de huéspedes y control de seguridad mediante Lista Negra.
                </p>

                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 text-center text-sm text-slate-500 mb-6">
                    [Diagrama de flujo removido para la versión impresa]
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Listado de Huéspedes</p>
                        <img src="/media__1778800645199.png" alt="Huéspedes" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Confirmar Bloqueo</p>
                        <img src="/media__1778800681047.png" alt="Bloqueo" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>

                <div className="space-y-4">
                    <TestCase 
                        id="ESCENARIO 1: MOVER CLIENTE A LISTA NEGRA"
                        description="Verificar que un cliente pueda ser bloqueado."
                        precondition="En el Dashboard, hacer clic en 'Gestión de Clientes'. Cliente debe estar en 'Huéspedes Activos'."
                        steps={[
                            "Hacer clic en los tres puntos del cliente.",
                            "Seleccionar 'MOVER A LISTA NEGRA'.",
                            "Escribir el motivo y confirmar."
                        ]}
                        data="Motivo del bloqueo."
                        expectedResult="El cliente se mueve a Lista Negra con icono de calavera."
                    />
                </div>
            </div>

            {/* Sección 8 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Smartphone className="h-6 w-6" />
                    8. Manual por Pantalla: Gestión de SINPE Móvil
                </h2>
                <p className="text-slate-700 mb-6">
                    Administración de las cuentas telefónicas para recibir pagos, con control de límites mensuales.
                </p>
                
                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 text-center text-sm text-slate-500 mb-6">
                    [Diagrama de flujo removido para la versión impresa]
                </div>

                <TestCase 
                    id="ESCENARIO 1: AGREGAR CUENTA SINPE"
                    description="Verificar que una nueva cuenta se cree correctamente."
                    precondition="En el Dashboard, hacer clic en 'Gestión de SINPE'."
                    steps={[
                        "Hacer clic en 'Añadir Cuenta SINPE'.",
                        "Ingresar Titular, Teléfono y Banco.",
                        "Hacer clic en 'Guardar'."
                    ]}
                    data="Datos de la cuenta."
                    expectedResult="La cuenta aparece activa en el listado."
                />
            </div>

            {/* Sección 9 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <BedDouble className="h-6 w-6" />
                    9. Manual por Pantalla: Tipos de Habitación
                </h2>
                <p className="text-slate-700 mb-6">
                    Definición de categorías de habitaciones y sus respectivas tarifas por tiempo.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Listado de Categorías</p>
                        <img src="/media__1778801190882.png" alt="Categorías" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Formulario de Edición</p>
                        <img src="/media__1778801218257.png" alt="Formulario" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>

                <TestCase 
                    id="ESCENARIO 1: CREAR TIPO DE HABITACIÓN CON PLAN DE PRECIOS"
                    description="Verificar que se pueda crear una categoría y asignarle precios."
                    precondition="En el Dashboard, hacer clic en 'Ajustes del Sistema'."
                    steps={[
                        "Hacer clic en 'Añadir Tipo de Habitación'.",
                        "Ingresar Nombre y Capacidad.",
                        "Definir el Plan de Precios (Horas, Precio).",
                        "Hacer clic en 'Guardar'."
                    ]}
                    data="Datos de la categoría."
                    expectedResult="La categoría aparece con su plan de precios."
                />
            </div>

            {/* Sección 10 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <BookCopy className="h-6 w-6" />
                    10. Manual por Pantalla: Catálogo de Productos
                </h2>
                <p className="text-slate-700 mb-6">
                    Organización del menú en categorías y subcategorías mediante una estructura en cascada.
                </p>
                
                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 text-center text-sm text-slate-500 mb-6">
                    [Diagrama de flujo removido para la versión impresa]
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 break-inside-avoid">
                    <div className="border p-4 rounded-lg border-slate-300">
                        <h4 className="font-bold mb-1 text-slate-800">Estructura de Tres Columnas</h4>
                        <ul className="text-sm list-disc pl-5 text-slate-700 space-y-1">
                            <li><b>Categorías:</b> Nivel alto (Ej: Bebidas).</li>
                            <li><b>Sub-Categorías:</b> Divisiones (Ej: Cervezas).</li>
                            <li><b>Productos:</b> Artículos finales (Ej: Corona).</li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Vista del Catálogo</p>
                        <img src="/media__1778801385907.png" alt="Vista del Catálogo" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>
            </div>

            {/* Sección 11 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <LayoutGrid className="h-6 w-6" />
                    11. Administración de Página Pública (Landing Page)
                </h2>
                <p className="text-slate-700 mb-6">
                    Personalización visual y textual del sitio web público del motel, incluyendo secciones como Hero, Amenidades y Galería.
                </p>
                <div className="flex justify-center mb-6 break-inside-avoid">
                    <img src="/media__1778801517090.png" alt="Formulario Landing" className="rounded-lg border border-slate-300 max-w-sm" />
                </div>
            </div>

            {/* Sección 12 */}
            <div className="mb-12 border-b-2 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <Percent className="h-6 w-6" />
                    12. Centro de Notificaciones y Alertas
                </h2>
                <p className="text-slate-700 mb-6">
                    Programación de avisos para clientes y personal, clasificados por prioridades de urgencia.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Listado de Avisos</p>
                        <img src="/media__1778801792040.png" alt="Avisos" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="break-inside-avoid">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Configuración de Sonidos</p>
                        <img src="/media__1778801675467.png" alt="Sonidos" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>
            </div>

            {/* Sección 13 */}
            <div className="mb-12 pb-6 break-before-page">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-6 w-6" />
                    13. Información Comercial de la Empresa
                </h2>
                <p className="text-slate-700 mb-6">
                    Configuración de datos legales, fiscales y presencia digital oficial que se utilizan en la facturación y la web.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 break-inside-avoid">
                    <div className="border p-2 rounded-lg border-slate-300">
                        <p className="text-xs text-slate-500 uppercase mb-1">Pestaña Identidad</p>
                        <img src="/media__1778801920032.png" alt="Identidad" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="border p-2 rounded-lg border-slate-300">
                        <p className="text-xs text-slate-500 uppercase mb-1">Pestaña Contacto</p>
                        <img src="/media__1778801928063.png" alt="Contacto" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                    <div className="border p-2 rounded-lg border-slate-300">
                        <p className="text-xs text-slate-500 uppercase mb-1">Pestaña Social</p>
                        <img src="/media__1778801936348.png" alt="Social" className="rounded-lg border border-slate-300 w-full" />
                    </div>
                </div>
            </div>

            {/* FIN DEL DOCUMENTO */}
            <div className="text-center text-xs text-slate-400 mt-20 border-t pt-4">
                © {new Date().getFullYear()} Hotel Du Manolo. Todos los derechos reservados.
            </div>
        </div>
    );
}
