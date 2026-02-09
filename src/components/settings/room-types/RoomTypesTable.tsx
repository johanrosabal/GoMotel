'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RoomType } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import EditRoomTypeDialog from './EditRoomTypeDialog';
import DeleteRoomTypeAlert from './DeleteRoomTypeAlert';

interface RoomTypesTableProps {
  initialRoomTypes: RoomType[];
}

export default function RoomTypesTable({ initialRoomTypes }: RoomTypesTableProps) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(initialRoomTypes);
  const [loading, setLoading] = useState(initialRoomTypes.length === 0);

  useEffect(() => {
    const q = query(collection(db, 'roomTypes'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: RoomType[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as RoomType);
      });
      setRoomTypes(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading && roomTypes.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Cargando tipos de habitación...</div>;
  }

  if (roomTypes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
        No se encontraron tipos de habitación. Haga clic en 'Añadir Tipo de Habitación' para comenzar.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Características</TableHead>
            <TableHead>
                <span className="sr-only">Acciones</span>
            </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {roomTypes.map((roomType) => (
            <TableRow key={roomType.id}>
                <TableCell className="font-medium">{roomType.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {roomType.features?.map(feature => (
                        <Badge key={feature} variant="secondary">{feature}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
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
                    <EditRoomTypeDialog roomType={roomType}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>
                    </EditRoomTypeDialog>
                    <DeleteRoomTypeAlert roomTypeId={roomType.id}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                    </DeleteRoomTypeAlert>
                    </DropdownMenuContent>
                </DropdownMenu>
                </TableCell>
            </TableRow>
            ))}
        </TableBody>
        </Table>
    </div>
  );
}
