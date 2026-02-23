import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { FileCode, Database, Workflow, ShieldCheck, Layers, Users } from 'lucide-react';

export default function ProjectDocsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            {/* Page Header */}
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <FileCode className="h-8 w-8" />
                    Documentación Técnica del Proyecto
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Una visión profunda de la arquitectura, flujos de datos, reglas de negocio y especificaciones técnicas del sistema Go Motel.
                </p>
            </div>

            {/* Tech Stack */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Layers className="h-6 w-6" />Arquitectura Tecnológica</CardTitle>
                    <CardDescription>Componentes y tecnologías que dan vida a la aplicación.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Framework:</strong> Next.js 15 (con App Router)</li>
                        <li><strong>Lenguaje:</strong> TypeScript</li>
                        <li><strong>Backend y Base de Datos:</strong> Firebase (Firestore, Authentication)</li>
                        <li><strong>UI:</strong> React, ShadCN UI, Tailwind CSS</li>
                        <li><strong>Gestión de Formularios:</strong> React Hook Form con Zod para validación de esquemas.</li>
                        <li><strong>Gestión de Estado:</strong> React Hooks y Context API para un manejo de estado ligero.</li>
                        <li><strong>Inteligencia Artificial:</strong> Genkit para flujos de IA.</li>
                        <li><strong>Despliegue:</strong> Firebase App Hosting</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Data Structure */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" />Estructura de Datos (Firestore)</CardTitle>
                    <CardDescription>Descripción de las colecciones principales en la base de datos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="rooms">
                            <AccordionTrigger>/rooms</AccordionTrigger>
                            <AccordionContent>Almacena cada habitación individual del motel, su estado actual (Disponible, Ocupada, etc.), tarifa y el ID de la estancia activa si la hubiera.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="roomTypes">
                            <AccordionTrigger>/roomTypes</AccordionTrigger>
                            <AccordionContent>Define las categorías de habitaciones (Sencilla, Doble, Suite), incluyendo capacidad, características y, crucialmente, los planes de precios asociados.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="stays">
                            <AccordionTrigger>/stays</AccordionTrigger>
                            <AccordionContent>Registra cada estancia de un huésped, desde el check-in hasta el check-out. Contiene el historial de extensiones y los detalles de pago.</AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="reservations">
                            <AccordionTrigger>/reservations</AccordionTrigger>
                            <AccordionContent>Guarda las reservaciones futuras o pasadas. Su estado cambia de 'Confirmada' a 'Checked-in' y finalmente a 'Completada', 'Cancelada' o 'No-show'.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="clients">
                            <AccordionTrigger>/clients</AccordionTrigger>
                            <AccordionContent>Funciona como un CRM básico, almacenando información de clientes recurrentes para agilizar el check-in y ofrecer un servicio personalizado (marcando VIPs).</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="services">
                            <AccordionTrigger>/services</AccordionTrigger>
                            <AccordionContent>Catálogo de todos los productos y servicios ofrecidos, incluyendo bebidas, comidas y amenidades. Diferencia entre productos de 'Producción Interna' (cocina) y 'Comprados' (con control de stock).</AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="orders">
                            <AccordionTrigger>/orders</AccordionTrigger>
                            <AccordionContent>Representa cada pedido de servicio realizado para una estancia activa. Contiene los artículos, el total y el estado de pago.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="invoices">
                            <AccordionTrigger>/invoices</AccordionTrigger>
                            <AccordionContent>Almacena un registro de todas las facturas generadas por el sistema, ya sea por pagos adelantados (reservación, extensión, pedido) o en el check-out final.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="suppliers">
                            <AccordionTrigger>/suppliers</AccordionTrigger>
                            <AccordionContent>Catálogo de proveedores de los productos comprados. Requisito para registrar facturas de compra.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="purchaseInvoices">
                            <AccordionTrigger>/purchaseInvoices</AccordionTrigger>
                            <AccordionContent>Registro de las facturas de compra de los proveedores. Al crear una, se actualiza automáticamente el stock de los productos correspondientes.</AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="taxes">
                            <AccordionTrigger>/taxes</AccordionTrigger>
                            <AccordionContent>Configuración de los diferentes tipos de impuestos (ej. IVA) que se pueden aplicar a los productos.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sinpeAccounts">
                            <AccordionTrigger>/sinpeAccounts</AccordionTrigger>
                            <AccordionContent>Administra las cuentas de SINPE Móvil para recibir pagos, incluyendo lógica de rotación basada en límites de saldo.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="users">
                            <AccordionTrigger>/users</AccordionTrigger>
                            <AccordionContent>Perfiles de los usuarios del sistema (personal del motel), con sus datos personales y rol asignado.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="roles_admin">
                            <AccordionTrigger>/roles_admin</AccordionTrigger>
                            <AccordionContent>Colección de control de acceso. La existencia de un documento con el UID de un usuario le otorga privilegios de 'Administrador'.</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            {/* Business Flows */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Workflow className="h-6 w-6" />Flujos de Negocio</CardTitle>
                    <CardDescription>Procesos clave que definen la operativa del motel.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="guest-cycle">
                            <AccordionTrigger>Ciclo de Vida del Huésped</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p><strong>1. Reservación/Check-in:</strong> Se crea una <Badge variant="secondary">reservación</Badge> con estado 'Confirmada'. Si es un walk-in, se crea la reservación y se pasa a 'Checked-in' inmediatamente, creando también una <Badge variant="secondary">estancia</Badge>.</p>
                                <p><strong>2. Check-in desde Reservación:</strong> Al hacer check-in desde una reservación confirmada, su estado cambia a 'Checked-in' y se genera una nueva <Badge variant="secondary">estancia</Badge> activa.</p>
                                <p><strong>3. Estancia Activa:</strong> Durante la estancia, se pueden añadir <Badge variant="secondary">pedidos</Badge> y <Badge variant="secondary">extensiones</Badge>. La habitación figura como 'Ocupada'.</p>
                                <p><strong>4. Check-out:</strong> Se calcula el total final, se genera la <Badge variant="secondary">factura</Badge>, la estancia se marca como pagada y el estado de la habitación cambia a 'Limpieza'.</p>
                                <p><strong>5. Limpieza:</strong> La habitación aparece en la cola de limpieza hasta que un usuario la marca como 'Disponible', completando el ciclo.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="inventory-flow">
                            <AccordionTrigger>Flujo de Inventario</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p><strong>1. Alta de Productos:</strong> Se crean productos en el catálogo, diferenciando entre 'Comprados' (con stock) y de 'Producción Interna'.</p>
                                <p><strong>2. Entrada de Stock:</strong> Se registra una <Badge variant="secondary">factura de compra</Badge>, seleccionando productos y cantidades. Al guardar, el stock de esos productos se incrementa automáticamente.</p>
                                <p><strong>3. Salida de Stock:</strong> Al crear un <Badge variant="secondary">pedido</Badge> para un cliente, el stock de los productos 'Comprados' se reduce automáticamente.</p>
                                <p><strong>4. Ajuste de Stock (Merma):</strong> Desde el historial de compras, se puede registrar una merma sobre una factura para ajustar el inventario por productos dañados o vencidos.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="billing-flow">
                            <AccordionTrigger>Flujo de Pagos y Facturación</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p><strong>Cuenta Abierta vs. Pago Adelantado:</strong> Todas las acciones que generan un costo (reservar, extender, pedir) permiten dos modalidades: 'Cuenta Abierta' (se acumula para el final) o 'Pagar Ahora'.</p>
                                <p><strong>Generación de Factura:</strong> Si se elige 'Pagar Ahora', se genera una <Badge variant="secondary">factura</Badge> automáticamente con el concepto y monto correspondiente.</p>
                                <p><strong>Factura Final:</strong> En el check-out, se genera una factura final que consolida todos los cargos pendientes de la estancia.</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            {/* Business Rules */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-6 w-6" />Reglas de Negocio y Validaciones</CardTitle>
                    <CardDescription>Lógica y restricciones clave implementadas en el sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Disponibilidad de Habitaciones:</strong> El sistema previene conflictos, no permitiendo crear reservaciones o hacer check-in en fechas/horas que se solapen con otras reservaciones 'Confirmadas' o 'Checked-in' para la misma habitación.</li>
                        <li><strong>Control de Stock:</strong> No se pueden añadir a un pedido productos 'Comprados' cuyo stock sea 0.</li>
                        <li><strong>Extensión de Estancias:</strong> Si una estancia está vencida, la base para calcular la nueva hora de check-out es la hora actual. Si no está vencida, es la hora de check-out original.</li>
                        <li><strong>Rotación de Cuentas SINPE:</strong> El sistema selecciona automáticamente la primera cuenta SINPE activa cuyo saldo, más el monto del pago, no exceda su límite mensual configurado.</li>
                        <li><strong>Roles de Usuario:</strong> El primer usuario en registrarse obtiene el rol de 'Administrador'. Los siguientes por defecto son 'Recepcion'. Solo los administradores pueden ver ciertas secciones, como la gestión de usuarios o la eliminación de reservaciones.</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
