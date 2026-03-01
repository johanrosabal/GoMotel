'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
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
import { formatCurrency, cn } from '@/lib/utils';
import { MoreHorizontal, ArchiveX, Trash2, Search, Filter, AlertTriangle, Edit, Power, PowerOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import DeleteServiceAlert from './DeleteServiceAlert';
import ServiceSpoilageDialog from './ServiceSpoilageDialog';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditServiceDialog from './EditServiceDialog';
import { toggleServiceStatus } from '@/lib/actions/service.actions';
import { useToast } from '@/hooks/use-toast';

interface InventoryTableProps {
  initialServices: Service[];
}

const categoryMap: Record<Service['category'], string> = {
  Food: 'Comida',
  Beverage: 'Bebida',
  Amenity: 'Amenidad',
};

function ActionsCell({ service, allServices }: { service: Service, allServices: Service[] }) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isSpoilageDialogOpen, setIsSpoilageDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { userProfile } = useUserProfile();
    const { toast } = useToast();

    const handleToggleStatus = () => {
        startTransition(async () => {
            const result = await toggleServiceStatus(service.id, !!service.isActive);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ 
                    title: result.newStatus ? 'Producto Activado' : 'Producto Desactivado',
                    description: `El producto "${service.name}" ha sido ${result.newStatus ? 'activado' : 'desactivado'}.`
                });
            }
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isPending}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones de Producto</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Detalles
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsSpoilageDialogOpen(true)}>
                    <ArchiveX className="mr-2 h-4 w-4" />
                    Registrar Merma
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleToggleStatus} className={cn(service.isActive ? "text-amber-600" : "text-green-600")}>
                    {service.isActive ? (
                        <><PowerOff className="mr-2 h-4 w-4" /> Desactivar Producto</>
                    ) : (
                        <><Power className="mr-2 h-4 w-4" /> Activar Producto</>
                    )}
                </DropdownMenuItem>
                {userProfile?.role === 'Administrador' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
                </DropdownMenuContent>
            </DropdownMenu>
            <DeleteServiceAlert serviceId={service.id} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} />
            <ServiceSpoilageDialog service={service} open={isSpoilageDialogOpen} onOpenChange={setIsSpoilageDialogOpen} />
            <EditServiceDialog service={service} allServices={allServices} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
        </>
    );
}

export default function InventoryTable({ initialServices }: InventoryTableProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [loading, setLoading] = useState(initialServices.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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

  const filteredServices = useMemo(() => {
    return services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             service.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  if (loading && services.length === 0) {
    return <div className="text-center text-muted-foreground py-12">Cargando inventario...</div>;
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/20 p-4 rounded-xl border">
            <div className="grid gap-2 w-full md:flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Buscador</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-background"
                    />
                </div>
            </div>
            <div className="grid gap-2 w-full md:w-48">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoría Contable</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="Food">Comidas</SelectItem>
                        <SelectItem value="Beverage">Bebidas</SelectItem>
                        <SelectItem value="Amenity">Amenidades</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        {filteredServices.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron productos con los filtros aplicados.
            </div>
        ) : (
            <div className="rounded-md border overflow-hidden">
                <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Nombre del Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right w-[50px]">
                        <span className="sr-only">Acciones</span>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredServices.map((service) => {
                        const isLowStock = service.minStock != null && service.stock <= service.minStock && service.source !== 'Internal';
                        const isInactive = service.isActive === false;
                        return (
                            <TableRow key={service.id} className={cn(
                                isLowStock && "bg-yellow-50/50 dark:bg-yellow-900/10",
                                isInactive && "opacity-60 bg-muted/30"
                            )}>
                                <TableCell>
                                <Badge variant="outline" className="font-mono">{service.code}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-bold">{service.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{service.source === 'Internal' ? 'Producción Interna' : 'Producto Comprado'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-medium">{categoryMap[service.category]}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-black">
                                    {formatCurrency(service.price)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={cn("font-black text-sm", isLowStock ? "text-destructive" : "text-foreground")}>
                                            {service.source === 'Internal' ? '-' : service.stock}
                                        </span>
                                        {isLowStock && !isInactive && (
                                            <span className="text-[9px] font-black text-destructive uppercase flex items-center gap-1">
                                                <AlertTriangle className="h-2 w-2" /> Stock Bajo
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={service.isActive ? "default" : "secondary"} className={cn(service.isActive && "bg-green-600")}>
                                        {service.isActive ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <ActionsCell service={service} allServices={services} />
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
                </Table>
            </div>
        )}
    </div>
  );
}
