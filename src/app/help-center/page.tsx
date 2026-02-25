import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, LifeBuoy, Mail } from 'lucide-react';

const faqs = [
    {
        question: "¿Cómo restauro mi contraseña?",
        answer: "Actualmente, la funcionalidad de reseteo de contraseña no está implementada. Si olvida su contraseña, por favor contacte al administrador del sistema para que le asigne una temporal. Recomendamos cambiarla inmediatamente después de iniciar sesión."
    },
    {
        question: "¿Qué hago si una habitación está 'Vencida'?",
        answer: "Una habitación vencida requiere acción inmediata. Vaya al detalle de la habitación (haciendo clic en ella desde el panel de habitaciones o desde la notificación) y tendrá dos opciones: 'Extender Estancia' para añadir un nuevo plan de precios, o 'Realizar Check-Out' para finalizar la estancia y generar la factura."
    },
    {
        question: "¿Cómo doy de baja un producto por merma o daño?",
        answer: "Vaya a la sección de 'Historial de Compras'. En la lista de facturas, utilice el menú de acciones (...) de la factura correspondiente al producto y seleccione 'Registrar Merma'. Ingrese la cantidad de unidades a dar de baja y el inventario se ajustará automáticamente."
    },
    {
        question: "Un pago con SINPE Móvil no se refleja, ¿qué hago?",
        answer: "Primero, verifique que la cuenta SINPE Móvil que está usando esté 'Activa' en la sección de 'Gestión de SINPE'. Si la cuenta ha alcanzado su límite mensual, se desactivará automáticamente. Asegúrese de tener cuentas de respaldo activas. Si el problema persiste, verifique el comprobante del cliente manualmente."
    },
    {
        question: "¿Puedo eliminar una reservación que ya tiene check-in?",
        answer: "No. Por seguridad e integridad de los datos, una reservación que ya ha iniciado una estancia (estado 'Checked-in') no puede ser eliminada. Primero debe realizar el check-out de la estancia correspondiente. Solo las reservaciones en estado 'Confirmada', 'Cancelada' o 'No-show' pueden ser eliminadas por un administrador."
    }
];

export default function HelpCenterPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <HelpCircle className="h-8 w-8" />
                    Centro de Ayuda
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Encuentre respuestas a preguntas frecuentes y cómo obtener soporte técnico para el sistema Go Motel.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Preguntas Frecuentes (FAQ)</CardTitle>
                            <CardDescription>
                                Respuestas rápidas a las dudas más comunes sobre la operación del sistema.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="multiple" className="w-full">
                                {faqs.map((faq, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger>{faq.question}</AccordionTrigger>
                                        <AccordionContent>
                                            {faq.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-1">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LifeBuoy className="h-6 w-6" />
                                Soporte Técnico
                            </CardTitle>
                            <CardDescription>
                                ¿Necesita ayuda personalizada?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Si no encuentra la respuesta a su pregunta en las FAQ o en la documentación, nuestro equipo de soporte está para ayudarle.
                            </p>
                            <div className="flex items-start gap-4">
                                <Mail className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold">Contacto por Email</h4>
                                    <p className="text-sm text-muted-foreground">Para asistencia técnica, errores o sugerencias, escríbanos a:</p>
                                    <a href="mailto:soporte.gomotel@example.com" className="text-sm font-medium text-primary hover:underline">
                                        soporte.gomotel@example.com
                                    </a>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
