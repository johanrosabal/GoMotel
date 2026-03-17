import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { FileCode, Database, Workflow, ShieldCheck, Layers, Users, FileText, CheckCircle } from 'lucide-react';

export default function ProjectDocsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <FileCode className="h-8 w-8 text-primary" />
                    Documentación Técnica del Proyecto
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Especificaciones de arquitectura, lógica de negocio y flujos de datos sincronizados del sistema Go Motel.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Workflow className="h-6 w-6 text-primary" />Flujos de Negocio Core</CardTitle>
                    <CardDescription>Lógica de alto nivel implementada en los procesos principales.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="guest-assistant">
                            <AccordionTrigger>Asistente de Reservaciones (3 Pasos)</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p><strong>Paso 1 (Huésped):</strong> Identificación del cliente. Si existe en la colección <code>/clients</code>, se vincula para historial de visitas y estado VIP. Filtrado reactivo de habitaciones con estado 'Available'.</p>
                                <p><strong>Paso 2 (Estancia):</strong> Selección de <code>PricePlan</code>. El sistema proyecta la <code>expectedCheckOut</code> sumando la duración del plan a la hora de entrada. Soporta 'Check-in Now' o programado.</p>
                                <p><strong>Paso 3 (Pago):</strong> Decisión de facturación. Si es 'Cuenta Abierta', no se genera factura inicial. Si se paga por adelantado, se genera un documento en <code>/invoices</code> y se actualiza el saldo de la cuenta SINPE si aplica.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="intelligent-checkout">
                            <AccordionTrigger>Lógica de Check-out Inteligente</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p>El sistema realiza una auditoría de saldos antes de abrir el diálogo de cobro:</p>
                                <ul className="list-disc list-inside pl-4 space-y-1">
                                    <li>Suma de Plan de Precios de Estancia.</li>
                                    <li>Suma de Pedidos activos (estado != 'Cancelado') con pago pendiente.</li>
                                    <li>Resta de Pagos Adelantados registrados en el documento de estancia.</li>
                                </ul>
                                <p><strong>Optimización:</strong> Si el resultado es 0.00, el componente omite el selector de métodos de pago y procesa la liberación de la habitación inmediatamente, enviando al usuario al visor de comprobante final.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="kds-sync">
                            <AccordionTrigger>Sincronización Cocina / Bar (KDS)</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <p>Al crear un <code>Order</code>, los productos se clasifican por su categoría contable (Food/Beverage). Esto dispara estados independientes:</p>
                                <ul className="list-disc list-inside pl-4 space-y-1">
                                    <li><code>kitchenStatus</code>: Controla la aparición en <code>/kitchen</code>.</li>
                                    <li><code>barStatus</code>: Controla la aparición en <code>/bar</code>.</li>
                                </ul>
                                <p>El estado global del pedido solo pasa a 'Entregado' cuando ambas áreas han marcado sus respectivos ítems como listos.</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />Reglas de Validación Críticas</CardTitle>
                    <CardDescription>Restricciones implementadas para garantizar la integridad de la operación.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-muted/20">
                            <h4 className="font-bold flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-green-600" />Integridad de Inventario</h4>
                            <p className="text-sm text-muted-foreground">No se permite añadir productos 'Comprados' a un pedido si el stock es insuficiente. La cancelación de pedidos restaura automáticamente las existencias mediante transacciones atómicas.</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/20">
                            <h4 className="font-bold flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-green-600" />Protección de Cobro</h4>
                            <p className="text-sm text-muted-foreground">El botón de finalizar en el asistente de reservaciones tiene un 'cooldown' de 500ms al entrar al Paso 3, previniendo que un doble clic accidental omita la selección del método de pago.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6 text-primary" />Estructura de Datos (Extensiones)</CardTitle>
                    <CardDescription>Actualización sobre cómo se almacenan los cambios de tiempo en estancias.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="stay-extension">
                            <AccordionTrigger>Colección /stays (Historial de Tiempo)</AccordionTrigger>
                            <AccordionContent>
                                <p>Las extensiones de estancia no sobrescriben los datos originales, se acumulan en un array <code>extensionHistory</code> dentro del documento de la estancia. Cada entrada registra:</p>
                                <pre className="mt-2 p-3 bg-black text-green-400 rounded-lg text-xs overflow-x-auto">
{`{
  extendedAt: Timestamp,
  oldExpectedCheckOut: Timestamp,
  newExpectedCheckOut: Timestamp,
  planName: string,
  planPrice: number
}`}
                                </pre>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
