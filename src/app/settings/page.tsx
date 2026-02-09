import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BedDouble } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
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
        </div>
    </div>
  );
}
