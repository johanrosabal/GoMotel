'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, CheckCircle, Smartphone, 
    X, LayoutGrid, User, History, Utensils, 
    Package, MapPin, Beer, Sun, QrCode,
    MessageSquare,
    ImageIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ORDER_SESSION_KEY = 'motel_order_session_v1';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Session State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);
    const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Load session from localStorage
    useEffect(() => {
        const session = localStorage.getItem(ORDER_SESSION_KEY);
        if (session) {
            try {
                const { orderId, tableId } = JSON.parse(session);
                setActiveOrderId(orderId);
                setSelectedTableId(tableId);
            } catch (e) {
                localStorage.removeItem(ORDER_SESSION_KEY);
            }
        }
    }, []);

    // Listen to active order changes
    useEffect(() => {
        if (!firestore || !activeOrderId) return;
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // If order is delivered and paid, clear session
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(ORDER_SESSION_KEY);
                    setActiveOrderId(null);
                    setSelectedTableId(null);
                    setCart([]);
                    setActiveTab('menu');
                }
            } else {
                // Order deleted
                localStorage.removeItem(ORDER_SESSION_KEY);
                setActiveOrderId(null);
                setSelectedTableId(null);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // Data Fetching
    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: tables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, [firestore]);
    const { data: allServices } = useCollection<Service>(servicesQuery);

    const activeOrderDocRef = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return doc(collection(firestore, 'orders'), activeOrderId);
    }, [firestore, activeOrderId]);
    
    // We use a query for useCollection compatibility or a simple subscription for single doc
    const activeOrderQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId));
    }, [firestore, activeOrderId]);
    
    const { data: activeOrderData } = useCollection<Order>(activeOrderQuery);
    const activeOrder = activeOrderData?.[0] || null;

    const filteredServices = useMemo(() => {
        if (!allServices) return [];
        return allServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [allServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [cart]);

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
        setIsNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setIsNoteDialogOpen(false);
    };

    const handleSelectTable = (tableId: string) => {
        setSelectedTableId(tableId);
    };

    const handleConfirmOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                // Add to existing order
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                // Create new order
                result = await openTableAccount(selectedTableId, cart, 'Pedido Móvil', 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'Su pedido ha sido registrado y está en preparación.' });
                if (result.orderId) {
                    localStorage.setItem(ORDER_SESSION_KEY, JSON.stringify({ orderId: result.orderId, tableId: selectedTableId }));
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTableId) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500 overflow-hidden">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner ring-8 ring-primary/5">
                        <QrCode className="w-12 h-12 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">Bienvenido</h1>
                    <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest opacity-60">¿Dónde se encuentra?</p>
                </div>

                <ScrollArea className="w-full max-w-md h-[50vh] pr-4">
                    <div className="grid grid-cols-2 gap-4 pb-10">
                        {tables?.map(table => (
                            <button
                                key={table.id}
                                onClick={() => handleSelectTable(table.id)}
                                className="bg-card border-2 border-border/50 hover:border-primary p-8 rounded-3xl flex flex-col items-center gap-2 transition-all active:scale-95 shadow-sm group"
                            >
                                <span className="text-5xl font-black text-foreground group-hover:text-primary transition-colors">{table.number}</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all">
                                    {table.type === 'Table' ? 'Mesa' : table.type === 'Bar' ? 'Barra' : table.type}
                                </span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        );
    }

    const currentTable = tables?.find(t => t.id === selectedTableId);

    return (
        <div className="min-h-[100dvh] bg-muted/30 flex flex-col relative overflow-hidden">
            {/* Header */}
            <header className="bg-background border-b px-4 py-4 sticky top-0 z-30 shadow-sm flex items-center justify-between backdrop-blur-md bg-background/90">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-2xl">
                        <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-primary leading-none">Auto-Pedido</h2>
                        <p className="text-[10px] font-black text-muted-foreground uppercase mt-1.5 opacity-60">Ubicación: {currentTable?.number || '...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeOrderId && (
                        <Badge variant="outline" className="h-7 border-emerald-500/30 bg-emerald-50 text-emerald-700 font-black uppercase text-[9px] tracking-widest animate-pulse">
                            En Preparación
                        </Badge>
                    )}
                    <button onClick={() => { setSelectedTableId(null); setActiveTab('menu'); }} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden pb-32">
                {/* Menu Tab */}
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Search & Categories */}
                        <div className="bg-background p-4 space-y-4 shadow-sm border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se le antoja hoy?..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-12 bg-muted/50 border-0 rounded-2xl font-bold text-sm"
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2.5 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm border",
                                            !selectedCategoryId ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border"
                                        )}
                                    >
                                        Todo el Menú
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm border",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Grid */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-10">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="bg-card rounded-[2rem] border overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300 shadow-sm hover:shadow-xl transition-all"
                                    >
                                        <div className="aspect-square relative group">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-700" />
                                                <AvatarFallback className="rounded-none bg-muted/20">
                                                    <Utensils className="w-12 h-12 text-muted-foreground/10" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Top Tag: Category & Stock */}
                                            <div className="absolute top-3 left-3 right-3 flex justify-between gap-1.5 items-start">
                                                <Badge className="bg-white/95 text-primary border-0 text-[8px] font-black uppercase px-2.5 h-6 shadow-xl backdrop-blur-md">
                                                    {service.category === 'Beverage' ? 'Bebida' : service.category === 'Food' ? 'Comida' : 'Amenidad'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className={cn(
                                                        "text-[8px] font-black uppercase px-2.5 h-6 shadow-xl border-0 backdrop-blur-md",
                                                        service.stock <= 5 ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"
                                                    )}>
                                                        {service.stock} Disp.
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom Info: Name, Price, Add Button */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-12 flex flex-col gap-2.5">
                                                <h3 className="text-[12px] font-black text-white uppercase tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                                                    {service.name}
                                                </h3>
                                                <div className="flex items-center justify-between gap-2 mt-1">
                                                    <span className="text-sm font-black text-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                                        {formatCurrency(service.price)}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        disabled={service.source !== 'Internal' && service.stock <= 0}
                                                        className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-all disabled:opacity-50 disabled:grayscale"
                                                    >
                                                        <Plus className="w-5 h-5" />
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

                {/* Cart Tab */}
                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Carrito</h2>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Confirme sus productos antes de enviar</p>
                        </div>
                        
                        <ScrollArea className="flex-1 border-2 border-dashed border-muted rounded-[2.5rem] bg-background/50 p-6">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20 opacity-40">
                                    <div className="p-8 bg-muted rounded-[3rem]">
                                        <ShoppingCart className="w-16 h-16 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">Carrito Vacío</p>
                                    <Button onClick={() => setActiveTab('menu')} variant="outline" className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-11 border-2">Ver el Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="flex flex-col gap-3 pb-6 border-b border-muted last:border-0 last:pb-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-sm uppercase truncate tracking-tight">{item.service.name}</p>
                                                    <p className="text-primary font-black text-xs mt-0.5">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-primary/10 p-1.5 rounded-2xl shadow-sm ring-1 ring-primary/5">
                                                    <button onClick={() => handleRemoveFromCart(item.service.id)} className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-colors"><Minus className="w-4 h-4" /></button>
                                                    <span className="text-sm font-black text-primary w-5 text-center">{item.quantity}</span>
                                                    <button 
                                                        onClick={() => handleAddToCart(item.service)} 
                                                        disabled={item.service.source !== 'Internal' && item.quantity >= item.service.stock}
                                                        className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-30"
                                                    ><Plus className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            {item.service.source === 'Internal' && (
                                                <button 
                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                    className={cn(
                                                        "flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2.5 rounded-2xl w-full transition-all border shadow-sm",
                                                        item.notes 
                                                            ? "bg-primary text-white border-primary" 
                                                            : "bg-background text-amber-600 border-amber-100 hover:bg-amber-50"
                                                    )}
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {item.notes ? 'Instrucciones: ' + item.notes : '+ Añadir Instrucciones Especiales'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {cart.length > 0 && (
                            <div className="bg-background border-2 border-primary/20 rounded-[2.5rem] p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total a pagar</span>
                                    <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    className="w-full h-16 rounded-3xl font-black text-base uppercase tracking-[0.1em] shadow-xl shadow-primary/20 transition-all active:scale-95"
                                    onClick={handleConfirmOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? 'Enviando Pedido...' : 'Enviar a Preparación'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Account Tab */}
                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Consumo</h2>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Control de gastos de su estancia</p>
                        </div>

                        {!activeOrderId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-20 border-2 border-dashed border-muted rounded-[2.5rem] opacity-40">
                                <div className="p-8 bg-muted rounded-[3rem]">
                                    <History className="w-16 h-16 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">Sin Historial</p>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Saldo Acumulado</p>
                                                    <CardTitle className="text-5xl font-black tracking-tighter mt-1">{formatCurrency(activeOrder?.total || 0)}</CardTitle>
                                                </div>
                                                <div className="bg-white/20 p-4 rounded-[2rem] backdrop-blur-xl ring-1 ring-white/30">
                                                    <LayoutGrid className="w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-8 space-y-6">
                                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                                <span>Detalle de Productos</span>
                                                <span>Importe</span>
                                            </div>
                                            <Separator className="bg-muted/50" />
                                            <div className="space-y-5">
                                                {activeOrder?.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start group animate-in fade-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <p className="font-black text-xs uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">{item.name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">{item.quantity} x {formatCurrency(item.price)}</p>
                                                        </div>
                                                        <span className="font-black text-xs text-foreground tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                        <div className="bg-muted/30 p-6 border-t border-muted/50 flex flex-col gap-4">
                                            <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 w-fit px-4 py-2 rounded-full border border-emerald-100 mx-auto">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Pedido: {activeOrder?.status}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center leading-relaxed max-w-[200px] mx-auto opacity-60 italic">
                                                Liquidación total al realizar su check-out en recepción.
                                            </p>
                                        </div>
                                    </Card>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Navigation: Fixed & Safe-Area Aware */}
            <nav className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-3xl border-t px-8 py-5 flex items-center justify-between z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[3rem]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-2 transition-all duration-500",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground/40 hover:text-primary/60"
                    )}
                >
                    <div className={cn(
                        "p-3 rounded-2xl transition-all duration-500 shadow-sm",
                        activeTab === 'menu' ? "bg-primary text-white shadow-primary/30" : "bg-muted/50"
                    )}>
                        <LayoutGrid className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-2 relative transition-all duration-500",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground/40 hover:text-primary/60"
                    )}
                >
                    <div className={cn(
                        "p-3 rounded-2xl transition-all duration-500 shadow-sm",
                        activeTab === 'cart' ? "bg-primary text-white shadow-primary/30" : "bg-muted/50"
                    )}>
                        <ShoppingCart className="w-6 h-6" />
                    </div>
                    {cart.length > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-6 min-w-6 flex items-center justify-center p-0 text-[10px] font-black border-4 border-background bg-primary text-white shadow-lg">
                            {cart.length}
                        </Badge>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-2 transition-all duration-500",
                        activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground/40 hover:text-primary/60"
                    )}
                >
                    <div className={cn(
                        "p-3 rounded-2xl transition-all duration-500 shadow-sm",
                        activeTab === 'account' ? "bg-primary text-white shadow-primary/30" : "bg-muted/50"
                    )}>
                        <History className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Cuenta</span>
                </button>
            </nav>

            {/* Note Dialog */}
            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Indicaciones</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Personalice su preparación
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight truncate">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kitchen-note" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">¿Alguna instrucción especial?</Label>
                            <Textarea 
                                id="kitchen-note"
                                placeholder="Ej: Término medio, sin hielo, extra servilletas..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[140px] rounded-3xl border-2 border-muted bg-muted/20 resize-none text-sm font-bold focus:border-primary focus:ring-0 transition-all p-5"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-row gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setIsNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
