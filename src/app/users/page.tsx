import { getUsers } from '@/lib/actions/user.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UsersTable from '@/components/users/UsersTable';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function UsersPage() {
  const users = await getUsers();
  
  const serializedUsers = users.map(user => ({
      ...user,
      createdAt: user.createdAt.toDate().toISOString(),
      birthDate: user.birthDate.toDate().toISOString(),
  }));

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Equipo de Trabajo</h1>
          <p className="text-muted-foreground max-w-2xl">
            Gestión integral de cuentas de usuario, asignación de roles y control de seguridad organizacional.
          </p>
        </div>
        <Button asChild>
          {/* This link is a placeholder for a future "Add User" form or dialog */}
          <Link href="/register">
            <PlusCircle className="mr-2" />
            Añadir Nuevo Usuario
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Busque, filtre y gestione a los miembros de su equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={serializedUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
