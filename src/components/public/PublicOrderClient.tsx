'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, User, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    MessageSquare, LogOut, ReceiptText, Filter
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STORAGE_KEY = 'go_motel_public_order_session';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string | null;
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
    const [now, setNow] = useState(new Date());
    
    // Session State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isSessionLoaded, setIsSessionLoaded] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Note Dialog State
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const savedSession = localStorage.getItem(STORAGE_KEY);
        if (savedSession) {
            setSelectedTableId(savedSession);
        }
        setIsSessionLoaded(true);
        return () => clearInterval(timer);
    }, []);

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

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        firestore && selectedTableId ? query(collection(firestore, 'orders'), where('locationId', '==', selectedTableId), where('status', '!=', 'Cancelado')) : null, 
        [firestore, selectedTableId]
    );
    const { data: myOrders } = useCollection<Order>(activeOrdersQuery);

    // Memos
    const selectedTable = useMemo(() => 
        allTables?.find(t => t.id === selectedTableId), 
        [allTables, selectedTableId]
    );

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        // Only show available tables OR the one already selected by this user
        const baseTables = allTables.filter(t => t.status === 'Available' || t.id === selectedTableId);
        
        if (locationFilter === 'all') return baseTables;
        return baseTables.filter(t => t.type === locationFilter);
    }, [allTables, locationFilter, selectedTableId]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const accountTotal = useMemo(() => {
        if (!myOrders) return 0;
        return myOrders.reduce((sum, order) => sum + (order.paymentStatus === 'Pagado' ? 0 : order.total), 0);
    }, [myOrders]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);
    }, [cart]);

    // Handlers
    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTableId(table.id);
        localStorage.setItem(STORAGE_KEY, table.id);
        toast({ title: `Bienvenido a la ${TYPE_LABELS[table.type] || table.type} ${table.number}` });
    };

    const handleExitSession = () => {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedTableId(null);
        setCart([]);
        setActiveTab('menu');
    };

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1, notes: null }];
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
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue || null } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            const openOrder = myOrders?.find(o => o.status === 'Pendiente');
            let result;

            if (openOrder) {
                result = await addToTableAccount(openOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, `Pedido Móvil`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    if (!isSessionLoaded) return null;

    // View 1: Selection Grid
    if (!selectedTableId) {
        return (
            <div className="flex-1 flex flex-col bg-[#0a0a0a] text-white p-6">
                <div className="mt-8 mb-12 text-center space-y-2">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">Go Motel Menu</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Selecciona tu ubicación para pedir</p>
                </div>

                <div className="max-w-md mx-auto w-full space-y-6">
                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="h-14 bg-muted/10 border-2 border-primary/20 rounded-2xl font-black uppercase text-xs tracking-widest text-primary shadow-lg shadow-primary/5">
                            <div className="flex items-center gap-3">
                                <Filter className="h-4 w-4" />
                                <SelectValue placeholder="Todas las Zonas" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-primary/20 text-white">
                            <SelectItem value="all">Todas las Zonas</SelectItem>
                            {locationTypes.map(type => (
                                <SelectItem key={type} value={type}>{TYPE_LABELS[type] || type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {filteredTables.map(table => {
                            const Icon = getTypeIcon(table.type);
                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="flex flex-col items-center justify-center p-6 bg-muted/5 border-2 border-primary/10 rounded-3xl hover:border-primary hover:bg-primary/5 transition-all duration-300 group"
                                >
                                    <Icon className="h-6 w-6 text-primary/40 group-hover:text-primary transition-colors mb-4" />
                                    <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{TYPE_LABELS[table.type] || table.type}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // View 2: Menu / Account
    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0a0a0a] overflow-hidden">
            {/* Header */}
            <header className="bg-background/80 backdrop-blur-xl border-b p-4 sticky top-0 z-30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
                            <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-black uppercase tracking-tighter text-lg leading-none">
                                {TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type} {selectedTable?.number}
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">Sesión Activa</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleExitSession} className="rounded-2xl h-11 w-11 hover:bg-destructive/10 hover:text-destructive">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-6 bg-muted/30 p-1 rounded-2xl border shadow-inner">
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            activeTab === 'menu' ? "bg-background text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        <PackageCheck className="h-4 w-4" /> Menú
                    </button>
                    <button 
                        onClick={() => setActiveTab('account')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all relative",
                            activeTab === 'account' ? "bg-background text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        <ReceiptText className="h-4 w-4" /> Mi Cuenta
                        {myOrders && myOrders.length > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-white text-[10px] font-black flex items-center justify-center rounded-full ring-4 ring-background">
                                {myOrders.length}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                {activeTab === 'menu' ? (
                    <div className="p-4 space-y-6 pb-32">
                        {/* Search & Categories */}
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar producto..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-12 bg-muted/20 border-none rounded-2xl text-sm font-medium"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={cn(
                                        "h-9 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                        selectedCategoryId === null ? "bg-primary border-primary text-white" : "border-muted text-muted-foreground"
                                    )}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            "h-9 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                            selectedCategoryId === cat.id ? "bg-primary border-primary text-white" : "border-muted text-muted-foreground"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-card border rounded-3xl overflow-hidden shadow-sm flex flex-col group active:scale-95 transition-transform">
                                    <div className="aspect-square bg-muted relative">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-background/90 text-primary font-black border-none backdrop-blur-sm shadow-sm">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-3 flex-1 flex flex-col">
                                        <div className="space-y-1 flex-1">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight">
                                                {service.name}
                                            </h3>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                                {service.source === 'Internal' ? 'Cocina' : 'Comprado'}
                                            </p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest h-9"
                                            onClick={() => handleAddToCart(service)}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Añadir
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-6 pb-20">
                        <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 text-center space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Total Acumulado</p>
                            <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(accountTotal)}</p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-black uppercase text-[11px] tracking-widest text-muted-foreground ml-2">Historial de Pedidos</h3>
                            {myOrders && myOrders.length > 0 ? (
                                <div className="space-y-3">
                                    {myOrders.map(order => (
                                        <div key={order.id} className="bg-card border rounded-3xl p-4 shadow-sm space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                                                            {formatDistance(order.createdAt.toDate(), now, { locale: es, addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Ref: {order.id.slice(-6)}</p>
                                                </div>
                                                <Badge className={cn(
                                                    "font-black text-[9px] uppercase px-3 py-1 rounded-full",
                                                    order.status === 'Pendiente' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                                    order.status === 'En preparación' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                )}>
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-primary">{item.quantity}x</span>
                                                                <span className="font-bold uppercase text-[11px] tracking-tight">{item.name}</span>
                                                            </div>
                                                            {item.notes && <p className="text-[9px] italic text-muted-foreground ml-6">"{item.notes}"</p>}
                                                        </div>
                                                        <span className="font-bold text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pt-3 border-t flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">Subtotal Orden</span>
                                                <span className="font-black text-sm">{formatCurrency(order.total)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 space-y-4">
                                    <div className="bg-muted/30 h-20 w-20 rounded-full flex items-center justify-center mx-auto">
                                        <ShoppingCart className="h-8 w-8 text-muted-foreground opacity-20" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">No hay pedidos registrados</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Bottom Floating Bar */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-1 -right-1 h-5 w-5 bg-white text-primary text-[10px] font-black flex items-center justify-center rounded-full">
                                                {cart.reduce((s, i) => s + i.quantity, 0)}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Revisar Pedido</p>
                                            <p className="text-lg font-black tracking-tighter leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-t-3xl sm:rounded-3xl">
                                <DialogHeader className="p-6 border-b">
                                    <DialogTitle className="font-black uppercase text-sm tracking-widest">Confirmar Pedido</DialogTitle>
                                    <DialogDescription className="text-xs uppercase font-bold text-primary/60">Enviando a: {TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type} {selectedTable?.number}</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="flex flex-col gap-2 p-4 bg-muted/20 rounded-2xl border">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-black text-[11px] uppercase tracking-tight">{item.service.name}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-background rounded-xl p-1 border shadow-sm">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-[11px] font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleAddToCart(item.service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                    className={cn(
                                                        "text-[9px] font-black uppercase h-8 rounded-xl border flex items-center justify-center gap-2",
                                                        item.notes ? "bg-primary text-white border-primary" : "bg-white dark:bg-black text-muted-foreground border-dashed"
                                                    )}
                                                >
                                                    <MessageSquare className="h-3 w-3" />
                                                    {item.notes ? "Ver Nota" : "+ Añadir Notas"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="p-6 border-t bg-muted/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total del Pedido</span>
                                        <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "ENVIANDO..." : "CONFIRMAR Y ENVIAR"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-t-3xl sm:rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-sm tracking-widest">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription className="text-xs">Detalles especiales para su preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                            <Utensils className="h-5 w-5 text-primary" />
                            <span className="font-black text-xs uppercase">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, con extra hielo..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-bold p-4"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
