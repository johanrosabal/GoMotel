'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, PackageCheck, Clock, CheckCircle, X, Sun, MapPin, 
    Pencil, Trash2, AlertCircle, MessageSquare, Utensils, Beer, 
    ChevronRight, ChevronLeft, ImageIcon, History, User, LogOut
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const SESSION_KEY = 'go_motel_active_order';
const TABLE_KEY = 'go_motel_active_table';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeTableId, setActiveTableId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Navigation & UI
    const [tab, setTab] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    
    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // Note Dialog
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Load Session
    useEffect(() => {
        const storedOrderId = localStorage.getItem(SESSION_KEY);
        const storedTableId = localStorage.getItem(TABLE_KEY);
        if (storedOrderId) setActiveOrderId(storedOrderId);
        if (storedTableId) setActiveTableId(storedTableId);
        setIsInitialized(true);
        
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Watch Active Order Status
    useEffect(() => {
        if (!firestore || !activeOrderId) return;

        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // If order is delivered and paid, the session is over
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    handleLogout();
                }
            } else {
                // If order document is gone, clear session
                handleLogout();
            }
        });

        return () => unsub();
    }, [firestore, activeOrderId]);

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

    const activeOrderQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId));
    }, [firestore, activeOrderId]);
    const { data: activeOrderData } = useCollection<Order>(activeOrderQuery);
    const activeOrder = activeOrderData?.[0] || null;

    // Filtered Data
    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            // Only show available tables OR the one I already have claimed
            const isMine = t.id === activeTableId;
            const isAvailable = t.status === 'Available';
            return matchesType && (isAvailable || isMine);
        }).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, typeFilter, activeTableId]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    // Handlers
    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied' && table.id !== activeTableId) {
            toast({ title: "Mesa Ocupada", description: "Esta ubicación ya tiene una cuenta activa.", variant: "destructive" });
            return;
        }
        localStorage.setItem(TABLE_KEY, table.id);
        setActiveTableId(table.id);
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TABLE_KEY);
        setActiveOrderId(null);
        setActiveTableId(null);
        setCart([]);
        setTab('menu');
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
        toast({ title: "Añadido", description: `${service.name} al carrito.` });
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
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue || undefined } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleConfirmOrder = () => {
        if (!activeTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(activeTableId, cart, "Pedido Móvil");
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su solicitud está siendo procesada." });
                if (result.orderId) {
                    localStorage.setItem(SESSION_KEY, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setIsCartOpen(false);
                setTab('account');
            }
        });
    };

    if (!isInitialized) return null;

    // VIEW: Select Table
    if (!activeTableId) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col p-6 animate-in fade-in duration-500">
                <div className="max-w-md mx-auto w-full space-y-10 py-10">
                    <div className="text-center space-y-2">
                        <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10">
                            <PackageCheck className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-foreground">¡Hola!</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="h-24 rounded-2xl border-2 bg-card flex flex-col items-center justify-center gap-1 transition-all active:scale-95 hover:border-primary/40 group"
                                >
                                    <span className="text-3xl font-black group-hover:text-primary transition-colors">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[table.type] || table.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentTableName = allTables?.find(t => t.id === activeTableId)?.number || '';
    const currentTableType = allTables?.find(t => t.id === activeTableId)?.type || '';

    return (
        <div className="flex flex-col h-[100dvh] bg-muted/20 overflow-hidden">
            {/* Sticky Header */}
            <div className="bg-background border-b px-4 py-3 shrink-0 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-tighter text-muted-foreground">Ubicación Actual</h2>
                        <p className="font-black text-sm leading-none">{TYPE_LABELS[currentTableType] || currentTableType} {currentTableName}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive transition-colors" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>

            {/* Tabs */}
            <div className="bg-background px-4 border-b shrink-0 flex gap-6 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setTab('menu')}
                    className={cn(
                        "h-12 px-2 font-black text-[11px] uppercase tracking-[0.2em] transition-all relative shrink-0",
                        tab === 'menu' ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    Menú Digital
                    {tab === 'menu' && <div className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setTab('account')}
                    className={cn(
                        "h-12 px-2 font-black text-[11px] uppercase tracking-[0.2em] transition-all relative shrink-0",
                        tab === 'account' ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    Mi Cuenta {activeOrder && <Badge className="ml-2 bg-primary/10 text-primary border-none text-[10px] px-1.5 h-4 font-black">{formatCurrency(activeOrder.total)}</Badge>}
                    {tab === 'account' && <div className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full" />}
                </button>
            </div>

            {/* Scrollable Area */}
            <ScrollArea className="flex-1">
                {tab === 'menu' ? (
                    <div className="p-4 space-y-6 pb-32">
                        {/* Search and Categories */}
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar algo delicioso..." 
                                    className="pl-9 h-12 bg-background rounded-2xl border-none shadow-sm font-medium"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest border transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" : "bg-background text-muted-foreground border-border"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest border transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" : "bg-background text-muted-foreground border-border"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Product Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-card rounded-3xl border shadow-sm overflow-hidden flex flex-col group active:scale-[0.98] transition-all">
                                    <div className="aspect-[4/5] relative">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-muted"><ImageIcon className="h-10 w-10 text-muted-foreground/20" /></AvatarFallback>
                                        </Avatar>
                                        
                                        {/* TOP INFO */}
                                        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex flex-col items-start gap-1">
                                            <Badge variant="outline" className="bg-white text-black border-none font-black text-[8px] uppercase tracking-widest px-2 py-0.5 shadow-sm">
                                                {service.category === 'Food' ? 'Comida' : service.category === 'Beverage' ? 'Bebida' : 'Otros'}
                                            </Badge>
                                            {service.source !== 'Internal' && (
                                                <span className="text-[8px] font-black uppercase text-white drop-shadow-md">
                                                    Stock: {service.stock}
                                                </span>
                                            )}
                                        </div>

                                        {/* BOTTOM INFO */}
                                        <div className="absolute bottom-0 inset-x-0 p-3 pt-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <h3 className="font-black text-[11px] uppercase tracking-tight text-white leading-tight line-clamp-2 drop-shadow-lg">{service.name}</h3>
                                                    <p className="font-black text-sm text-primary drop-shadow-lg mt-0.5">{formatCurrency(service.price)}</p>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    className="h-8 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-90 transition-transform"
                                                    onClick={() => handleAddToCart(service)}
                                                    disabled={service.source !== 'Internal' && (service.stock || 0) <= 0}
                                                >
                                                    Agregar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-6 pb-32">
                        {!activeOrder ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="bg-muted h-20 w-20 rounded-full flex items-center justify-center">
                                    <History className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-black uppercase tracking-widest text-muted-foreground text-xs">Sin actividad</p>
                                    <p className="text-sm text-muted-foreground px-10">Aún no ha realizado ningún pedido en esta estancia.</p>
                                </div>
                                <Button variant="outline" className="rounded-2xl font-bold" onClick={() => setTab('menu')}>Explorar Menú</Button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 flex flex-col items-center text-center gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Total Acumulado</p>
                                    <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(activeOrder.total)}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge className="bg-green-500/10 text-green-600 border-none uppercase font-black text-[10px]">Cuenta Abierta</Badge>
                                        <Badge className="bg-primary/10 text-primary border-none uppercase font-black text-[10px]">{activeOrder.items.length} Artículos</Badge>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Historial de Consumo</h3>
                                    <div className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center justify-between pb-3 border-b border-dashed">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado Actual</p>
                                                    <p className="text-sm font-bold text-primary">{activeOrder.status}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground">{formatDistance(activeOrder.createdAt.toDate(), now, { locale: es, addSuffix: true })}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {activeOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start">
                                                    <div className="flex-1 pr-4">
                                                        <p className="font-bold text-sm leading-tight uppercase tracking-tight">{item.quantity}x {item.name}</p>
                                                        {item.notes && <p className="text-[10px] italic text-primary mt-0.5">"{item.notes}"</p>}
                                                    </div>
                                                    <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-3 border-t flex justify-between items-center">
                                            <span className="text-xs font-black uppercase text-muted-foreground">Subtotal Pedido</span>
                                            <span className="text-lg font-black">{formatCurrency(activeOrder.total)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/50 rounded-2xl border-2 border-dashed flex flex-col items-center gap-3">
                                    <p className="text-center text-[11px] text-muted-foreground font-medium">¿Desea algo más? Puede seguir añadiendo productos a su cuenta desde el menú.</p>
                                    <Button size="sm" variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest" onClick={() => setTab('menu')}>Volver al Menú</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 inset-x-0 px-6 z-30">
                    <div className="max-w-md mx-auto">
                        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-white text-primary rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">{cart.length}</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Ver Carrito</p>
                                            <p className="text-lg font-black leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
                                <DialogHeader className="p-6 pb-2">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Confirmar Pedido</DialogTitle>
                                    <DialogDescription>Revise su selección antes de enviar.</DialogDescription>
                                </DialogHeader>
                                
                                <ScrollArea className="flex-1 px-6">
                                    <div className="space-y-4 py-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-3xl border border-border/50">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className="font-black text-sm uppercase tracking-tight line-clamp-1">{item.service.name}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <p className="text-xs font-bold text-muted-foreground">{formatCurrency(item.service.price)}</p>
                                                            {item.service.source === 'Internal' && (
                                                                <button 
                                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                                    className={cn(
                                                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1.5 shadow-sm",
                                                                        item.notes ? "bg-primary text-white border-primary" : "bg-white text-primary border-primary/20 hover:bg-primary/5"
                                                                    )}
                                                                >
                                                                    <MessageSquare className="h-3 w-3" />
                                                                    {item.notes ? "Ver Nota" : "Añadir Nota"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1.5 border border-primary/20">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl hover:bg-white" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3 text-primary" />
                                                        </Button>
                                                        <span className="text-sm font-black text-primary w-4 text-center">{item.quantity}</span>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-7 w-7 rounded-xl hover:bg-white" 
                                                            onClick={() => handleAddToCart(item.service)}
                                                            disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                        >
                                                            <Plus className="h-3 w-3 text-primary" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {item.notes && (
                                                    <div className="px-3 py-2 bg-primary/10 rounded-xl border border-primary/10">
                                                        <p className="text-[10px] text-primary italic font-medium">"{item.notes}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="p-6 border-t bg-muted/5 space-y-4">
                                    <div className="flex justify-between items-end px-2">
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Monto del Pedido</span>
                                        <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                                        onClick={handleConfirmOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "PROCESANDO..." : "CONFIRMAR Y ENVIAR"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription>Añada indicaciones especiales para su preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border flex items-center gap-4">
                            <div className="bg-primary/10 p-2.5 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sus instrucciones</Label>
                            <Textarea 
                                placeholder="Ej: Sin cebolla, término medio, etc."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-bold p-4"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl font-bold" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
