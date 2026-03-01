'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, CompanyProfile } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight,
    ImageIcon, Utensils, Clock, CheckCircle, X, LogOut, Filter, Store, History, MessageSquare
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';

const SESSION_KEY = 'public_order_session_table_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session State
    const [sessionTableId, setSessionTableId] = useState<string | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);
    
    // Zone Filter for selection screen
    const [zoneFilter, setZoneFilter] = useState<string>('all');

    // Note Modal State
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Timer for time-ago strings
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Load Session
    useEffect(() => {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) setSessionTableId(saved);
        setIsCheckingSession(false);
    }, []);

    // Data Fetching
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const selectedTable = useMemo(() => {
        if (!sessionTableId || !allTables) return null;
        return allTables.find(t => t.id === sessionTableId);
    }, [sessionTableId, allTables]);

    // Orders for "My Account"
    const activeOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !sessionTableId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', sessionTableId),
            where('status', '!=', 'Cancelado')
        );
    }, [firestore, sessionTableId]);
    const { data: myOrders } = useCollection<Order>(activeOrdersQuery);

    const displayTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesZone = zoneFilter === 'all' || t.type === zoneFilter;
            // Only show tables that are available OR the one currently claimed by this device
            const isAvailable = t.status === 'Available' || t.id === sessionTableId;
            return matchesZone && isAvailable;
        }).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, zoneFilter, sessionTableId]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

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

    // Actions
    const handleSelectTable = (tableId: string) => {
        localStorage.setItem(SESSION_KEY, tableId);
        setSessionTableId(tableId);
        setCart([]);
        setActiveTab('menu');
    };

    const handleExit = () => {
        localStorage.removeItem(SESSION_KEY);
        setSessionTableId(null);
        setCart([]);
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

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!sessionTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            const existingPendingOrder = myOrders?.find(o => o.status === 'Pendiente');
            
            if (existingPendingOrder) {
                result = await addToTableAccount(existingPendingOrder.id, cart);
            } else {
                result = await openTableAccount(sessionTableId, cart);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Tu orden está siendo procesada.' });
                setCart([]);
                setActiveTab('account');
                getServices().then(setAvailableServices);
            }
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + (i.service.price * i.quantity), 0), [cart]);
    const accountTotal = useMemo(() => myOrders?.reduce((sum, o) => sum + o.total, 0) || 0, [myOrders]);

    if (isCheckingSession) return null;

    // Selection Screen
    if (!sessionTableId || !selectedTable || (selectedTable.status === 'Available' && !myOrders?.length)) {
        return (
            <div className="min-h-screen bg-background flex flex-col p-6 animate-in fade-in duration-500">
                <div className="max-w-md mx-auto w-full space-y-10 py-10">
                    <div className="text-center space-y-4">
                        <div className="bg-primary/10 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto ring-8 ring-primary/5">
                            <Store className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
                            {company?.tradeName || 'Go Motel'}
                        </h1>
                        <p className="text-muted-foreground font-medium text-sm px-10">
                            Bienvenido. Por favor selecciona tu ubicación para comenzar tu pedido.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                <Filter className="h-3 w-3" /> Filtrar por Zona
                            </Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-12 rounded-2xl border-2 bg-background font-bold shadow-sm">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {displayTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table.id)}
                                    className="group relative flex flex-col items-center justify-center h-32 rounded-3xl border-2 bg-card hover:border-primary transition-all duration-300 active:scale-95 shadow-sm hover:shadow-xl hover:-translate-y-1"
                                >
                                    <span className="text-4xl font-black text-foreground group-hover:text-primary transition-colors">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{table.type}</span>
                                    {table.status === 'Available' ? (
                                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    ) : (
                                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {displayTables.length === 0 && (
                            <div className="text-center py-10 bg-muted/30 rounded-3xl border-2 border-dashed">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No hay ubicaciones disponibles</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Main Order Screen
    return (
        <div className="min-h-screen bg-background flex flex-col overflow-hidden">
            <header className="bg-background border-b shrink-0 px-4 h-16 flex items-center justify-between z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-primary/20">
                        {selectedTable.number}
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-tight text-foreground leading-none">{selectedTable.type}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Sesión Activa</p>
                    </div>
                </div>
                <button 
                    onClick={handleExit}
                    className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded-xl bg-muted/50 border border-transparent hover:border-destructive/20"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </header>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
                <div className="px-4 pt-4 shrink-0 bg-background border-b pb-4">
                    <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1">
                        <TabsTrigger value="menu" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm">
                            Menú
                        </TabsTrigger>
                        <TabsTrigger value="account" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-sm relative">
                            Mi Cuenta
                            {myOrders && myOrders.length > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-[8px] flex items-center justify-center rounded-full border-2 border-background ring-2 ring-primary/20" />}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                    <TabsContent value="menu" className="h-full flex flex-col m-0 p-0">
                        <div className="p-4 space-y-4 shrink-0 bg-background shadow-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar en el menú..." 
                                    className="pl-9 h-12 bg-muted/30 rounded-2xl border-none font-medium shadow-inner"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/50 text-muted-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/50 text-muted-foreground"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute bottom-3 left-3">
                                                <Badge className="font-black bg-background/90 text-primary border-primary/20 shadow-sm backdrop-blur-sm px-2 py-1">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-3 flex flex-col justify-between flex-1 gap-3">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight min-h-[2rem]">
                                                {service.name}
                                            </h3>
                                            <div className="flex items-center justify-between gap-2">
                                                {cart.find(i => i.service.id === service.id) ? (
                                                    <div className="flex items-center gap-2 bg-primary/10 rounded-full p-1 w-full justify-between">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background" onClick={() => handleRemoveFromCart(service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-[11px] font-black text-primary">{cart.find(i => i.service.id === service.id)?.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background" onClick={() => handleAddToCart(service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button 
                                                        className="w-full h-9 rounded-2xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-sm"
                                                        onClick={() => handleAddToCart(service)}
                                                    >
                                                        <Plus className="h-3 w-3" /> Agregar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="account" className="h-full flex flex-col m-0 p-0 bg-muted/20">
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6 pb-20">
                                <div className="bg-primary rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 opacity-80">
                                            <Utensils className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Total Consumido</span>
                                        </div>
                                        <Badge variant="outline" className="bg-white/20 border-none text-white font-black">
                                            {myOrders?.length || 0} PEDIDOS
                                        </Badge>
                                    </div>
                                    <p className="text-4xl font-black tracking-tighter">{formatCurrency(accountTotal)}</p>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 ml-1">
                                        <History className="h-3.5 w-3.5" /> Historial de Pedidos
                                    </h3>
                                    {myOrders && myOrders.length > 0 ? (
                                        [...myOrders].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map((order, idx) => (
                                            <div key={order.id} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center font-black text-xs">
                                                            {myOrders.length - idx}
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDistance(order.createdAt.toDate(), now, { locale: es, addSuffix: true })}
                                                        </div>
                                                    </div>
                                                    <Badge className={cn(
                                                        "font-black text-[9px] uppercase px-3 py-1 rounded-full",
                                                        order.status === 'Entregado' ? "bg-green-500" : "bg-amber-500 animate-pulse"
                                                    )}>
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                
                                                <div className="space-y-2 border-t pt-4">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-start text-sm">
                                                            <div className="flex-1">
                                                                <p className="font-bold uppercase text-xs leading-none">{item.quantity}x {item.name}</p>
                                                                {item.notes && <p className="text-[10px] text-primary italic mt-1 ml-4 border-l-2 pl-2 border-primary/20">"{item.notes}"</p>}
                                                            </div>
                                                            <p className="font-bold text-muted-foreground ml-4">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex justify-between items-center pt-3 border-t border-dashed">
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Subtotal Pedido</span>
                                                    <span className="font-black text-sm">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed space-y-4">
                                            <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aún no has realizado pedidos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </div>
            </Tabs>

            {/* Bottom Floating Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-2 -right-2 h-5 w-5 bg-white text-primary text-[10px] font-black flex items-center justify-center rounded-full shadow-sm ring-2 ring-primary">
                                                {cart.reduce((s, i) => s + i.quantity, 0)}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Ver Pedido</p>
                                            <p className="text-lg font-black tracking-tighter leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest bg-white/20 px-4 h-10 rounded-2xl">
                                        Confirmar <ChevronRight className="h-4 w-4" />
                                    </div>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-t-3xl sm:rounded-3xl border-none">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Confirmar Pedido</DialogTitle>
                                    <DialogDescription className="text-xs font-medium uppercase tracking-widest">
                                        Enviando a {selectedTable.type} {selectedTable.number}
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <ScrollArea className="max-h-[50vh] pr-4 my-4">
                                    <div className="space-y-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/30 rounded-2xl p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className="font-black text-xs uppercase">{item.service.name}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.service.price)} x {item.quantity}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-background rounded-xl p-1 shadow-sm">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleAddToCart(item.service)} disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                {item.service.source === 'Internal' && (
                                                    <div className="space-y-1.5">
                                                        <button 
                                                            onClick={() => handleOpenNoteDialog(idx)}
                                                            className={cn(
                                                                "flex items-center gap-2 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all shadow-sm w-full",
                                                                item.notes ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                                                            )}
                                                        >
                                                            <MessageSquare className="h-3 w-3" />
                                                            {item.notes ? "Instrucción: " + item.notes : "Añadir instrucción de cocina"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">Total del Pedido</span>
                                        <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.1em] text-sm shadow-xl shadow-primary/20"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "PROCESANDO..." : "ENVIAR A COCINA / BARRA"}
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
                        <DialogTitle className="text-lg font-black uppercase tracking-tight">Instrucción Especial</DialogTitle>
                        <DialogDescription className="text-xs font-medium uppercase tracking-widest">
                            {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="public-kitchen-note" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">¿Cómo prefieres tu pedido?</Label>
                        <Textarea 
                            id="public-kitchen-note"
                            placeholder="Ej: Con poca sal, sin cebolla, término medio..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 bg-muted/20 focus:bg-background transition-colors resize-none text-sm font-bold p-4"
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="flex-row gap-2">
                        <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
