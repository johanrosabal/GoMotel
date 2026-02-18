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
import { MoreHorizontal, Tag, DollarSign } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
        {/* Mobile & Tablet View: Card List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:hidden">
            {roomTypes.map((roomType) => (
                <Card key={roomType.id} className="flex flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <CardTitle>{roomType.name}</CardTitle>
                                <CardDescription>Código: {roomType.code}</CardDescription>
                            </div>
                            <ActionsMenu roomType={roomType} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                                <Tag className="h-4 w-4" />
                                Características
                            </h4>
                            {roomType.features && roomType.features.length > 0 ? (
                                <ul className="space-y-2">
                                    {roomType.features.map(feature => (
                                        <li key={feature} className="flex items-center text-sm">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary/40 mr-3 flex-shrink-0"></span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sin características</p>
                            )}
                        </div>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                                <DollarSign className="h-4 w-4" />
                                Planes de Precios
                            </h4>
                            {roomType.pricePlans && roomType.pricePlans.length > 0 ? (
                                <ul className="space-y-1.5 text-sm">
                                {roomType.pricePlans.map(plan => (
                                    <li key={plan.name} className="flex justify-between">
                                        <span>{plan.name}</span>
                                        <span className="font-medium">{formatCurrency(plan.price)}</span>
                                    </li>
                                ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sin planes de precios</p>
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
                    <TableCell className="align-top"><Badge variant="outline">{roomType.code}</Badge></TableCell>
                    <TableCell className="font-medium align-top">{roomType.name}</TableCell>
                    <TableCell className="align-top">
                       {roomType.features && roomType.features.length > 0 ? (
                            <ul className="space-y-1.5 max-w-sm">
                                {roomType.features.map(feature => (
                                    <li key={feature} className="flex items-center text-xs">
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground mr-2 flex-shrink-0"></span>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                           <div className="text-xs text-muted-foreground">N/A</div>
                        )}
                    </TableCell>
                    <TableCell className="align-top">
                        {roomType.pricePlans && roomType.pricePlans.length > 0 ? (
                            <div className="flex flex-col gap-1.5 items-start">
                                {roomType.pricePlans.map(plan => (
                                    <div key={plan.name} className="text-xs whitespace-nowrap">
                                        <span className="font-medium">{plan.name}:</span>
                                        <span className="text-muted-foreground ml-1">{formatCurrency(plan.price)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">N/A</div>
                        )}
                    </TableCell>
                    <TableCell className="text-right align-top">
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
