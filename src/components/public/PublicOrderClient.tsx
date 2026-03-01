'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Sun, MapPin, X,
    Clock, CheckCircle, Receipt, History, ShoppingBag
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const STATUS_CONFIG = {
    'Pendiente': { color: 'text-amber-500 bg-amber-50 border-amber-200', icon: Clock },
    'En preparación': { color: 'text-blue-500 bg-blue-50 border-blue-200', icon: Utensils },
    'Entregado': { color: 'text-emerald-500 bg-emerald-50 border-emerald-200', icon: CheckCircle },
    'Cancelado': { color: 'text-destructive bg-destructive/10 border-destructive/20', icon: X }
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);
    const [viewMode, setViewMode] = useState<string>('all');

    // Data Fetching
    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), where('status', '==', 'Available'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: availableTables } = useCollection<RestaurantTable>(tablesQuery);

    // Fetch client's orders if a table is selected
    const clientOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTable) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTable.id),
            where('status', '!=', 'Cancelado'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, selectedTable]);
    const { data: myOrders } = useCollection<Order>(clientOrdersQuery);

    const activeAccountOrders = useMemo(() => {
        if (!myOrders) return [];
        // Only show orders that haven't been paid (legacy check: paymentStatus)
        return myOrders.filter(o => o.paymentStatus !== 'Pagado');
    }, [myOrders]);

    const accountTotal = useMemo(() => {
        return activeAccountOrders.reduce((sum, o) => sum + o.total, 0);
    }, [activeAccountOrders]);

    const filteredTables = useMemo(() => {
        if (!availableTables) return [];
        if (viewMode === 'all') return availableTables;
        return availableTables.filter(t => t.type === viewMode);
    }, [availableTables, viewMode]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

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

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            const currentActiveOrder = activeAccountOrders[0]; // Logic: add to the first open account found for this table

            if (currentActiveOrder) {
                result = await addToTableAccount(currentActiveOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando tu orden.' });
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

    if (!selectedTable) {
        return (
            <div className="flex flex-col min-h-screen p-4 sm:p-6 bg-background animate-in fade-in duration-500">
                <header className="mb-8 text-center pt-6">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">Go Motel Menu</h1>
                    <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest mt-1">Selecciona tu ubicación para pedir</p>
                </header>

                <div className="flex flex-wrap gap-2 mb-6 justify-center">
                    <button 
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 transition-all",
                            viewMode === 'all' ? "bg-primary text-primary-foreground border-primary shadow-lg" : "bg-muted text-muted-foreground border-transparent"
                        )}
                        onClick={() => setViewMode('all')}
                    >
                        Todos
                    </button>
                    {['Table', 'Bar', 'Terraza'].map(type => (
                        <button 
                            key={type}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 transition-all",
                                viewMode === type ? "bg-primary text-primary-foreground border-primary shadow-lg" : "bg-muted text-muted-foreground border-transparent"
                            )}
                            onClick={() => setViewMode(type)}
                        >
                            {TYPE_LABELS[type] || type}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-10">
                    {filteredTables.map(table => {
                        const Icon = getTypeIcon(table.type);
                        return (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTable(table)}
                                className="flex flex-col items-center justify-center aspect-square rounded-3xl border-2 border-border bg-card hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 group"
                            >
                                <div className="p-3 rounded-2xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors mb-2">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{TYPE_LABELS[table.type] || table.type}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* Header Fijo */}
            <header className="shrink-0 bg-primary text-primary-foreground p-4 shadow-lg z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg leading-none uppercase tracking-tighter">
                                {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                            </h2>
                            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Cliente Auto-Servicio</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setSelectedTable(null); setCart([]); setActiveTab('menu'); }}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Tabs de Navegación */}
            <div className="shrink-0 flex border-b bg-muted/30">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                        activeTab === 'menu' ? "bg-background text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}
                >
                    <ShoppingBag className="h-4 w-4" /> Menú
                </button>
                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all relative",
                        activeTab === 'account' ? "bg-background text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}
                >
                    <Receipt className="h-4 w-4" /> Mi Cuenta
                    {activeAccountOrders.length > 0 && (
                        <div className="absolute top-3 right-1/4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                </button>
            </div>

            <main className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' ? (
                    <div className="flex flex-col h-full">
                        {/* Categorías y Búsqueda */}
                        <div className="p-4 space-y-4 bg-muted/10 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se te antoja hoy?..." 
                                    className="pl-9 h-11 bg-background border-2 rounded-xl shadow-inner"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                        selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-background text-muted-foreground border-border"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                            selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-background text-muted-foreground border-border"
                                        )}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                                {filteredServices.map(service => {
                                    const qty = cart.find(i => i.service.id === service.id)?.quantity || 0;
                                    return (
                                        <div key={service.id} className="flex flex-col bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                                            <div className="aspect-square relative overflow-hidden bg-muted">
                                                <Avatar className="h-full w-full rounded-none">
                                                    <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback className="rounded-none"><ImageIcon className="h-8 w-8 opacity-10" /></AvatarFallback>
                                                </Avatar>
                                                <div className="absolute top-2 right-2">
                                                    <Badge className="font-black bg-background/90 text-primary border-none shadow-sm backdrop-blur-sm">
                                                        {formatCurrency(service.price)}
                                                    </Badge>
                                                </div>
                                                {qty > 0 && (
                                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in zoom-in-95">
                                                        <div className="bg-primary text-white font-black h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-xl ring-4 ring-white/20">
                                                            {qty}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                                                <h3 className="font-black text-[11px] uppercase leading-tight line-clamp-2">{service.name}</h3>
                                                <div className="flex items-center gap-1">
                                                    {qty === 0 ? (
                                                        <Button 
                                                            size="sm" 
                                                            className="w-full h-8 rounded-lg font-black text-[10px] uppercase tracking-widest"
                                                            onClick={() => handleAddToCart(service)}
                                                        >
                                                            Añadir
                                                        </Button>
                                                    ) : (
                                                        <div className="flex items-center w-full gap-1">
                                                            <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(service.id)}>
                                                                <Minus className="h-3 w-3" />
                                                            </Button>
                                                            <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(service)}>
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col h-full bg-muted/10">
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6">
                                {activeAccountOrders.length > 0 ? (
                                    <>
                                        <div className="bg-background rounded-2xl p-6 border-2 border-primary/10 shadow-sm text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Monto Total de la Cuenta</p>
                                            <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(accountTotal)}</p>
                                            <div className="flex items-center justify-center gap-2 mt-4 text-[10px] font-bold text-muted-foreground uppercase">
                                                <CheckCircle className="h-3 w-3 text-emerald-500" /> {activeAccountOrders.length} Pedidos registrados
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Historial de Pedidos</h3>
                                            {activeAccountOrders.map(order => (
                                                <div key={order.id} className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                                                    <div className="p-4 border-b bg-muted/5 flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-primary/10 p-2 rounded-xl"><History className="h-4 w-4 text-primary" /></div>
                                                            <div>
                                                                <p className="text-[11px] font-black uppercase leading-none">Orden #{order.id.slice(-4)}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">
                                                                    {formatDistance(order.createdAt.toDate(), new Date(), { locale: es, addSuffix: true })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className={cn(
                                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                            STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.color || 'bg-muted'
                                                        )}>
                                                            {order.status}
                                                        </div>
                                                    </div>
                                                    <div className="p-4 space-y-2">
                                                        {order.items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-primary text-xs">{item.quantity}x</span>
                                                                    <span className="font-bold text-xs uppercase tracking-tight text-muted-foreground">{item.name}</span>
                                                                </div>
                                                                <span className="font-black text-xs">{formatCurrency(item.price * item.quantity)}</span>
                                                            </div>
                                                        ))}
                                                        <Separator className="my-2" />
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Subtotal Orden</span>
                                                            <span className="font-black text-sm">{formatCurrency(order.total)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                        <div className="bg-muted p-6 rounded-full"><Receipt className="h-12 w-12 text-muted-foreground/30" /></div>
                                        <div className="space-y-1">
                                            <h3 className="font-black uppercase tracking-tight">Sin consumos aún</h3>
                                            <p className="text-xs text-muted-foreground max-w-[200px]">Tus pedidos confirmados aparecerán aquí para que lleves el control de tu cuenta.</p>
                                        </div>
                                        <Button variant="outline" className="rounded-xl font-bold text-xs uppercase h-11 px-8" onClick={() => setActiveTab('menu')}>Ir al Menú</Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Resumen de Carrito Flotante */}
                {cart.length > 0 && (
                    <div className="absolute bottom-6 left-4 right-6 z-30 animate-in slide-in-from-bottom-10 duration-500">
                        <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl flex items-center justify-between ring-4 ring-primary/20">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 h-12 w-12 rounded-xl flex items-center justify-center relative">
                                    <ShoppingCart className="h-6 w-6" />
                                    <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-lg">
                                        {cart.reduce((s, i) => s + i.quantity, 0)}
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total del Pedido</p>
                                    <p className="text-xl font-black tracking-tighter">{formatCurrency(cartTotal)}</p>
                                </div>
                            </div>
                            <Button 
                                className="bg-white text-primary hover:bg-white/90 font-black uppercase text-xs tracking-widest h-12 px-6 rounded-xl shadow-lg"
                                onClick={handleSendOrder}
                                disabled={isPending}
                            >
                                {isPending ? 'Enviando...' : 'Confirmar'}
                            </Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
