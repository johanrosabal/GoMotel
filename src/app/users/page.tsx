'use client';

import { useState, useEffect } from 'react';
import { getUsers } from '@/lib/actions/user.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UsersTable from '@/components/users/UsersTable';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import UserFormDialog from '@/components/users/UserFormDialog';
import type { UserProfile } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers().then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const toISO = (dateVal: any) => {
      if (!dateVal) return null;
      if (typeof dateVal === 'string') return new Date(dateVal).toISOString();
      if (typeof dateVal.toDate === 'function') return dateVal.toDate().toISOString();
      return null;
  };

  const serializedUsers = users.map(user => {
      return {
          ...user,
          createdAt: toISO(user.createdAt) || new Date().toISOString(),
          birthDate: toISO(user.birthDate) || '',
          deletedAt: toISO(user.deletedAt) || null,
      };
  });

  if (loading) {
    return (
      <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Equipo de Trabajo</h1>
            <p className="text-muted-foreground max-w-2xl">
              Cargando usuarios...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Equipo de Trabajo</h1>
          <p className="text-muted-foreground max-w-2xl">
            Gestión integral de cuentas de usuario, asignación de roles y control de seguridad organizacional.
          </p>
        </div>
        <UserFormDialog>
            <Button id="page-button-a-adir-nuevo-usuario" data-testid="users-add-button">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Nuevo Usuario
            </Button>
        </UserFormDialog>
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
