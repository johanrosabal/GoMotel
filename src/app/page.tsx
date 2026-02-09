import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, Cog } from 'lucide-react';

const sections = [
    {
        title: 'Panel de Habitaciones',
        description: 'Visualice y gestione el estado de todas las habitaciones en tiempo real.',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Inventario y Servicios',
        description: 'Administre los productos y servicios disponibles para los huéspedes.',
        href: '/inventory',
        icon: Package,
    },
    {
        title: 'Ajustes del Sistema',
        description: 'Configure los parámetros de la aplicación, como los tipos de habitación.',
        href: '/settings',
        icon: Cog,
    }
]

export default function HubPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8">
        <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Panel de Control de Go Motel</h1>
                <p className="text-muted-foreground mt-3 text-lg">
                    Bienvenido al centro de operaciones de su motel. Seleccione una sección para comenzar.
                </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                {sections.map(section => (
                    <Card key={section.href} className="flex flex-col">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <section.icon className="h-6 w-6 text-primary" />
                                {section.title}
                            </CardTitle>
                            <CardDescription className="pt-2">{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow flex items-end">
                            <Link href={section.href} className="w-full">
                                <Button className='w-full'>Administrar</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    </div>
  );
}
