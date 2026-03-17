'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { RestaurantTable, Order, Service, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    Utensils, Search, ShoppingCart, Plus, Minus, 
    ArrowRight, MapPin, Clock, CheckCircle, Package,
    ChevronLeft, Smartphone, History, Receipt, Info, Sparkles
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

type CartItem = {
    service: Service;
    quantity: number;
    notes?: string;
};

export default function PublicOrderClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const tableIdFromUrl = searchParams.get('tableId');
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [services, setServices] = useState<Service[]>([]);

    // 1. Listen to the Table
    const tableRef = useMemoFirebase(() => tableIdFromUrl ? doc(firestore!, 'restaurantTables', tableIdFromUrl) : null, [firestore, tableIdFromUrl]);
    const { data: table, isLoading: isLoadingTable } = useDoc<RestaurantTable>(tableRef);

    // 2. Listen to the Active Order
    const orderRef = useMemoFirebase(() => (table?.currentOrderId) ? doc(firestore!, 'orders', table.currentOrderId) : null, [firestore, table?.currentOrderId]);
    const { data: activeOrder, isLoading: isLoadingOrder } = useDoc<Order>(orderRef);

    // 3. Fetch Menu Data
    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    useEffect(() => {
        getServices().then(data => setServices(data.filter(s => s.isActive)));
    }, []);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

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

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    const handleSendOrder = () => {
        if (!tableIdFromUrl || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrder) {
                result = await addToTableAccount(activeOrder.id, cart);
            } else {
                result = await openTableAccount(tableIdFromUrl, cart, `Cliente Mesa ${table?.number || ''}`, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ 
                    title: "¡Pedido Enviado!", 
                    description: "En un momento lo llevaremos a tu mesa.",
                });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!tableIdFromUrl) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-6">
                <div className="p-6 rounded-full bg-primary/10">
                    <MapPin className="h-12 w-12 text-primary" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter">Escanea el código QR de tu mesa</h1>
                <p className="text-muted-foreground max-w-xs">Para realizar un pedido, por favor utiliza el código QR disponible en tu ubicación.</p>
            </div>
        );
    }

    if (isLoadingTable) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 font-black uppercase text-xs tracking-widest animate-pulse">Conectando con tu mesa...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto bg-background text-foreground shadow-2xl relative overflow-hidden">
            {/* Header */}
            <header className="p-4 border-b bg-card/50 backdrop-blur-xl sticky top-0 z-30 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground p-2.5 rounded-2xl shadow-lg shadow-primary/20">
                            <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tighter leading-none">GO MOTEL</h1>
                            <p className="text-[10px] font-bold text-primary tracking-widest uppercase">Auto-Servicio Digital</p>
                        </div>
                    </div>
                    <div className="bg-card border-2 border-primary/20 px-4 py-2 rounded-2xl flex flex-col items-center shadow-sm">
                        <span className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-0.5">Tu Mesa</span>
                        <span className="text-xl font-black leading-none">{table?.number}</span>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="px-4 py-2 border-b bg-card/30 shrink-0 flex gap-2">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                        activeTab === 'menu' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    MENÚ
                </button>
                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all relative",
                        activeTab === 'account' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    MI CUENTA
                    {activeOrder && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent text-white text-[8px] flex items-center justify-center rounded-full animate-bounce">
                            !
                        </span>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' ? (
                    <div className="flex flex-col h-full">
                        {/* Search & Categories */}
                        <div className="p-4 bg-muted/5 space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar en el menú..." 
                                    className="pl-10 h-12 bg-card rounded-2xl border-none shadow-sm focus-visible:ring-primary"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                                        )}
                                    >
                                        TODOS
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Menu Items */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group bg-card rounded-3xl border border-border/50 overflow-hidden flex flex-col shadow-sm hover:shadow-xl transition-all active:scale-95"
                                        onClick={() => handleAddToCart(service)}
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <img src={service.imageUrl || 'https://placehold.co/400?text=Comida'} alt={service.name} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute top-2 right-2">
                                                <Badge className="font-black bg-background/90 text-primary shadow-sm backdrop-blur-sm">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-3 space-y-1">
                                            <h3 className="font-black text-xs uppercase leading-tight line-clamp-2">{service.name}</h3>
                                            <p className="text-[9px] text-muted-foreground font-bold uppercase">{service.category === 'Food' ? 'Cocina' : 'Bar'}</p>
                                        </div>
                                        <div className="p-2 pt-0 mt-auto">
                                            <Button variant="secondary" className="w-full h-8 rounded-xl font-black text-[9px] uppercase tracking-widest">
                                                AGREGAR <Plus className="ml-1 h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col h-full bg-muted/10">
                        {isLoadingOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 animate-pulse text-muted-foreground">
                                <Receipt className="h-16 w-16 mb-4 opacity-20" />
                                <p className="font-black uppercase text-xs tracking-widest">Cargando tu cuenta...</p>
                            </div>
                        ) : activeOrder ? (
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-6 pb-24">
                                    <div className="p-6 bg-primary rounded-3xl text-primary-foreground shadow-xl shadow-primary/20 relative overflow-hidden">
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">Total a Pagar</p>
                                            <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(activeOrder.total)}</h2>
                                            <div className="mt-4 flex items-center gap-2">
                                                <Badge variant="outline" className="border-white/30 text-white font-bold text-[9px] uppercase">
                                                    <Clock className="mr-1 h-2.5 w-2.5" /> Cuenta Abierta
                                                </Badge>
                                                <span className="text-[9px] font-bold uppercase opacity-60">Pedido #{activeOrder.id.slice(-5).toUpperCase()}</span>
                                            </div>
                                        </div>
                                        <Receipt className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10 rotate-12" />
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground ml-2">Detalle del Consumo</h3>
                                        <div className="bg-card rounded-3xl border shadow-sm divide-y">
                                            {activeOrder.items.map((item, idx) => (
                                                <div key={idx} className="p-4 flex justify-between items-center group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center font-black text-primary border">
                                                            {item.quantity}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-xs uppercase tracking-tight">{item.name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.price)} c/u</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-accent/10 border-2 border-accent/20 rounded-2xl flex items-start gap-4">
                                        <div className="bg-accent p-2 rounded-xl text-white shadow-lg"><Sparkles className="h-4 w-4" /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-accent tracking-widest mb-1">Nota del Establecimiento</p>
                                            <p className="text-xs font-bold leading-relaxed">Puedes seguir pidiendo del menú. Al finalizar tu estancia, el total se liquidará en recepción.</p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                                <div className="p-10 rounded-full bg-muted/50 mb-6 border-2 border-dashed border-muted-foreground/20">
                                    <ShoppingCart className="h-20 w-20 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-2">SIN CUENTA ACTIVA</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mb-8 font-medium">Realiza tu primer pedido desde la sección de Menú para iniciar tu consumo en esta mesa.</p>
                                <Button 
                                    onClick={() => setActiveTab('menu')}
                                    className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
                                >
                                    VER EL MENÚ AHORA
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Float Cart (Visible when activeTab is menu and cart has items) */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
                    <div className="bg-primary p-4 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-primary/40 border-2 border-white/10 animate-in slide-in-from-bottom-10 duration-500">
                        <div className="flex items-center gap-4 ml-2">
                            <div className="relative">
                                <ShoppingCart className="h-6 w-6 text-primary-foreground" />
                                <span className="absolute -top-3 -right-3 h-6 w-6 bg-accent text-white font-black text-xs flex items-center justify-center rounded-full border-2 border-primary">
                                    {cart.reduce((s, i) => s + i.quantity, 0)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase text-white/60 leading-none">Total Pedido</span>
                                <span className="text-lg font-black text-white leading-none tracking-tight">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>
                        <Button 
                            onClick={handleSendOrder}
                            disabled={isPending}
                            className="bg-white text-primary hover:bg-white/90 rounded-3xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-2 shadow-inner"
                        >
                            {isPending ? "ENVIANDO..." : "ENVIAR PEDIDO"} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}