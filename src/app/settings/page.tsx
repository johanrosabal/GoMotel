import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BedDouble, Bell, Percent } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
        <div className='space-y-1.5'>
            <CardTitle>Ajustes del Sistema</CardTitle>
            <CardDescription>Administre las configuraciones de su motel.</CardDescription>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><BedDouble /> Tipos de Habitación</CardTitle>
                    <CardDescription>Gestionar los tipos de habitación disponibles (ej. Sencilla, Suite).</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/room-types">
                        <Button>Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Bell /> Sonido de Alarma</CardTitle>
                    <CardDescription>Seleccione el sonido para las notificaciones de estancias vencidas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/sounds">
                        <Button>Seleccionar Sonido</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Percent /> Gestión de Impuestos</CardTitle>
                    <CardDescription>Defina los impuestos aplicables a productos y servicios.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/taxes">
                        <Button>Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
