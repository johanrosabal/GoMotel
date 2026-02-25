'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, ProductCategory, ProductSubCategory, RestaurantTable, Order } from '@/types';
import { createDirectSale } from '@/lib/actions/pos.actions';
import { openTableAccount, addToTableAccount, payRestaurantAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, Settings2, X, Sun, MapPin
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InvoiceSuccessDialog from '../reservations/InvoiceSuccessDialog';
import { Label } from '../ui/label';
import { useUserProfile } from '@/hooks/use-user-profile';
import TableManagementDialog from './TableManagementDialog';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

const posPaymentSchema = z.object({
  clientName: z.string().default('Cliente de Contado'),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']),
  paymentConfirmed: z.boolean().default(false),
  voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

type CartItem = {
  service: Service;
  quantity: number;
};

export default function PosClientPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { userProfile } = useUserProfile();
    const [isPending, startTransition] = useTransition();
    
    // View Management
    const [viewMode, setViewMode] = useState<string>('fast');
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [manageTablesOpen, setManageTablesOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [step, setStep] = useState(1); // 1: Select, 2: Payment
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);
    const [cashTendered, setCashTendered] = useState('');

    const form = useForm<z.infer<typeof posPaymentSchema>>({
        resolver: zodResolver(posPaymentSchema),
        defaultValues: { clientName: 'Cliente de Contado', paymentMethod: 'Efectivo', paymentConfirmed: false, voucherNumber: '' },
    });

    const paymentMethod = form.watch('paymentMethod');

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Pendiente')) : null, 
        [firestore]
    );
    const { data: activeOrders } = useCollection<Order>(activeOrdersQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, 
        [firestore]
    );
    const { data: activeSinpeAccounts } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    // Filter tables and extract dynamic types
    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        const types = Array.from(new Set(allTables.map(t => t.type)));
        // Order: Table, Bar, Terraza, then the rest
        const order = ['Table', 'Bar', 'Terraza'];
        return types.sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables || viewMode === 'fast') return [];
        return allTables.filter(t => t.type === viewMode).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, viewMode]);

    // Active order for selected table
    const currentOrder = useMemo(() => {
        if (!selectedTable || !activeOrders) return null;
        return activeOrders.find(o => o.locationId === selectedTable.id);
    }, [selectedTable, activeOrders]);

    // Calculations
    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let tax = 0;
        const taxes: AppliedTax[] = [];

        if (allTaxes) {
            const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemTotal * (taxInfo.percentage / 100);
                        tax += taxAmount;
                        const existingTax = taxMap.get(taxId);
                        if (existingTax) existingTax.amount += taxAmount;
                        else taxMap.set(taxId, { name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                });
            });
            taxMap.forEach((value, key) => taxes.push({ taxId: key, ...value }));
        }
        return { subtotal: sub, totalTax: tax, grandTotal: sub + tax, appliedTaxes: taxes };
    }, [cart, allTaxes]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + grandTotal) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, grandTotal]);

    // Handlers
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: i.service.source === 'Internal' ? i.quantity + 1 : Math.min(i.quantity + 1, service.stock || 0) } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
    };

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleClearCart = () => setCart([]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = Number(cashTendered.replace(/\D/g, ''));

    const handleProcessSale = (values: z.infer<typeof posPaymentSchema>) => {
        if (cart.length === 0 && !currentOrder) return;

        startTransition(async () => {
            let result;
            if (viewMode === 'fast') {
                result = await createDirectSale({
                    items: cart.map(i => ({
                        serviceId: i.service.id,
                        name: i.service.name,
                        quantity: i.quantity,
                        price: i.service.price,
                    })),
                    clientName: values.clientName,
                    paymentMethod: values.paymentMethod,
                    voucherNumber: values.voucherNumber,
                    subtotal,
                    taxes: appliedTaxes,
                    total: grandTotal,
                });
            } else if (selectedTable && currentOrder) {
                // Closing a restaurant account
                result = await payRestaurantAccount(currentOrder.id, selectedTable.id, {
                    clientName: values.clientName,
                    paymentMethod: values.paymentMethod,
                    voucherNumber: values.voucherNumber,
                    subtotal,
                    taxes: appliedTaxes,
                    total: combinedTotal
                });
            }

            if (result?.error) {
                toast({ title: 'Error en venta', description: result.error, variant: 'destructive' });
            } else if (result?.success) {
                setGeneratedInvoiceId(result.invoiceId);
                setSuccessModalOpen(true);
                handleClearCart();
                setStep(1);
                form.reset();
                setCashTendered('');
                setSelectedTable(null);
                getServices().then(setAvailableServices);
            }
        });
    };

    const handleSaveOpenAccount = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (currentOrder) {
                result = await addToTableAccount(currentOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Cuenta actualizada', description: `Se añadieron los productos a la ${selectedTable.type} ${selectedTable.number}.` });
                handleClearCart();
                setSelectedTable(null);
            }
        });
    }

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        handleClearCart();
    };

    const totalInOpenAccount = useMemo(() => {
        if (!currentOrder) return 0;
        return currentOrder.total;
    }, [currentOrder]);

    const combinedTotal = grandTotal + totalInOpenAccount;

    const getLocationIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    const getLocationLabel = (type: string) => {
        if (type === 'Table') return 'Mesas Salón';
        if (type === 'Bar') return 'Barra';
        if (type === 'Terraza') return 'Terraza';
        return type;
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-muted/30">
            {/* Top Mode Selector */}
            <div className="mx-2 sm:mx-4 lg:mx-6 mt-4 flex items-center justify-between bg-background border rounded-2xl p-1.5 shadow-sm">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                    <Button 
                        variant={viewMode === 'fast' ? "default" : "ghost"} 
                        className="rounded-xl h-11 font-black text-xs uppercase tracking-widest gap-2 shrink-0"
                        onClick={() => { setViewMode('fast'); setSelectedTable(null); handleClearCart(); }}
                    >
                        <PackageCheck className="h-4 w-4" /> Para Llevar
                    </Button>
                    {locationTypes.map(type => {
                        const Icon = getLocationIcon(type);
                        return (
                            <Button 
                                key={type}
                                variant={viewMode === type ? "default" : "ghost"} 
                                className="rounded-xl h-11 font-black text-xs uppercase tracking-widest gap-2 shrink-0"
                                onClick={() => { setViewMode(type); setSelectedTable(null); handleClearCart(); }}
                            >
                                <Icon className="h-4 w-4" /> {getLocationLabel(type)}
                            </Button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    {selectedTable && (
                        <div className="flex items-center gap-3 px-4 animate-in fade-in slide-in-from-right-2 border-l">
                            <Badge variant="secondary" className="h-8 font-black uppercase tracking-tighter px-3">
                                {selectedTable.type} {selectedTable.number}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedTable(null)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    {userProfile?.role === 'Administrador' && (
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-11 w-11 rounded-xl shadow-sm border-2"
                            onClick={() => setManageTablesOpen(true)}
                        >
                            <Settings2 className="h-5 w-5 text-primary" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden p-2 sm:p-4 lg:p-6 gap-4 lg:gap-6">
                {/* Main Content Area */}
                <div className={cn("flex-1 flex flex-col min-w-0 bg-background border rounded-2xl shadow-sm overflow-hidden transition-all", step === 2 && "hidden lg:flex")}>
                    
                    {/* Location Selection Overlay */}
                    {viewMode !== 'fast' && !selectedTable ? (
                        <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black uppercase tracking-tight text-primary">Seleccione Ubicación: {getLocationLabel(viewMode)}</h2>
                                <Badge variant="outline" className="h-6 font-bold uppercase">{filteredTables.length} Configuradas</Badge>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                                    {filteredTables.map(table => {
                                        const order = activeOrders?.find(o => o.locationId === table.id);
                                        const Icon = getLocationIcon(table.type);
                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => handleSelectTable(table)}
                                                className={cn(
                                                    "group relative flex flex-col items-center justify-center aspect-square rounded-3xl border-2 transition-all p-4",
                                                    order 
                                                        ? "bg-primary/5 border-primary shadow-lg ring-4 ring-primary/10" 
                                                        : "bg-background border-muted-foreground/10 hover:border-primary/50 hover:bg-muted/30"
                                                )}
                                            >
                                                <div className={cn(
                                                    "mb-2 p-3 rounded-full transition-transform group-hover:scale-110",
                                                    order ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <span className="font-black text-2xl tracking-tighter">{table.number}</span>
                                                
                                                {order && (
                                                    <div className="mt-2 space-y-1">
                                                        <Badge variant="default" className="font-black text-[10px] tracking-tighter bg-primary px-2 h-5">
                                                            {formatCurrency(order.total)}
                                                        </Badge>
                                                        <div className="flex items-center gap-1 text-[8px] font-black text-primary/60 uppercase">
                                                            <Clock className="h-2 w-2" /> {formatDistance(order.createdAt.toDate(), new Date(), { locale: es, addSuffix: false })}
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {filteredTables.length === 0 && (
                                        <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed rounded-3xl text-muted-foreground">
                                            <MapPin className="h-12 w-12 opacity-20" />
                                            <p className="font-bold text-sm uppercase tracking-widest italic">No hay ubicaciones configuradas para esta zona.</p>
                                            {userProfile?.role === 'Administrador' && (
                                                <Button variant="outline" size="sm" onClick={() => setManageTablesOpen(true)} className="rounded-full font-bold">
                                                    Configurar Ubicaciones
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <>
                            {/* Search & Filters Bar */}
                            <div className="border-b bg-background flex flex-col gap-3 p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Búsqueda rápida de productos..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-11 border-muted-foreground/20 rounded-xl"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="shrink-0 p-1.5 rounded-full bg-muted">
                                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <div className="flex gap-1.5 pb-2">
                                            <Button 
                                                variant={selectedCategoryId === null ? "default" : "outline"} 
                                                size="sm" 
                                                className="h-8 text-[10px] font-black uppercase rounded-full px-4"
                                                onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                            >
                                                Todos
                                            </Button>
                                            {categories?.map(cat => (
                                                <Button 
                                                    key={cat.id}
                                                    variant={selectedCategoryId === cat.id ? "default" : "outline"} 
                                                    size="sm" 
                                                    className="h-8 text-[10px] font-black uppercase rounded-full px-4"
                                                    onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                                >
                                                    {cat.name}
                                                </Button>
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>

                                {selectedCategoryId && subCategories && subCategories.length > 0 && (
                                    <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                                        <div className="shrink-0 p-1.5 rounded-full bg-primary/10">
                                            <Filter className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <ScrollArea className="w-full whitespace-nowrap">
                                            <div className="flex gap-1.5 pb-2">
                                                <Button 
                                                    variant={selectedSubCategoryId === null ? "secondary" : "ghost"} 
                                                    size="sm" 
                                                    className="h-7 text-[9px] font-bold uppercase rounded-full px-3"
                                                    onClick={() => setSelectedSubCategoryId(null)}
                                                >
                                                    Ver Todo
                                                </Button>
                                                {subCategories.map(sub => (
                                                    <Button 
                                                        key={sub.id}
                                                        variant={selectedSubCategoryId === sub.id ? "secondary" : "ghost"} 
                                                        size="sm" 
                                                        className="h-7 text-[9px] font-bold uppercase rounded-full px-3"
                                                        onClick={() => setSelectedSubCategoryId(sub.id)}
                                                    >
                                                        {sub.name}
                                                    </Button>
                                                ))}
                                            </div>
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 p-3 gap-2">
                                    {filteredServices.map(service => (
                                        <div 
                                            key={service.id} 
                                            className={cn(
                                                "cursor-pointer hover:ring-2 hover:ring-primary transition-all group overflow-hidden flex flex-col bg-card border rounded-xl shadow-sm",
                                                (service.source !== 'Internal' && (service.stock || 0) <= 0) && "opacity-50 cursor-not-allowed"
                                            )}
                                            onClick={() => (service.source === 'Internal' || (service.stock || 0) > 0) && handleAddToCart(service)}
                                        >
                                            <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                                                {service.imageUrl ? (
                                                    <img 
                                                        src={service.imageUrl} 
                                                        alt={service.name} 
                                                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110" 
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                                        <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest text-center px-2">Sin imagen</span>
                                                    </div>
                                                )}
                                                
                                                <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span 
                                                            className="text-white font-black text-sm uppercase leading-tight drop-shadow-lg line-clamp-2"
                                                            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                                        >
                                                            {service.name}
                                                        </span>
                                                        <span 
                                                            className="text-white/80 font-mono text-[9px] drop-shadow-sm"
                                                            style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.8)' }}
                                                        >
                                                            {service.code}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="absolute bottom-1.5 right-1.5">
                                                    <Badge variant="default" className="bg-primary/90 backdrop-blur-sm font-black text-sm px-2 h-6 shadow-lg border-0">
                                                        {formatCurrency(service.price)}
                                                    </Badge>
                                                </div>
                                                
                                                {(service.source !== 'Internal' && (service.stock || 0) <= 0) && (
                                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[1px]">
                                                        <Badge variant="destructive" className="font-black uppercase tracking-tighter text-[9px]">Agotado</Badge>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-0.5 bg-muted/20 border-t">
                                                <Badge variant="outline" className={cn(
                                                    "w-full justify-center text-[9px] h-5 font-black border-0 rounded-none uppercase",
                                                    service.source === 'Internal' 
                                                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" 
                                                        : "bg-white/50 text-muted-foreground dark:bg-muted/30 dark:text-muted-foreground"
                                                )}>
                                                    {service.source === 'Internal' ? 'Producto de Cocina' : `Stock: ${service.stock}`}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </div>

                {/* Cart & Checkout Area */}
                <div className={cn("w-full lg:w-[380px] xl:w-[420px] flex flex-col h-full bg-card border rounded-2xl shadow-xl z-10 overflow-hidden", step === 1 && "hidden lg:flex")}>
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center h-14 shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2 font-black uppercase tracking-tighter">
                            <ShoppingCart className="h-4 w-4 text-primary" /> 
                            Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                        </CardTitle>
                        {step === 1 && cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearCart} className="text-destructive h-8 px-2 font-bold uppercase text-[9px] hover:bg-destructive/10">
                                Limpiar
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            {step === 1 ? (
                                <div className="p-3 space-y-2">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-32 text-muted-foreground">
                                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                            <p className="font-bold text-[10px] uppercase tracking-widest opacity-30">Carrito Vacío</p>
                                        </div>
                                    ) : (
                                        cart.map(item => (
                                            <div key={item.service.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-background shadow-sm">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-[11px] truncate uppercase tracking-tight">{item.service.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5 border">
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                        <Minus className="h-2.5 w-2.5" />
                                                    </Button>
                                                    <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-5 w-5 rounded-full" 
                                                        onClick={() => handleAddToCart(item.service)} 
                                                        disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                    >
                                                        <Plus className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                                <div className="text-right w-16">
                                                    <p className="text-[11px] font-black text-primary">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form className="p-4 space-y-5">
                                        <FormField
                                            control={form.control}
                                            name="clientName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Facturar a</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                            <Input {...field} className="pl-9 h-10 font-bold text-xs rounded-xl" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="paymentMethod"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Método de Pago</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 font-black uppercase text-[10px] tracking-widest rounded-xl">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Efectivo"><div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Efectivo</div></SelectItem>
                                                            <SelectItem value="Sinpe Movil"><div className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> SINPE Móvil</div></SelectItem>
                                                            <SelectItem value="Tarjeta"><div className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Tarjeta</div></SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />

                                        {paymentMethod === 'Efectivo' && (
                                            <div className="p-3 rounded-2xl bg-primary/5 border-2 border-primary/10 space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-primary/70 ml-1">Monto Recibido</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="₡0.00"
                                                        value={cashTendered}
                                                        onChange={handleCashTenderedChange}
                                                        className="h-12 text-right text-xl font-black bg-background border-primary/20 rounded-xl"
                                                    />
                                                </div>
                                                {numericCashTendered >= combinedTotal && (
                                                    <div className="flex justify-between items-center p-2 bg-primary/10 rounded-lg">
                                                        <span className="font-black text-[9px] uppercase text-primary">Vuelto</span>
                                                        <span className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - combinedTotal)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {paymentMethod === 'Sinpe Movil' && (
                                            <div className="space-y-3">
                                                {targetSinpeAccount ? (
                                                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 space-y-3 text-center">
                                                        <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-widest">Enviar SINPE a:</p>
                                                        <p className="text-3xl font-black font-mono tracking-tighter text-indigo-900 dark:text-indigo-100">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                        <FormField
                                                            control={form.control}
                                                            name="paymentConfirmed"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-xl border bg-background p-3 text-left">
                                                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                    <FormLabel className="font-black text-[10px] uppercase">Pago recibido</FormLabel>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-[9px] text-center font-black border uppercase">
                                                        Límite SINPE excedido
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {paymentMethod === 'Tarjeta' && (
                                            <FormField
                                                control={form.control}
                                                name="voucherNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Voucher</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Código de voucher" {...field} className="h-10 font-bold font-mono text-center text-sm border-2 rounded-xl" />
                                                        </FormControl>
                                                        <FormMessage className="text-[10px]" />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </form>
                                </Form>
                            )}
                        </ScrollArea>

                        <div className="p-4 border-t bg-background space-y-3 mt-auto shrink-0">
                            {currentOrder && (
                                <div className="p-2 rounded-lg bg-muted/50 border border-dashed mb-2 space-y-1">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <span>Consumo Acumulado</span>
                                        <span>{formatCurrency(currentOrder.total)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                        <span>Por añadir</span>
                                        <span>{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal + (currentOrder?.total || 0))}</span>
                                </div>
                                {appliedTaxes.map(tax => (
                                    <div key={tax.taxId} className="flex justify-between text-[9px] font-bold text-muted-foreground/60 uppercase">
                                        <span>{tax.name} {tax.percentage}%</span>
                                        <span>{formatCurrency(tax.amount)}</span>
                                    </div>
                                ))}
                                <Separator className="my-1.5" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total General</span>
                                    <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(combinedTotal)}</span>
                                </div>
                            </div>

                            {step === 1 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {selectedTable && (
                                        <Button 
                                            variant="secondary"
                                            className="h-12 text-xs font-black uppercase tracking-widest rounded-xl border-primary/20"
                                            disabled={cart.length === 0 || isPending}
                                            onClick={handleSaveOpenAccount}
                                        >
                                            GUARDAR CUENTA
                                        </Button>
                                    )}
                                    <Button 
                                        className={cn("h-12 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg", (viewMode === 'fast' || !selectedTable) ? "col-span-2" : "")}
                                        disabled={cart.length === 0 && !currentOrder}
                                        onClick={() => setStep(2)}
                                    >
                                        PAGAR <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button variant="outline" className="h-12 w-12 rounded-xl" onClick={() => setStep(1)} disabled={isPending}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        className="flex-1 h-12 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                                        onClick={form.handleSubmit(handleProcessSale)}
                                        disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                                    >
                                        {isPending ? "PROCESANDO..." : "COMPLETAR COBRO"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <InvoiceSuccessDialog 
                open={successModalOpen}
                onOpenChange={setSuccessModalOpen}
                invoiceId={generatedInvoiceId}
            />

            {allTables && (
                <TableManagementDialog 
                    open={manageTablesOpen} 
                    onOpenChange={setManageTablesOpen} 
                    tables={allTables} 
                />
            )}
        </div>
    );
}
