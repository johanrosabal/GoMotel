
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
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
    Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    ImageIcon, ChevronRight, Receipt, LayoutGrid, Trash2, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

type CartItem = {
  service: Service;
  quantity: number;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // Session State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [zoneFilter, setZoneFilter] = useState<string>('all');

    // Data Fetching
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

    // --- Persistencia de Sesión ---
    useEffect(() => {
        if (selectedTable) {
            const sessionKey = `gomotel_session_${selectedTable.id}`;
            const savedOrderId = localStorage.getItem(sessionKey);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            }
        }
    }, [selectedTable]);

    // --- Sincronización de Orden en Tiempo Real ---
    useEffect(() => {
        if (!activeOrderId || !firestore) {
            setCurrentOrder(null);
            return;
        }

        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const orderData = { id: snap.id, ...snap.data() } as Order;
                
                // Si la orden ya fue pagada o cancelada, limpiar sesión local
                if (orderData.paymentStatus === 'Pagado' || orderData.status === 'Cancelado') {
                    const sessionKey = `gomotel_session_${selectedTable?.id}`;
                    localStorage.removeItem(sessionKey);
                    setActiveOrderId(null);
                    setCurrentOrder(null);
                } else {
                    setCurrentOrder(orderData);
                }
            } else {
                // Si el documento fue eliminado
                const sessionKey = `gomotel_session_${selectedTable?.id}`;
                localStorage.removeItem(sessionKey);
                setActiveOrderId(null);
                setCurrentOrder(null);
            }
        });

        return () => unsub();
    }, [activeOrderId, firestore, selectedTable]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        if (zoneFilter === 'all') return allTables;
        return allTables.filter(t => t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);
    }, [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: i.quantity + 1 } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado", description: `${service.name} al carrito.` });
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

    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cuenta ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    const sessionKey = `gomotel_session_${selectedTable.id}`;
                    localStorage.setItem(sessionKey, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                toast({ title: '¡Pedido enviado!', description: 'Tu orden está siendo preparada.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-md space-y-10 text-center">
                    <div className="space-y-4">
                        <div className="relative inline-block">
                            <h1 className="text-6xl sm:text-7xl font-black uppercase tracking-tighter text-foreground drop-shadow-[0_10px_10px_rgba(0,0,0,0.1)]">
                                Bienvenido
                            </h1>
                            <div className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 -skew-x-12 -z-10" />
                        </div>
                        <p className="text-muted-foreground font-medium text-lg">
                            Seleccione su ubicación para comenzar a ordenar.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            <button 
                                onClick={() => setZoneFilter('all')}
                                className={cn(
                                    "px-6 h-11 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border-2",
                                    zoneFilter === 'all' ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105" : "bg-muted/50 border-transparent text-muted-foreground"
                                )}
                            >
                                Todas
                            </button>
                            {Array.from(new Set(allTables?.map(t => t.type) || [])).map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setZoneFilter(type)}
                                    className={cn(
                                        "px-6 h-11 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border-2",
                                        zoneFilter === type ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105" : "bg-muted/50 border-transparent text-muted-foreground"
                                    )}
                                >
                                    {TYPE_LABELS[type] || type}
                                </button>
                            ))}
                        </div>

                        <ScrollArea className="h-[400px] w-full rounded-[2.5rem] border-2 border-dashed border-muted p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className="h-24 rounded-[1.5rem] border-2 border-border bg-card hover:border-primary hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"
                                    >
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">
                                            {TYPE_LABELS[table.type] || table.type}
                                        </span>
                                        <span className="text-3xl font-black tracking-tighter">
                                            {table.number}
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

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-screen-xl mx-auto border-x shadow-2xl relative overflow-hidden">
            {/* Header Fijo */}
            <div className="bg-background/80 backdrop-blur-xl border-b sticky top-0 z-50 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { setSelectedTable(null); setActiveTab('menu'); }}
                        className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center hover:bg-destructive hover:text-white transition-all active:scale-90"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="font-black text-xl uppercase tracking-tighter leading-none">
                            {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sesión Activa</span>
                        </div>
                    </div>
                </div>
                {cart.length > 0 && activeTab !== 'cart' && (
                    <Button 
                        onClick={() => setActiveTab('cart')}
                        className="rounded-2xl h-12 px-6 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 animate-in zoom-in duration-300"
                    >
                        Carrito ({cart.length})
                    </Button>
                )}
            </div>

            {/* Contenido Principal */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-6 space-y-6 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué te apetece hoy?..." 
                                    className="h-14 pl-12 rounded-[1.2rem] bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary text-base font-medium shadow-inner"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "h-10 px-6 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-10 px-6 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 px-6">
                            <div className="grid grid-cols-2 gap-4 pb-32">
                                {filteredServices.map(service => (
                                    <Card key={service.id} className="overflow-hidden border-0 bg-muted/30 rounded-[2rem] group hover:shadow-xl transition-all active:scale-95 duration-300">
                                        <div className="aspect-[4/5] relative">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-muted">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <div className="flex justify-between items-start">
                                                    <Badge className="bg-white/20 backdrop-blur-md border-white/10 text-[8px] font-black uppercase tracking-widest">
                                                        {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                                    </Badge>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="font-black text-sm uppercase leading-tight text-white line-clamp-2 drop-shadow-md">
                                                        {service.name}
                                                    </h3>
                                                    <p className="text-lg font-black text-primary tracking-tighter drop-shadow-md">
                                                        {formatCurrency(service.price)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-4xl font-black uppercase tracking-tighter">Tu Carrito</h2>
                            <Badge variant="outline" className="h-8 px-4 font-black uppercase tracking-widest">{cart.length} Artículos</Badge>
                        </div>

                        <ScrollArea className="flex-1">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground/30">
                                    <ShoppingCart className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase tracking-widest">Carrito vacío</p>
                                </div>
                            ) : (
                                <div className="space-y-4 pb-10">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="flex gap-4 p-4 rounded-[1.5rem] bg-muted/30 border border-border/50 group">
                                            <Avatar className="h-20 w-20 rounded-2xl shadow-md">
                                                <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback><ImageIcon /></AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 flex flex-col justify-between py-1">
                                                <div>
                                                    <h4 className="font-black uppercase text-sm tracking-tight line-clamp-1">{item.service.name}</h4>
                                                    <p className="text-primary font-black">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1 bg-background rounded-xl p-1 shadow-inner border">
                                                        <button 
                                                            onClick={() => handleRemoveOne(item.service.id)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className="w-8 text-center font-black text-xs">{item.quantity}</span>
                                                        <button 
                                                            onClick={() => handleAddToCart(item.service)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <button 
                                                        onClick={() => setCart(c => c.filter(i => i.service.id !== item.service.id))}
                                                        className="text-destructive font-black text-[10px] uppercase tracking-widest p-2 hover:bg-destructive/10 rounded-xl transition-colors"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {cart.length > 0 && (
                            <div className="pt-6 border-t space-y-4 animate-in fade-in duration-700">
                                <div className="flex justify-between items-center px-2">
                                    <span className="font-black uppercase tracking-widest text-muted-foreground text-xs">Total del Pedido</span>
                                    <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    className="w-full h-16 rounded-[1.5rem] text-lg font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                                    onClick={handleConfirmOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? "Procesando..." : "Confirmar Pedido"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-4xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                            {currentOrder && <Badge className="bg-primary text-primary-foreground font-black px-4 h-8 uppercase tracking-widest">Activa</Badge>}
                        </div>

                        <ScrollArea className="flex-1">
                            {!currentOrder ? (
                                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground/30 text-center px-10">
                                    <Receipt className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase tracking-widest leading-tight">No hay consumos registrados</p>
                                    <p className="text-[10px] mt-2 font-bold opacity-60 uppercase">Elige tus productos en la pestaña de menú</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Resumen de Cuenta</p>
                                                    <h3 className="text-4xl font-black tracking-tighter mt-1">{formatCurrency(currentOrder.total)}</h3>
                                                </div>
                                                <Badge variant="outline" className="border-white/20 text-white font-black uppercase text-[10px] px-4 py-1.5 rounded-full">
                                                    {currentOrder.status === 'Pendiente' ? 'Enviado' : currentOrder.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-0">
                                            <div className="p-6 space-y-4">
                                                {currentOrder.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black">
                                                                {item.quantity}x
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-[11px] uppercase leading-none">{item.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-bold mt-1 tracking-wider">
                                                                    {formatCurrency(item.price)} c/u
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-xs">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="bg-muted/30 p-6 space-y-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Solicitud de Cobro</h4>
                                                        <p className="text-xs font-bold text-muted-foreground mt-1 leading-relaxed">
                                                            Para solicitar el cierre de cuenta y el cobro, por favor comunícate con la recepción o utiliza el sistema de comunicación de la habitación.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="text-center px-10">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                                            ID Sesión: {currentOrder.id.slice(-8).toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </main>

            {/* Navegación Inferior Estilo App */}
            <nav className="bg-background/95 backdrop-blur-xl border-t p-2 px-6 flex justify-around items-center h-24 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-4 py-2 rounded-2xl",
                        activeTab === 'menu' ? "text-primary bg-primary/5 scale-110" : "text-muted-foreground grayscale opacity-50"
                    )}
                >
                    <LayoutGrid className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Menú</span>
                    {activeTab === 'menu' && <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />}
                </button>
                
                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-4 py-2 rounded-2xl",
                        activeTab === 'cart' ? "text-primary bg-primary/5 scale-110" : "text-muted-foreground grayscale opacity-50"
                    )}
                >
                    <div className="relative">
                        <ShoppingCart className="h-6 w-6" />
                        {cart.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center ring-2 ring-background">
                                {cart.length}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Carrito</span>
                    {activeTab === 'cart' && <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />}
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-4 py-2 rounded-2xl",
                        activeTab === 'account' ? "text-primary bg-primary/5 scale-110" : "text-muted-foreground grayscale opacity-50"
                    )}
                >
                    <Receipt className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
                    {activeTab === 'account' && <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />}
                </button>
            </nav>
        </div>
    );
}
