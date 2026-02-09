'use client';

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
import type { RoomType } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface RoomTypesTableProps {
  initialRoomTypes: RoomType[];
}

export default function RoomTypesTable({ initialRoomTypes }: RoomTypesTableProps) {
  const roomTypes = initialRoomTypes;

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
            <TableHead className="w-[80px]">Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Características</TableHead>
            <TableHead>Planes de Precios</TableHead>
            <TableHead>
                <span className="sr-only">Acciones</span>
            </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {roomTypes.map((roomType) => (
            <TableRow key={roomType.id}>
                <TableCell><Badge variant="outline">{roomType.code}</Badge></TableCell>
                <TableCell className="font-medium">{roomType.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {roomType.features?.map(feature => (
                        <Badge key={feature} variant="secondary">{feature}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    {roomType.pricePlans?.map(plan => (
                        <Badge key={plan.name} variant="outline" className="font-normal whitespace-nowrap">
                          {`${plan.name} (${plan.hours}hs): ${formatCurrency(plan.price)}`}
                        </Badge>
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
