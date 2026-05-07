
'use client';

import { useState, useEffect, useTransition, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import type { RestaurantTable, Service, Order, ProductCategory, ProductSubCategory, Tax, Room, Stay } from '@/types';
import { openTableAccount, addToTableAccount, requestBill, requestStayBill, cancelOrderItem } from '@/lib/actions/restaurant.actions';
import { createOrder } from '@/lib/actions/order.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ShoppingCart, Plus, Minus, Search, Utensils,
    CheckCircle, Clock, Info, ChevronRight, MessageSquare,
    ReceiptText, PackageOpen, GlassWater, Trash2
} from 'lucide-react';
import type { PrepStatus } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

type CartItem = {
    service: Service;
    quantity: number;
    notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

function OrderPageContent() {
    const searchParams = useSearchParams();
    const tableId = searchParams.get('tableId');
    const roomId = searchParams.get('roomId');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // UI States
    const [activeTab, setActiveTab] = useState('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Kitchen Notes dialog
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');
    const [selectedLocationType, setSelectedLocationType] = useState<string>('Table');
    const [itemToCancel, setItemToCancel] = useState<any>(null);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);

    // 1. Fetch Table Data
    const tableRef = useMemoFirebase(() => tableId ? doc(firestore!, 'restaurantTables', tableId) : null, [firestore, tableId]);
    const { data: table, isLoading: isLoadingTable } = useDoc<RestaurantTable>(tableRef);

    const roomRef = useMemoFirebase(() => roomId ? doc(firestore!, 'rooms', roomId) : null, [firestore, roomId]);
    const { data: room, isLoading: isLoadingRoom } = useDoc<Room>(roomRef);

    const [activeStay, setActiveStay] = useState<Stay | null>(null);
    useEffect(() => {
        if (!roomId || !firestore) return;
        const q = query(collection(firestore, 'stays'), where('roomId', '==', roomId), where('checkOut', '==', null));
        return onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setActiveStay({ id: snap.docs[0].id, ...snap.docs[0].data() } as Stay);
            } else {
                setActiveStay(null);
            }
        });
    }, [roomId, firestore]);

    const allTablesQuery = useMemoFirebase(() => !tableId && !roomId && firestore ? query(collection(firestore, 'restaurantTables')) : null, [firestore, tableId, roomId]);
    const { data: allTables } = useCollection<RestaurantTable>(allTablesQuery);

    // 2. Fetch Active Order for this table
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore) return;
        
        let q;
        if (tableId) {
            q = query(collection(firestore, 'orders'), where('locationId', '==', tableId), where('paymentStatus', '==', 'Pendiente'));
        } else if (activeStay) {
            q = query(collection(firestore, 'orders'), where('stayId', '==', activeStay.id), where('paymentStatus', '==', 'Pendiente'));
        } else {
            setCurrentOrder(null);
            return;
        }

        return onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
                
                if (tableId) {
                    setCurrentOrder(orders[0]); // Take the first active order for tables
                } else {
                    // For stays, merge all items into a single "virtual" order for the account view
                    const allItems = orders.flatMap(o => o.items.map(item => ({ ...item, parentOrderId: o.id })));
                    const mergedOrder: any = {
                        ...orders[0],
                        id: 'stay-account-summary',
                        items: allItems,
                        // Determine overall status
                        status: orders.some(o => o.status === 'En preparación') ? 'En preparación' : 
                                (orders.every(o => o.status === 'Entregado') ? 'Entregado' : 'Pendiente'),
                        billRequested: orders.some(o => o.billRequested)
                    };
                    setCurrentOrder(mergedOrder);
                }
            } else {
                setCurrentOrder(null);
            }
        });
    }, [tableId, activeStay, firestore]);

    // 3. Fetch Menu Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => { getServices().then(setAvailableServices); }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    // Financial Calculations
    const billing = useMemo(() => {
        const orderItems = currentOrder?.items || [];
        let subtotal = 0;
        let taxTotal = 0;
        const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();

        if (allTaxes && currentOrder) {
            orderItems.filter(item => item.status !== 'Cancelado').forEach(item => {
                const service = availableServices.find(s => s.id === item.serviceId);
                const taxIds = service?.taxIds || [];
                const isTaxIncluded = service?.taxIncluded || false;

                // Add restaurant service tax if applicable
                const serviceTaxInfo = allTaxes.find(t => t.name.toLowerCase().includes('servicio'));
                const effectiveTaxIds = new Set(taxIds);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                const activeTaxes = Array.from(effectiveTaxIds)
                    .map(id => allTaxes.find(t => t.id === id))
                    .filter(Boolean) as Tax[];

                const totalPercentage = activeTaxes.reduce((sum, t) => sum + t.percentage, 0);
                const lineTotal = item.price * item.quantity;

                if (isTaxIncluded && totalPercentage > 0) {
                    const lineBase = lineTotal / (1 + totalPercentage / 100);
                    const lineTaxes = lineTotal - lineBase;
                    
                    subtotal += lineBase;
                    taxTotal += lineTaxes;

                    activeTaxes.forEach(t => {
                        const amt = lineTotal * (t.percentage / (100 + totalPercentage));
                        const existing = taxMap.get(t.id);
                        if (existing) existing.amount += amt;
                        else taxMap.set(t.id, { name: t.name, percentage: t.percentage, amount: amt });
                    });
                } else {
                    subtotal += lineTotal;
                    activeTaxes.forEach(t => {
                        const amt = lineTotal * (t.percentage / 100);
                        taxTotal += amt;
                        const existing = taxMap.get(t.id);
                        if (existing) existing.amount += amt;
                        else taxMap.set(t.id, { name: t.name, percentage: t.percentage, amount: amt });
                    });
                }
            });
        }

        return {
            subtotal,
            taxes: Array.from(taxMap.values()),
            total: subtotal + taxTotal
        };
    }, [currentOrder, allTaxes, availableServices]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado al carrito", description: service.name, duration: 1500 });
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

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
    };

    const handleSendOrder = () => {
        if (!tableId && !roomId) return;
        if (roomId && !activeStay) {
            toast({ title: "Acceso denegado", description: "No hay una estancia activa en esta habitación.", variant: 'destructive' });
            return;
        }
        if (cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (roomId && activeStay) {
                result = await createOrder(activeStay.id, cart);
            } else if (tableId && table) {
                if (currentOrder) {
                    result = await addToTableAccount(currentOrder.id, cart);
                } else {
                    result = await openTableAccount(tableId, cart, `Cliente ${TYPE_LABELS[table.type]} ${table.number}`, 'Public');
                }
            } else {
                result = { error: "Ubicación no identificada." };
            }

            if (result.error) {
                toast({ title: "Error al pedir", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está en preparación." });
                setCart([]);
                setEditingNoteIndex(null);
                setActiveTab('account');
            }
        });
    };

    const handleRequestBill = () => {
        if (!currentOrder || !activeStay && !tableId) return;
        startTransition(async () => {
            const result = (roomId && activeStay) 
                ? await requestStayBill(activeStay.id) 
                : await requestBill(currentOrder.id);
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({
                    title: "Cuenta Solicitada",
                    description: "El personal vendrá a tu mesa en breve.",
                });
            }
        });
    };

    const handleCancelItem = (item: any) => {
        setItemToCancel(item);
        setCancelDialogOpen(true);
    };

    const onConfirmCancel = () => {
        if (!currentOrder || !itemToCancel) return;

        startTransition(async () => {
            const orderId = itemToCancel.parentOrderId || currentOrder.id;
            const result = await cancelOrderItem(orderId, itemToCancel.id, 'Cancelado por el cliente');
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({
                    title: "Producto Cancelado",
                    description: "El producto ha sido eliminado de su cuenta.",
                });
            }
            setCancelDialogOpen(false);
            setItemToCancel(null);
        });
    };

    if ((isLoadingTable && tableId) || (isLoadingRoom && roomId)) {
        return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-bold animate-pulse uppercase tracking-[0.2em]">CARGANDO...</div>;
    }

    if (!table && !room) {
        const uniqueTypes = Array.from(new Set((allTables || []).map(t => t.type))).sort();
        const filteredTabs = (allTables || []).filter(t => t.type === selectedLocationType);

        // Auto-select first available type if current is empty or not in the set
        if (uniqueTypes.length > 0 && !uniqueTypes.includes(selectedLocationType)) {
            setSelectedLocationType(uniqueTypes[0]);
        }

        return (
            <div className="min-h-screen bg-neutral-950 p-6 flex flex-col items-center justify-center text-center">
                <div className="relative w-32 h-32 mb-6">
                    <Image src="/logo_manolo.png" alt="Hotel Du Manolo" fill className="object-contain" priority />
                </div>
                <h1 className="text-white text-3xl font-black uppercase tracking-[0.2em] italic mb-2">Hotel Du Manolo</h1>
                <p className="text-neutral-400 text-xs font-bold tracking-widest uppercase mb-8">Seleccione su ubicación</p>

                <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mb-8 flex gap-2 flex-wrap justify-center">
                    {uniqueTypes.map(type => (
                        <Button
                            key={type}
                            variant="outline"
                            onClick={() => setSelectedLocationType(type)}
                            className={cn(
                                "flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                selectedLocationType === type ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white"
                            )} data-testid="order-action-button"
                        >
                            {TYPE_LABELS[type] || type}
                        </Button>
                    ))}
                </div>

                <div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent mb-8" />

                <div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pb-12 px-4 pt-2 pr-4 lg:pr-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-800 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {[...filteredTabs].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(t => (
                        <Button
                            key={t.id}
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-3 bg-neutral-900/50 backdrop-blur-sm border border-neutral-800/80 hover:border-primary/60 hover:bg-primary/10 hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 rounded-2xl shadow-lg shadow-black/40 group cursor-pointer"
                            onClick={() => window.location.href = `/public/order?tableId=${t.id}`} data-testid="order-action-button"
                        >
                            <div className="bg-neutral-800/80 text-neutral-400 group-hover:bg-primary group-hover:text-white p-3.5 rounded-full transition-colors duration-300 shadow-inner">
                                {t.type === 'Table' ? <Utensils className="h-6 w-6" /> : <PackageOpen className="h-6 w-6" />}
                            </div>
                            <span className="font-black text-sm uppercase tracking-widest text-neutral-300 group-hover:text-white transition-colors duration-300">
                                {TYPE_LABELS[t.type] || t.type} {t.number}
                            </span>
                        </Button>
                    ))}
                    {filteredTabs.length === 0 && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-neutral-500 italic text-sm">No hay ubicaciones registradas en esta categoría.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const cartTotal = cart.reduce((sum, i) => sum + (i.service.price * i.quantity), 0);

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto border-x border-neutral-900 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-neutral-900/50 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                            <Utensils className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-lg tracking-tighter uppercase leading-none">
                                {room ? "SERVICIO A SUITE" : "AUTO-SERVICIO"}
                            </h1>
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                                {room ? `SUITE ${room.number}` : `${TYPE_LABELS[table!.type] || table!.type} ${table!.number}`}
                                {activeStay && room && ` - ${activeStay.guestName}`}
                            </p>
                        </div>
                    </div>
                    {cartCount > 0 && (
                        <Badge className="bg-primary text-white h-8 px-3 font-black animate-bounce">
                            {cartCount} ITEMS
                        </Badge>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <Input
                        placeholder="Buscar comida o bebida..."
                        className="bg-neutral-800 border-none rounded-xl pl-9 text-white placeholder:text-neutral-600 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} id="page-input-buscar-comida-o" data-testid="order-search-input"
                    />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="bg-neutral-900/30 p-2">
                    <TabsList className="grid w-full grid-cols-2 bg-neutral-800/50 rounded-xl h-12 p-1">
                        <TabsTrigger value="menu" className="rounded-lg font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary">EL MENÚ</TabsTrigger>
                        <TabsTrigger value="account" className="rounded-lg font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary relative">
                            MI CUENTA
                            {currentOrder && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 overflow-hidden mt-0">
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-neutral-900 bg-neutral-900/20">
                        <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                            !selectedCategoryId ? "bg-primary text-white" : "bg-neutral-800 text-neutral-400"
                                        )} id="page-button-todos" data-testid="order-action-all-button"
                                    >TODOS</button>
                                    {categories?.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-neutral-800 text-neutral-400"
                                            )} id="page-button-1" data-testid="order-action-category-button"
                                        >{cat.name}</button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {room && !activeStay && (
                            <div className="mx-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                <Info className="h-4 w-4 text-amber-500 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">
                                    Menú en modo lectura. Para realizar pedidos debe tener una estancia activa en la suite.
                                </p>
                            </div>
                        )}

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4 pb-32">
                                    {filteredServices.map(service => (
                                        <div key={service.id} className="flex gap-4 p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 hover:border-primary/30 transition-all">
                                            <Avatar className="h-24 w-24 rounded-xl border border-neutral-800 shrink-0">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-neutral-800 text-neutral-600"><Utensils className="h-8 w-8" /></AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 flex flex-col justify-between py-1">
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className="font-black text-sm uppercase tracking-tight line-clamp-1">{service.name}</h3>
                                                    <p className="text-[10px] text-neutral-500 line-clamp-2 leading-tight">{service.description || 'Sin descripción disponible.'}</p>
                                                    {cart.some(i => i.service.id === service.id) && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleOpenNoteDialog(cart.findIndex(i => i.service.id === service.id))}
                                                            className="h-7 px-2 w-fit -ml-2 text-primary hover:text-white hover:bg-primary/80 flex items-center gap-1.5 mt-0.5 transition-all duration-300 rounded-lg" data-testid="order-action-button"
                                                        >
                                                            <MessageSquare className="h-3.5 w-3.5" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Instrucciones</span>
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="font-black text-primary text-base">{formatCurrency(service.price)}</span>
                                                    <Button
                                                        size="sm"
                                                        className="rounded-lg h-8 px-3 font-black text-[10px] uppercase bg-neutral-800 hover:bg-primary"
                                                        onClick={() => handleAddToCart(service)} id="page-button-a-adir" data-testid="order-add-button"
                                                    >
                                                        AÑADIR <Plus className="ml-1 h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                        </ScrollArea>
                    </div>
                </TabsContent>

                <TabsContent value="account" className="flex-1 overflow-hidden mt-0 p-4">
                    <ScrollArea className="h-full">
                        <div className="space-y-6 pb-24">
                            {currentOrder && currentOrder.items.some(i => i.status !== 'Cancelado') ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h2 className="font-black text-xs uppercase tracking-widest text-neutral-500">Consumo Acumulado</h2>
                                        {currentOrder.paymentStatus === 'Pagado' ? (
                                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase bg-emerald-500/10">PAGADO / SALDO AL DÍA</Badge>
                                        ) : currentOrder.status === 'Entregado' ? (
                                            <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px] font-black uppercase">LISTO / ENTREGADO</Badge>
                                        ) : currentOrder.status === 'En preparación' ? (
                                            <Badge variant="outline" className="border-blue-500/30 text-blue-500 text-[10px] font-black uppercase animate-pulse">EN PREPARACIÓN</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px] font-black uppercase">PENDIENTE</Badge>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
                                        {currentOrder.items.filter(item => item.status !== 'Cancelado').map((item, idx) => (
                                            <div key={item.id || idx} className="p-4 border-b border-neutral-800/50 flex justify-between items-center group hover:bg-neutral-800/10 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-10 w-10 rounded-xl bg-neutral-800 flex items-center justify-center font-black text-primary border border-neutral-700">
                                                                {item.quantity}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-sm uppercase tracking-tight">{item.name}</span>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] font-bold text-neutral-500">{formatCurrency(item.price)} c/u</span>
                                                                    {(item.status === 'Entregado' || item.status === 'Listo' || (!item.status && (item.category === 'Food' ? currentOrder.kitchenStatus === 'Entregado' : currentOrder.barStatus === 'Entregado'))) && (
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border-green-500/20">
                                                                            {item.status === 'Listo' ? 'Listo para entregar' : 'Entregado'}
                                                                        </Badge>
                                                                    )}
                                                                    {(item.status === 'En preparación' || (!item.status && (item.category === 'Food' ? currentOrder.kitchenStatus === 'En preparación' : currentOrder.barStatus === 'En preparación'))) && (
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">
                                                                            {item.category === 'Beverage' ? 'Preparando' : 'Cocinando'}
                                                                        </Badge>
                                                                    )}
                                                                    {(item.status === 'Pendiente' || (!item.status && (item.category === 'Food' ? currentOrder.kitchenStatus === 'Pendiente' : currentOrder.barStatus === 'Pendiente'))) && (
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border-amber-500/20">Pendiente</Badge>
                                                                    )}
                                                                    {item.status === 'Cancelado' && (
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border-red-500/20 line-through">Cancelado</Badge>
                                                                    )}
                                                                </div>
                                                                {item.notes && (
                                                                    <p className="text-[10px] text-primary font-bold mt-1 uppercase leading-tight italic">
                                                                        "{item.notes}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {item.status !== 'Entregado' && (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleCancelItem(item)}
                                                            disabled={isPending}
                                                            className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-neutral-800 rounded-full transition-colors" data-testid="order-delete-button"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <div className="text-right">
                                                        <span className="font-black text-neutral-200 block">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Financial Summary */}
                                        <div className="p-4 bg-neutral-900/50 space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                                <span>Subtotal Neto</span>
                                                <span>{formatCurrency(billing.subtotal)}</span>
                                            </div>
                                            {billing.taxes.map((tax, i) => (
                                                <div key={i} className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                                    <span>{tax.name} {tax.percentage}%</span>
                                                    <span>{formatCurrency(tax.amount)}</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
                                                <span className="text-sm font-black uppercase tracking-tighter text-primary">
                                                    {currentOrder.paymentStatus === 'Pagado' ? 'Saldo Cancelado' : 'Total a Pagar'}
                                                </span>
                                                <span className={cn("text-xl font-black italic tracking-tighter", currentOrder.paymentStatus === 'Pagado' ? "text-emerald-500" : "text-white")}>
                                                    {formatCurrency(billing.total)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col gap-4">
                                        <div className="flex gap-3 items-start">
                                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-primary/80 font-bold leading-tight">
                                                {room ? "El personal procesará tu pedido." : "Puede seguir pidiendo del menú. El personal vendrá a su mesa periódicamente para retirar platos vacíos."}
                                            </p>
                                        </div>

                                        {currentOrder.paymentStatus === 'Pagado' ? (
                                            <div className="w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-3">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                <span className="font-black text-emerald-500 text-xs uppercase tracking-widest">Cuenta Pagada - ¡Gracias!</span>
                                            </div>
                                        ) : !currentOrder.billRequested ? (
                                            <Button
                                                onClick={handleRequestBill}
                                                disabled={isPending}
                                                className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-900/20" data-testid="order-action-button"
                                            >
                                                SOLICITAR CUENTA
                                            </Button>
                                        ) : (
                                            <div className="w-full p-3 bg-orange-600/10 border border-orange-600/20 rounded-xl text-center">
                                                <p className="font-black text-orange-600 text-[10px] uppercase tracking-widest animate-pulse">Cuenta Solicitada - Personal en camino</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 flex flex-col items-center animate-in fade-in zoom-in duration-700">
                                    <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                                        <CheckCircle className="h-10 w-10 text-emerald-500" />
                                    </div>
                                    <p className="font-black uppercase text-lg tracking-tighter text-emerald-500 mb-1">¡Todo al día!</p>
                                    <p className="font-bold uppercase text-[10px] tracking-[0.2em] text-neutral-500">No tiene saldos pendientes</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Sticky Action Bar */}
            {cart.length > 0 && (
                <div className="p-4 bg-neutral-900 border-t border-neutral-800 fixed bottom-0 left-0 right-0 max-w-md mx-auto animate-in slide-in-from-bottom-full duration-300 shadow-2xl z-30">
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-xl bg-neutral-800 border-neutral-700 shrink-0 relative"
                            onClick={() => setOrderDialogOpen(true)} data-testid="order-view-cart-button"
                        >
                            <ShoppingCart className="h-5 w-5 text-neutral-400" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white shadow-lg animate-in zoom-in duration-300">
                                    {cartCount}
                                </span>
                            )}
                        </Button>
                        <Button
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
                            onClick={handleSendOrder}
                            disabled={isPending} id="page-button-2" data-testid="order-next-button"
                        >
                            {isPending ? "ENVIANDO..." : `PEDIR ${formatCurrency(cartTotal)}`}
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Kitchen Notes Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-white">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-neutral-500">Ej: Término de carne, sin cebolla, etc.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span className="font-black text-xs uppercase text-primary">
                                {editingNoteIndex !== null ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <Textarea
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            placeholder="Escriba aquí sus indicaciones..."
                            className="bg-neutral-800 border-neutral-700 min-h-[120px] rounded-xl text-white font-bold"
                            autoFocus id="page-textarea-escriba-aqu-sus" data-testid="order-1-textarea"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setNoteDialogOpen(false)} className="text-neutral-400 hover:text-white" id="page-button-cancelar" data-testid="order-cancel-button">CANCELAR</Button>
                        <Button onClick={handleSaveNote} className="font-black uppercase text-xs tracking-widest h-11 rounded-xl" id="page-button-guardar-nota" data-testid="order-save-button">GUARDAR NOTA</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Cancellation Confirmation Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent className="bg-neutral-950 border-neutral-900 text-white max-w-[calc(100vw-2rem)] sm:max-w-[400px] rounded-2xl shadow-2xl">

                    <AlertDialogHeader>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter italic">¿Eliminar Producto?</AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-0.5">Esta acción no se puede deshacer.</AlertDialogDescription>
                            </div>
                        </div>
                        {itemToCancel && (
                            <div className="mt-4 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mb-1">Producto a cancelar</span>
                                    <span className="font-black text-sm uppercase text-white">{itemToCancel.name}</span>
                                </div>
                                <span className="font-black text-primary">{formatCurrency(itemToCancel.price * itemToCancel.quantity)}</span>
                            </div>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 flex-row gap-2">
                        <AlertDialogCancel 
                            className="flex-1 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white font-black text-[10px] uppercase tracking-widest h-12 rounded-xl"
                            onClick={() => {
                                setCancelDialogOpen(false);
                                setItemToCancel(null);
                            }}
                        >
                            No, Volver
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={onConfirmCancel}
                            disabled={isPending}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest h-12 rounded-xl border-none"
                        >
                            {isPending ? "CANCELANDO..." : "SÍ, ELIMINAR"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Order Review Dialog (Cart) */}
            <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
                <DialogContent className="bg-neutral-950 border-neutral-900 text-white max-w-md mx-auto h-[80vh] flex flex-col p-0 overflow-hidden rounded-t-3xl sm:rounded-2xl">
                    <DialogHeader className="p-6 border-b border-neutral-900 shrink-0">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Tu Pedido
                        </DialogTitle>
                        <DialogDescription className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest">
                            Revisa y confirma los productos antes de enviarlos.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-4">
                            {cart.map((item, idx) => (
                                <div key={item.service.id} className="flex gap-4 p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800/50">
                                    <Avatar className="h-16 w-16 rounded-xl border border-neutral-800 shrink-0">
                                        <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                        <AvatarFallback className="bg-neutral-800 text-neutral-600 font-black italic">{item.service.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 flex flex-col justify-center gap-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-black text-sm uppercase tracking-tight">{item.service.name}</h4>
                                            <button 
                                                onClick={() => setCart(prev => prev.filter(i => i.service.id !== item.service.id))}
                                                className="text-neutral-600 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex items-center gap-3 bg-neutral-800 rounded-lg p-1 px-2 border border-neutral-700">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="text-neutral-400 hover:text-primary"><Minus className="h-3 w-3" /></button>
                                                <span className="font-black text-xs text-primary min-w-[12px] text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="text-neutral-400 hover:text-primary"><Plus className="h-3 w-3" /></button>
                                            </div>
                                            <span className="font-black text-neutral-200">{formatCurrency(item.service.price * item.quantity)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 border-t border-neutral-900 bg-neutral-900/20 shrink-0 flex flex-col gap-4">
                        <div className="flex justify-between items-center w-full px-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Subtotal del Pedido</span>
                            <span className="text-xl font-black text-white italic">{formatCurrency(cartTotal)}</span>
                        </div>
                        <Button 
                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
                            onClick={() => {
                                setOrderDialogOpen(false);
                                handleSendOrder();
                            }}
                            disabled={isPending}
                        >
                            {isPending ? "ENVIANDO..." : `PEDIR AHORA`}
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function OrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-bold">CARGANDO...</div>}>
            <OrderPageContent />
        </Suspense>
    );
}
