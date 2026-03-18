'use client';

import { useState, useMemo, useTransition } from 'react';
import type { Client } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AddClientDialog from './AddClientDialog';
import { deleteClient } from '@/lib/actions/client.actions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function ActionsMenu({ client }: { client: Client }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleDelete = () => {
        setIsDeleteDialogOpen(false);
        startTransition(async () => {
            const result = await deleteClient(client.id);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Cliente Eliminado', description: 'El cliente ha sido eliminado exitosamente.' });
            }
        });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} id="clientstable-button-1">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Ficha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Cliente
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            <AddClientDialog client={client} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la ficha del cliente {client.firstName} {client.lastName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? "Eliminando..." : "Confirmar Eliminación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default function ClientsTable({ clients }: { clients: Client[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const searchContent = `${client.firstName} ${client.lastName} ${client.email} ${client.idCard}`.toLowerCase();
      return searchContent.includes(searchTerm.toLowerCase());
    });
  }, [clients, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por nombre, correo o cédula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm" id="clientstable-input-buscar-por-nombre"
        />
      </div>

       {filteredClients.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
            No se encontraron clientes.
        </div>
      ) : (
        <>
            {/* Mobile & Tablet View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:hidden">
                {filteredClients.map(client => (
                <Card key={client.id} className={cn("flex flex-col", client.isVip && 'bg-yellow-100/50 dark:bg-yellow-900/20')}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback>{client.firstName?.[0]}{client.lastName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        {client.firstName} {client.lastName}
                                        {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                    </CardTitle>
                                    <CardDescription>{client.email}</CardDescription>
                                </div>
                            </div>
                            <ActionsMenu client={client} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4 text-sm">
                        <div>
                            <p className="font-semibold text-muted-foreground">Contacto</p>
                            <p>{client.phoneNumber}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-muted-foreground">Cédula</p>
                            <p className="font-mono">{client.idCard}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-muted-foreground">Miembro Desde</p>
                            <p>{format(client.createdAt.toDate(), 'dd MMM yyyy', { locale: es })}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-muted-foreground">Visitas</p>
                            <p>{client.visitCount || 0}</p>
                        </div>
                    </CardContent>
                </Card>
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Miembro Desde</TableHead>
                    <TableHead>Visitas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredClients.map(client => (
                    <TableRow key={client.id} className={cn(client.isVip && 'bg-yellow-100/50 dark:bg-yellow-900/20')}>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarFallback>{client.firstName?.[0]}{client.lastName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                            <div className="font-medium flex items-center gap-2">
                                {client.firstName} {client.lastName}
                                {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                            </div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                            </div>
                        </div>
                        </TableCell>
                        <TableCell>{client.phoneNumber}</TableCell>
                        <TableCell>
                        <div className="font-mono text-sm">{client.idCard}</div>
                        </TableCell>
                        <TableCell>{format(client.createdAt.toDate(), 'dd MMM yyyy', { locale: es })}</TableCell>
                        <TableCell>{client.visitCount || 0}</TableCell>
                        <TableCell className="text-right">
                        <ActionsMenu client={client} />
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        </>
      )}
    </div>
  );
}

    