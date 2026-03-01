'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    doc, 
    onSnapshot, 
    addDoc, 
    Timestamp, 
    increment, 
    runTransaction,
    getDocs,
    limit
} from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { 
    ShoppingCart, 
    Plus, 
    Minus, 
    PackageCheck, 
    Clock, 
    CheckCircle, 
    Utensils, 
    Search,
    ChevronRight,
    MapPin,
    Smartphone,
    User,
    ListFilter,
    ChevronLeft,
    ImageIcon,
    Star,
    LayoutGrid,
    History,
    X
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';

type CartItem = {
  service: Service;
  quantity: number;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // Privacy & Session Management
    const [deviceToken, setDeviceToken] = useState<string | null>(null);
    useEffect(() => {
        let token = localStorage.getItem('motel_order_token');
        if (!token) {
            token = `dev_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('motel_order_token', token);
        }
        setDeviceToken(token);
    }, []);

    // State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'history'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);

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
    const { data: allServices } = useCollection<Service>(servicesQuery);

    // Filter tables based on zone dropdown
    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        if (zoneFilter === 'all') return allTables;
        return allTables.filter(t => t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const zones = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredServices = useMemo(() => {
        if (!allServices) return [];
        return allServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [allServices, searchTerm, selectedCategoryId]);

    // History Fetching (Device Specific)
    const [myOrders, setMyOrders] = useState<Order[]>([]);
    useEffect(() => {
        if (!firestore || !deviceToken || !selectedTableId) return;
        const q = query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            where('deviceToken', '==', deviceToken),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setMyOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        });
    }, [firestore, deviceToken, selectedTableId]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Añadido", description: `${service.name} al carrito.` });
    };

    const handleRemoveOne = (serviceId: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === serviceId);
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const totalInCart = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

    const handleConfirmOrder = () => {
        if (!selectedTableId || cart.length === 0 || !deviceToken) return;

        startTransition(async () => {
            try {
                await runTransaction(firestore!, async (transaction) => {
                    const tableRef = doc(firestore!, 'restaurantTables', selectedTableId);
                    const tableSnap = await transaction.get(tableRef);
                    if (!tableSnap.exists()) throw new Error("Ubicación no encontrada.");

                    // Create Order
                    const orderRef = doc(collection(firestore!, 'orders'));
                    const total = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
                    
                    transaction.set(orderRef, {
                        locationId: selectedTableId,
                        locationType: tableSnap.data().type,
                        label: `Auto-Pedido (${tableSnap.data().number})`,
                        deviceToken: deviceToken,
                        items: cart.map(i => ({
                            serviceId: i.service.id,
                            name: i.service.name,
                            quantity: i.quantity,
                            price: i.service.price,
                        })),
                        total,
                        createdAt: Timestamp.now(),
                        status: 'Pendiente',
                        paymentStatus: 'Pendiente',
                        source: 'Public'
                    });

                    transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
                });

                setCart([]);
                setActiveTab('history');
                toast({ title: "¡Pedido Enviado!", description: "Su pedido está en camino." });
            } catch (e: any) {
                toast({ title: "Error", description: e.message, variant: "destructive" });
            }
        });
    };

    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
                <Card className="w-full max-w-md border-0 shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <div className="bg-primary p-10 text-primary-foreground text-center relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                        <div className="relative z-10 space-y-2">
                            <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-80" />
                            <h1 className="text-3xl font-black uppercase tracking-tighter">Bienvenido</h1>
                            <p className="text-primary-foreground/70 font-medium uppercase text-[10px] tracking-widest">Digital Order System</p>
                        </div>
                    </div>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Filtrar Zona</Label>
                                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                    <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                        <SelectValue placeholder="Todas las zonas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las zonas</SelectItem>
                                        {zones.map(z => (
                                            <SelectItem key={z} value={z}>{z}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Seleccione su Mesa</Label>
                                <ScrollArea className="h-[300px] border-2 rounded-2xl p-4 bg-muted/20">
                                    <div className="grid grid-cols-3 gap-3">
                                        {filteredTables.map(table => (
                                            <button
                                                key={table.id}
                                                onClick={() => setSelectedTableId(table.id)}
                                                className="h-20 rounded-xl bg-background border-2 border-transparent hover:border-primary hover:text-primary transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95"
                                            >
                                                <span className="text-2xl font-black">{table.number}</span>
                                                <span className="text-[8px] font-bold uppercase opacity-50">{table.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currentTable = allTables?.find(t => t.id === selectedTableId);

    return (
        <div className="flex flex-col h-screen bg-muted/20 font-sans max-w-full overflow-hidden">
            {/* Header */}
            <header className="bg-background/80 backdrop-blur-xl border-b p-4 pb-2 sticky top-0 z-30 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <span className="text-2xl font-black">{currentTable?.number}</span>
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-tight">Mesa Seleccionada</h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentTable?.type}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedTableId(null)} className="rounded-xl h-10 w-10">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {activeTab === 'menu' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar productos..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 h-11 bg-muted/50 border-0 rounded-xl font-bold"
                            />
                        </div>
                        <ScrollArea className="w-full">
                            <div className="flex gap-2 pb-2">
                                <button 
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={cn(
                                        "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        !selectedCategoryId ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0",
                                            selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>
                )}
            </header>

            {/* Content */}
            <main className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    {activeTab === 'menu' && (
                        <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-card border rounded-[2rem] overflow-hidden shadow-sm flex flex-col group active:scale-95 transition-transform duration-200">
                                    <div className="aspect-square relative overflow-hidden bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="rounded-none">
                                                <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                            <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-[8px] font-black uppercase tracking-widest text-white h-5 px-2">
                                                {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                            </Badge>
                                            {service.source !== 'Internal' && (
                                                <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black uppercase h-5 px-2">
                                                    STOCK: {service.stock}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
                                            <h3 className="font-black text-xs uppercase tracking-tight text-white line-clamp-1 mb-1">{service.name}</h3>
                                            <p className="text-primary font-black text-sm">{formatCurrency(service.price)}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        className="rounded-none h-12 font-black uppercase text-[10px] tracking-[0.2em] gap-2"
                                        onClick={() => handleAddToCart(service)}
                                        disabled={service.source !== 'Internal' && service.stock <= 0}
                                    >
                                        <Plus className="h-3 w-3" /> Añadir
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'cart' && (
                        <div className="p-6 space-y-6 pb-24 animate-in fade-in duration-300">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">Mi Carrito</h2>
                            {cart.length === 0 ? (
                                <div className="text-center py-20 opacity-30 space-y-4">
                                    <ShoppingCart className="h-20 w-20 mx-auto" />
                                    <p className="font-black uppercase tracking-widest text-xs">Su carrito está vacío</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="flex items-center justify-between p-4 bg-background border rounded-2xl shadow-sm">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                                <p className="text-primary font-bold text-sm mt-0.5">{formatCurrency(item.service.price * item.quantity)}</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-1 border">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveOne(item.service.id)}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <Card className="border-0 shadow-lg bg-primary text-primary-foreground rounded-[2rem] overflow-hidden mt-10">
                                        <CardContent className="p-8 space-y-6">
                                            <div className="flex justify-between items-end border-b border-white/20 pb-6">
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Total a Pagar</span>
                                                <span className="text-4xl font-black tracking-tighter">{formatCurrency(totalInCart)}</span>
                                            </div>
                                            <Button 
                                                className="w-full h-16 bg-white text-primary hover:bg-white/90 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl"
                                                onClick={handleConfirmOrder}
                                                disabled={isPending}
                                            >
                                                {isPending ? "Procesando..." : "Confirmar Pedido"}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="p-6 space-y-6 pb-24 animate-in fade-in duration-300">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">Mi Cuenta</h2>
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Consumido</p>
                                                    <p className="text-4xl font-black tracking-tighter mt-1">
                                                        {formatCurrency(myOrders.reduce((sum, o) => sum + o.total, 0))}
                                                    </p>
                                                </div>
                                                <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                                    <History className="h-7 w-7" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-6 space-y-6">
                                            {myOrders.length === 0 ? (
                                                <p className="text-center text-muted-foreground py-10 font-bold uppercase text-[10px] tracking-widest opacity-50">Sin pedidos registrados</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {myOrders.map(order => (
                                                        <div key={order.id} className="p-4 border rounded-2xl bg-muted/30 space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase h-5">
                                                                    {order.status}
                                                                </Badge>
                                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                                    {order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {order.items.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-xs font-bold uppercase">
                                                                        <span className="opacity-70">{item.quantity}x {item.name}</span>
                                                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <Separator className="bg-primary/10" />
                                                            <div className="flex justify-between font-black text-sm">
                                                                <span>TOTAL ORDEN</span>
                                                                <span className="text-primary">{formatCurrency(order.total)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900 border-dashed text-center space-y-2">
                                                <p className="text-xs font-black text-amber-800 dark:text-amber-200 uppercase tracking-widest">Aviso Importante</p>
                                                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                                    Para solicitar el cobro, por favor comuníquate con la recepción o un salonero.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </ScrollArea>
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 inset-x-0 h-20 bg-background/80 backdrop-blur-2xl border-t flex items-center justify-around px-6 z-40">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <Utensils className="h-6 w-6" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>
                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1 relative transition-all",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <ShoppingCart className="h-6 w-6" />
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-background animate-pulse">
                            {cart.length}
                        </span>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all",
                        activeTab === 'history' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <History className="h-6 w-6" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </nav>
        </div>
    );
}
