'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, ProductCategory, ProductSubCategory, Order, Tax } from '@/types';
import { openTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft, ImageIcon, 
    Utensils, Beer, Sun, MapPin, CheckCircle, Package,
    Layers, Filter, ArrowRight, Store
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

type CartItem = {
  service: Service;
  quantity: number;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const getTypeIcon = (type: string) => {
    if (type === 'Table') return Utensils;
    if (type === 'Bar') return Beer;
    if (type === 'Terraza') return Sun;
    return MapPin;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI State
    const [step, setStep] = useState(1); // 1: Location, 2: Menu, 3: Success
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Menu State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Firestore Queries
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), where('status', '==', 'Available'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: availableTables, isLoading: isLoadingTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
        [firestore]
    );
    const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    // Filtered Data
    const locationTypes = useMemo(() => {
        if (!availableTables) return [];
        return Array.from(new Set(availableTables.map(t => t.type))).sort();
    }, [availableTables]);

    const filteredTables = useMemo(() => {
        if (!availableTables) return [];
        return availableTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [availableTables, typeFilter]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const total = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    // Handlers
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
            const result = await openTableAccount(selectedTable.id, cart, 'Auto-Pedido Móvil');
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                setStep(3);
                setCart([]);
            }
        });
    };

    if (step === 3) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="bg-primary/10 p-6 rounded-full mb-6">
                    <CheckCircle className="h-20 w-20 text-primary" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">¡Pedido Enviado!</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-8">
                    Tu orden para la <strong>{TYPE_LABELS[selectedTable?.type || ''] || 'Ubicación'} {selectedTable?.number}</strong> está siendo preparada. ¡Gracias!
                </p>
                <Button size="lg" className="w-full max-w-xs font-bold rounded-2xl h-14 shadow-lg" onClick={() => { setStep(1); setSelectedTable(null); }}>
                    Realizar otro pedido
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background max-w-md mx-auto relative shadow-2xl min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black uppercase tracking-tighter">Auto-Pedido</h1>
                    {selectedTable && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">
                            <MapPin className="h-3 w-3" /> {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </div>
                    )}
                </div>
                {step === 2 && (
                    <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                        Cambiar Mesa
                    </button>
                )}
            </div>

            {/* Step 1: Location Selection */}
            {step === 1 && (
                <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-2 mb-8">
                        <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-2">
                            <Store className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">¿Dónde te encuentras?</h2>
                        <p className="text-xs text-muted-foreground font-medium">Selecciona tu punto de servicio disponible.</p>
                    </div>

                    {/* Filter Bar */}
                    <ScrollArea className="w-full whitespace-nowrap mb-6">
                        <div className="flex gap-2 pb-2">
                            <button 
                                onClick={() => setTypeFilter('all')}
                                className={cn(
                                    "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                    typeFilter === 'all' ? "bg-primary border-primary text-primary-foreground shadow-lg" : "bg-muted/50 border-transparent text-muted-foreground"
                                )}
                            >
                                Todos
                            </button>
                            {locationTypes.map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={cn(
                                        "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                        typeFilter === type ? "bg-primary border-primary text-primary-foreground shadow-lg" : "bg-muted/50 border-transparent text-muted-foreground"
                                    )}
                                >
                                    {TYPE_LABELS[type] || type}
                                </button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    <ScrollArea className="flex-1 -mx-2">
                        <div className="grid grid-cols-2 gap-4 p-2">
                            {isLoadingTables ? (
                                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)
                            ) : filteredTables.length > 0 ? (
                                filteredTables.map(table => {
                                    const Icon = getTypeIcon(table.type);
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => { setSelectedTable(table); setStep(2); }}
                                            className="group flex flex-col items-center justify-center p-6 bg-card border-2 rounded-3xl hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 text-center"
                                        >
                                            <div className="p-3 bg-muted rounded-2xl group-hover:bg-primary/10 transition-colors mb-3">
                                                <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <span className="text-3xl font-black tracking-tighter mb-1">{table.number}</span>
                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">{TYPE_LABELS[table.type] || table.type}</span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-20 text-center space-y-4">
                                    <MapPin className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No hay puntos disponibles</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* Step 2: Menu and Cart */}
            {step === 2 && (
                <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500 overflow-hidden">
                    <div className="p-4 space-y-4 bg-muted/10 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="¿Qué se te antoja?" 
                                className="pl-9 h-12 bg-background rounded-2xl border-2 shadow-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap">
                            <div className="flex gap-2 pb-2">
                                <button 
                                    className={cn(
                                        "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todo
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
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

                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                            {isLoadingServices ? (
                                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
                            ) : filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleAddToCart(service)}
                                    className="flex flex-col bg-card border rounded-3xl overflow-hidden hover:shadow-lg transition-all active:scale-95 text-left"
                                >
                                    <div className="aspect-square relative bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="font-black bg-background/90 text-primary border-none shadow-sm backdrop-blur-md">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                        {getCartQuantity(service.id) > 0 && (
                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                <div className="bg-primary text-primary-foreground h-10 w-10 rounded-full flex items-center justify-center font-black text-lg shadow-xl ring-4 ring-background/20">
                                                    {getCartQuantity(service.id)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight">
                                            {service.name}
                                        </h3>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Floating Cart Button */}
                    {cart.length > 0 && (
                        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-40">
                            <Button 
                                className="w-full h-16 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-between px-8"
                                onClick={handleSendOrder}
                                disabled={isPending}
                            >
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[10px] opacity-70 mb-1">Confirmar Pedido</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/20 px-3 py-1.5 rounded-lg text-[10px]">
                                        {cart.reduce((s, i) => s + i.quantity, 0)} items
                                    </span>
                                    {isPending ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                                </div>
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    function getCartQuantity(serviceId: string) {
        return cart.find(i => i.service.id === serviceId)?.quantity || 0;
    }
}
