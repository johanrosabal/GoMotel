'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, PackageCheck, Clock, CheckCircle, X, Utensils, Beer, Sun, MapPin,
    ImageIcon, History, User, ChevronRight, LayoutGrid
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type CartItem = {
  service: Service;
  quantity: number;
};

const SESSION_KEY = 'go_motel_active_order_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [zoneFilter, setStatusFilter] = useState<string>('all');

    // Session / Privacy State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [orderHistory, setOrderHistory] = useState<Order | null>(null);

    // Initialize session from localStorage
    useEffect(() => {
        const savedId = localStorage.getItem(SESSION_KEY);
        if (savedId) setActiveOrderId(savedId);
    }, []);

    // Listen to current order for real-time status and privacy
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setOrderHistory(null);
            return;
        }
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // Si la orden ya fue pagada, limpiamos la sesión para el siguiente cliente
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(SESSION_KEY);
                    setActiveOrderId(null);
                    setOrderHistory(null);
                } else {
                    setOrderHistory({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
                setActiveOrderId(null);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return zoneFilter === 'all' ? allTables : allTables.filter(t => t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado", description: `${service.name} al carrito.` });
    };

    const handleUpdateQuantity = (serviceId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.service.id === serviceId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, 'Pedido Móvil', 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem(SESSION_KEY, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                toast({ title: "¡Pedido Enviado!", description: "Su orden está siendo procesada." });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTableId) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col p-6 animate-in fade-in duration-500">
                <div className="space-y-2 mb-8 text-center pt-10">
                    <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mb-4">
                        <Smartphone className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter">Bienvenido</h1>
                    <p className="text-muted-foreground font-medium">Seleccione su mesa para ver el menú</p>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                    <button 
                        onClick={() => setStatusFilter('all')}
                        className={cn("h-10 px-6 rounded-full font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0", 
                        zoneFilter === 'all' ? "bg-primary border-primary text-white" : "border-muted text-muted-foreground")}
                    >Todas</button>
                    {['Table', 'Bar', 'Terraza'].map(zone => (
                        <button 
                            key={zone}
                            onClick={() => setStatusFilter(zone)}
                            className={cn("h-10 px-6 rounded-full font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0", 
                            zoneFilter === zone ? "bg-primary border-primary text-white" : "border-muted text-muted-foreground")}
                        >{zone === 'Table' ? 'Mesas' : zone}</button>
                    ))}
                </div>

                <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-10">
                        {filteredTables.map(table => (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTableId(table.id)}
                                className="group bg-card border-2 border-border hover:border-primary rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-xl active:scale-95 aspect-square"
                            >
                                <span className="text-5xl font-black tracking-tighter group-hover:text-primary transition-colors">{table.number}</span>
                                <Badge variant="outline" className="font-black uppercase text-[9px] tracking-widest opacity-60">
                                    {table.type === 'Table' ? 'Mesa' : table.type}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        );
    }

    const currentTable = allTables?.find(t => t.id === selectedTableId);

    return (
        <div className="min-h-[100dvh] flex flex-col bg-muted/20 relative overflow-hidden">
            {/* Top Bar */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] leading-none mb-1">Ubicación</span>
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        {currentTable?.type === 'Table' ? 'Mesa' : currentTable?.type} {currentTable?.number}
                    </h2>
                </div>
                <button onClick={() => { setSelectedTableId(null); setCart([]); }} className="h-10 w-10 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <main className="flex-1 flex flex-col overflow-hidden pb-32">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                        <div className="p-4 space-y-4 bg-background border-b shadow-sm shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar algo delicioso..." 
                                    className="pl-9 h-12 bg-muted/30 border-0 rounded-2xl text-base font-medium focus-visible:ring-2 focus-visible:ring-primary/20"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full no-scrollbar">
                                <div className="flex gap-2 pb-1">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0", 
                                        !selectedCategoryId ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted/50 text-muted-foreground")}
                                    >Todos</button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0", 
                                            selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted/50 text-muted-foreground")}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-10">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group bg-card border rounded-[2rem] overflow-hidden flex flex-col relative shadow-sm"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Top info integrated */}
                                            <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10 pointer-events-none">
                                                <Badge className="bg-white/90 text-black border-0 font-black text-[8px] tracking-widest uppercase shadow-sm">
                                                    {service.category}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className="bg-primary text-white border-0 font-black text-[8px] tracking-widest uppercase shadow-sm">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom interaction integrated */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-10 z-10">
                                                <h3 className="font-black text-[11px] uppercase tracking-tight text-white mb-2 leading-tight line-clamp-2">{service.name}</h3>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-black text-white">{formatCurrency(service.price)}</span>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform"
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
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Tu Pedido</h2>
                            <Badge variant="secondary" className="h-8 px-4 rounded-xl font-black">{cart.length} Artículos</Badge>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                                <div className="p-10 rounded-full bg-muted border-4 border-dashed"><ShoppingCart className="h-16 w-16" /></div>
                                <p className="text-xl font-black uppercase tracking-widest">Carrito Vacío</p>
                                <Button onClick={() => setActiveTab('menu')} variant="outline" className="rounded-2xl h-12 font-black uppercase px-8 border-2">Ver Catálogo</Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1 -mx-2 px-2">
                                <div className="space-y-4 pb-10">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="bg-card border rounded-3xl p-4 flex items-center gap-4 shadow-sm">
                                            <Avatar className="h-20 w-20 rounded-2xl border-2">
                                                <AvatarImage src={item.service.imageUrl} className="object-cover" />
                                                <AvatarFallback><ImageIcon /></AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm uppercase tracking-tight truncate">{item.service.name}</p>
                                                <p className="text-primary font-black text-base">{formatCurrency(item.service.price * item.quantity)}</p>
                                                
                                                <div className="flex items-center gap-3 mt-3">
                                                    <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-xl border border-primary/20">
                                                        <button onClick={() => handleUpdateQuantity(item.service.id, -1)} className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shadow-sm"><Minus className="h-4 w-4" /></button>
                                                        <span className="w-8 text-center font-black text-primary text-sm">{item.quantity}</span>
                                                        <button onClick={() => handleUpdateQuantity(item.service.id, 1)} className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shadow-sm"><Plus className="h-4 w-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}

                        {cart.length > 0 && (
                            <div className="mt-auto pt-6 space-y-4 border-t-2 border-dashed">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Total a Pagar</span>
                                    <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    onClick={handleSendOrder}
                                    disabled={isPending}
                                    className="w-full h-16 rounded-3xl text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/20"
                                >
                                    {isPending ? 'PROCESANDO...' : 'CONFIRMAR Y PEDIR'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-4 h-8 uppercase text-[10px]">En Estancia</Badge>
                        </div>

                        {!orderHistory ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                                <div className="p-10 rounded-full bg-muted border-4 border-dashed"><Clock className="h-16 w-16" /></div>
                                <p className="text-xl font-black uppercase tracking-widest">Sin Consumos</p>
                                <p className="text-sm font-medium">Realice su primer pedido para ver su cuenta.</p>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">Monto Acumulado</p>
                                                    <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(orderHistory.total)}</h3>
                                                </div>
                                                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                                                    <LayoutGrid className="h-7 w-7" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detalle de Productos</span>
                                                </div>
                                                {orderHistory.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-4 rounded-2xl border bg-muted/10 group">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-black text-xs uppercase truncate pr-4">{item.name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">{item.quantity} Unidades x {formatCurrency(item.price)}</p>
                                                        </div>
                                                        <span className="font-black text-sm shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="p-6 rounded-[2.5rem] bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-200 text-center space-y-2">
                                        <p className="text-amber-800 dark:text-amber-400 font-black uppercase text-[10px] tracking-widest">¿Deseas pagar tu cuenta?</p>
                                        <p className="text-sm font-medium text-amber-700/70">Para solicitar el cobro, por favor comunícate con la recepción o un salonero.</p>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-xl border-t p-4 px-6 flex items-center justify-between safe-area-bottom z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'menu' && "bg-primary/10")}>
                        <LayoutGrid className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn("flex flex-col items-center gap-1.5 transition-all relative", activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'cart' && "bg-primary/10")}>
                        <ShoppingCart className="h-6 w-6" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in">
                                {cart.length}
                            </span>
                        )}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'account' && "bg-primary/10")}>
                        <History className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>
        </div>
    );
}
