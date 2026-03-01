'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { Service, ProductCategory, ProductSubCategory, RestaurantTable, Order, SinpeAccount, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Clock, CheckCircle, X, Sun, MapPin,
    MessageSquare, LogOut, ReceiptText, Layers
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const categoryMap: Record<string, string> = {
    Beverage: 'Bebida',
    Food: 'Comida',
    Amenity: 'Amenidad',
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());
    
    // Session State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [isInitialized, setIsMounted] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Notes Modal
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        setIsMounted(true);
        const savedTableId = localStorage.getItem('public_table_id');
        const savedOrderId = localStorage.getItem('public_order_id');
        if (savedTableId) setSelectedTableId(savedTableId);
        if (savedOrderId) setActiveOrderId(savedOrderId);

        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

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

    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // Subscribe to the ACTIVE order only
    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTableId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            where('status', '!=', 'Cancelado')
        );
    }, [firestore, selectedTableId]);
    const { data: tableOrders } = useCollection<Order>(ordersQuery);

    // Filter orders to show ONLY what this device/session ordered
    const myHistory = useMemo(() => {
        if (!tableOrders || !activeOrderId) return [];
        return tableOrders.filter(o => o.id === activeOrderId);
    }, [tableOrders, activeOrderId]);

    // Check if the saved order is still active
    useEffect(() => {
        if (activeOrderId && tableOrders) {
            const orderIsStillActive = tableOrders.find(o => o.id === activeOrderId && o.status !== 'Entregado');
            // If the order is delivered/paid, we might want to clear session, 
            // but usually we keep it so they can see the final total until they "Logout"
        }
    }, [activeOrderId, tableOrders]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            const isAvailable = t.status === 'Available';
            return matchesType && isAvailable;
        });
    }, [allTables, typeFilter]);

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

    const totalAccumulated = useMemo(() => {
        return myHistory.reduce((sum, o) => sum + o.total, 0);
    }, [myHistory]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
    }, [cart]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTableId(table.id);
        localStorage.setItem('public_table_id', table.id);
        toast({ title: `Ubicación seleccionada: ${TYPE_LABELS[table.type] || table.type} ${table.number}` });
    };

    const handleLogout = () => {
        localStorage.removeItem('public_table_id');
        localStorage.removeItem('public_order_id');
        setSelectedTableId(null);
        setActiveOrderId(null);
        setCart([]);
        setActiveTab('menu');
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
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            const table = allTables?.find(t => t.id === selectedTableId);
            if (!table) return;

            // Sanitize cart items to avoid 'undefined' notes
            const sanitizedCart = cart.map(item => ({
                ...item,
                notes: item.notes || null
            }));

            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, sanitizedCart as any);
            } else {
                const label = `Pedido Móvil ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                result = await openTableAccount(selectedTableId, sanitizedCart as any, label);
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem('public_order_id', result.orderId);
                }
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
                setCart([]);
                setActiveTab('account');
                getServices().then(setAvailableServices);
            }
        });
    };

    if (!isInitialized) return null;

    // --- VIEW 1: SELECT TABLE ---
    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-muted/30 p-6 flex flex-col">
                <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in duration-500">
                    <div className="text-center space-y-2">
                        <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border-4 border-primary/20 shadow-xl">
                            <Utensils className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar a ordenar.</p>
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
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="h-32 bg-card border-2 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
                                >
                                    <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                                        {TYPE_LABELS[table.type] || table.type}
                                    </span>
                                    <span className="text-4xl font-black text-primary">{table.number}</span>
                                </button>
                            ))}
                        </div>

                        {filteredTables.length === 0 && (
                            <div className="text-center py-12 bg-card border-2 border-dashed rounded-3xl">
                                <p className="text-muted-foreground font-bold italic">No hay ubicaciones disponibles en esta zona.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const currentTable = allTables?.find(t => t.id === selectedTableId);

    // --- VIEW 2: MENU & ACCOUNT ---
    return (
        <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
            {/* Header Fijo */}
            <header className="bg-primary text-white p-4 pt-6 shadow-xl z-20 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl border border-white/10 backdrop-blur-md">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none">Ubicación</h2>
                            <p className="text-xl font-black tracking-tight leading-tight">
                                {currentTable ? `${TYPE_LABELS[currentTable.type] || currentTable.type} ${currentTable.number}` : 'Cargando...'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white hover:bg-white/10 rounded-xl">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-6 bg-white/10 p-1 rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={cn(
                            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all",
                            activeTab === 'menu' ? "bg-white text-primary shadow-lg scale-100" : "text-white/70 scale-95"
                        )}
                    >
                        <Utensils className="h-4 w-4" /> Menú
                    </button>
                    <button 
                        onClick={() => setActiveTab('account')}
                        className={cn(
                            "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all",
                            activeTab === 'account' ? "bg-white text-primary shadow-lg scale-100" : "text-white/70 scale-95"
                        )}
                    >
                        <ReceiptText className="h-4 w-4" /> Mi Cuenta
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-hidden">
                {activeTab === 'menu' ? (
                    <div className="h-full flex flex-col">
                        {/* Categorías y Búsqueda */}
                        <div className="p-4 bg-muted/30 border-b space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida o bebida..." 
                                    className="pl-9 h-12 bg-background border-2 rounded-2xl focus:border-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    className={cn(
                                        "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border",
                                        selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border",
                                            selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border"
                                        )}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Listado de Productos */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div
                                        key={service.id}
                                        className="group bg-card border rounded-3xl overflow-hidden shadow-sm flex flex-col relative"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* TOP OVERLAY: Info context */}
                                            <div className="absolute top-0 inset-x-0 p-3 pb-6 bg-gradient-to-b from-black/70 to-transparent z-10">
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white opacity-95 flex items-center gap-1.5">
                                                    {categoryMap[service.category]} 
                                                    <span className="h-1 w-1 rounded-full bg-white/40"></span>
                                                    Stock: {service.stock}
                                                </span>
                                            </div>

                                            {/* BOTTOM OVERLAY: Action & Details */}
                                            <div className="absolute bottom-0 inset-x-0 p-3 pt-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10">
                                                <div className="space-y-2">
                                                    <div className="flex flex-col">
                                                        <h3 className="font-black text-[11px] uppercase tracking-tight text-white leading-tight drop-shadow-md">
                                                            {service.name}
                                                        </h3>
                                                        <p className="text-primary-foreground font-black text-sm drop-shadow-md">
                                                            {formatCurrency(service.price)}
                                                        </p>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest bg-primary text-white border-white/20 shadow-lg active:scale-95"
                                                        onClick={() => handleAddToCart(service)}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" /> Agregar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <ScrollArea className="h-full bg-muted/20">
                        <div className="p-6 space-y-6 pb-32">
                            {/* Resumen de Cuenta */}
                            <div className="bg-primary text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                                    <ReceiptText className="h-32 w-32" />
                                </div>
                                <div className="relative z-10 space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Acumulado</p>
                                    <p className="text-4xl font-black tracking-tighter">{formatCurrency(totalAccumulated)}</p>
                                    <div className="pt-2 flex items-center gap-2">
                                        <Badge className="bg-white/20 hover:bg-white/20 border-white/10 text-[10px] font-bold">
                                            {myHistory.length} Pedidos realizados
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Historial de Pedidos */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Historial de Estancia</h3>
                                </div>
                                
                                {myHistory.length === 0 ? (
                                    <div className="text-center py-16 bg-background rounded-3xl border-2 border-dashed flex flex-col items-center gap-4">
                                        <ShoppingCart className="h-12 w-12 text-muted-foreground/20" />
                                        <p className="text-muted-foreground font-bold italic text-sm">Aún no hay pedidos en esta estancia.</p>
                                    </div>
                                ) : (
                                    myHistory.map((order, idx) => (
                                        <div key={order.id} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-2xl flex items-center justify-center",
                                                        order.status === 'Entregado' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                                    )}>
                                                        {order.status === 'Entregado' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xs uppercase tracking-tight">Pedido #{myHistory.length - idx}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">
                                                            {formatDistance(order.createdAt.toDate(), now, { locale: es, addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className={cn(
                                                    "font-black text-[10px] uppercase tracking-widest px-3 h-6",
                                                    order.status === 'Entregado' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                                )}>
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            
                                            <div className="space-y-2 pl-1">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span className="font-medium text-muted-foreground">
                                                            <span className="font-black text-primary mr-2">{item.quantity}x</span>
                                                            {item.name}
                                                        </span>
                                                        <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <Separator className="bg-muted/50" />
                                            
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">Subtotal Pedido</span>
                                                <span className="font-black text-base">{formatCurrency(order.total)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </main>

            {/* Barra Flotante de Carrito */}
            {cart.length > 0 && (
                <div className="absolute bottom-0 inset-x-0 p-4 pb-8 z-30 pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <Badge className="absolute -top-2 -right-2 bg-white text-primary font-black border-2 border-primary h-6 w-6 rounded-full flex items-center justify-center p-0">
                                                {cart.length}
                                            </Badge>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Ver Carrito</p>
                                            <p className="text-lg font-black tracking-tight leading-tight">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bottom-0 sm:bottom-auto translate-y-0 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-3xl p-0 overflow-hidden border-0">
                                <DialogHeader className="p-6 bg-muted/30 border-b">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Su Pedido</DialogTitle>
                                    <DialogDescription className="font-bold">Confirme los artículos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                
                                <ScrollArea className="max-h-[50vh] px-6">
                                    <div className="py-6 space-y-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/30 rounded-2xl p-4 space-y-3 border border-border/50">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm uppercase truncate leading-tight">{item.service.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-xs font-bold text-muted-foreground">{formatCurrency(item.service.price)}</p>
                                                            {item.service.source === 'Internal' && (
                                                                <button 
                                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                                    className={cn(
                                                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 shadow-sm",
                                                                        item.notes ? "bg-primary text-white border-primary" : "bg-amber-100 text-amber-700 border-amber-200"
                                                                    )}
                                                                >
                                                                    <MessageSquare className="h-2.5 w-2.5" />
                                                                    {item.notes ? "Editar Nota" : "+ Instrucciones"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-white rounded-2xl p-1.5 shadow-sm border">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)} disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}>
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {item.notes && (
                                                    <p className="text-[11px] text-primary italic font-bold bg-primary/5 p-2 rounded-xl border-l-4 border-primary">
                                                        "{item.notes}"
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="p-6 bg-muted/10 border-t space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Monto Total</span>
                                        <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20"
                                        onClick={handleConfirmOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "Enviando..." : "Confirmar y Ordenar"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="font-bold">
                            ¿Cómo desea su {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : 'pedido'}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Escriba sus preferencias</Label>
                            <Textarea 
                                placeholder="Ej: Término medio, con poca sal, sin cebolla..."
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
