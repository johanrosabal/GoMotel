
'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, ProductCategory, ProductSubCategory, RestaurantTable, Order } from '@/types';
import { createDirectSale } from '@/lib/actions/pos.actions';
import { openTableAccount, addToTableAccount, payRestaurantAccount, updateOrderLabel, removeItemFromAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, Settings2, X, Sun, MapPin, UserPlus,
    Pencil, Trash2, AlertCircle
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const DELETION_REASONS = [
    "Error de digitación",
    "Cliente cambió de parecer",
    "Producto defectuoso / devuelto",
    "Mesa cancelada / retirada",
    "Producto no disponible",
    "Otro (especificar en notas)"
];

export default function PosClientPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { userProfile } = useUserProfile();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // View Management
    const [viewMode, setViewMode] = useState<string>('fast');
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [manageTablesOpen, setManageTablesOpen] = useState(false);

    // Renaming state
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renamingOrderId, setRenamingOrderId] = useState<string | null>(null);
    const [newLabelName, setNewLabelName] = useState('');

    // Deletion state
    const [removeItemDialogOpen, setRemoveItemDialogOpen] = useState(false);
    const [itemToRemove, setItemToRemove] = useState<{ orderId: string, serviceId: string, name: string } | null>(null);
    const [deletionReason, setDeletionReason] = useState('');
    const [deletionNotes, setDeletionNotes] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [step, setStep] = useState(1); // 1: Select, 2: Payment
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);
    const [cashTendered, setCashTendered] = useState('');
    const [newAccountLabel, setNewAccountLabel] = useState('');

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

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        const types = Array.from(new Set(allTables.map(t => t.type)));
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

    const currentOrder = useMemo(() => {
        if (!selectedOrderId || !activeOrders) return null;
        return activeOrders.find(o => o.id === selectedOrderId);
    }, [selectedOrderId, activeOrders]);

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

    const { subtotal, totalTax, grandTotal, appliedTaxes, currentOrderSubtotal } = useMemo(() => {
        const newItems = cart.map(i => ({
            price: i.service.price,
            quantity: i.quantity,
            taxIds: i.service.taxIds || []
        }));

        const existingItems = (currentOrder?.items || []).map(i => {
            const service = availableServices.find(s => s.id === i.serviceId);
            return {
                price: i.price,
                quantity: i.quantity,
                taxIds: service?.taxIds || []
            };
        });

        const allItems = [...newItems, ...existingItems];
        
        const sub = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const orderSub = existingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        let taxTotal = 0;
        const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();

        if (allTaxes) {
            // Buscamos si existe un impuesto de servicio (10%) configurado en el sistema
            const serviceTax = allTaxes.find(t => 
                t.name.toLowerCase().includes('servicio') || 
                t.name.toLowerCase().includes('service')
            );

            allItems.forEach(item => {
                const itemTotal = item.price * item.quantity;
                
                // Combinamos los impuestos del producto con el impuesto de servicio si aplica
                const effectiveTaxIds = new Set(item.taxIds || []);
                
                // Si estamos en una mesa/barra (no fast mode), añadimos el impuesto de servicio automáticamente
                // si existe en el sistema y no está ya asignado al producto.
                if (viewMode !== 'fast' && serviceTax) {
                    effectiveTaxIds.add(serviceTax.id);
                }

                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        // El impuesto de servicio SOLO se aplica si no estamos en modo rápido (Para Llevar)
                        if (taxInfo.id === serviceTax?.id && viewMode === 'fast') return;

                        const taxAmount = itemTotal * (taxInfo.percentage / 100);
                        taxTotal += taxAmount;
                        
                        const existingTax = taxMap.get(taxId);
                        if (existingTax) {
                            existingTax.amount += taxAmount;
                        } else {
                            taxMap.set(taxId, {
                                taxId,
                                name: taxInfo.name,
                                percentage: taxInfo.percentage,
                                amount: taxAmount
                            });
                        }
                    }
                });
            });
        }

        return {
            subtotal: sub,
            currentOrderSubtotal: orderSub,
            totalTax: taxTotal,
            grandTotal: sub + taxTotal,
            appliedTaxes: Array.from(taxMap.values())
        };
    }, [cart, currentOrder, allTaxes, availableServices, viewMode]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + grandTotal) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, grandTotal]);

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
                result = await payRestaurantAccount(currentOrder.id, selectedTable.id, {
                    clientName: values.clientName,
                    paymentMethod: values.paymentMethod,
                    voucherNumber: values.voucherNumber,
                    subtotal,
                    taxes: appliedTaxes,
                    total: grandTotal
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
                setSelectedOrderId(null);
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
                const label = newAccountLabel.trim() || `Cuenta ${activeOrders?.filter(o => o.locationId === selectedTable.id).length || 0 + 1}`;
                result = await openTableAccount(selectedTable.id, cart, label);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const label = TYPE_LABELS[selectedTable.type] || selectedTable.type;
                toast({ title: 'Cuenta actualizada', description: `Se añadieron los productos a la ${label} ${selectedTable.number}.` });
                handleClearCart();
                setSelectedTable(null);
                setSelectedOrderId(null);
                setNewAccountLabel('');
            }
        });
    }

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        handleClearCart();
        const orders = activeOrders?.filter(o => o.locationId === table.id) || [];
        if (orders.length === 1) {
            setSelectedOrderId(orders[0].id);
        } else {
            setSelectedOrderId(null);
        }
    };

    const handleRenameAccount = () => {
        if (!renamingOrderId || !newLabelName.trim()) return;
        startTransition(async () => {
            const result = await updateOrderLabel(renamingOrderId, newLabelName.trim());
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Cuenta renombrada' });
                setRenameDialogOpen(false);
            }
        });
    };

    const handleOpenRemoveItemDialog = (orderId: string, serviceId: string, name: string) => {
        setItemToRemove({ orderId, serviceId, name });
        setDeletionReason('');
        setDeletionNotes('');
        setRemoveItemDialogOpen(true);
    };

    const handleRemoveExistingItem = () => {
        if (!itemToRemove || !deletionReason) return;
        
        startTransition(async () => {
            const result = await removeItemFromAccount(itemToRemove.orderId, itemToRemove.serviceId, deletionReason, deletionNotes);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Producto eliminado', description: 'Se ha actualizado la cuenta y devuelto el stock.' });
                setRemoveItemDialogOpen(false);
                setItemToRemove(null);
            }
        });
    };

    const getTypeIcon = (type: string) => {
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

    const isCartEmpty = cart.length === 0 && (!currentOrder || currentOrder.items.length === 0);

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-muted/30">
            {/* Top Mode Selector */}
            <div className="mx-2 sm:mx-4 lg:mx-6 mt-4 flex items-center justify-between bg-background border rounded-2xl p-1.5 shadow-sm">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                    <button 
                        className={cn(
                            "rounded-xl h-11 px-4 font-black text-xs uppercase tracking-widest gap-2 flex items-center transition-all",
                            viewMode === 'fast' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                        )}
                        onClick={() => { setViewMode('fast'); setSelectedTable(null); setSelectedOrderId(null); handleClearCart(); }}
                    >
                        <PackageCheck className="h-4 w-4" /> Para Llevar
                    </button>
                    {locationTypes.map(type => {
                        const Icon = getTypeIcon(type);
                        return (
                            <button 
                                key={type}
                                className={cn(
                                    "rounded-xl h-11 px-4 font-black text-xs uppercase tracking-widest gap-2 flex items-center transition-all shrink-0",
                                    viewMode === type ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground"
                                )}
                                onClick={() => { setViewMode(type); setSelectedTable(null); setSelectedOrderId(null); handleClearCart(); }}
                            >
                                <Icon className="h-4 w-4" /> {getLocationLabel(type)}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    {selectedTable && (
                        <div className="flex items-center gap-3 px-4 animate-in fade-in slide-in-from-right-2 border-l">
                            <Badge variant="secondary" className="h-8 font-black uppercase tracking-tighter px-3">
                                {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                            </Badge>
                            <button onClick={() => { setSelectedTable(null); setSelectedOrderId(null); handleClearCart(); }} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-4 w-4" />
                            </button>
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
                <div className={cn("flex-1 flex flex-col min-w-0 bg-background border rounded-2xl shadow-sm overflow-hidden", step === 2 && "hidden lg:flex")}>
                    
                    {viewMode !== 'fast' && !selectedTable ? (
                        <div className="flex-1 flex flex-col p-6 lg:p-10 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Seleccione Ubicación: {getLocationLabel(viewMode)}</h2>
                                <Badge variant="outline" className="h-8 px-4 font-black uppercase tracking-widest bg-muted/30">{filteredTables.length} Unidades</Badge>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-2 pb-10">
                                    {filteredTables.map(table => {
                                        const tableOrders = activeOrders?.filter(o => o.locationId === table.id) || [];
                                        const hasOrders = tableOrders.length > 0;
                                        const oldestOrder = hasOrders ? [...tableOrders].sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis())[0] : null;
                                        const totalAmount = tableOrders.reduce((sum, o) => sum + o.total, 0);
                                        const Icon = getTypeIcon(table.type);
                                        
                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => handleSelectTable(table)}
                                                className={cn(
                                                    "group relative flex flex-col items-center justify-between min-h-[220px] rounded-2xl border-2 transition-all duration-300 p-0 overflow-hidden",
                                                    hasOrders 
                                                        ? "bg-primary/[0.08] border-primary shadow-xl shadow-primary/10 ring-4 ring-primary/5" 
                                                        : "bg-card border-border hover:border-primary/40 hover:shadow-2xl hover:-translate-y-1.5 active:scale-95"
                                                )}
                                            >
                                                <div className={cn(
                                                    "px-4 py-2 rounded-b-xl border-x border-b border-t-0 transition-all duration-300 shadow-md",
                                                    hasOrders 
                                                        ? "bg-primary text-primary-foreground border-primary/20 shadow-primary/20" 
                                                        : "bg-secondary text-foreground/30 border-border group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30"
                                                )}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                
                                                <div className="flex-1 flex flex-col items-center justify-center py-2 relative w-full">
                                                    <span className={cn(
                                                        "font-black text-5xl tracking-tighter transition-colors",
                                                        hasOrders ? "text-primary" : "text-foreground"
                                                    )}>{table.number}</span>
                                                    
                                                    {hasOrders && (
                                                        <div className="flex flex-col items-center gap-1 mt-1 animate-in fade-in zoom-in-95 duration-500">
                                                            <div className="flex items-center gap-1 text-[9px] font-black text-primary/80 uppercase bg-primary/10 px-3 py-1 rounded-full border border-primary/10 backdrop-blur-sm">
                                                                <Clock className="h-3 w-3" /> {formatDistance(oldestOrder!.createdAt.toDate(), now, { locale: es, addSuffix: false })}
                                                            </div>
                                                            {tableOrders.length > 1 && (
                                                                <Badge variant="outline" className="text-[8px] font-black tracking-widest border-primary/20 bg-background/50 text-primary h-4 px-1.5">
                                                                    {tableOrders.length} CUENTAS
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className={cn(
                                                    "w-full px-4 py-3 rounded-t-none border-x border-t border-b-0 transition-all duration-300 shadow-md flex items-center justify-center min-h-[48px]",
                                                    hasOrders 
                                                        ? "bg-primary text-primary-foreground border-primary/20 shadow-primary/20" 
                                                        : "bg-secondary text-foreground/30 border-border group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30"
                                                )}>
                                                    {hasOrders ? (
                                                        <span className="font-black text-base tracking-tighter shadow-sm">
                                                            {formatCurrency(totalAmount)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] group-hover:animate-pulse">
                                                            Abrir Cuenta
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Sub-Accounts Barra Superior */}
                            {selectedTable && (
                                <div className="bg-primary/5 border-b p-4 space-y-3 shrink-0">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <span className="text-xs font-black uppercase tracking-widest text-primary/70">Cuentas en esta Mesa</span>
                                            {selectedOrderId === null && (
                                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                                    <Separator orientation="vertical" className="h-4 hidden sm:block bg-primary/20" />
                                                    <div className="relative">
                                                        <UserPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-primary/50" />
                                                        <Input 
                                                            placeholder="Identificador de cuenta (opcional)..." 
                                                            value={newAccountLabel}
                                                            onChange={e => setNewAccountLabel(e.target.value)}
                                                            className="h-8 w-64 pl-8 text-[11px] font-bold rounded-lg border-primary/20 bg-background transition-all focus:border-primary focus:ring-2 focus:ring-primary/5"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="h-6 font-bold border-primary/20 text-primary uppercase text-[10px]">
                                            {activeOrders?.filter(o => o.locationId === selectedTable.id).length || 0} Abiertas
                                        </Badge>
                                    </div>
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <div className="flex gap-3 pb-2">
                                            <button
                                                className={cn(
                                                    "rounded-2xl font-black text-[11px] uppercase tracking-widest h-14 px-6 gap-3 flex items-center border-2 transition-all shrink-0",
                                                    selectedOrderId === null 
                                                        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105" 
                                                        : "bg-background text-muted-foreground border-input hover:border-primary/30"
                                                )}
                                                onClick={() => { setSelectedOrderId(null); handleClearCart(); }}
                                            >
                                                <UserPlus className="h-4 w-4" /> Nueva Cuenta
                                            </button>
                                            
                                            {activeOrders?.filter(o => o.locationId === selectedTable.id).map(order => (
                                                <div key={order.id} className="relative group/account shrink-0">
                                                    <button
                                                        className={cn(
                                                            "rounded-2xl font-black text-[11px] uppercase tracking-widest h-14 px-6 pr-14 gap-3 flex items-center border-2 transition-all",
                                                            selectedOrderId === order.id 
                                                                ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105" 
                                                                : "bg-background text-muted-foreground border-input hover:border-primary/30"
                                                        )}
                                                        onClick={() => { setSelectedOrderId(order.id); handleClearCart(); }}
                                                    >
                                                        <div className="flex flex-col items-start leading-none gap-1">
                                                            <span className="truncate max-w-[120px]">{order.label}</span>
                                                            <span className={cn("text-[10px] font-bold", selectedOrderId === order.id ? "text-white/70" : "text-primary")}>
                                                                {formatCurrency(order.total)}
                                                            </span>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRenamingOrderId(order.id);
                                                            setNewLabelName(order.label || '');
                                                            setRenameDialogOpen(true);
                                                        }}
                                                        className={cn(
                                                            "absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-xl transition-all",
                                                            selectedOrderId === order.id 
                                                                ? "bg-white/20 text-white hover:bg-white/30" 
                                                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary opacity-0 group-hover/account:opacity-100"
                                                        )}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            )}

                            <div className="p-4 border-b space-y-4 bg-muted/5 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar producto por nombre o código..." 
                                        className="pl-9 h-11 bg-background rounded-xl border-2 transition-all focus:border-primary"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <ScrollArea className="w-full whitespace-nowrap">
                                    <div className="flex gap-2 pb-2">
                                        <button 
                                            className={cn(
                                                "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                            onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                        >
                                            Todos
                                        </button>
                                        {categories?.map(cat => (
                                            <button 
                                                key={cat.id}
                                                className={cn(
                                                    "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                    selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                )}
                                                onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>

                                {selectedCategoryId && subCategories && subCategories.length > 0 && (
                                    <ScrollArea className="w-full whitespace-nowrap border-t pt-2">
                                        <div className="flex gap-2 pb-2">
                                            <button 
                                                className={cn(
                                                    "h-7 px-3 rounded-full font-black text-[9px] uppercase tracking-widest transition-all",
                                                    selectedSubCategoryId === null ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                                onClick={() => setSelectedSubCategoryId(null)}
                                            >
                                                Ver Todo
                                            </button>
                                            {subCategories.map(sub => (
                                                <button 
                                                    key={sub.id}
                                                    className={cn(
                                                        "h-7 px-3 rounded-full font-black text-[9px] uppercase tracking-widest transition-all",
                                                        selectedSubCategoryId === sub.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50"
                                                    )}
                                                    onClick={() => setSelectedSubCategoryId(sub.id)}
                                                >
                                                    {sub.name}
                                                </button>
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                )}
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 lg:p-6">
                                    {filteredServices.map(service => (
                                        <button
                                            key={service.id}
                                            onClick={() => handleAddToCart(service)}
                                            disabled={service.source !== 'Internal' && (service.stock || 0) <= 0}
                                            className="group flex flex-col bg-card border rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all duration-300 text-left relative active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                                        >
                                            <div className="aspect-square relative overflow-hidden bg-muted">
                                                <Avatar className="h-full w-full rounded-none">
                                                    <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                                    <AvatarFallback className="rounded-none bg-transparent">
                                                        <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                
                                                {/* Price Badge */}
                                                <div className="absolute top-2 right-2 z-10">
                                                    <Badge className="font-black bg-background/90 text-primary border-primary/20 shadow-sm backdrop-blur-sm">
                                                        {formatCurrency(service.price)}
                                                    </Badge>
                                                </div>

                                                {/* Name Overlay */}
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8 z-10">
                                                    <h3 className="font-black text-[10px] sm:text-[11px] uppercase tracking-tight line-clamp-2 leading-tight text-white drop-shadow-md">
                                                        {service.name}
                                                    </h3>
                                                </div>
                                            </div>
                                            
                                            <div className={cn(
                                                "w-full py-1.5 px-2 text-center border-t transition-colors mt-auto",
                                                service.source === 'Internal' 
                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50" 
                                                    : (service.stock || 0) <= (service.minStock || 0)
                                                        ? "bg-amber-50 text-yellow-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50"
                                                        : "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                                            )}>
                                                <span className="text-[9px] font-black uppercase tracking-widest">
                                                    {service.source === 'Internal' ? 'Producto de Cocina' : `Stock: ${service.stock}`}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                {/* Cart & Checkout Area */}
                <div className={cn("w-full lg:w-[380px] xl:w-[420px] flex flex-col h-full bg-card border rounded-2xl shadow-xl z-10 overflow-hidden", step === 1 && "hidden lg:flex")}>
                    
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center h-14 shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2 font-black uppercase tracking-tighter">
                            <ShoppingCart className="h-4 w-4 text-primary" /> 
                            {currentOrder ? `Orden: ${currentOrder.label}` : 'Nuevo Pedido'}
                        </CardTitle>
                        {step === 1 && (cart.length > 0 || selectedTable) && (
                            <button 
                                onClick={() => { handleClearCart(); setSelectedTable(null); setSelectedOrderId(null); setNewAccountLabel(''); }} 
                                className="text-destructive h-8 px-2 font-bold uppercase text-[9px] hover:bg-destructive/10 transition-colors rounded-lg"
                            >
                                {cart.length > 0 ? 'Limpiar' : 'Salir'}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            {step === 1 ? (
                                <div className="p-3 space-y-2">
                                    {isCartEmpty ? (
                                        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-6">
                                            <ShoppingCart className="h-12 w-12 opacity-10" />
                                            
                                            {selectedTable && (
                                                <div className="px-6 space-y-4 w-full">
                                                    <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 border-dashed animate-in fade-in zoom-in-95 duration-500">
                                                        <p className="text-[11px] font-black text-primary uppercase text-center leading-relaxed">
                                                            {selectedOrderId === null 
                                                                ? "Seleccione productos del catálogo para registrar la nueva cuenta" 
                                                                : "Añada productos a la cuenta de " + currentOrder?.label}
                                                        </p>
                                                    </div>
                                                    
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="rounded-xl font-bold h-10 text-[10px] uppercase tracking-widest text-muted-foreground border border-dashed w-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        onClick={() => { setSelectedTable(null); setSelectedOrderId(null); handleClearCart(); setNewAccountLabel(''); }}
                                                    >
                                                        Volver al Mapa de Mesas
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Productos ya pedidos (Existentes en la orden) */}
                                            {currentOrder && currentOrder.items.map((item, idx) => (
                                                <div key={`existing-${idx}`} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-muted/20 opacity-90 border-dashed group/existing-item">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle className="h-3 w-3 text-primary" />
                                                            <p className="font-black text-[11px] truncate uppercase tracking-tight">{item.name}</p>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 px-3">
                                                        <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                                                    </div>
                                                    <div className="text-right w-16">
                                                        <p className="text-[11px] font-bold text-muted-foreground">{formatCurrency(item.price * item.quantity)}</p>
                                                    </div>
                                                    {/* Borrar Item Existente */}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-destructive opacity-0 group-hover/existing-item:opacity-100 transition-opacity hover:bg-destructive/10"
                                                        onClick={() => handleOpenRemoveItemDialog(currentOrder.id, item.serviceId, item.name)}
                                                        disabled={isPending}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}

                                            {/* Productos por añadir (Carrito temporal) */}
                                            {cart.map(item => (
                                                <div key={item.service.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-background shadow-sm border-primary/20">
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
                                            ))}
                                        </>
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
                                                {numericCashTendered >= grandTotal && (
                                                    <div className="flex justify-between items-center p-2 bg-primary/10 rounded-lg">
                                                        <span className="font-black text-[9px] uppercase text-primary">Vuelto</span>
                                                        <span className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - grandTotal)}</span>
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
                                                            <Input placeholder="Código de voucher" {...field} className="pl-2 h-10 font-bold font-mono text-center text-sm border-2 rounded-xl" />
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
                                        <span>Consumo Acumulado (Neto)</span>
                                        <span>{formatCurrency(currentOrderSubtotal)}</span>
                                    </div>
                                    {cart.length > 0 && (
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                            <span>Nuevos items (Neto)</span>
                                            <span>{formatCurrency(subtotal - currentOrderSubtotal)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
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
                                    <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(grandTotal)}</span>
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
                                        disabled={cart.length === 0 && (!currentOrder || currentOrder.items.length === 0)}
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

            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Renombrar Cuenta</DialogTitle>
                        <DialogDescription>
                            Asigne un nombre identificativo a esta cuenta.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="rename-label" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Nombre de la Cuenta</Label>
                        <Input 
                            id="rename-label"
                            placeholder="Ej: Persona 1, Mesa Ventana, etc." 
                            value={newLabelName} 
                            onChange={(e) => setNewLabelName(e.target.value)}
                            className="h-12 font-bold text-base rounded-xl border-2"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={isPending}>Cancelar</Button>
                        <Button onClick={handleRenameAccount} disabled={isPending || !newLabelName.trim()}>
                            {isPending ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Item Dialog */}
            <Dialog open={removeItemDialogOpen} onOpenChange={setRemoveItemDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" /> Eliminar Producto de la Cuenta
                        </DialogTitle>
                        <DialogDescription>
                            Confirmación de seguridad para remover <strong>{itemToRemove?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Razón de la eliminación *</Label>
                            <RadioGroup value={deletionReason} onValueChange={setDeletionReason} className="grid gap-2">
                                {DELETION_REASONS.map((reason) => (
                                    <Label
                                        key={reason}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50",
                                            deletionReason === reason ? "border-primary bg-primary/5" : "border-transparent bg-muted/20"
                                        )}
                                    >
                                        <RadioGroupItem value={reason} />
                                        <span className="text-sm font-bold">{reason}</span>
                                    </Label>
                                ))}
                            </RadioGroup>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deletion-notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notas Especiales (Opcional)</Label>
                            <Textarea 
                                id="deletion-notes"
                                placeholder="Describa el motivo detallado si es necesario..."
                                value={deletionNotes}
                                onChange={(e) => setDeletionNotes(e.target.value)}
                                className="min-h-[100px] rounded-xl border-2 resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="bg-muted/10 p-4 -m-6 mt-2 rounded-b-lg flex gap-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold rounded-xl" onClick={() => setRemoveItemDialogOpen(false)}>Cancelar</Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg"
                            disabled={!deletionReason || isPending}
                            onClick={handleRemoveExistingItem}
                        >
                            {isPending ? 'PROCESANDO...' : 'CONFIRMAR ELIMINACIÓN'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
