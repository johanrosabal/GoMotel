'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, ProductCategory, ProductSubCategory, RestaurantTable, Order, SinpeAccount, AppliedTax, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft, ImageIcon, User, 
    Clock, X, LogOut, Receipt, History, Utensils,
    MessageSquare, CheckCircle, Smartphone, Wallet, CreditCard
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [isSessionLoaded, setIsSessionLoaded] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Kitchen Notes
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Load Session from LocalStorage
    useEffect(() => {
        const storedTableId = localStorage.getItem('public_order_table_id');
        const storedOrderId = localStorage.getItem('public_order_active_id');
        if (storedTableId) setSelectedTableId(storedTableId);
        if (storedOrderId) setActiveOrderId(storedOrderId);
        setIsSessionLoaded(true);
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

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTableId || !activeOrderId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, selectedTableId, activeOrderId]);
    
    const { data: orders } = useCollection<Order>(ordersQuery);

    // Filtramos los pedidos para mostrar SOLO los de la sesión actual del dispositivo
    const sessionOrders = useMemo(() => {
        if (!orders || !activeOrderId) return [];
        return orders.filter(o => o.id === activeOrderId || o.paymentStatus === 'Pendiente');
    }, [orders, activeOrderId]);

    const activeTable = useMemo(() => allTables?.find(t => t.id === selectedTableId), [allTables, selectedTableId]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            // Solo mostramos mesas disponibles para que el cliente elija
            return matchesType && t.status === 'Available';
        }).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
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

    const cartSubtotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);
    const accountTotal = useMemo(() => sessionOrders.reduce((sum, o) => sum + (o.status !== 'Cancelado' ? o.total : 0), 0), [sessionOrders]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTableId(table.id);
        localStorage.setItem('public_order_table_id', table.id);
    };

    const handleExit = () => {
        setSelectedTableId(null);
        setActiveOrderId(null);
        setCart([]);
        localStorage.removeItem('public_order_table_id');
        localStorage.removeItem('public_order_active_id');
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

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, 'Auto-Pedido');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem('public_order_active_id', result.orderId);
                }
                toast({ title: 'Pedido Enviado', description: 'Tu orden está siendo procesada.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!isSessionLoaded) return null;

    // View 1: Table Selection
    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col p-6 pb-12">
                <div className="max-w-md mx-auto w-full space-y-10 animate-in fade-in duration-500">
                    <div className="text-center space-y-2">
                        <div className="bg-primary/10 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <Utensils className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Por favor, seleccione su mesa para comenzar.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar por Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
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

                        <div className="grid grid-cols-3 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="aspect-square rounded-2xl bg-card border-2 border-border flex flex-col items-center justify-center hover:border-primary transition-all active:scale-95 shadow-sm"
                                >
                                    <span className="text-2xl font-black tracking-tighter">{table.number}</span>
                                    <span className="text-[8px] font-bold uppercase text-muted-foreground mt-1">
                                        {table.type === 'Table' ? 'Mesa' : table.type}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {filteredTables.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed rounded-3xl space-y-2">
                                <p className="text-sm font-bold text-muted-foreground uppercase">No hay ubicaciones libres</p>
                                <p className="text-xs text-muted-foreground">Consulte con el personal de recepción.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // View 2: Main Menu & Account
    return (
        <div className="h-[100dvh] flex flex-col bg-muted/20 overflow-hidden">
            {/* Header Fijo */}
            <header className="bg-background/80 backdrop-blur-xl border-b p-4 px-6 shrink-0 flex items-center justify-between z-30">
                <div className="flex items-center gap-3">
                    <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <span className="font-black text-lg tracking-tighter">{activeTable?.number}</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-tighter leading-none">Ordenando</h2>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{activeTable?.type === 'Table' ? 'Mesa Salón' : activeTable?.type}</p>
                    </div>
                </div>
                <button onClick={handleExit} className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                    <LogOut className="h-5 w-5" />
                </button>
            </header>

            {/* Pestañas de Navegación */}
            <div className="flex bg-background border-b shrink-0 z-30">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative",
                        activeTab === 'menu' ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    Menú
                    {activeTab === 'menu' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative",
                        activeTab === 'account' ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    Mi Cuenta
                    {activeTab === 'account' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                </button>
            </div>

            <main className="flex-1 overflow-y-auto relative bg-muted/10">
                {activeTab === 'menu' ? (
                    <div className="p-4 space-y-6 pb-32">
                        {/* Categorías (Wrap Chips) */}
                        <div className="flex flex-wrap gap-2">
                            <button 
                                className={cn(
                                    "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest border-2 transition-all",
                                    selectedCategoryId === null ? "bg-primary border-primary text-white shadow-md" : "bg-card border-border text-muted-foreground"
                                )}
                                onClick={() => setSelectedCategoryId(null)}
                            >
                                Todos
                            </button>
                            {categories?.map(cat => (
                                <button 
                                    key={cat.id}
                                    className={cn(
                                        "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest border-2 transition-all",
                                        selectedCategoryId === cat.id ? "bg-primary border-primary text-white shadow-md" : "bg-card border-border text-muted-foreground"
                                    )}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Lista de Productos */}
                        <div className="grid grid-cols-2 gap-4">
                            {filteredServices.map(service => (
                                <div key={service.id} className="group relative bg-card rounded-3xl overflow-hidden shadow-sm border-2 border-transparent active:border-primary transition-all">
                                    <div className="aspect-[4/5] relative">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-muted flex items-center justify-center">
                                                <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        {/* Precio Flotante */}
                                        <div className="absolute top-3 right-3 z-20">
                                            <Badge className="bg-background/90 text-primary font-black border-primary/20 backdrop-blur-md px-2.5 py-1">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>

                                        {/* Overlay de Información (Bottom) */}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-10 z-10">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary-foreground/70 mb-0.5">
                                                        {service.source === 'Internal' ? 'Cocina' : 'Bar / Stock'}
                                                    </span>
                                                    <h3 className="text-white font-black text-xs uppercase leading-tight line-clamp-2">
                                                        {service.name}
                                                    </h3>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => handleAddToCart(service)}
                                                    className="w-full h-10 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Agregar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-6 pb-32">
                        {/* Mi Cuenta / Historial */}
                        <div className="bg-primary text-white rounded-3xl p-6 shadow-xl shadow-primary/20 animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Acumulado</p>
                                    <h3 className="text-4xl font-black tracking-tighter">{formatCurrency(accountTotal)}</h3>
                                </div>
                                <Receipt className="h-8 w-8 opacity-20" />
                            </div>
                            <div className="bg-white/10 rounded-2xl p-3 border border-white/10 flex items-center gap-3">
                                <Clock className="h-4 w-4 opacity-70" />
                                <p className="text-[10px] font-bold uppercase tracking-widest leading-none">
                                    {sessionOrders.length} Pedidos registrados
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Historial de Consumo</h4>
                            {sessionOrders.length === 0 ? (
                                <div className="text-center py-16 border-2 border-dashed rounded-3xl space-y-3">
                                    <History className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                                    <p className="text-sm font-bold text-muted-foreground uppercase">Aún no hay consumos</p>
                                </div>
                            ) : (
                                sessionOrders.map((order, idx) => (
                                    <div key={order.id} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="h-6 font-black">{sessionOrders.length - idx}</Badge>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    {formatDistance(order.createdAt.toDate(), now, { locale: es, addSuffix: true })}
                                                </span>
                                            </div>
                                            <Badge className={cn(
                                                "font-black text-[9px] uppercase tracking-widest",
                                                order.status === 'Entregado' ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                                            )}>
                                                {order.status}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {order.items.map((item, iidx) => (
                                                <div key={iidx} className="flex justify-between text-sm">
                                                    <span className="font-bold text-muted-foreground">{item.quantity}x <span className="text-foreground">{item.name}</span></span>
                                                    <span className="font-black">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Separator className="bg-muted/50" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Subtotal Pedido</span>
                                            <span className="font-black text-primary">{formatCurrency(order.total)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Barra Flotante de Carrito */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full p-4 px-6 bg-gradient-to-t from-background via-background to-transparent z-40">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-white text-primary border-none font-black text-[10px]">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Ver Carrito</p>
                                            <p className="font-black text-xl tracking-tighter leading-none">{formatCurrency(cartSubtotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-t-[40px] rounded-b-none border-none p-0 overflow-hidden">
                                <DialogHeader className="p-8 pb-4">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Mi Pedido</DialogTitle>
                                    <DialogDescription className="font-bold text-xs uppercase text-muted-foreground">Revisa tus productos antes de enviar</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[50vh] px-8">
                                    <div className="space-y-4 py-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="flex flex-col gap-2 p-4 rounded-3xl bg-muted/30 border border-muted-foreground/10">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                                        <p className="text-[10px] font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-background rounded-2xl p-1 shadow-sm">
                                                        <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center active:scale-90 transition-transform">
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className="font-black text-xs w-4 text-center">{item.quantity}</span>
                                                        <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform">
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mt-1"
                                                >
                                                    <MessageSquare className="h-3 w-3" />
                                                    {item.notes ? "Editar Instrucciones" : "+ Instrucciones de cocina"}
                                                </button>
                                                {item.notes && (
                                                    <p className="text-[10px] font-medium text-primary italic bg-primary/5 p-2 rounded-xl border border-primary/10">"{item.notes}"</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="p-8 bg-background border-t space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Total Pedido</span>
                                        <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartSubtotal)}</span>
                                    </div>
                                    <Button 
                                        onClick={handleSendOrder} 
                                        disabled={isPending} 
                                        className="w-full h-16 rounded-[2rem] font-black uppercase tracking-[0.1em] text-base shadow-xl shadow-primary/20"
                                    >
                                        {isPending ? "Procesando..." : "Confirmar y Enviar"}
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
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase">Añade indicaciones para la preparación</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-muted/30 rounded-2xl border flex items-center gap-3">
                            <Utensils className="h-5 w-5 text-primary" />
                            <span className="font-black text-xs uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <Textarea 
                            placeholder="Ej: Con poca sal, bien cocido, sin cebolla..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 font-medium"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg" onClick={handleSaveNote}>
                            Guardar Nota
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
