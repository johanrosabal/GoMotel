'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ImageIcon, Utensils, Beer, Sun, MapPin, 
    X, Clock, CheckCircle, MessageSquare, ChevronRight,
    ArrowLeft, LogOut, History, ShoppingBag
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

const SESSION_KEY = 'go_motel_active_order_v1';
const TABLE_KEY = 'go_motel_active_table_v1';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // Session State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeTableId, setActiveTableId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Navigation & Filters
    const [view, setView] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Cart & UI State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Initialization: Load from LocalStorage
    useEffect(() => {
        const savedOrderId = localStorage.getItem(SESSION_KEY);
        const savedTableId = localStorage.getItem(TABLE_KEY);
        if (savedOrderId) setActiveOrderId(savedOrderId);
        if (savedTableId) setActiveTableId(savedTableId);
        setIsInitialized(true);
    }, []);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    // Real-time listener for current order to track status and end session if paid
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setCurrentOrder(null);
            return;
        }
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() } as Order;
                if (data.paymentStatus === 'Pagado' || data.status === 'Cancelado') {
                    // Session ended by admin
                    handleLogOut();
                } else {
                    setCurrentOrder(data);
                }
            } else {
                handleLogOut();
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // Track all orders for this device session (in case multiple orders in same account)
    const deviceOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId || !activeTableId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', activeTableId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeOrderId, activeTableId]);
    const { data: allOrders } = useCollection<Order>(deviceOrdersQuery);

    // Filtered account orders: Only those that belong to the current session
    // In a real app, we'd use a more secure session token, but for now we filter by 
    // orders that share the same location and haven't been finalized before our session started.
    const accountOrders = useMemo(() => {
        if (!allOrders || !activeOrderId) return [];
        // We show all orders for the table while the "current" one is still active
        return allOrders.filter(o => o.paymentStatus !== 'Pagado');
    }, [allOrders, activeOrderId]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            // Only show Available tables OR the one I'm currently using
            const isAvailable = t.status === 'Available' || t.id === activeTableId;
            return matchesType && isAvailable;
        });
    }, [allTables, typeFilter, activeTableId]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
    }, [cart]);

    const accountTotal = useMemo(() => {
        return accountOrders.reduce((sum, o) => sum + o.total, 0);
    }, [accountOrders]);

    // Handlers
    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied' && table.id !== activeTableId) {
            toast({ title: 'Mesa Ocupada', description: 'Esta ubicación ya está siendo atendida.', variant: 'destructive' });
            return;
        }
        setActiveTableId(table.id);
        localStorage.setItem(TABLE_KEY, table.id);
    };

    const handleLogOut = () => {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TABLE_KEY);
        setActiveOrderId(null);
        setActiveTableId(null);
        setCart([]);
        setView('menu');
    };

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

    const handleSendOrder = () => {
        if (!activeTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(activeTableId, cart, 'Auto-Pedido Móvil');
            }

            if (result.error) {
                toast({ title: 'Error al pedir', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando su orden.' });
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem(SESSION_KEY, result.orderId);
                }
                setCart([]);
                setView('account');
            }
        });
    };

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue || undefined } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    if (!isInitialized) return null;

    // View 1: Selection of Location
    if (!activeTableId) {
        return (
            <div className="min-h-[100dvh] bg-background p-6 flex flex-col max-w-2xl mx-auto">
                <header className="py-8 space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-primary uppercase">Bienvenido</h1>
                    <p className="text-muted-foreground font-medium">Por favor, seleccione su ubicación para ver el menú.</p>
                </header>

                <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                <SelectValue placeholder="Todas las zonas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las zonas</SelectItem>
                                {locationTypes.map(t => (
                                    <SelectItem key={t} value={t}>{t === 'Table' ? 'Mesas' : t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <ScrollArea className="flex-1 -mx-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-2 pb-10">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="flex flex-col items-center justify-center gap-2 aspect-square rounded-3xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
                                >
                                    <div className="bg-muted h-12 w-12 rounded-2xl flex items-center justify-center">
                                        {table.type === 'Bar' ? <Beer className="h-6 w-6 text-primary" /> : <Utensils className="h-6 w-6 text-primary" />}
                                    </div>
                                    <span className="text-3xl font-black tracking-tighter">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{table.type === 'Table' ? 'Mesa' : table.type}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    // View 2: Main Application (Menu & Account)
    const selectedTable = allTables?.find(t => t.id === activeTableId);

    return (
        <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden max-w-2xl mx-auto shadow-2xl">
            {/* Header */}
            <header className="bg-background border-b px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-primary h-12 w-12 rounded-2xl flex flex-col items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <span className="text-[10px] font-black leading-none uppercase mb-0.5">Mesa</span>
                        <span className="text-xl font-black leading-none tracking-tighter">{selectedTable?.number}</span>
                    </div>
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-tight">Go Motel Menu</h2>
                        <button onClick={handleLogOut} className="text-[10px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1 uppercase tracking-widest">
                            <LogOut className="h-3 w-3" /> Salir / Cambiar
                        </button>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Cuenta</p>
                    <p className="text-lg font-black text-primary tracking-tighter">{formatCurrency(accountTotal)}</p>
                </div>
            </header>

            <Tabs value={view} onValueChange={(v) => setView(v as any)} className="flex-1 flex flex-col min-h-0">
                <div className="bg-background px-6 border-b shrink-0">
                    <TabsList className="grid w-full grid-cols-2 h-14 bg-transparent gap-4">
                        <TabsTrigger 
                            value="menu" 
                            className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-black uppercase text-[11px] tracking-widest gap-2"
                        >
                            <ShoppingBag className="h-4 w-4" /> Menú
                        </TabsTrigger>
                        <TabsTrigger 
                            value="account" 
                            className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-black uppercase text-[11px] tracking-widest gap-2"
                        >
                            <History className="h-4 w-4" /> Mi Cuenta
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <TabsContent value="menu" className="h-full m-0 flex flex-col outline-none">
                        {/* Search & Categories */}
                        <div className="p-4 bg-background border-b space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué te apetece hoy?..." 
                                    className="pl-9 h-12 bg-muted/50 rounded-2xl border-none font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    className={cn(
                                        "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        selectedCategoryId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Product Grid */}
                        <ScrollArea className="flex-1 bg-muted/10">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group bg-card rounded-[2rem] overflow-hidden border shadow-sm relative aspect-[4/5] active:scale-95 transition-transform"
                                    >
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-muted/50">
                                                <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Overlay Content (Bottom) */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white mb-0.5">
                                                    {service.source === 'Internal' ? 'Cocina' : 'Bar / Stock'}
                                                </span>
                                                <h3 className="text-white font-black text-sm uppercase leading-tight tracking-tight line-clamp-2">
                                                    {service.name}
                                                </h3>
                                                <div className="flex items-center justify-between gap-2 pt-2">
                                                    <span className="text-primary-foreground font-black text-sm">{formatCurrency(service.price)}</span>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-10 w-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="account" className="h-full m-0 outline-none">
                        <ScrollArea className="h-full bg-muted/10">
                            <div className="p-6 space-y-6 pb-32">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black uppercase tracking-tight">Tu Consumo</h3>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Resumen de pedidos realizados</p>
                                </div>

                                {accountOrders.length === 0 ? (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                                            <Utensils className="h-10 w-10 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Aún no has realizado pedidos.</p>
                                        <Button onClick={() => setView('menu')} variant="outline" className="rounded-xl font-bold">Ver Carta</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {accountOrders.map((order, idx) => (
                                            <div key={order.id} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-primary/10 h-10 w-10 rounded-2xl flex items-center justify-center text-primary">
                                                            <span className="font-black text-sm">{accountOrders.length - idx}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{formatDistance(order.createdAt.toDate(), new Date(), { locale: es, addSuffix: true })}</p>
                                                            <Badge variant="secondary" className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest px-2 h-5 mt-1",
                                                                order.status === 'Pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                            )}>
                                                                {order.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <p className="font-black text-base tracking-tighter">{formatCurrency(order.total)}</p>
                                                </div>
                                                <div className="space-y-2 border-t pt-4">
                                                    {order.items.map((item, iidx) => (
                                                        <div key={iidx} className="flex justify-between text-xs font-medium">
                                                            <span className="text-muted-foreground">{item.quantity}x <span className="text-foreground font-bold uppercase">{item.name}</span></span>
                                                            <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="bg-muted/30 p-2.5 rounded-xl flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal Pedido</span>
                                                    <span className="text-sm font-black tracking-tight">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </div>
            </Tabs>

            {/* Bottom Floating Bar */}
            {cart.length > 0 && view === 'menu' && (
                <div className="fixed bottom-6 inset-x-6 z-50 pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <Badge className="absolute -top-2 -right-2 bg-white text-primary font-black text-[10px] h-5 w-5 p-0 justify-center">
                                                {cart.length}
                                            </Badge>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Ver Carrito</p>
                                            <p className="text-lg font-black tracking-tighter leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-2xl">
                                        <span className="text-[11px] font-black uppercase tracking-widest">Ordenar</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bottom-0 sm:bottom-auto translate-y-0 sm:-translate-y-1/2 rounded-t-[2.5rem] sm:rounded-3xl border-none">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Tu Carrito</DialogTitle>
                                    <DialogDescription className="font-bold">Confirma los productos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[50dvh] -mx-6 px-6">
                                    <div className="space-y-4 py-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="flex flex-col gap-3 p-4 bg-muted/30 rounded-3xl border border-dashed">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm uppercase tracking-tight truncate">{item.service.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-xs font-bold text-muted-foreground">{formatCurrency(item.service.price)}</p>
                                                            {item.service.source === 'Internal' && (
                                                                <button 
                                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                                    className={cn(
                                                                        "text-[9px] font-black uppercase px-2 py-1 rounded-lg border transition-all flex items-center gap-1",
                                                                        item.notes ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted"
                                                                    )}
                                                                >
                                                                    <MessageSquare className="h-3 w-3" />
                                                                    {item.notes ? "Ver Nota" : "+ Nota"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-white rounded-2xl p-1 shadow-sm border">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {item.notes && (
                                                    <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10">
                                                        <p className="text-[10px] font-black uppercase text-primary/60 mb-1">Instrucciones:</p>
                                                        <p className="text-xs font-bold italic">"{item.notes}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pedido</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "Procesando..." : "Confirmar y Pedir"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Notas de Cocina</DialogTitle>
                        <DialogDescription className="font-bold">¿Alguna instrucción especial para tu pedido?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-muted/50 rounded-2xl border flex items-center gap-3">
                            <Utensils className="h-5 w-5 text-primary" />
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tu instrucción</Label>
                            <Textarea 
                                placeholder="Ej: Término medio, sin cebolla, mucha salsa..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 font-bold text-sm"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
