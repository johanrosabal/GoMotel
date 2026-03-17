
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { RestaurantTable, Order, Service, ProductCategory, ProductSubCategory, Tax } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    ShoppingCart, Utensils, Beer, Package, 
    Plus, Minus, CheckCircle, 
    Clock, MessageSquare, Info, 
    ArrowRight, Smartphone, MapPin, X,
    ReceiptText, GlassWater, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { motion, AnimatePresence } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

type CartItem = {
    service: Service;
    quantity: number;
    notes?: string;
};

export default function PublicOrderPage() {
    const searchParams = useSearchParams();
    const tableId = searchParams.get('tableId');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);

    // 1. Get Table Data
    const tableRef = useMemoFirebase(() => tableId ? doc(firestore!, 'restaurantTables', tableId) : null, [firestore, tableId]);
    const { data: table, isLoading: isLoadingTable } = useDoc<RestaurantTable>(tableRef);

    // 2. Get Active Order for this table
    const orderRef = useMemoFirebase(() => (firestore && table?.currentOrderId) ? doc(firestore, 'orders', table.currentOrderId) : null, [firestore, table?.currentOrderId]);
    const { data: activeOrder, isLoading: isLoadingOrder } = useDoc<Order>(orderRef);

    // 3. Get Catalog Data
    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Producto añadido", description: `${service.name} se agregó al carrito.` });
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
        if (!tableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrder) {
                result = await addToTableAccount(activeOrder.id, cart);
            } else {
                result = await openTableAccount(tableId, cart, `Cliente Móvil`, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está siendo preparada." });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (isLoadingTable || !table) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 text-center">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                    <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Cargando su mesa...</p>
                </div>
            </div>
        );
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-primary/30">
            {/* Header */}
            <header className="p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <Utensils className="text-white h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="font-black text-xl tracking-tighter uppercase leading-none">Go Motel</h1>
                        <p className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase mt-1">Auto-Servicio Digital</p>
                    </div>
                </div>
                <div className="text-right bg-white/5 p-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Tu Mesa</p>
                    <p className="text-2xl font-black text-white leading-none tracking-tighter">{table.number}</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="px-6 py-4 flex gap-2 shrink-0">
                <button 
                    className={cn(
                        "flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border-2",
                        activeTab === 'menu' 
                            ? "bg-transparent border-white text-white" 
                            : "bg-transparent border-transparent text-muted-foreground"
                    )}
                    onClick={() => setActiveTab('menu')}
                >
                    Menú
                </button>
                <button 
                    className={cn(
                        "flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border-2 relative",
                        activeTab === 'account' 
                            ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" 
                            : "bg-transparent border-transparent text-muted-foreground"
                    )}
                    onClick={() => setActiveTab('account')}
                >
                    Mi Cuenta
                    {activeOrder && activeOrder.items.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
                    )}
                </button>
            </div>

            <main className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'menu' ? (
                        <motion.div 
                            key="menu"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full flex flex-col"
                        >
                            {/* Categories */}
                            <div className="px-6 mb-4 shrink-0">
                                <ScrollArea className="w-full whitespace-nowrap">
                                    <div className="flex gap-2 pb-2">
                                        <button 
                                            className={cn(
                                                "h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === null ? "bg-white text-black" : "bg-white/5 text-muted-foreground border border-white/5"
                                            )}
                                            onClick={() => setSelectedCategoryId(null)}
                                        >
                                            Todos
                                        </button>
                                        {categories?.map(cat => (
                                            <button 
                                                key={cat.id}
                                                className={cn(
                                                    "h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                    selectedCategoryId === cat.id ? "bg-white text-black" : "bg-white/5 text-muted-foreground border border-white/5"
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

                            {/* Services Grid */}
                            <ScrollArea className="flex-1 px-6">
                                <div className="grid grid-cols-1 gap-4 pb-32">
                                    {filteredServices.map(service => (
                                        <div 
                                            key={service.id}
                                            className="group bg-white/[0.03] border border-white/5 rounded-[2rem] p-4 flex items-center gap-4 transition-all active:scale-[0.98] active:bg-white/[0.05]"
                                        >
                                            <div className="h-24 w-24 rounded-3xl bg-white/5 overflow-hidden flex-shrink-0 border border-white/10 relative">
                                                {service.imageUrl ? (
                                                    <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-white/10">
                                                        <Package className="h-8 w-8" />
                                                    </div>
                                                )}
                                                <div className="absolute top-1.5 right-1.5">
                                                    {service.source === 'Internal' ? (
                                                        <Badge className="bg-orange-500/20 text-orange-400 border-none text-[8px] font-black px-1.5 h-4">COCINA</Badge>
                                                    ) : (
                                                        <Badge className="bg-blue-500/20 text-blue-400 border-none text-[8px] font-black px-1.5 h-4">BAR</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-sm uppercase tracking-tight truncate mb-1">{service.name}</h3>
                                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2 opacity-60">{service.description || "Producto seleccionado para su disfrute."}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-black tracking-tighter text-primary">{formatCurrency(service.price)}</span>
                                                    <Button 
                                                        size="sm" 
                                                        className="rounded-xl h-9 px-4 font-black text-[10px] uppercase tracking-widest bg-white text-black hover:bg-white/90"
                                                        onClick={() => handleAddToCart(service)}
                                                    >
                                                        Pedir <Plus className="ml-1 h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="account"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full flex flex-col px-6"
                        >
                            {activeOrder ? (
                                <div className="space-y-8 pb-32">
                                    {/* Summary Card */}
                                    <div className="bg-primary rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl shadow-primary/20">
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">Total a Pagar</p>
                                            <h2 className="text-5xl font-black tracking-tighter text-white mb-6">
                                                {formatCurrency(activeOrder.total)}
                                            </h2>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-widest px-3 h-7">
                                                    <Clock className="mr-1.5 h-3 w-3" /> Cuenta Abierta
                                                </Badge>
                                                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Pedido #{activeOrder.id.slice(-5).toUpperCase()}</span>
                                            </div>
                                        </div>
                                        <ReceiptText className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5 -rotate-12" />
                                    </div>

                                    {/* Items List */}
                                    <div className="space-y-6">
                                        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground px-2">Detalle del Consumo</h3>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] divide-y divide-white/5">
                                            {activeOrder.items.map((item, idx) => (
                                                <div key={idx} className="p-6 flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm">
                                                            {item.quantity}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-sm uppercase tracking-tight truncate max-w-[180px]">{item.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">{formatCurrency(item.price)} c/u</p>
                                                        </div>
                                                    </div>
                                                    <p className="font-black text-base tracking-tighter text-white">
                                                        {formatCurrency(item.price * item.quantity)}
                                                    </p>
                                                </div>
                                            ))}

                                            {/* BREAKDOWN SECTION: Subtotal & Taxes */}
                                            <div className="p-8 bg-white/[0.01] rounded-b-[2.5rem] space-y-3">
                                                <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-[0.1em]">
                                                    <span>Subtotal Neto</span>
                                                    <span>{formatCurrency(activeOrder.subtotal || activeOrder.total)}</span>
                                                </div>
                                                {activeOrder.taxes?.map((tax) => (
                                                    <div key={tax.taxId} className="flex justify-between items-center text-xs font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">
                                                        <span>{tax.name} ({tax.percentage}%)</span>
                                                        <span>{formatCurrency(tax.amount)}</span>
                                                    </div>
                                                ))}
                                                <Separator className="bg-white/5 my-2" />
                                                <div className="flex justify-between items-center pt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Total Final</span>
                                                    <span className="text-xl font-black tracking-tighter text-white">{formatCurrency(activeOrder.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Help Note */}
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2rem] flex gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Nota del Establecimiento</h4>
                                            <p className="text-xs text-emerald-500/70 font-bold leading-relaxed">Puedes seguir pidiendo del menú. Al finalizar tu estancia, el total se liquidará en recepción.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                                    <div className="h-24 w-24 rounded-[2.5rem] bg-white/5 flex items-center justify-center border border-white/10">
                                        <ReceiptText className="h-10 w-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-black text-lg uppercase tracking-widest">Cuenta Inactiva</h3>
                                        <p className="text-sm max-w-[240px] font-medium leading-relaxed">Aún no has realizado pedidos en esta mesa. Explora el menú para comenzar.</p>
                                    </div>
                                    <Button variant="outline" className="rounded-xl border-white/20 font-black text-[10px] uppercase tracking-[0.2em]" onClick={() => setActiveTab('menu')}>
                                        Ver Menú <ArrowRight className="ml-2 h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Cart Floating Panel */}
            <AnimatePresence>
                {cart.length > 0 && activeTab === 'menu' && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 p-6 z-[60]"
                    >
                        <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] p-2 flex items-center shadow-2xl shadow-black">
                            <button 
                                onClick={() => setCart([])}
                                className="h-14 w-14 rounded-[2rem] bg-black/5 flex items-center justify-center text-black/20 hover:text-red-500 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            
                            <div className="flex-1 px-6">
                                <p className="text-[9px] font-black uppercase tracking-widest text-black/40 leading-none mb-1">Tu Pedido</p>
                                <p className="text-lg font-black text-black leading-none tracking-tighter">
                                    {cart.length} {cart.length === 1 ? 'Producto' : 'Productos'}
                                    <span className="mx-2 text-black/10">|</span>
                                    <span className="text-primary">{formatCurrency(cartTotal)}</span>
                                </p>
                            </div>

                            <Button 
                                className="h-14 px-8 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20"
                                onClick={handleSendOrder}
                                disabled={isPending}
                            >
                                {isPending ? "Enviando..." : "Confirmar"}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #0a0a0a;
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
