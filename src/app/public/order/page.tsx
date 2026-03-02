
'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import type { RestaurantTable, Service, ProductCategory, ProductSubCategory, Order, SinpeAccount, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { 
    Utensils, Beer, Sun, MapPin, Search, ShoppingCart, 
    Plus, Minus, Trash2, Clock, CheckCircle, ChevronRight,
    ImageIcon, Layers, Filter, PackageCheck, Smartphone, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const STATUS_MAP: Record<string, string> = {
    'Pendiente': 'Pendiente',
    'En preparación': 'Preparando',
    'Entregado': 'Listo',
    'Cancelado': 'Cancelado'
};

export default function PublicOrderPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number }[]>([]);
    
    // Data State
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // 1. Fetch Tables
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    // 2. Fetch Categories
    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    // 3. Fetch Services
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // 4. Persistence & Real-time Sync
    useEffect(() => {
        if (!selectedTable || !firestore) {
            setActiveOrder(null);
            return;
        }

        const storageKey = `active_order_${selectedTable.id}`;
        const savedOrderId = localStorage.getItem(storageKey);

        if (savedOrderId) {
            const unsubscribe = onSnapshot(doc(firestore, 'orders', savedOrderId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as Order;
                    if (data.paymentStatus === 'Pendiente') {
                        setActiveOrder(data);
                    } else {
                        // Order was paid or closed
                        localStorage.removeItem(storageKey);
                        setActiveOrder(null);
                    }
                } else {
                    localStorage.removeItem(storageKey);
                    setActiveOrder(null);
                }
            });
            return () => unsubscribe();
        }
    }, [selectedTable, firestore]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
    };

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === serviceId);
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrder) {
                result = await addToTableAccount(activeOrder.id, cart);
            } else {
                const locationLabel = `${TYPE_LABELS[selectedTable.type] || selectedTable.type} ${selectedTable.number}`.toUpperCase();
                result = await openTableAccount(selectedTable.id, cart, locationLabel, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Tu orden está siendo procesada.' });
                if (result.orderId) {
                    localStorage.setItem(`active_order_${selectedTable.id}`, result.orderId);
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col">
                <div className="flex flex-col items-center mb-12 text-center space-y-4">
                    <div className="bg-primary/20 p-4 rounded-3xl border border-primary/30 shadow-[0_0_50px_-12px_rgba(16,185,129,0.5)]">
                        <Utensils className="h-12 w-12 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Go Motel</h1>
                        <p className="text-xs font-black tracking-[0.3em] text-primary/80 uppercase">Auto-Servicio Digital</p>
                    </div>
                </div>

                <div className="flex-1 max-w-2xl mx-auto w-full">
                    <h2 className="text-lg font-black uppercase tracking-widest text-center mb-8 text-muted-foreground/60">Selecciona tu ubicación</h2>
                    <Tabs defaultValue={locationTypes[0]} className="w-full">
                        <TabsList className="grid w-full bg-muted/10 p-1 mb-8 border border-white/5 rounded-2xl h-14" style={{ gridTemplateColumns: `repeat(${locationTypes.length}, 1fr)` }}>
                            {locationTypes.map(type => (
                                <TabsTrigger key={type} value={type} className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-full transition-all">
                                    {TYPE_LABELS[type] || type}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {locationTypes.map(type => (
                            <TabsContent key={type} value={type} className="animate-in fade-in zoom-in-95 duration-300 outline-none">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {allTables?.filter(t => t.type === type).map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className="group relative flex flex-col items-center justify-center h-32 rounded-3xl border-2 border-white/5 bg-white/[0.03] hover:bg-primary/10 hover:border-primary/40 transition-all active:scale-95 overflow-hidden"
                                        >
                                            <span className="text-4xl font-black tracking-tighter text-white/80 group-hover:text-primary group-hover:scale-110 transition-all">{table.number}</span>
                                            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5 group-hover:bg-primary/40 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
            {/* Header Rediseñado */}
            <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3" onClick={() => setSelectedTable(null)}>
                        <div className="bg-primary/20 p-2 rounded-2xl border border-primary/30">
                            <Utensils className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Go Motel</h1>
                            <p className="text-[8px] font-black tracking-widest text-primary uppercase">Auto-Servicio Digital</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 text-center min-w-[80px]">
                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Tu Mesa</p>
                            <p className="text-sm font-black text-primary uppercase">{selectedTable.number}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="px-4 py-3 bg-black/40 border-b border-white/5">
                <div className="flex bg-muted/10 p-1 rounded-2xl border border-white/5 h-12">
                    <button 
                        className={cn(
                            "flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                            activeTab === 'menu' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
                        )}
                        onClick={() => setActiveTab('menu')}
                    >
                        Menú
                    </button>
                    <button 
                        className={cn(
                            "flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all relative",
                            activeTab === 'account' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
                        )}
                        onClick={() => setActiveTab('account')}
                    >
                        Mi Cuenta
                        {activeOrder && activeOrder.items.some(i => (i.category === 'Food' ? activeOrder.kitchenStatus : activeOrder.barStatus) === 'Entregado') && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse border border-black" />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'menu' ? (
                    <div className="h-full flex flex-col p-4 space-y-4">
                        {/* Search & Filter */}
                        <div className="space-y-3 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar en el menú..." 
                                    className="pl-11 h-12 bg-white/5 border-white/10 rounded-2xl text-sm font-bold focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select onValueChange={setSelectedCategoryId} value={selectedCategoryId || 'all'}>
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                    <div className="flex items-center gap-2"><Filter className="h-3 w-3 text-primary" /> <SelectValue placeholder="Todo el Menú" /></div>
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10">
                                    <SelectItem value="all" className="font-bold uppercase text-[10px]">Todo el Menú</SelectItem>
                                    {categories?.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id} className="font-bold uppercase text-[10px]">{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Grid de Productos - CORREGIDO PARA EVITAR CORTES */}
                        <ScrollArea className="flex-1 -mx-4">
                            <div className="grid grid-cols-2 gap-4 px-4 pb-32">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        className="group flex flex-col bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden hover:bg-white/[0.06] hover:border-primary/30 transition-all duration-300 text-left relative active:scale-95"
                                    >
                                        <div className="aspect-[4/3] relative overflow-hidden bg-muted/20">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-white/5" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 right-2 z-10">
                                                <Badge className="font-black bg-black/60 backdrop-blur-md text-primary border-primary/20 text-[10px] py-0.5 h-6">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="p-3 flex flex-col flex-1 gap-1 min-h-[80px]">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight text-white/90">
                                                {service.name}
                                            </h3>
                                            <div className="mt-auto flex items-center justify-between pt-2">
                                                <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest">
                                                    {service.source === 'Internal' ? 'Cocina' : `Stock: ${service.stock}`}
                                                </span>
                                                <div className="bg-primary/10 p-1.5 rounded-xl border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                                    <Plus className="h-3 w-3" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    /* Pestaña Cuenta */
                    <div className="h-full flex flex-col p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        {activeOrder ? (
                            <ScrollArea className="flex-1 -mx-4">
                                <div className="px-4 space-y-6 pb-20">
                                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 text-center shadow-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-2">Total Acumulado</p>
                                        <h3 className="text-5xl font-black tracking-tighter text-white">{formatCurrency(activeOrder.total)}</h3>
                                        <div className="flex items-center justify-center gap-2 mt-4">
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Abierta</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Detalle de Consumos</h4>
                                        <div className="space-y-2">
                                            {activeOrder.items.map((item, idx) => {
                                                const status = item.category === 'Food' ? activeOrder.kitchenStatus : activeOrder.barStatus;
                                                return (
                                                    <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-xs uppercase tracking-tight truncate">{item.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="h-5 px-2 text-[9px] font-bold border-white/10 text-muted-foreground">
                                                                    {item.quantity} x {formatCurrency(item.price)}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className={cn(
                                                                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest",
                                                                status === 'Entregado' ? "bg-primary/10 text-primary border-primary/20" :
                                                                status === 'En preparación' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                                "bg-white/5 text-muted-foreground border-white/10"
                                                            )}>
                                                                {status === 'Entregado' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                                {STATUS_MAP[status || 'Pendiente'] || 'Pendiente'}
                                                            </div>
                                                            <p className="mt-1.5 font-black text-sm text-primary tracking-tighter">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-3xl bg-muted/10 border border-white/5 flex items-start gap-4">
                                        <div className="bg-white/5 p-3 rounded-2xl"><Info className="h-5 w-5 text-primary" /></div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Información de Pago</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Esta es una cuenta abierta. El pago se realiza al salir directamente en la recepción del motel.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-30 grayscale">
                                <ShoppingCart className="h-24 w-24 mb-6 stroke-[1]" />
                                <h3 className="text-2xl font-black uppercase tracking-tighter">Sin cuenta activa</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2 max-w-[200px]">Realiza tu primer pedido para iniciar tu estancia</p>
                                <Button variant="outline" className="mt-8 rounded-full h-12 px-8 font-black uppercase text-[10px] tracking-[0.2em]" onClick={() => setActiveTab('menu')}>Ver el Menú</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Cart Button (Paso 1) */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="fixed bottom-6 inset-x-0 px-6 z-[60] animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-primary p-4 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(16,185,129,0.6)] flex items-center justify-between gap-4 border-t border-white/20">
                        <div className="flex items-center gap-4 pl-2">
                            <div className="h-12 w-12 bg-black/20 rounded-2xl flex items-center justify-center relative">
                                <ShoppingCart className="h-6 w-6 text-white" />
                                <Badge className="absolute -top-2 -right-2 bg-white text-primary font-black h-6 w-6 rounded-full flex items-center justify-center p-0 text-[10px]">{cart.length}</Badge>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none mb-1">Total Pedido</span>
                                <span className="text-2xl font-black text-white leading-none tracking-tighter">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>
                        <Button 
                            className="bg-white text-primary hover:bg-white/90 rounded-[2rem] h-14 px-8 font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95"
                            onClick={handleSendOrder}
                            disabled={isPending}
                        >
                            {isPending ? "Enviando..." : activeOrder ? "Añadir a mi Cuenta" : "Enviar Pedido"}
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick Cart Preview (Mobile Drawer style) */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="fixed bottom-24 inset-x-0 px-8 z-[55] animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-t-[2rem] p-4 pb-10 shadow-2xl space-y-3">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tu selección</span>
                            <button onClick={() => setCart([])} className="text-[9px] font-black uppercase text-destructive tracking-widest bg-destructive/10 px-3 py-1 rounded-full">Limpiar</button>
                        </div>
                        <ScrollArea className="max-h-40">
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.service.id} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                                        <span className="font-bold text-[11px] uppercase tracking-tight truncate max-w-[150px]">{item.service.name}</span>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-black/40 rounded-xl p-1 px-2 border border-white/5">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="text-muted-foreground hover:text-white"><Minus className="h-3 w-3" /></button>
                                                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="text-primary hover:text-primary/80"><Plus className="h-3 w-3" /></button>
                                            </div>
                                            <button onClick={() => setCart(prev => prev.filter(i => i.service.id !== item.service.id))} className="text-destructive p-1.5 hover:bg-destructive/10 rounded-xl transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}
        </div>
    );
}
