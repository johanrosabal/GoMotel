import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, BookOpen, CalendarPlus, LogIn, LogOut, Sparkles, BedDouble } from 'lucide-react';
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
                            <div key={status.name}>
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

export default function ManualOperationsPage() {
    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
            <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-8 w-8" />
                    Manual Operativo
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Una guía detallada sobre el flujo de trabajo principal de la aplicación: el ciclo de vida de una reservación.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ciclo de Vida de una Reservación</CardTitle>
                    <CardDescription>
                        Desde la creación hasta que la habitación está lista para el siguiente huésped.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-16 max-w-2xl mx-auto py-8">
                        <Step
                            icon={CalendarPlus}
                            title="Paso 1: Creación de la Reservación"
                            description="Se crea una nueva reservación para un huésped en una fecha futura. La habitación se bloquea para ese período."
                            statuses={[
                                { type: 'Reservación', name: 'Confirmada', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' },
                                { type: 'Habitación', name: 'Disponible', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' },
                            ]}
                        />
                        <Step
                            icon={LogIn}
                            title="Paso 2: Check-in del Huésped"
                            description="Cuando el huésped llega, se realiza el check-in desde la reservación confirmada o como un 'walk-in' en una habitación disponible. Se crea una 'Estancia' activa."
                            statuses={[
                                { type: 'Reservación', name: 'Checked-in', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' },
                                { type: 'Estancia', name: 'Activa', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' },
                                { type: 'Habitación', name: 'Ocupada', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' },
                            ]}
                        />
                         <Step
                            icon={LogOut}
                            title="Paso 3: Check-out del Huésped"
                            description="Al finalizar la estancia, se realiza el check-out. Se calcula la factura final, la reservación se marca como completada y la habitación pasa a limpieza."
                            statuses={[
                                { type: 'Reservación', name: 'Completada', color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50' },
                                { type: 'Estancia', name: 'Completada', color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50' },
                                { type: 'Habitación', name: 'Limpieza', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50' },
                            ]}
                        />
                        <Step
                            icon={Sparkles}
                            title="Paso 4: Proceso de Limpieza"
                            description="El personal de limpieza prepara la habitación para el siguiente huésped. La habitación figura en la 'Cola de Limpieza'."
                            statuses={[
                                { type: 'Habitación', name: 'Limpieza', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50' },
                            ]}
                        />
                        <Step
                            icon={BedDouble}
                            title="Paso 5: Habitación Disponible"
                            description="Una vez que la limpieza ha finalizado, la habitación se marca como 'Disponible' y el ciclo puede comenzar de nuevo."
                            statuses={[
                                { type: 'Habitación', name: 'Disponible', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' },
                            ]}
                            isLast
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
