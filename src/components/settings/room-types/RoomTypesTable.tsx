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
import { ArrowUpDown, ChevronDown, ChevronUp, MoreHorizontal, Tag, Globe, EyeOff } from 'lucide-react';
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
import { useState, useMemo } from 'react';

interface RoomTypesTableProps {
  roomTypes: RoomType[];
}

function ActionsMenu({ roomType }: { roomType: RoomType }) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost" id="roomtypestable-button-1">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/settings/room-types/edit/${roomType.id}`} id="roomtypestable-link-editar">Editar</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <DeleteRoomTypeAlert roomTypeId={roomType.id} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} />
        </>
    );
}

export default function RoomTypesTable({ roomTypes }: RoomTypesTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof RoomType | 'featuresCount' | 'pricePlansCount';
    direction: 'asc' | 'desc';
  } | null>({ key: 'code', direction: 'asc' });

  const sortedRoomTypes = useMemo(() => {
    let sortableItems = [...roomTypes];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'featuresCount') {
          aValue = a.features?.length || 0;
          bValue = b.features?.length || 0;
        } else if (sortConfig.key === 'pricePlansCount') {
          aValue = a.pricePlans?.length || 0;
          bValue = b.pricePlans?.length || 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [roomTypes, sortConfig]);

  const requestSort = (key: keyof RoomType | 'featuresCount' | 'pricePlansCount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
            {sortedRoomTypes.map((roomType) => (
                <Card key={roomType.id} className="flex flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <CardTitle className="flex items-center gap-2">
                                    {roomType.name}
                                    {roomType.showOnLandingPage && (
                                        <Globe className="h-3.5 w-3.5 text-emerald-500" title="Visible en Landing Page" />
                                    )}
                                </CardTitle>
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
                                <span className="w-4 text-center">₡</span>
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
                <TableHead 
                    className="w-[120px] cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => requestSort('code')}
                >
                    <div className="flex items-center gap-2">
                        Código
                        {sortConfig?.key === 'code' ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                        ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                </TableHead>
                <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => requestSort('name')}
                >
                    <div className="flex items-center gap-2">
                        Nombre
                        {sortConfig?.key === 'name' ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                        ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                </TableHead>
                <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => requestSort('featuresCount')}
                >
                    <div className="flex items-center gap-2">
                        Características
                        {sortConfig?.key === 'featuresCount' ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                        ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                </TableHead>
                <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => requestSort('pricePlansCount')}
                >
                    <div className="flex items-center gap-2">
                        Planes de Precios
                        {sortConfig?.key === 'pricePlansCount' ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                        ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                </TableHead>
                <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => requestSort('showOnLandingPage')}
                >
                    <div className="flex items-center gap-2">
                        Landing Page
                        {sortConfig?.key === 'showOnLandingPage' ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />
                        ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                </TableHead>
                <TableHead className="text-right w-[50px]">
                    <span className="sr-only">Acciones</span>
                </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedRoomTypes.map((roomType) => (
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
                    <TableCell className="align-top">
                        {roomType.showOnLandingPage ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5 py-1">
                                <Globe className="h-3 w-3" />
                                Visible
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1.5 py-1 opacity-60">
                                <EyeOff className="h-3 w-3" />
                                Oculto
                            </Badge>
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
