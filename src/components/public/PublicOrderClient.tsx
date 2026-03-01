'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
    Search, ShoppingCart, Plus, Minus, ImageIcon, ChevronRight, 
    User, History, Clock, Utensils, X, LogOut, MessageSquare, CheckCircle,
    Filter, MapPin
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const DEVICE_ORDER_ID_KEY = 'go_motel_active_order_id';
const DEVICE_TABLE_ID_KEY = 'go_motel_active_table_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session Management
    const [activeTableId, setActiveTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Navigation and UI
    const [tab, setTab] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Kitchen Notes
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const storedTableId = localStorage.getItem(DEVICE_TABLE_ID_KEY);
        const storedOrderId = localStorage.getItem(DEVICE_ORDER_ID_KEY);
        if (storedTableId) setActiveTableId(storedTableId);
        if (storedOrderId) setActiveOrderId(storedOrderId);
        setIsInitialized(true);

        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
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

    // Active order listener for privacy and real-time updates
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setActiveOrder(null);
            return;
        }
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    // Order is finalized, clear session
                    handleExit();
                } else {
                    setActiveOrder({ id: snap.id, ...data });
                }
            } else {
                handleExit();
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // Filtered Content
    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const availableTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => 
            (typeFilter === 'all' || t.type === typeFilter) && 
            (t.status === 'Available' || t.id === activeTableId)
        ).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, typeFilter, activeTableId]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    // Cart Logic
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

    const handleSelectTable = (tableId: string) => {
        localStorage.setItem(DEVICE_TABLE_ID_KEY, tableId);
        setActiveTableId(tableId);
    };

    const handleExit = () => {
        localStorage.removeItem(DEVICE_TABLE_ID_KEY);
        localStorage.removeItem(DEVICE_ORDER_ID_KEY);
        setActiveTableId(null);
        setActiveOrderId(null);
        setCart([]);
        setTab('menu');
    };

    const handleConfirmOrder = () => {
        if (!activeTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(activeTableId, cart, 'Auto-Pedido Móvil');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Pedido Enviado', description: 'Su solicitud está siendo procesada.' });
                if (result.orderId) {
                    localStorage.setItem(DEVICE_ORDER_ID_KEY, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setTab('account');
            }
        });
    };

    if (!isInitialized) return null;

    // View 1: Select Location
    if (!activeTableId) {
        return (
            <div className="min-h-[100dvh] bg-muted/30 p-6 flex flex-col">
                <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-2">
                        <div className="h-16 w-16 bg-primary rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-primary/20 rotate-3">
                            <Utensils className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight pt-4">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para ordenar</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card shadow-sm">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {availableTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table.id)}
                                    className="group relative flex flex-col items-center justify-center bg-card border-2 border-border p-6 rounded-3xl transition-all hover:border-primary hover:shadow-xl hover:-translate-y-1 active:scale-95"
                                >
                                    <span className="text-4xl font-black tracking-tighter group-hover:text-primary transition-colors">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{table.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentTable = allTables?.find(t => t.id === activeTableId);

    // View 2: Menu / Account
    return (
        <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
            {/* Sticky Header */}
            <header className="shrink-0 bg-background/80 backdrop-blur-xl border-b z-30 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 h-10 w-10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Ubicación Actual</p>
                        <p className="font-black text-lg tracking-tight">{currentTable?.type} {currentTable?.number}</p>
                    </div>
                </div>
                <button 
                    onClick={handleExit}
                    className="h-10 w-10 flex items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground hover:text-destructive transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </header>

            {/* View Switcher */}
            <div className="shrink-0 p-4 bg-muted/20">
                <div className="flex bg-background p-1.5 rounded-2xl border shadow-inner">
                    <button 
                        onClick={() => setTab('menu')}
                        className={cn(
                            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all",
                            tab === 'menu' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <Utensils className="h-4 w-4" /> Menú
                    </button>
                    <button 
                        onClick={() => setTab('account')}
                        className={cn(
                            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all",
                            tab === 'account' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <History className="h-4 w-4" /> Mi Cuenta
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden">
                {tab === 'menu' ? (
                    <div className="h-full flex flex-col">
                        <div className="px-4 pb-4 space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar antojos..." 
                                    className="pl-9 h-12 bg-muted/30 border-0 rounded-2xl font-medium focus-visible:ring-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "h-9 px-5 rounded-full font-bold text-xs transition-all",
                                            selectedCategoryId === null ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-bold text-xs transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 px-4">
                            <div className="grid grid-cols-2 gap-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden border shadow-sm bg-muted animate-in fade-in zoom-in-95 duration-300">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Top Info Badge */}
                                        <div className="absolute top-3 inset-x-3 flex justify-start">
                                            <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-white leading-none">
                                                    {service.category} {service.source !== 'Internal' && `| ${service.stock}`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Main Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4 flex flex-col justify-end gap-2">
                                            <div>
                                                <p className="text-primary font-black text-sm tracking-tight">{formatCurrency(service.price)}</p>
                                                <h3 className="text-white font-black text-xs leading-tight uppercase line-clamp-2">{service.name}</h3>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                className="w-full h-10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
                                                onClick={() => handleAddToCart(service)}
                                                disabled={service.source !== 'Internal' && service.stock <= 0}
                                            >
                                                {service.source !== 'Internal' && service.stock <= 0 ? 'Agotado' : 'Añadir'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <ScrollArea className="h-full px-4 pt-2 pb-32">
                        {!activeOrder ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
                                    <ShoppingCart className="h-10 w-10 text-muted-foreground opacity-30" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-black text-lg uppercase tracking-tight">Sin pedidos activos</p>
                                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Vaya al menú y comience a añadir productos a su cuenta.</p>
                                </div>
                                <Button variant="outline" className="rounded-full font-bold h-11" onClick={() => setTab('menu')}>
                                    Ver Catálogo
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="bg-primary/5 rounded-3xl p-6 border-2 border-primary/10 flex items-center justify-between shadow-inner">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Acumulado</p>
                                        <p className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</p>
                                    </div>
                                    <div className="bg-background h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg border border-primary/10">
                                        <CheckCircle className="h-7 w-7 text-primary animate-pulse" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Detalle de Consumo</h3>
                                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-tighter bg-muted/30">
                                            {activeOrder.items.length} ARTÍCULOS
                                        </Badge>
                                    </div>
                                    <div className="bg-muted/30 rounded-3xl p-4 border space-y-1">
                                        {activeOrder.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center py-3 border-b last:border-0 border-border/50">
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-[11px] uppercase tracking-tight">{item.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold">{item.quantity} x {formatCurrency(item.price)}</p>
                                                </div>
                                                <p className="font-black text-xs tracking-tight">{formatCurrency(item.price * item.quantity)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/50 p-5 rounded-3xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        <p className="text-xs font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">Estado del Servicio</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Su cuenta se encuentra:</p>
                                        <Badge className="bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest h-7 px-3 rounded-full">
                                            {activeOrder.status === 'Pendiente' ? 'En Cola' : activeOrder.status}
                                        </Badge>
                                    </div>
                                    <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 font-medium">El personal procesará su pago al momento del check-out o retiro.</p>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                )}
            </main>

            {/* Bottom Cart Bar */}
            {cart.length > 0 && tab === 'menu' && (
                <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/30 animate-in slide-in-from-bottom-4 active:scale-95 transition-transform">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-white text-primary text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                                                {cart.reduce((s, i) => s + i.quantity, 0)}
                                            </span>
                                        </div>
                                        <div className="text-left leading-none">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Subtotal Pedido</p>
                                            <p className="text-xl font-black tracking-tight">{formatCurrency(cart.reduce((s, i) => s + (i.service.price * i.quantity), 0))}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-[2.5rem]">
                                <DialogHeader className="p-6 pb-4">
                                    <DialogTitle className="text-2xl font-black tracking-tight">Confirmar Pedido</DialogTitle>
                                    <DialogDescription className="font-medium">Revise los artículos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[50vh] px-6">
                                    <div className="space-y-3 pb-6">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/30 p-4 rounded-3xl border border-border/50 space-y-3">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-black text-xs uppercase tracking-tight leading-tight">{item.service.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold mt-1">{formatCurrency(item.service.price)} c/u</p>
                                                    </div>
                                                    {/* QUANTITY SELECTOR WITH FIXED COLORS */}
                                                    <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1 border border-primary/20">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-primary hover:bg-primary/20" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-sm font-black w-4 text-center text-primary">{item.quantity}</span>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 rounded-xl text-primary hover:bg-primary/20" 
                                                            onClick={() => handleAddToCart(item.service)}
                                                            disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {item.service.source === 'Internal' && (
                                                    <div className="space-y-2">
                                                        <button 
                                                            onClick={() => handleOpenNoteDialog(idx)}
                                                            className="flex items-center gap-2 text-[10px] font-black uppercase text-primary bg-background px-3 py-2 rounded-xl border border-primary/20 shadow-sm w-full"
                                                        >
                                                            <MessageSquare className="h-3 w-3" />
                                                            {item.notes ? "Editar Instrucciones" : "+ Instrucciones de preparación"}
                                                        </button>
                                                        {item.notes && (
                                                            <p className="text-[10px] italic text-muted-foreground px-2">"{item.notes}"</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="p-6 bg-muted/30 border-t space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pedido</span>
                                        <span className="text-2xl font-black text-primary tracking-tighter">
                                            {formatCurrency(cart.reduce((s, i) => s + (i.service.price * i.quantity), 0))}
                                        </span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
                                        disabled={isPending}
                                        onClick={handleConfirmOrder}
                                    >
                                        {isPending ? "Enviando..." : "Enviar a Cocina"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md p-6 rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Utensils className="h-5 w-5 text-primary" />
                            Instrucciones
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                            ¿Alguna indicación especial para su preparación?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-muted/50 p-4 rounded-2xl border">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Producto</p>
                            <p className="font-black text-sm uppercase">{editingNoteIndex !== null ? cart[editingNoteIndex]?.service.name : ''}</p>
                        </div>
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, hielo aparte..." 
                            value={currentNoteValue}
                            onChange={(e) => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 font-medium"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg" onClick={handleSaveNote}>
                            Guardar Nota
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
