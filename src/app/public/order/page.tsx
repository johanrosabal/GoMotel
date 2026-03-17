
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { RestaurantTable, Service, Order, ProductCategory, ProductSubCategory, Tax } from '@/types';
import { getServices } from '@/lib/actions/service.actions';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    ShoppingCart, Plus, Minus, Utensils, Beer, 
    Clock, CheckCircle, Smartphone, Info, Receipt, 
    ArrowRight, Loader2, PackageOpen
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import AppLogo from '@/components/AppLogo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type CartItem = {
    service: Service;
    quantity: number;
};

export default function PublicOrderPage() {
    const searchParams = useSearchParams();
    const tableId = searchParams.get('tableId');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    const [activeTab, setActiveTab] = useState('menu');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // 1. Listen to Table State
    const tableRef = useMemoFirebase(() => tableId ? doc(firestore!, 'restaurantTables', tableId) : null, [firestore, tableId]);
    const { data: table, isLoading: isLoadingTable } = useDoc<RestaurantTable>(tableRef);

    // 2. Listen to Active Order (Real-time account)
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!table?.currentOrderId || !firestore) {
            setCurrentOrder(null);
            return;
        }
        const unsub = onSnapshot(doc(firestore, 'orders', table.currentOrderId), (snap) => {
            if (snap.exists()) {
                setCurrentOrder({ id: snap.id, ...snap.data() } as Order);
            } else {
                setCurrentOrder(null);
            }
        });
        return () => unsub();
    }, [table?.currentOrderId, firestore]);

    // 3. Data Fetching
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    // 4. Calculations
    const filteredServices = useMemo(() => {
        return availableServices.filter(s => s.isActive && (!selectedCategoryId || s.categoryId === selectedCategoryId));
    }, [availableServices, selectedCategoryId]);

    const { cartSubtotal, cartTax, cartTotal, cartTaxesList } = useMemo(() => {
        const sub = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
        let taxTotal = 0;
        const taxMap = new Map<string, { name: string; amount: number }>();

        if (allTaxes) {
            const serviceTax = allTaxes.find(t => t.name.toLowerCase().includes('servicio') || t.name.toLowerCase().includes('service'));
            
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                const taxIds = new Set(item.service.taxIds || []);
                if (serviceTax) taxIds.add(serviceTax.id);

                taxIds.forEach(id => {
                    const taxInfo = allTaxes.find(t => t.id === id);
                    if (taxInfo) {
                        const amount = itemTotal * (taxInfo.percentage / 100);
                        taxTotal += amount;
                        const existing = taxMap.get(id);
                        if (existing) existing.amount += amount;
                        else taxMap.set(id, { name: taxInfo.name, amount });
                    }
                });
            });
        }
        return { 
            cartSubtotal: sub, 
            cartTax: taxTotal, 
            cartTotal: sub + taxTotal,
            cartTaxesList: Array.from(taxMap.values())
        };
    }, [cart, allTaxes]);

    // Account Totals (Current Order + Cart)
    const totalToPay = (currentOrder?.total || 0) + cartTotal;

    // 5. Handlers
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
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
        if (!tableId || cart.length === 0) return;
        startTransition(async () => {
            let result;
            if (table?.currentOrderId) {
                result = await addToTableAccount(table.currentOrderId, cart);
            } else {
                result = await openTableAccount(tableId, cart, undefined, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'En breve te llevaremos tus productos.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (isLoadingTable) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="font-black uppercase tracking-widest animate-pulse">Conectando con tu mesa...</p>
            </div>
        );
    }

    if (!table) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <PackageOpen className="h-20 w-20 text-muted-foreground mb-6 opacity-20" />
                <h1 className="text-2xl font-black uppercase mb-2">Mesa no encontrada</h1>
                <p className="text-muted-foreground max-w-xs">Por favor, solicita ayuda al personal o intenta escanear el código QR nuevamente.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-slate-100 font-sans selection:bg-primary/30">
            {/* Header Responsivo */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-black text-sm sm:text-xl tracking-tighter leading-none uppercase">Go Motel</h1>
                        <p className="text-[8px] sm:text-[10px] font-bold text-primary tracking-[0.2em] uppercase mt-1 opacity-80">Auto-Servicio Digital</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right hidden xs:block">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tu Mesa</p>
                        <p className="text-xl sm:text-2xl font-black text-white leading-none">{table.number}</p>
                    </div>
                    <div className="xs:hidden bg-white/5 rounded-lg px-3 py-1 text-center">
                         <p className="text-[10px] font-black text-primary uppercase">Mesa</p>
                         <p className="text-lg font-black leading-none">{table.number}</p>
                    </div>
                </div>
            </header>

            <main className="container max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-14 sm:h-16 p-1 bg-white/5 rounded-2xl border border-white/10">
                        <TabsTrigger value="menu" className="rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">Menú</TabsTrigger>
                        <TabsTrigger value="account" className="rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl transition-all relative">
                            Mi Cuenta
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-red-500 text-[10px] font-black rounded-full ring-4 ring-[#050505] animate-bounce">
                                    {cart.reduce((s, i) => s + i.quantity, 0)}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="menu" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Categorías */}
                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                            <div className="flex gap-2 sm:gap-3">
                                <button 
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={cn(
                                        "px-5 sm:px-6 h-10 sm:h-12 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest border transition-all",
                                        selectedCategoryId === null ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                    )}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            "px-5 sm:px-6 h-10 sm:h-12 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest border transition-all",
                                            selectedCategoryId === cat.id ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>

                        {/* Productos Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                            {filteredServices.map(service => (
                                <div key={service.id} className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-xl flex flex-col">
                                    <div className="aspect-square relative overflow-hidden">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-700" />
                                            <AvatarFallback className="rounded-none bg-white/5 flex items-center justify-center">
                                                <Beer className="h-10 w-10 text-white/10" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/60 backdrop-blur-md px-2 sm:px-3 py-1 rounded-full border border-white/10">
                                            <span className="text-[10px] sm:text-xs font-black text-primary">{formatCurrency(service.price)}</span>
                                        </div>
                                    </div>
                                    <div className="p-3 sm:p-5 flex flex-col flex-1">
                                        <h3 className="font-black text-xs sm:text-sm uppercase tracking-tight mb-3 sm:mb-4 line-clamp-2 h-8 sm:h-10 leading-tight">
                                            {service.name}
                                        </h3>
                                        <div className="mt-auto">
                                            {getCartQuantity(service.id, cart) > 0 ? (
                                                <div className="flex items-center justify-between bg-black/40 rounded-2xl p-1 sm:p-1.5 border border-white/10">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-white/10" onClick={() => handleRemoveFromCart(service.id)}>
                                                        <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                    <span className="font-black text-sm sm:text-base tabular-nums">{getCartQuantity(service.id, cart)}</span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-white/10" onClick={() => handleAddToCart(service)}>
                                                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button 
                                                    className="w-full h-10 sm:h-12 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest bg-white/5 hover:bg-primary hover:text-white transition-all border border-white/10 hover:border-primary shadow-inner"
                                                    onClick={() => handleAddToCart(service)}
                                                >
                                                    Agregar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="account" className="mt-6 sm:mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 sm:pb-32">
                        {/* Account Banner Responsivo */}
                        <div className="bg-primary rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl shadow-primary/30 relative overflow-hidden mb-8 sm:mb-12">
                            <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10 rotate-12">
                                <Receipt className="h-32 w-32 sm:h-48 sm:w-48 text-white" />
                            </div>
                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                <div className="space-y-1 sm:space-y-2">
                                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-white/70">Total a Pagar</p>
                                    <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-white drop-shadow-2xl">
                                        {formatCurrency(totalToPay)}
                                    </h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-white/20 text-white border-white/20 px-3 sm:px-4 py-1.5 font-black uppercase text-[9px] sm:text-[10px] tracking-widest backdrop-blur-md">
                                        Cuenta Abierta
                                    </Badge>
                                    {currentOrder && (
                                        <Badge variant="outline" className="text-white/60 border-white/10 font-bold text-[9px] sm:text-[10px] uppercase">
                                            Pedido #{currentOrder.id.slice(-5).toUpperCase()}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* List Detail Responsivo */}
                        <div className="space-y-6 sm:space-y-8">
                            <div className="flex items-center gap-4 px-2 sm:px-4">
                                <h3 className="font-black text-xs sm:text-sm uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Detalle del Consumo</h3>
                                <div className="h-px w-full bg-white/5" />
                            </div>

                            <div className="space-y-3 sm:space-y-4">
                                {/* Existente en Cuenta */}
                                {currentOrder?.items.map((item, idx) => (
                                    <div key={`existing-${idx}`} className="flex items-center justify-between p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl group transition-all">
                                        <div className="flex items-center gap-4 sm:gap-6">
                                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary">
                                                {item.quantity}
                                            </div>
                                            <div>
                                                <p className="font-black text-xs sm:text-base uppercase tracking-tight leading-tight">{item.name}</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground font-bold mt-1 opacity-60">@{formatCurrency(item.price)} c/u</p>
                                            </div>
                                        </div>
                                        <p className="font-black text-sm sm:text-lg tabular-nums text-white/90">{formatCurrency(item.price * item.quantity)}</p>
                                    </div>
                                ))}

                                {/* Por pedir (Carrito) */}
                                {cart.map((item, idx) => (
                                    <div key={`new-${idx}`} className="flex items-center justify-between p-4 sm:p-6 bg-primary/[0.03] border border-primary/20 rounded-2xl sm:rounded-3xl animate-pulse">
                                        <div className="flex items-center gap-4 sm:gap-6">
                                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm sm:text-base shadow-lg">
                                                {item.quantity}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-xs sm:text-base uppercase tracking-tight text-primary">NUEVO: {item.service.name}</p>
                                                </div>
                                                <p className="text-[10px] sm:text-xs text-primary/60 font-bold mt-1">Por confirmar envío</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <p className="font-black text-sm sm:text-lg text-primary">{formatCurrency(item.service.price * item.quantity)}</p>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {cart.length === 0 && (!currentOrder || currentOrder.items.length === 0) && (
                                    <div className="py-16 sm:py-20 text-center space-y-4">
                                        <div className="h-20 w-20 sm:h-24 sm:w-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <PackageOpen className="h-10 w-10 sm:h-12 sm:w-12 text-white/10" />
                                        </div>
                                        <p className="font-black text-sm sm:text-base uppercase tracking-widest text-muted-foreground/40">Tu cuenta está vacía</p>
                                        <Button variant="link" className="text-primary font-bold" onClick={() => setActiveTab('menu')}>Ir al Menú <ArrowRight className="ml-2 h-4 w-4" /></Button>
                                    </div>
                                )}
                            </div>

                            {/* Resumen de Cuenta Responsivo */}
                            {(currentOrder || cart.length > 0) && (
                                <div className="mt-10 sm:mt-12 p-6 sm:p-10 border-t border-white/5 space-y-4 sm:space-y-6">
                                    <div className="space-y-2 sm:space-y-3">
                                        <div className="flex justify-between items-center text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                                            <span>Subtotal Neto</span>
                                            <span className="tabular-nums">{formatCurrency((currentOrder?.subtotal || 0) + cartSubtotal)}</span>
                                        </div>
                                        
                                        {/* Desglose de Impuestos */}
                                        {Array.from(new Set([...(currentOrder?.taxes?.map(t => t.name) || []), ...cartTaxesList.map(t => t.name)])).map(taxName => {
                                            const existingTax = currentOrder?.taxes?.find(t => t.name === taxName)?.amount || 0;
                                            const newTax = cartTaxesList.find(t => t.name === taxName)?.amount || 0;
                                            const percentage = currentOrder?.taxes?.find(t => t.name === taxName)?.percentage || cartTaxesList.find(t => t.name === taxName)?.percentage || '';
                                            return (
                                                <div key={taxName} className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
                                                    <span>{taxName} {percentage ? `(${percentage}%)` : ''}</span>
                                                    <span className="tabular-nums">{formatCurrency(existingTax + newTax)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="pt-6 sm:pt-8 border-t border-primary/20 flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-primary">Total Final</span>
                                        <span className="text-3xl sm:text-5xl font-black tracking-tighter text-white">{formatCurrency(totalToPay)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Barra de Acción Inferior Responsiva */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-[60] animate-in slide-in-from-bottom-full duration-500">
                    <div className="container max-w-4xl mx-auto">
                        <Button 
                            className="w-full h-16 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 flex items-center justify-between px-6 sm:px-10 group transition-all active:scale-95"
                            onClick={handleSendOrder}
                            disabled={isPending}
                        >
                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-xs sm:text-sm uppercase tracking-widest leading-none">Confirmar Pedido</p>
                                    <p className="text-[10px] sm:text-xs font-bold text-white/60 mt-1 uppercase">{cart.length} productos listos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-4">
                                <span className="font-black text-lg sm:text-2xl tabular-nums">{formatCurrency(cartTotal)}</span>
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                    {isPending ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />}
                                </div>
                            </div>
                        </Button>
                    </div>
                </div>
            )}

            {/* Footer Informativo Responsivo */}
            <footer className="mt-12 sm:mt-20 pb-24 sm:pb-32 px-4 sm:px-6">
                <div className="container max-w-4xl mx-auto">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex items-start sm:items-center gap-4 sm:gap-6">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <Info className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-500">Nota del Establecimiento</p>
                            <p className="text-xs sm:text-sm font-medium text-emerald-500/70 leading-relaxed">
                                Puedes seguir pidiendo del menú. Al finalizar tu estancia, el total se liquidará en recepción.
                            </p>
                        </div>
                    </div>
                    <div className="mt-8 sm:mt-12 text-center space-y-4 opacity-20">
                        <AppLogo className="h-6 w-6 sm:h-8 sm:w-8 mx-auto grayscale invert" />
                        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em]">Go Motel Manager &copy; 2024</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function getCartQuantity(id: string, cart: CartItem[]) {
    return cart.find(i => i.service.id === id)?.quantity || 0;
}
