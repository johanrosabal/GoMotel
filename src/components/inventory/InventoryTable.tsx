'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import EditServiceDialog from './EditServiceDialog';
import DeleteServiceAlert from './DeleteServiceAlert';

interface InventoryTableProps {
  initialServices: Service[];
  allServices: Service[];
}

const categoryMap: Record<Service['category'], string> = {
  Food: 'Comida',
  Beverage: 'Bebida',
  Amenity: 'Amenidad',
};

function ActionsCell({ service, allServices }: { service: Service, allServices: Service[] }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>Editar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <EditServiceDialog service={service} allServices={allServices} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
            <DeleteServiceAlert serviceId={service.id} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} />
        </>
    );
}

export default function InventoryTable({ initialServices, allServices }: InventoryTableProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [loading, setLoading] = useState(initialServices.length === 0);

  useEffect(() => {
    const q = query(
      collection(db, 'services')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const servicesData: Service[] = [];
      querySnapshot.forEach((doc) => {
        servicesData.push({ id: doc.id, ...doc.data() } as Service);
      });
      servicesData.sort((a, b) => {
        if (a.category.localeCompare(b.category) !== 0) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
      setServices(servicesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading && services.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Cargando inventario...</div>;
  }

  if (services.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
        No se encontraron servicios. Haga clic en 'Añadir Servicio' para comenzar.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Existencias</TableHead>
            <TableHead>
                <span className="sr-only">Acciones</span>
            </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {services.map((service) => (
            <TableRow key={service.id}>
                <TableCell className="font-medium">{service.name}</TableCell>
                <TableCell>
                <Badge variant="secondary">{categoryMap[service.category]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                {formatCurrency(service.price)}
                </TableCell>
                <TableCell className="text-right">{service.stock}</TableCell>
                <TableCell>
                    <ActionsCell service={service} allServices={allServices} />
                </TableCell>
            </TableRow>
            ))}
        </TableBody>
        </Table>
    </div>
  );
}
