'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { 
    Search, ShoppingCart, Plus, Minus, CheckCircle, 
    Utensils, Beer, Sun, MapPin, PackageCheck, 
    Smartphone, History, Clock, ArrowRight, X,
    ChevronRight, ImageIcon, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CartItem = {
  service: Service;
  quantity: number;
};

const ZONE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [view, setView] = useState<'menu' | 'cart' | 'account'>('menu');
    
    // Selection state
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    
    // Order state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Initial Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

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

    // Persistence & Real-time Sync
    useEffect(() => {
        const savedOrderId = localStorage.getItem('guest_order_id');
        const savedTableId = localStorage.getItem('guest_table_id');
        if (savedOrderId) setActiveOrderId(savedOrderId);
        if (savedTableId) setSelectedTableId(savedTableId);
    }, []);

    useEffect(() => {
        if (!activeOrderId || !firestore) return;
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                setActiveOrder({ id: snap.id, ...snap.data() } as Order);
            } else {
                localStorage.removeItem('guest_order_id');
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        });
        return () => unsub();
    }, [activeOrderId, firestore]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return zoneFilter === 'all' ? allTables : allTables.filter(t => t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const zones = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
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

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: i.service.source === 'Internal' ? i.quantity + 1 : Math.min(i.quantity + 1, service.stock) } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: 'Añadido', description: `${service.name} al carrito.` });
    };

    const handleUpdateCart = (serviceId: string, delta: number) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.service.id !== serviceId);
            return prev.map(i => i.service.id === serviceId ? { ...i, quantity: newQty } : i);
        });
    };

    const handlePlaceOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, 'Auto-Pedido', 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem('guest_order_id', result.orderId);
                }
                setCart([]);
                setView('account');
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su solicitud.' });
            }
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);

    // Initial Table Selection Screen
    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-3">
                        <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Smartphone className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="text-left space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {zones.map(z => <SelectItem key={z} value={z}>{ZONE_LABELS[z] || z}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[400px] border-2 rounded-3xl bg-muted/20 p-2">
                            <div className="grid grid-cols-2 gap-3 p-2">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => {
                                            setSelectedTableId(table.id);
                                            localStorage.setItem('guest_table_id', table.id);
                                        }}
                                        className="h-24 rounded-2xl bg-background border-2 border-transparent hover:border-primary transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95"
                                    >
                                        <span className="text-3xl font-black text-primary">{table.number}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
                                            {ZONE_LABELS[table.type] || table.type}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    const selectedTable = allTables?.find(t => t.id === selectedTableId);

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col pb-24 lg:pb-0 lg:pl-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Utensils className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Mesa Seleccionada</p>
                        <p className="text-xl font-black text-primary leading-tight">{selectedTable?.number}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setSelectedTableId(null); localStorage.removeItem('guest_table_id'); }} className="rounded-xl h-10 w-10">
                    <X className="h-5 w-5" />
                </Button>
            </header>

            {/* View Content */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {view === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-4 space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar producto..." 
                                    className="pl-10 h-12 rounded-2xl border-none bg-background shadow-sm text-base font-bold"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap pb-2">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-6 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                            !selectedCategoryId ? "bg-primary text-primary-foreground shadow-lg" : "bg-background text-muted-foreground border"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-6 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-background text-muted-foreground border"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 px-4">
                            <div className="grid grid-cols-2 gap-4 pb-10">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-card rounded-3xl overflow-hidden shadow-sm border border-border/50 group active:scale-95 transition-all">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Badges */}
                                            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                                <Badge className="bg-white/90 text-black border-none text-[8px] font-black uppercase">
                                                    {service.category === 'Beverage' ? 'Bebida' : service.category === 'Food' ? 'Comida' : 'Servicio'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="secondary" className="bg-black/50 text-white text-[8px] font-bold border-none backdrop-blur-md">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Info Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <div />
                                                <div className="space-y-1">
                                                    <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-tight leading-none drop-shadow-md">
                                                        {service.name}
                                                    </h3>
                                                    <p className="text-primary font-black text-lg sm:text-xl tracking-tighter drop-shadow-lg">
                                                        {formatCurrency(service.price)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* ADD BUTTON */}
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                disabled={service.source !== 'Internal' && service.stock <= 0}
                                                className="absolute bottom-3 right-3 h-10 w-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 disabled:opacity-50 disabled:grayscale transition-transform z-20"
                                            >
                                                <Plus className="h-6 w-6 stroke-[3px]" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {view === 'cart' && (
                    <div className="flex-1 flex flex-col p-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <ShoppingCart className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Tu Carrito</h2>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                                <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center">
                                    <ShoppingCart className="h-10 w-10 opacity-20" />
                                </div>
                                <p className="font-bold uppercase text-xs tracking-widest">El carrito está vacío</p>
                                <Button onClick={() => setView('menu')} variant="outline" className="rounded-xl font-bold">Volver al Menú</Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 pr-2">
                                    <div className="space-y-3">
                                        {cart.map(item => (
                                            <div key={item.service.id} className="bg-background rounded-3xl p-4 flex items-center justify-between border-2 border-border/50 shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-14 w-14 rounded-2xl border-2">
                                                        <AvatarImage src={item.service.imageUrl} className="object-cover" />
                                                        <AvatarFallback><ImageIcon /></AvatarFallback>
                                                    </Avatar>
                                                    <div className="space-y-0.5">
                                                        <p className="font-black text-xs uppercase tracking-tight truncate max-w-[120px]">{item.service.name}</p>
                                                        <p className="text-primary font-black text-sm">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted/50 rounded-2xl p-1 border">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleUpdateCart(item.service.id, -1)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-8 text-center font-black text-sm text-primary">{item.quantity}</span>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 rounded-xl" 
                                                        onClick={() => handleUpdateCart(item.service.id, 1)}
                                                        disabled={item.service.source !== 'Internal' && item.quantity >= item.service.stock}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                
                                <div className="mt-6 space-y-4 pt-6 border-t">
                                    <div className="flex justify-between items-end px-2">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total del Pedido</span>
                                        <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-[2rem] text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                        onClick={handlePlaceOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? 'Enviando...' : 'Confirmar Pedido'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {view === 'account' && (
                    <div className="flex-1 flex flex-col p-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <History className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Mi Cuenta</h2>
                        </div>

                        {!activeOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                                <History className="h-12 w-12 opacity-10" />
                                <p className="font-bold uppercase text-xs tracking-widest">No hay consumos registrados</p>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Acumulado</p>
                                                    <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(activeOrder.total)}</h3>
                                                </div>
                                                <Badge className="bg-white text-primary font-black uppercase text-[10px] px-4 py-1.5 rounded-full">
                                                    {activeOrder.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Detalle de Consumo</h4>
                                                <div className="space-y-2">
                                                    {activeOrder.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center p-3 rounded-2xl bg-muted/30 border border-border/50">
                                                            <div>
                                                                <p className="font-black text-[11px] uppercase tracking-tight">{item.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-bold">{item.quantity} un x {formatCurrency(item.price)}</p>
                                                            </div>
                                                            <p className="font-black text-sm text-primary">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-amber-500/5 p-6 border-t border-amber-500/10">
                                            <div className="flex gap-4">
                                                <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                                </div>
                                                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 leading-snug">
                                                    Para solicitar el cobro, por favor comunícate con la recepción o un salonero.
                                                </p>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t p-2 px-4 flex justify-around items-center h-20 z-50">
                <button 
                    onClick={() => setView('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20",
                        view === 'menu' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" : "text-muted-foreground"
                    )}
                >
                    <Utensils className="h-5 w-5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>
                <button 
                    onClick={() => setView('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20 relative",
                        view === 'cart' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" : "text-muted-foreground"
                    )}
                >
                    <ShoppingCart className="h-5 w-5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                    {cart.length > 0 && (
                        <span className="absolute top-1 right-4 bg-destructive text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-background">
                            {cart.length}
                        </span>
                    )}
                </button>
                <button 
                    onClick={() => setView('account')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20",
                        view === 'account' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" : "text-muted-foreground"
                    )}
                >
                    <History className="h-5 w-5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </nav>
        </div>
    );
}