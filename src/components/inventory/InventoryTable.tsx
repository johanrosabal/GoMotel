
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, ProductCategory, ProductSubCategory } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { MoreHorizontal, ArchiveX, Trash2, Search, Filter, AlertTriangle, Edit, Power, PowerOff, ChevronUp, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';
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
    Article: 'Artículo',
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
                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isPending} id="inventorytable-button-1" data-testid="inventorytable-action-button">
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
    const { profile } = useUserProfile();
    const [services, setServices] = useState<Service[]>(initialServices);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [subCategories, setSubCategories] = useState<ProductSubCategory[]>([]);
    const [loading, setLoading] = useState(initialServices.length === 0);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
    const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [stockFilter, setStockFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    const [sortColumn, setSortColumn] = useState<string>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'products'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const servicesData: Service[] = [];
            querySnapshot.forEach((doc) => {
                servicesData.push({ id: doc.id, ...doc.data() } as Service);
            });
            setServices(servicesData);
            setLoading(false);
        });

        const subQ = query(collection(db, 'productSubCategories'), orderBy('name'));
        const unsubscribeSub = onSnapshot(subQ, (querySnapshot) => {
            const subData: ProductSubCategory[] = [];
            querySnapshot.forEach((doc) => {
                subData.push({ id: doc.id, ...doc.data() } as ProductSubCategory);
            });
            setSubCategories(subData);
        });

        const catQ = query(collection(db, 'productCategories'), orderBy('name'));
        const unsubscribeCat = onSnapshot(catQ, (querySnapshot) => {
            const catData: ProductCategory[] = [];
            querySnapshot.forEach((doc) => {
                catData.push({ id: doc.id, ...doc.data() } as ProductCategory);
            });
            setCategories(catData);
        });

        return () => {
            unsubscribe();
            unsubscribeSub();
            unsubscribeCat();
        };
    }, []);

    const filteredServices = useMemo(() => {
        return services.filter(service => {
            const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                service.code?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
            const matchesProductCategory = productCategoryFilter === 'all' || service.categoryId === productCategoryFilter;
            const matchesSubCategory = subCategoryFilter === 'all' || service.subCategoryId === subCategoryFilter;
            
            const isLowStock = service.minStock != null && service.stock <= service.minStock && service.source !== 'Internal';
            const matchesStock = stockFilter === 'all' || (stockFilter === 'low' && isLowStock);
            
            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === 'active' && service.isActive !== false) || 
                (statusFilter === 'inactive' && service.isActive === false);
                
            const matchesType = typeFilter === 'all' || 
                (typeFilter === 'internal' && service.source === 'Internal') || 
                (typeFilter === 'purchased' && service.source === 'Purchased');

            return matchesSearch && matchesCategory && matchesProductCategory && matchesSubCategory && matchesStock && matchesStatus && matchesType;
        }).sort((a, b) => {
            let aValue = a[sortColumn as keyof Service];
            let bValue = b[sortColumn as keyof Service];
            
            // Handle calculated columns if needed, or just standard fields
            if (sortColumn === 'profit') {
                aValue = a.price - (a.costPrice || 0);
                bValue = b.price - (b.costPrice || 0);
            } else if (sortColumn === 'margin') {
                aValue = a.costPrice ? ((a.price - a.costPrice) / a.costPrice) : 0;
                bValue = b.costPrice ? ((b.price - b.costPrice) / b.costPrice) : 0;
            }

            if (aValue === bValue) return 0;
            if (aValue === undefined) return 1;
            if (bValue === undefined) return -1;
            
            const modifier = sortDirection === 'asc' ? 1 : -1;
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue) * modifier;
            }
            return ((aValue as number) - (bValue as number)) * modifier;
        });
    }, [services, searchTerm, categoryFilter, productCategoryFilter, subCategoryFilter, statusFilter, stockFilter, typeFilter, sortColumn, sortDirection]);

    const generatePDF = () => {
        const doc = new jsPDF();
        const businessName = "HOTEL DU MANOLO";
        
        // Header
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(businessName, 14, 15);
        doc.text("Reporte de Inventario", 14, 20);
        
        // Divider
        doc.setDrawColor(200);
        doc.line(14, 25, 196, 25);
        
        // Title
        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.text("Listado de Existencias", 14, 35);
        
        // Date
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 42);
        doc.text(`Generado por: ${profile?.name || 'Administrador'}`, 14, 47);
        
        // Filters
        let filterY = 55;
        doc.setFontSize(10);
        doc.setTextColor(100);
        let activeFilters = [];
        if (searchTerm) activeFilters.push(`Buscador: "${searchTerm}"`);
        if (categoryFilter !== 'all') activeFilters.push(`Cola: ${categoryMap[categoryFilter as Service['category']]}`);
        if (productCategoryFilter !== 'all') activeFilters.push(`Categoría: ${categories.find(c => c.id === productCategoryFilter)?.name}`);
        if (subCategoryFilter !== 'all') activeFilters.push(`Subcat: ${subCategories.find(sc => sc.id === subCategoryFilter)?.name}`);
        if (statusFilter !== 'all') activeFilters.push(`Estado: ${statusFilter === 'active' ? 'Activo' : 'Inactivo'}`);
        if (stockFilter !== 'all') activeFilters.push(`Stock: Stock Bajo`);
        if (typeFilter !== 'all') activeFilters.push(`Tipo: ${typeFilter === 'internal' ? 'Producción Interna' : 'Producto Terminado'}`);
        
        if (activeFilters.length > 0) {
            doc.text(`Filtros aplicados: ${activeFilters.join(' | ')}`, 14, filterY);
            filterY += 10;
        } else {
            filterY += 5;
        }
        
        const formatNumber = (num: number) => {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
        };

        const tableColumn = ["Código", "Nombre", "Cola", "Categoría", "P. Costo", "P. Venta", "Stock", "Estado"];
        const tableRows: any[] = [];

        filteredServices.forEach(service => {
            const catName = categories.find(c => c.id === service.categoryId)?.name || '-';
            const serviceData = [
                service.code || '-',
                service.name,
                categoryMap[service.category],
                catName,
                service.costPrice ? formatNumber(service.costPrice) : '-',
                formatNumber(service.price),
                service.source === 'Internal' ? '-' : service.stock,
                service.isActive !== false ? 'Activo' : 'Inactivo'
            ];
            tableRows.push(serviceData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: filterY,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 250] },
            margin: { top: 20, bottom: 20 },
            columnStyles: {
                4: { halign: 'right' }, // P. Costo
                5: { halign: 'right' }, // P. Venta
                6: { halign: 'center' }, // Stock
            }
        });
        
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${totalPages}`, 14, doc.internal.pageSize.height - 10);
            doc.text(businessName, doc.internal.pageSize.width - 14 - doc.getTextWidth(businessName), doc.internal.pageSize.height - 10);
        }
        
        doc.save("reporte-inventario.pdf");
    };

    const generateCSV = () => {
        const headers = ["Código", "Nombre", "Cola", "Categoría", "P. Costo", "P. Venta", "Stock", "Estado"];
        const rows = filteredServices.map(service => {
            const catName = categories.find(c => c.id === service.categoryId)?.name || '-';
            return [
                service.code || '-',
                service.name,
                categoryMap[service.category],
                catName,
                service.costPrice || 0,
                service.price,
                service.source === 'Internal' ? '-' : service.stock,
                service.isActive !== false ? 'Activo' : 'Inactivo'
            ];
        });

        // Use semicolon as separator for Spanish Excel and add BOM for UTF-8
        const csvContent = "\ufeff" + [
            headers.map(h => `"${h}"`).join(';'),
            ...rows.map(row => row.map(v => `"${v}"`).join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "reporte-inventario.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && services.length === 0) {
        return <div className="text-center text-muted-foreground py-12">Cargando inventario...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Buscador</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Buscar por nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white/5 border-white/10 focus:border-primary/50 text-white rounded-xl h-11" id="inventorytable-input-buscar-por-nombre" data-testid="inventorytable-search-input"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button onClick={generatePDF} className="bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 w-full sm:w-fit">
                            <FileText className="h-4 w-4 text-primary" /> Exportar PDF
                        </Button>
                        <Button onClick={generateCSV} className="bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 w-full sm:w-fit">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Exportar Excel
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cola de Producción</label>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-category">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="Food">Comidas</SelectItem>
                                <SelectItem value="Beverage">Bebidas</SelectItem>
                                <SelectItem value="Amenity">Amenidades</SelectItem>
                                <SelectItem value="Article">Artículos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Categoría</label>
                        <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-product-category">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todas</SelectItem>
                                {categories.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Sub Categoría</label>
                        <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-subcategory">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todas</SelectItem>
                                {subCategories.map(sc => (
                                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Estado</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-status">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="active">Activos</SelectItem>
                                <SelectItem value="inactive">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Stock</label>
                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-stock">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="low">Stock Bajo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tipo</label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11" id="inventorytable-selecttrigger-type">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f12] border-white/10 text-white">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="internal">Producto Interno</SelectItem>
                                <SelectItem value="purchased">Producto Terminado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {filteredServices.length === 0 ? (
                <div className="text-center text-slate-500 py-16 border-2 border-dashed border-white/10 rounded-2xl bg-white/2">
                    No se encontraron productos con los filtros aplicados.
                </div>
            ) : (
                <>
                    {/* Vista para móviles (Tarjetas) */}
                    <div className="md:hidden space-y-4">
                        {filteredServices.map((service) => {
                            const isLowStock = service.minStock != null && service.stock <= service.minStock && service.source !== 'Internal';
                            const isInactive = service.isActive === false;
                            return (
                                <div key={service.id} className={cn(
                                    "p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-md space-y-3 relative transition-all hover:bg-white/10",
                                    isLowStock && "border-yellow-500/50 bg-yellow-500/5",
                                    isInactive && "opacity-60 bg-muted/30"
                                )}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-mono border-white/20 text-white">{service.code}</Badge>
                                                <span className="font-bold text-white">{service.name}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                {service.source === 'Internal' ? 'Producción Interna' : 'Producto Comprado'}
                                            </div>
                                        </div>
                                        <ActionsCell service={service} allServices={services} />
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Categoría:</span>
                                            <Badge variant="secondary" className="ml-1 font-bold text-[10px] uppercase tracking-wider bg-white/10 text-white">{categoryMap[service.category]}</Badge>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Precio:</span>
                                            <span className="ml-1 font-black text-white">{formatCurrency(service.price)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Stock:</span>
                                            <span className={cn("ml-1 font-black", isLowStock ? "text-red-500" : "text-white")}>
                                                {service.source === 'Internal' ? '-' : service.stock}
                                            </span>
                                            {isLowStock && !isInactive && (
                                                <span className="text-[9px] font-black text-red-500 uppercase ml-1 flex items-center gap-1 inline-flex">
                                                    <AlertTriangle className="h-2 w-2" /> Stock Bajo
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant={service.isPublic ? "default" : "secondary"} className={cn(service.isPublic ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-slate-500 border-white/10")}>
                                                {service.isPublic ? 'TV Board' : 'No TV'}
                                            </Badge>
                                            <Badge variant={service.isActive ? "default" : "secondary"} className={cn(service.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-slate-500 border-white/10")}>
                                                {service.isActive ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Vista para escritorio (Tabla) */}
                    <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('code')}>
                                        <div className="flex items-center gap-1">
                                            Código
                                            {sortColumn === 'code' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">
                                            Nombre del Producto
                                            {sortColumn === 'name' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('category')}>
                                        <div className="flex items-center gap-1">
                                            Categoría
                                            {sortColumn === 'category' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('costPrice')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            Precio Costo
                                            {sortColumn === 'costPrice' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('price')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            Precio Venta
                                            {sortColumn === 'price' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('profit')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            Monto Utilidad
                                            {sortColumn === 'profit' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('margin')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            % Utilidad
                                            {sortColumn === 'margin' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Impuestos</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer" onClick={() => handleSort('stock')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            Stock
                                            {sortColumn === 'stock' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">TV Board</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</TableHead>
                                    <TableHead className="text-right w-[50px]">
                                        <span className="sr-only">Acciones</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredServices.map((service) => {
                                    const isLowStock = service.minStock != null && service.stock <= service.minStock && service.source !== 'Internal';
                                    const isInactive = service.isActive === false;
                                    const profit = service.price - (service.costPrice || 0);
                                    const margin = service.costPrice ? ((profit / service.costPrice) * 100) : 100;
                                    
                                    return (
                                        <TableRow key={service.id} className={cn(
                                            "border-white/5 hover:bg-white/[0.02] transition-colors",
                                            isLowStock && "bg-yellow-500/5 hover:bg-yellow-500/10",
                                            isInactive && "opacity-60 bg-muted/30"
                                        )}>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono border-primary/20 bg-primary/5 text-primary tracking-wider px-2 py-0.5 rounded-lg shadow-sm shadow-primary/5">
                                                    {service.code}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white">{service.name}</span>
                                                    <div className="flex flex-wrap gap-x-2 items-center">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{service.source === 'Internal' ? 'Producción Interna' : 'Producto Comprado'}</span>
                                                        <span className="text-[10px] text-primary/80 font-bold uppercase tracking-wider">• {categories.find(c => c.id === service.categoryId)?.name || 'Sin Categoría'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-white/5 text-slate-300 border-white/10">{categoryMap[service.category]}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-slate-400">
                                                {service.costPrice ? formatCurrency(service.costPrice) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-white">
                                                {formatCurrency(service.price)}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-emerald-500">
                                                {service.costPrice ? formatCurrency(profit) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-emerald-500">
                                                {service.costPrice ? `${margin.toFixed(1)}%` : '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={service.taxIncluded ? "outline" : "secondary"} className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest",
                                                    service.taxIncluded ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "opacity-30 bg-white/5 text-slate-400"
                                                )}>
                                                    {service.taxIncluded ? 'Incluidos' : 'Más Imp.'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={cn("font-black text-sm", isLowStock ? "text-red-500" : "text-white")}>
                                                        {service.source === 'Internal' ? '-' : service.stock}
                                                    </span>
                                                    {isLowStock && !isInactive && (
                                                        <span className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1">
                                                            <AlertTriangle className="h-2 w-2" /> Stock Bajo
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={service.isPublic ? "default" : "secondary"} className={cn(service.isPublic ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-slate-500 border-white/10")}>
                                                    {service.isPublic ? 'Visible' : 'Oculto'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={service.isActive ? "default" : "secondary"} className={cn(service.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-slate-500 border-white/10")}>
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
                </>
            )}
        </div>
    );
}
