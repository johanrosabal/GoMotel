import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BedDouble, Bell, Percent, BookCopy, Building, ShieldCheck, Layout } from 'lucide-react';

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
                    <CardTitle className="flex items-center gap-2 text-xl"><Building /> Información Comercial</CardTitle>
                    <CardDescription>Gestione los datos legales y fiscales de su empresa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/company" id="page-link-settings-company">
                        <Button id="page-button-administrar">Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><BedDouble /> Tipos de Habitación</CardTitle>
                    <CardDescription>Gestionar los tipos de habitación disponibles (ej. Sencilla, Suite).</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/room-types" id="page-link-settings-room-types">
                        <Button id="page-button-administrar-1">Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Bell /> Sonido de Alarma</CardTitle>
                    <CardDescription>Seleccione el sonido para las notificaciones de estancias vencidas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/sounds" id="page-link-settings-sounds">
                        <Button id="page-button-seleccionar-sonido">Seleccionar Sonido</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Percent /> Gestión de Impuestos</CardTitle>
                    <CardDescription>Defina los impuestos aplicables a productos y servicios.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/taxes" id="page-link-settings-taxes">
                        <Button id="page-button-administrar-2">Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><BookCopy /> Catálogo de Productos</CardTitle>
                    <CardDescription>Gestiona categorías, sub-categoría y productos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/catalog" id="page-link-catalog">
                        <Button id="page-button-administrar-3">Administrar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><ShieldCheck /> Verificación de Cédula</CardTitle>
                    <CardDescription>Configure el dominio del API de verificación del Registro Civil.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/verification" id="page-link-settings-verification">
                        <Button id="page-button-configurar">Configurar</Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Layout /> Administración de Contenido</CardTitle>
                    <CardDescription>Gestione los textos e información de la Página de Inicio.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/settings/landing-page" id="page-link-settings-landing-page">
                        <Button id="page-button-gestionar-cms">Gestionar</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
