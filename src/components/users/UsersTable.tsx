'use client';

import { useState, useMemo, useTransition } from 'react';
import type { UserProfile, UserRole } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Edit, UserX, UserCheck } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import UserFormDialog from './UserFormDialog';
import { toggleUserStatus } from '@/lib/actions/user.actions';
import { useToast } from '@/hooks/use-toast';

type SerializedUserProfile = Omit<UserProfile, 'createdAt' | 'birthDate'> & {
  createdAt: string;
  birthDate: string;
};

function ActionsMenu({ user }: { user: SerializedUserProfile }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleToggleStatus = () => {
        startTransition(async () => {
            const result = await toggleUserStatus(user.id, user.status);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Estado Actualizado', description: `La cuenta ahora está ${result.newStatus === 'Active' ? 'Activa' : 'Pausada'}.` });
            }
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} id="userstable-button-1">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones de Cuenta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                        onSelect={handleToggleStatus}
                        className={cn(user.status === 'Active' ? "text-destructive" : "text-green-600")}
                    >
                        {user.status === 'Active' ? (
                            <><UserX className="mr-2 h-4 w-4" /> Pausar Cuenta</>
                        ) : (
                            <><UserCheck className="mr-2 h-4 w-4" /> Activar Cuenta</>
                        )}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <UserFormDialog user={user} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
        </>
    );
}

export default function UsersTable({ users }: { users: SerializedUserProfile[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (!user.firstName || !user.lastName || !user.email) return false;
      const searchMatch = user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatch = roleFilter === 'all' || user.role === roleFilter;
      return searchMatch && roleMatch;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por nombre o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm" id="userstable-input-buscar-por-nombre"
        />
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as any)}>
          <SelectTrigger className="w-[180px]" id="userstable-selecttrigger-1">
            <SelectValue placeholder="Todos los Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Roles</SelectItem>
            <SelectItem value="Administrador">Administrador</SelectItem>
            <SelectItem value="Recepcion">Recepción</SelectItem>
            <SelectItem value="Conserje">Conserje</SelectItem>
            <SelectItem value="Contador">Contador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identidad y Acceso</TableHead>
              <TableHead>Rol / Permisos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Miembro Desde</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <TableRow key={user.id} className={cn(user.status !== 'Active' && "opacity-60 bg-muted/30")}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} />
                    <div>
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className="font-bold">{user.role}</Badge>
                </TableCell>
                <TableCell>
                   <Badge variant="outline" className={cn(user.status === 'Active' 
                        ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' 
                        : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50'
                    )}>
                        {user.status === 'Active' ? 'Activo' : 'Pausado'}
                    </Badge>
                </TableCell>
                <TableCell className="text-xs">{format(new Date(user.createdAt), 'dd MMM yyyy', { locale: es })}</TableCell>
                <TableCell className="text-right">
                  <ActionsMenu user={user} />
                </TableCell>
              </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No se encontraron usuarios con los criterios de búsqueda.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
