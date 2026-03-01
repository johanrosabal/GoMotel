
'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory, CompanyProfile } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
    Search, ShoppingCart, Plus, Minus, Check, 
    ArrowRight, Utensils, History, Info, X, 
    MapPin, ChevronRight, ImageIcon, Smartphone, Clock
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type CartItem = {
  service: Service;
  quantity: number;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const ZONE_LABELS: Record<string, string> = {
    'Table': 'Mesas Salón',
    'Bar': 'Área de Barra',
    'Terraza': 'Terraza Abierta',
    'Pooles': 'Área de Pooles'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Session Management
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [currentSessionOrderId, setCurrentSessionOrderId] = useState<string | null>(null);

    // View State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [zoneFilter, setRoleFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Initialize Device Session
    useEffect(() => {
        let id = localStorage.getItem('motel_guest_device_id');
        if (!id) {
            id = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('motel_guest_device_id', id);
        }
        setDeviceId(id);

        const savedOrderId = localStorage.getItem('motel_active_order_id');
        if (savedOrderId) setCurrentSessionOrderId(savedOrderId);
    }, []);

    // Firestore Real-time Subscriptions
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    useEffect(() => {
        if (!firestore) return;
        const q = query(collection(firestore, 'restaurantTables'), orderBy('number'));
        return onSnapshot(q, (snap) => {
            setTables(snap.docs.map(d => ({ id: d.id, ...d.data() } as RestaurantTable)));
        });
    }, [firestore]);

    useEffect(() => {
        if (!firestore || !currentSessionOrderId) {
            setActiveOrder(null);
            return;
        }
        const orderRef = doc(firestore, 'orders', currentSessionOrderId);
        return onSnapshot(orderRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' || data.status === 'Cancelado') {
                    localStorage.removeItem('motel_active_order_id');
                    setCurrentSessionOrderId(null);
                } else {
                    setActiveOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem('motel_active_order_id');
                setCurrentSessionOrderId(null);
            }
        });
    }, [firestore, currentSessionOrderId]);

    // Data Fetching
    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const companyRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'companyInfo')) : null, [firestore]);
    const { data: companyData } = useCollection<CompanyProfile>(companyRef);
    const company = companyData?.[0];

    // Logic
    const locationTypes = useMemo(() => Array.from(new Set(tables.map(t => t.type))), [tables]);

    const filteredTables = useMemo(() => {
        return tables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [tables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [cart]);

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
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrder) {
                result = await addToTableAccount(activeOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, 'Auto-Pedido', 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Lo recibiremos en un momento.' });
                setCart([]);
                if (result.orderId) {
                    setCurrentSessionOrderId(result.orderId);
                    localStorage.setItem('motel_active_order_id', result.orderId);
                }
                setActiveTab('account');
            }
        });
    };

    // --- RENDER SCREEN: SELECT TABLE ---
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-in fade-in duration-500">
                <header className="flex flex-col items-center gap-4 mb-10 mt-8 text-center">
                    {company?.logoUrl && <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" />}
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Bienvenido</h1>
                        <p className="text-zinc-500 font-medium">¿Dónde se encuentra?</p>
                    </div>
                </header>

                <div className="w-full max-w-md mx-auto space-y-8">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Filtrar Zona</Label>
                        <Select value={zoneFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                <SelectValue placeholder="Todas las zonas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las zonas</SelectItem>
                                {locationTypes.map(type => (
                                    <SelectItem key={type} value={type}>{TYPE_LABELS[type] || type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <ScrollArea className="h-[50vh] pr-4">
                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTable(table)}
                                    className="group relative flex flex-col items-center justify-center p-6 bg-background border-2 rounded-[2rem] hover:border-primary hover:shadow-xl transition-all active:scale-95"
                                >
                                    <span className="text-4xl font-black tracking-tighter mb-1">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{TYPE_LABELS[table.type] || table.type}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans overflow-hidden">
            {/* Header Fijo */}
            <header className="bg-background/80 backdrop-blur-xl border-b p-4 flex items-center justify-between z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-2xl">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mesa Seleccionada</p>
                        <p className="font-black text-xl tracking-tighter">{selectedTable.number} <span className="text-xs font-bold text-zinc-400 opacity-60">— {TYPE_LABELS[selectedTable.type] || selectedTable.type}</span></p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTable(null)} className="rounded-2xl h-11 w-11 hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-5 w-5" />
                </Button>
            </header>

            <main className="flex-1 overflow-hidden relative flex flex-col">
                {/* MENU TAB */}
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-4 space-y-4 shrink-0">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 transition-colors group-focus-within:text-primary" />
                                <Input 
                                    placeholder="Buscar productos..." 
                                    className="h-12 pl-11 bg-background border-2 rounded-2xl text-lg font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-6 h-10 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-zinc-200/50 text-zinc-500"
                                        )}
                                    >Todos</button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-6 h-10 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-zinc-200/50 text-zinc-500"
                                            )}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        disabled={service.source !== 'Internal' && (service.stock || 0) <= 0}
                                        className="group relative flex flex-col aspect-[4/5] bg-background border-2 rounded-[2.5rem] overflow-hidden hover:border-primary active:scale-95 transition-all duration-300 disabled:opacity-50"
                                    >
                                        <Avatar className="absolute inset-0 h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-700" />
                                            <AvatarFallback className="rounded-none bg-zinc-100 dark:bg-zinc-900">
                                                <ImageIcon className="h-12 w-12 opacity-10" />
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                                        
                                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                                            <Badge variant="secondary" className="bg-white/20 backdrop-blur-md text-white border-0 text-[8px] font-black uppercase tracking-widest px-2 py-1">
                                                {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                            </Badge>
                                            {service.source !== 'Internal' && (
                                                <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                                                    <p className="text-[8px] font-black text-white/80 uppercase">Stock: {service.stock}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-auto p-5 relative z-10 w-full">
                                            <h3 className="font-black text-sm uppercase tracking-tight text-white line-clamp-2 mb-1 leading-tight">{service.name}</h3>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-primary font-black text-lg tracking-tighter">{formatCurrency(service.price)}</span>
                                                <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:bg-white group-hover:text-primary transition-colors">
                                                    <Plus className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* CART TAB */}
                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black tracking-tighter uppercase">Tu Pedido</h2>
                            <Badge className="h-8 px-4 font-black uppercase bg-primary/10 text-primary border-primary/20">{cart.length} Ítems</Badge>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                                    <ShoppingCart className="h-10 w-10 text-zinc-300" />
                                </div>
                                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Aún no has añadido nada</p>
                                <Button onClick={() => setActiveTab('menu')} variant="outline" className="h-12 rounded-2xl font-black uppercase tracking-widest px-8">Ver Menú</Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 -mx-2 px-2">
                                    <div className="space-y-4">
                                        {cart.map((item) => (
                                            <div key={item.service.id} className="flex items-center gap-4 p-4 bg-background border-2 rounded-[2rem] shadow-sm">
                                                <Avatar className="h-16 w-16 rounded-2xl shadow-md">
                                                    <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback><ImageIcon className="opacity-20" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                                    <p className="text-primary font-black text-sm">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl border">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-6 text-center font-black text-sm text-primary">{item.quantity}</span>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)} disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="mt-6 pt-6 border-t space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Estimado</span>
                                        <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-[2rem] text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "Enviando..." : "Confirmar Pedido"}
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black tracking-tighter uppercase">Tu Cuenta</h2>
                            <Badge variant="outline" className="h-8 px-4 font-black uppercase border-primary/20 text-primary">Estancia Actual</Badge>
                        </div>

                        {!activeOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                                    <Clock className="h-10 w-10 text-zinc-300" />
                                </div>
                                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay consumos registrados aún</p>
                                <Button onClick={() => setActiveTab('menu')} variant="outline" className="h-12 rounded-2xl font-black uppercase tracking-widest px-8">Hacer Primer Pedido</Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Acumulado</p>
                                                    <h3 className="text-4xl font-black tracking-tighter mt-1">{formatCurrency(activeOrder.total)}</h3>
                                                </div>
                                                <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                                    <Smartphone className="h-7 w-7" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-6 space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Detalle de Consumo</h4>
                                                    <Badge variant="outline" className="text-[9px] font-bold uppercase border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                                                        {activeOrder.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-3">
                                                    {activeOrder.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-black">{item.quantity}</div>
                                                                <span className="text-xs font-bold uppercase truncate max-w-[150px]">{item.name}</span>
                                                            </div>
                                                            <span className="text-xs font-black">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="pt-6 border-t border-dashed">
                                                <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-[1.5rem] border-2 border-amber-200/50 dark:border-amber-900/50 flex gap-4">
                                                    <Info className="h-5 w-5 text-amber-600 shrink-0" />
                                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                                                        Para solicitar el cobro, por favor comunícate con la recepción o un salonero.
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* BARRA DE NAVEGACIÓN INFERIOR (App Style) */}
            <nav className="h-20 bg-background border-t px-6 flex items-center justify-between shrink-0 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-zinc-400 grayscale"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'menu' ? "bg-primary/10" : "")}>
                        <Utensils className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all relative",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-zinc-400 grayscale"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'cart' ? "bg-primary/10" : "")}>
                        <ShoppingCart className="h-5 w-5" />
                    </div>
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground rounded-full text-[10px] font-black flex items-center justify-center border-2 border-background animate-in zoom-in">
                            {cart.length}
                        </span>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all",
                        activeTab === 'account' ? "text-primary scale-110" : "text-zinc-400 grayscale"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'account' ? "bg-primary/10" : "")}>
                        <History className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </nav>
        </div>
    );
}
