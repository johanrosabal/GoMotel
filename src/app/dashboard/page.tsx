import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LayoutGrid, Package, Cog } from 'lucide-react';

const menuOptions = [
    {
        href: '/dashboard/rooms',
        title: 'Panel de Habitaciones',
        description: 'Vea y administre el estado de todas las habitaciones.',
        icon: LayoutGrid,
    },
    {
        href: '/inventory',
        title: 'Inventario',
        description: 'Administre los servicios y productos de su motel.',
        icon: Package,
    },
    {
        href: '/settings',
        title: 'Ajustes',
        description: 'Configure los ajustes del sistema, como los tipos de habitación.',
        icon: Cog,
    },
];

export default function DashboardPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
        <div className='space-y-1.5'>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel de Control Principal</h1>
            <p className="text-muted-foreground max-w-2xl">
                Bienvenido a Go Motel. Seleccione una opción a continuación para comenzar a administrar su motel.
            </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {menuOptions.map((option) => (
                <Card key={option.href} className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                            <option.icon className="h-6 w-6" />
                            {option.title}
                        </CardTitle>
                        <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="mt-auto">
                        <Button asChild className="w-full">
                            <Link href={option.href}>Ir a {option.title}</Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
  );
}
