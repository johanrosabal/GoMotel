'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, addDoc, Timestamp, increment, runTransaction, getDocs } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, X, Utensils, Beer, Sun, MapPin, 
    MessageSquare, CheckCircle, Clock, LayoutGrid, Package, User,
    ChevronLeft, ImageIcon, SmartphoneIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const SESSION_TOKEN_KEY = 'go_motel_order_session_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View States
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [zoneFilter, setStatusFilter] = useState<string>('all');
    
    // Catalog States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    
    // Cart States
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Session Management: Ensure user only sees their own orders in this session
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        let sid = localStorage.getItem(SESSION_TOKEN_KEY);
        if (!sid) {
            sid = Math.random().toString(36).substring(2, 15);
            localStorage.getItem(SESSION_TOKEN_KEY);
        }
        setSessionId(sid);
    }, []);

    // Data Fetching
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    // Watch active orders for the session
    const activeOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTableId || !sessionId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            where('sessionId', '==', sessionId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, selectedTableId, sessionId]);
    const { data: myOrders } = useCollection<Order>(activeOrdersQuery);

    const selectedTable = useMemo(() => 
        allTables?.find(t => t.id === selectedTableId), 
        [allTables, selectedTableId]
    );

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [services, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const cartTotal = useMemo(() => 
        cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0), 
        [cart]
    );

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: service.source === 'Internal' ? i.quantity + 1 : Math.min(i.quantity + 1, service.stock || 0) } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Añadido", description: `${service.name} al carrito.` });
    };

    const handleUpdateQuantity = (serviceId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.service.id === serviceId) {
                const newQty = Math.max(0, item.quantity + delta);
                if (item.service.source !== 'Internal' && newQty > (item.service.stock || 0)) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0 || !sessionId) return;

        startTransition(async () => {
            try {
                await runTransaction(firestore!, async (transaction) => {
                    // 1. Check Stock
                    for (const item of cart) {
                        if (item.service.source !== 'Internal') {
                            const sRef = doc(firestore!, 'services', item.service.id);
                            const sSnap = await transaction.get(sRef);
                            const currentStock = sSnap.data()?.stock || 0;
                            if (currentStock < item.quantity) {
                                throw new Error(`Stock insuficiente para ${item.service.name}.`);
                            }
                            transaction.update(sRef, { stock: increment(-item.quantity) });
                        }
                    }

                    // 2. Create Order
                    const orderRef = doc(collection(firestore!, 'orders'));
                    const newOrder = {
                        locationId: selectedTableId,
                        locationType: selectedTable?.type || 'Unknown',
                        label: `Auto-Pedido (${selectedTable?.number || ''})`,
                        items: cart.map(i => ({
                            serviceId: i.service.id,
                            name: i.service.name,
                            quantity: i.quantity,
                            price: i.service.price,
                            notes: i.notes || null
                        })),
                        total: cartTotal,
                        createdAt: Timestamp.now(),
                        status: 'Pendiente',
                        paymentStatus: 'Pendiente',
                        source: 'Public',
                        sessionId: sessionId
                    };

                    transaction.set(orderRef, newOrder);
                    
                    // 3. Update Table Status
                    const tableRef = doc(firestore!, 'restaurantTables', selectedTableId);
                    transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
                });

                setCart([]);
                setCurrentTab('account');
                toast({ title: "¡Pedido Enviado!", description: "Tu orden está siendo procesada." });
            } catch (e: any) {
                toast({ title: "Error", description: e.message, variant: "destructive" });
            }
        });
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    // Render Welcome / Table Selection
    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col items-center p-6 lg:p-12 animate-in fade-in duration-500">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-2">
                        <div className="inline-flex p-4 rounded-[2rem] bg-primary/10 mb-2">
                            <ShoppingCart className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={zoneFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[50vh] rounded-[2rem] border-2 bg-background/50">
                            <div className="p-4 grid grid-cols-2 gap-3">
                                {filteredTables.map(table => {
                                    const Icon = getTypeIcon(table.type);
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTableId(table.id)}
                                            className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95 group"
                                        >
                                            <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/20 transition-colors mb-3">
                                                <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <span className="font-black text-3xl tracking-tighter">{table.number}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                                                {TYPE_LABELS[table.type] || table.type}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground">
            {/* Header */}
            <header className="shrink-0 h-20 border-b bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { setSelectedTableId(null); setCart([]); }}
                        className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center active:scale-90 transition-transform"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 leading-none mb-1">Mesa Seleccionada</p>
                        <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">{selectedTable?.number}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-12 px-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest text-primary">Móvil</span>
                    </div>
                </div>
            </header>

            {/* Main Viewport */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
                {currentTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Filters */}
                        <div className="p-4 space-y-4 shrink-0 bg-muted/5">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se te antoja hoy?" 
                                    className="pl-11 h-14 bg-background rounded-2xl border-2 text-base font-bold shadow-sm focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shrink-0",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                                        )}
                                        onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shrink-0",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                                            )}
                                            onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="hidden" />
                            </ScrollArea>
                        </div>

                        {/* Catalog Grid */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div
                                        key={service.id}
                                        className="group relative flex flex-col bg-card rounded-[2rem] overflow-hidden border-2 border-border/50 hover:border-primary/40 transition-all duration-300 shadow-sm"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-700" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Top info badge */}
                                            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
                                                <Badge className="bg-black/60 text-white border-0 backdrop-blur-md font-black text-[8px] uppercase tracking-widest px-2 py-1">
                                                    {service.category === 'Beverage' ? 'Bebida' : service.category === 'Food' ? 'Comida' : 'Amenidad'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant={service.stock <= (service.minStock || 5) ? 'destructive' : 'secondary'} className="font-black text-[8px] uppercase tracking-widest px-2 py-1">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Hover overlay gradient */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <div className="flex justify-end">
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-90 transition-all hover:bg-primary/90"
                                                    >
                                                        <Plus className="h-6 w-6" />
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="font-black text-sm uppercase tracking-tight leading-none text-white drop-shadow-md line-clamp-2">
                                                        {service.name}
                                                    </h3>
                                                    <p className="text-lg font-black text-primary drop-shadow-lg">
                                                        {formatCurrency(service.price)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {currentTab === 'cart' && (
                    <div className="flex-1 flex flex-col min-h-0 p-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Tu Carrito</h2>
                            <Badge variant="outline" className="h-8 px-4 font-black uppercase text-[10px] tracking-widest border-2">
                                {cart.length} productos
                            </Badge>
                        </div>

                        <ScrollArea className="flex-1 -mx-6 px-6">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center space-y-6">
                                    <div className="p-8 rounded-[3rem] bg-muted/50">
                                        <ShoppingCart className="h-20 w-20 opacity-20" />
                                    </div>
                                    <p className="font-bold text-lg max-w-[200px]">Tu carrito está esperando por algo delicioso.</p>
                                    <Button 
                                        variant="outline" 
                                        className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest border-2"
                                        onClick={() => setCurrentTab('menu')}
                                    >
                                        Ver Menú
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4 pb-10">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="group p-4 rounded-[2rem] border-2 bg-card shadow-sm hover:shadow-xl hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-20 w-20 rounded-2xl border-2">
                                                    <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback className="rounded-2xl"><ImageIcon className="h-8 w-8 text-muted-foreground/20" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-black text-sm uppercase tracking-tight truncate leading-tight">{item.service.name}</h4>
                                                    <p className="text-primary font-black text-base mt-0.5">{formatCurrency(item.service.price)}</p>
                                                    <button 
                                                        onClick={() => { setEditingNoteIndex(idx); setCurrentNoteValue(item.notes || ''); setNoteDialogOpen(true); }}
                                                        className={cn(
                                                            "mt-2 text-[9px] font-black uppercase flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all",
                                                            item.notes ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-transparent hover:bg-primary/5"
                                                        )}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Ver Instrucciones" : "+ Instrucciones de cocina"}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 bg-muted/50 p-1.5 rounded-2xl border shadow-inner">
                                                    <button 
                                                        onClick={() => handleUpdateQuantity(item.service.id, 1)}
                                                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-background shadow-md active:scale-90 transition-transform"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                    <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                                                    <button 
                                                        onClick={() => handleUpdateQuantity(item.service.id, -1)}
                                                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-background shadow-md active:scale-90 transition-transform"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            {item.notes && (
                                                <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-dashed border-primary/20 text-[11px] font-medium text-primary italic">
                                                    "{item.notes}"
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {cart.length > 0 && (
                            <div className="pt-6 border-t mt-4 space-y-4 pb-20">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none">Total del Pedido</p>
                                        <p className="text-4xl font-black tracking-tighter text-primary leading-none">{formatCurrency(cartTotal)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">Items</p>
                                        <p className="font-black text-xl leading-none">{cart.length}</p>
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-16 rounded-[1.5rem] font-black uppercase text-base tracking-[0.1em] shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                                    onClick={handleSendOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? "Procesando..." : "Enviar a Preparación"}
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {currentTab === 'account' && (
                    <div className="flex-1 flex flex-col min-h-0 p-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Estancia Activa</span>
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="space-y-6 pb-10">
                                <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                    <div className="bg-primary p-8 text-primary-foreground relative">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                        <div className="relative z-10 flex justify-between items-center">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Saldo Acumulado</p>
                                                <h3 className="text-5xl font-black tracking-tighter">
                                                    {formatCurrency(myOrders?.filter(o => o.status !== 'Cancelado').reduce((sum, o) => sum + o.total, 0) || 0)}
                                                </h3>
                                            </div>
                                            <div className="h-16 w-16 rounded-[1.5rem] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                                                <Package className="h-8 w-8" />
                                            </div>
                                        </div>
                                    </div>
                                    <CardContent className="p-8 space-y-6 bg-card">
                                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-4">
                                            <span>Historial de Consumo</span>
                                            <span>{myOrders?.length || 0} pedidos</span>
                                        </div>
                                        <div className="space-y-4">
                                            {myOrders && myOrders.length > 0 ? myOrders.map(order => (
                                                <div key={order.id} className="relative group p-5 rounded-[2rem] border-2 bg-muted/20 hover:bg-muted/40 transition-all">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                                <p className="text-[10px] font-bold text-muted-foreground">
                                                                    {order.createdAt.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                            <p className="font-black text-lg tracking-tight leading-none">{formatCurrency(order.total)}</p>
                                                        </div>
                                                        <Badge className={cn(
                                                            "font-black uppercase text-[10px] px-4 py-1.5 rounded-full pointer-events-none transition-none shadow-sm",
                                                            order.status === 'Entregado' ? "bg-emerald-500 text-white" : "bg-white text-primary border-2 border-primary/10 hover:bg-white hover:text-primary"
                                                        )}>
                                                            {order.status === 'Pendiente' ? 'En Cola' : order.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {order.items.map((item, i) => (
                                                            <div key={i} className="flex justify-between text-sm">
                                                                <span className="font-bold text-muted-foreground/80"><span className="text-primary">{item.quantity}x</span> {item.name}</span>
                                                                <span className="font-black opacity-40">{formatCurrency(item.price * item.quantity)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-12 text-center text-muted-foreground italic font-medium">Aún no has realizado pedidos.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="p-8 rounded-[2.5rem] bg-amber-500/10 border-2 border-amber-500/20 flex flex-col items-center text-center space-y-4">
                                    <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
                                        <Smartphone className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">¿Deseas pagar la cuenta?</h4>
                                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                            Para solicitar el cobro, por favor comunícate con la recepción o un salonero.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </main>

            {/* Fixed Bottom Navigation (App Style) */}
            <nav className="shrink-0 h-24 bg-background/95 backdrop-blur-xl border-t flex items-center justify-around px-4 pb-4 z-20">
                <button 
                    onClick={() => setCurrentTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-6 py-2 rounded-2xl",
                        currentTab === 'menu' ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <LayoutGrid className={cn("h-6 w-6 transition-transform", currentTab === 'menu' && "scale-110")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Menú</span>
                    {currentTab === 'menu' && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setCurrentTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-6 py-2 rounded-2xl",
                        currentTab === 'cart' ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <div className="relative">
                        <ShoppingCart className={cn("h-6 w-6 transition-transform", currentTab === 'cart' && "scale-110")} />
                        {cart.length > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 rounded-full font-black text-[10px] animate-in zoom-in border-2 border-background">
                                {cart.length}
                            </Badge>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Carrito</span>
                    {currentTab === 'cart' && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />}
                </button>
                <button 
                    onClick={() => setCurrentTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-6 py-2 rounded-2xl",
                        currentTab === 'account' ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <User className={cn("h-6 w-6 transition-transform", currentTab === 'account' && "scale-110")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
                    {currentTab === 'account' && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />}
                </button>
            </nav>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription className="font-medium">
                            Añada indicaciones especiales para la preparación.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-xl shadow-inner"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kitchen-note-public" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Detalles especiales</Label>
                            <Textarea 
                                id="kitchen-note-public"
                                placeholder="Ej: Sin sal, bien cocido, sin cebolla..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 font-bold text-base focus:border-primary transition-all"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-3">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
