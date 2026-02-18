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
import Link from 'next/link';
import DeleteRoomTypeAlert from './DeleteRoomTypeAlert';
import type { RoomType } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RoomTypesTableProps {
  roomTypes: RoomType[];
}

function ActionsMenu({ roomType }: { roomType: RoomType }) {
    return (
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
                <Link href={`/settings/room-types/edit/${roomType.id}`}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>
                </Link>
                <DeleteRoomTypeAlert roomTypeId={roomType.id}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                </DeleteRoomTypeAlert>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function RoomTypesTable({ roomTypes }: RoomTypesTableProps) {
  if (roomTypes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
        No se encontraron tipos de habitación. Haga clic en 'Añadir Tipo de Habitación' para comenzar.
      </div>
    );
  }

  return (
    <>
        {/* Mobile View: Card List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {roomTypes.map((roomType) => (
            <Card key={roomType.id}>
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div className='space-y-1'>
                            <CardTitle className="text-lg">{roomType.name}</CardTitle>
                            <Badge variant="outline">{roomType.code}</Badge>
                        </div>
                        <ActionsMenu roomType={roomType} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                <div>
                    <h4 className="font-medium mb-2">Características</h4>
                    {roomType.features && roomType.features.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                        {roomType.features.map(feature => (
                            <Badge key={feature} variant="secondary">{feature}</Badge>
                        ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Sin características</p>
                    )}
                </div>
                <div>
                    <h4 className="font-medium mb-2">Planes de Precios</h4>
                    {roomType.pricePlans && roomType.pricePlans.length > 0 ? (
                        <div className="flex flex-col items-start gap-1">
                        {roomType.pricePlans.map(plan => (
                            <Badge key={plan.name} variant="outline" className="font-normal whitespace-nowrap">
                                {`${plan.name}: ${formatCurrency(plan.price)}`}
                            </Badge>
                        ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Sin planes de precios</p>
                    )}
                </div>
                </CardContent>
            </Card>
            ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block rounded-md border">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Características</TableHead>
                <TableHead>Planes de Precios</TableHead>
                <TableHead className="text-right w-[50px]">
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
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {roomType.features?.map(feature => (
                            <Badge key={feature} variant="secondary">{feature}</Badge>
                        ))}
                    </div>
                    </TableCell>
                    <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                        {roomType.pricePlans?.map(plan => (
                            <Badge key={plan.name} variant="outline" className="font-normal whitespace-nowrap">
                            {`${plan.name}: ${formatCurrency(plan.price)}`}
                            </Badge>
                        ))}
                    </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <ActionsMenu roomType={roomType} />
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
    </>
  );
}
