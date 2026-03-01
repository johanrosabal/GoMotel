'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, DocumentData } from 'firebase/firestore';
import type { RestaurantTable, Order, Service, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, X, ChevronRight, 
    ImageIcon, Utensils, Beer, Sun, MapPin, Receipt, 
    CheckCircle, MessageSquare, Trash2, ArrowLeft, Clock
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const SINGLE_TYPE_LABEL: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Session Management
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'history'>('menu');
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Persistence Logic
    useEffect(() => {
        if (!selectedTable || !firestore) return;

        const sessionKey = `active_order_${selectedTable.id}`;
        const storedOrderId = localStorage.getItem(sessionKey);

        if (storedOrderId) {
            setActiveOrderId(storedOrderId);
            const unsubscribe = onSnapshot(doc(firestore, 'orders', storedOrderId), (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as Order;
                    if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                        // Order completed, clear session
                        localStorage.removeItem(sessionKey);
                        setActiveOrderId(null);
                        setActiveOrder(null);
                    } else {
                        setActiveOrder({ id: snap.id, ...data });
                    }
                } else {
                    localStorage.removeItem(sessionKey);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                }
            });
            return () => unsubscribe();
        }
    }, [selectedTable, firestore]);

    // Firestore Data
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

    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => { getServices().then(setServices); }, []);

    // Filtered Data
    const zones = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    // Cart Actions
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: 'Añadido al pedido', description: service.name, duration: 1500 });
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

    const handleClearItem = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
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

    const handleSubmitOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, 'Auto-Pedido', 'Public');
                if (result.success && result.orderId) {
                    localStorage.setItem(`active_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Su orden está en preparación.' });
                setCart([]);
                setActiveTab('history');
            }
        });
    };

    const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const cartTotal = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

    // Welcome Screen
    if (!selectedTable) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 via-background to-secondary/5">
                <div className="w-full max-w-md space-y-10 text-center">
                    <div className="space-y-4 animate-in fade-in zoom-in duration-700">
                        <h1 className="text-6xl sm:text-7xl font-black uppercase tracking-tighter text-primary drop-shadow-2xl">
                            BIENVENIDO
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-sm">
                            Seleccione su mesa para ordenar
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Select value={zoneFilter} onValueChange={setZoneFilter}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background/80 backdrop-blur-sm">
                                <SelectValue placeholder="Filtrar por Zona" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las zonas</SelectItem>
                                {zones.map(z => <SelectItem key={z} value={z}>{TYPE_LABELS[z] || z}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <ScrollArea className="h-[400px] border-2 rounded-3xl bg-background/50 backdrop-blur-md p-4 shadow-2xl">
                            <div className="grid grid-cols-3 gap-3">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className={cn(
                                            "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-90",
                                            table.status === 'Occupied' 
                                                ? "bg-primary/10 border-primary/40 text-primary shadow-lg ring-4 ring-primary/5" 
                                                : "bg-background border-border hover:border-primary/30"
                                        )}
                                    >
                                        <span className="text-3xl font-black tracking-tighter">{table.number}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">
                                            {SINGLE_TYPE_LABEL[table.type] || table.type}
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
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* Header */}
            <div className="bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTable(null)} className="p-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight leading-none">
                            {SINGLE_TYPE_LABEL[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sesión Activa</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant={activeOrderId ? "default" : "outline"} className={cn("h-8 font-black uppercase tracking-widest", activeOrderId && "bg-primary")}>
                        {activeOrderId ? 'Cuenta Activa' : 'Nueva Orden'}
                    </Badge>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' && (
                    <div className="h-full flex flex-col animate-in fade-in duration-300">
                        <div className="p-4 space-y-4 bg-muted/5 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué desea pedir hoy?" 
                                    className="pl-9 h-12 bg-background rounded-2xl border-2 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm border",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
                                        )}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todo
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm border",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <Card key={service.id} className="overflow-hidden border-2 rounded-3xl shadow-lg group active:scale-95 transition-transform">
                                        <div className="aspect-square relative bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <div className="flex justify-between items-start">
                                                    <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 font-bold text-[8px] uppercase tracking-widest">
                                                        {service.category === 'Food' ? 'Cocina' : 'Bar'}
                                                    </Badge>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40 active:bg-primary/80 transition-all border-2 border-white/20"
                                                    >
                                                        <Plus className="h-6 w-6" />
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="font-black text-xs uppercase leading-tight text-white line-clamp-2">
                                                        {service.name}
                                                    </h3>
                                                    <p className="text-lg font-black text-primary drop-shadow-sm">
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
                    <div className="h-full flex flex-col p-4 animate-in slide-in-from-right-4 duration-300 pb-24">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Su Pedido</h3>
                            <Badge variant="outline" className="h-7 font-black bg-muted/30">{cartCount} Artículos</Badge>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="p-6 rounded-full bg-muted/50">
                                    <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                                </div>
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">El carrito está vacío</p>
                                <Button variant="outline" className="rounded-full font-black uppercase text-[10px] tracking-widest" onClick={() => setActiveTab('menu')}>
                                    Explorar Menú
                                </Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 -mx-4 px-4">
                                    <div className="space-y-4 pb-10">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="flex flex-col gap-3 p-4 rounded-3xl border-2 bg-card shadow-sm group">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm truncate uppercase tracking-tight">{item.service.name}</p>
                                                        <p className="text-xs text-muted-foreground font-bold">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-muted/50 rounded-2xl p-1 border shadow-inner">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-xs font-black w-6 text-center tabular-nums">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-2xl" onClick={() => handleClearItem(item.service.id)}>
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                                                    {item.notes ? (
                                                        <button 
                                                            onClick={() => handleOpenNoteDialog(idx)}
                                                            className="flex-1 text-left p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-[10px] text-amber-700 dark:text-amber-400 italic font-bold border border-amber-200 dark:border-amber-900/50"
                                                        >
                                                            "{item.notes}"
                                                        </button>
                                                    ) : (
                                                        <Button variant="outline" size="sm" className="w-full h-9 rounded-xl font-bold text-[10px] uppercase border-dashed" onClick={() => handleOpenNoteDialog(idx)}>
                                                            <MessageSquare className="h-3 w-3 mr-2" /> + Instrucciones de Cocina
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="mt-4 p-6 rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">Total a Pagar</span>
                                        <span className="text-3xl font-black tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-white/90 font-black uppercase text-sm tracking-widest shadow-lg shadow-black/10"
                                        onClick={handleSubmitOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "PROCESANDO..." : "CONFIRMAR PEDIDO"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="h-full flex flex-col p-4 animate-in slide-in-from-left-4 duration-300 pb-24">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Su Cuenta</h3>
                            {activeOrder && (
                                <Badge variant="outline" className="h-7 font-black bg-primary/10 text-primary border-primary/20">
                                    {activeOrder.paymentStatus === 'Pendiente' ? 'Pendiente' : 'Pagado'}
                                </Badge>
                            )}
                        </div>

                        {!activeOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="p-6 rounded-full bg-muted/50">
                                    <Receipt className="h-12 w-12 text-muted-foreground/30" />
                                </div>
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No tiene una cuenta activa</p>
                                <Button variant="outline" className="rounded-full font-black uppercase text-[10px] tracking-widest" onClick={() => setActiveTab('menu')}>
                                    Hacer un Pedido
                                </Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1 -mx-4 px-4">
                                <div className="space-y-6 pb-10">
                                    <div className="p-6 rounded-3xl bg-muted/30 border-2 border-dashed space-y-4">
                                        <div className="space-y-3">
                                            {activeOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs uppercase truncate">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                                    </div>
                                                    <span className="font-black text-xs whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Separator className="bg-border/50" />
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-sm font-black uppercase tracking-widest text-primary">Saldo Total</span>
                                            <span className="text-3xl font-black tracking-tighter">{formatCurrency(activeOrder.total)}</span>
                                        </div>
                                    </div>

                                    <div className="p-5 rounded-3xl border-2 border-primary/20 bg-primary/5 flex items-center gap-4">
                                        <div className="bg-primary/10 p-3 rounded-2xl">
                                            <Clock className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Indicación de Pago</p>
                                            <p className="text-xs font-bold leading-tight mt-1 text-muted-foreground">
                                                Para cerrar su cuenta y realizar el pago, por favor solicite asistencia en recepción o a un salonero.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="bg-background border-t px-6 py-3 pb-8 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'menu' && "bg-primary/10")}>
                        <Utensils className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300 relative",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'cart' && "bg-primary/10")}>
                        <ShoppingCart className="h-6 w-6" />
                        {cartCount > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full bg-primary text-[10px] font-black border-2 border-background">
                                {cartCount}
                            </Badge>
                        )}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300",
                        activeTab === 'history' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'history' && "bg-primary/10")}>
                        <Receipt className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Personalice su pedido para cocina
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-3xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-2.5 rounded-2xl">
                                <Utensils className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kitchen-note" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Su mensaje para cocina</Label>
                            <Textarea 
                                id="kitchen-note"
                                placeholder="Ej: Sin cebolla, término medio, etc."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[140px] rounded-[24px] border-2 resize-none text-sm font-bold p-4 focus:border-primary transition-all"
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