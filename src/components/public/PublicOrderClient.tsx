
'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, ProductCategory, ProductSubCategory, Order, Tax, AppliedTax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingBag, Plus, Minus, 
    ChevronRight, ChevronLeft, ImageIcon, 
    Utensils, Beer, Sun, MapPin, CheckCircle2, Clock,
    ShoppingCart, X, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import AppLogo from '../AppLogo';

type CartItem = {
  service: Service;
  quantity: number;
};

const TYPE_ICONS: Record<string, any> = {
    'Table': Utensils,
    'Bar': Beer,
    'Terraza': Sun,
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // App State
    const [step, setStep] = useState(1); // 1: Location, 2: Menu, 3: Cart/Review, 4: Success
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), where('status', '==', 'Available'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: availableTables } = useCollection<RestaurantTable>(tablesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Pendiente')) : null, 
        [firestore]
    );
    const { data: activeOrders } = useCollection<Order>(activeOrdersQuery);

    const locationTypes = useMemo(() => {
        if (!availableTables) return [];
        return Array.from(new Set(availableTables.map(t => t.type)));
    }, [availableTables]);

    const filteredTables = useMemo(() => {
        if (!availableTables) return [];
        if (locationFilter === 'all') return availableTables;
        return availableTables.filter(t => t.type === locationFilter);
    }, [availableTables, locationFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);
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
        toast({ title: "Agregado", description: `${service.name} al carrito.` });
    };

    const handleUpdateQuantity = (serviceId: string, delta: number) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.service.id !== serviceId);
            
            // Stock validation for purchased items
            if (delta > 0 && item.service.source !== 'Internal' && newQty > (item.service.stock || 0)) {
                return prev;
            }

            return prev.map(i => i.service.id === serviceId ? { ...i, quantity: newQty } : i);
        });
    };

    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            // Check if there's already an order for this table (though we filtered by Available, things happen)
            const existingOrder = activeOrders?.find(o => o.locationId === selectedTable.id);
            let result;

            if (existingOrder) {
                result = await addToTableAccount(existingOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil ${selectedTable.number}`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                setStep(4);
                setCart([]);
            }
        });
    };

    // Render Logic
    if (step === 4) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 text-primary">¡Pedido Recibido!</h1>
                <p className="text-muted-foreground mb-8 font-medium">Estamos preparando su orden para enviarla a la {TYPE_LABELS[selectedTable?.type || ''] || 'Mesa'} {selectedTable?.number}.</p>
                <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs" onClick={() => { setStep(2); setSelectedTable(null); setSelectedTable(null); }}>
                    Hacer otro pedido
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background relative overflow-hidden">
            
            {/* Header */}
            <header className="px-6 pt-8 pb-4 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-xl">
                            <AppLogo className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-black uppercase tracking-tighter">Go Motel <span className="text-primary font-bold">Menu</span></h1>
                    </div>
                    {step > 1 && (
                        <button 
                            onClick={() => {
                                if (step === 3) setStep(2);
                                else if (step === 2) { setStep(1); setSelectedTable(null); }
                            }}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {selectedTable && step >= 2 && (
                    <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/10 rounded-xl animate-in slide-in-from-top-2 duration-300">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                            Ubicación: {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </span>
                    </div>
                )}
            </header>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
                
                {/* Step 1: Location Selection */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-500">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">¿Dónde se encuentra?</h2>
                            <p className="text-sm text-muted-foreground font-medium">Seleccione su ubicación para iniciar su pedido.</p>
                        </div>

                        {/* Location Type Chips (WRAP) */}
                        <div className="flex flex-wrap gap-2 mb-8">
                            <button 
                                onClick={() => setLocationFilter('all')}
                                className={cn(
                                    "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                                    locationFilter === 'all' ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                                )}
                            >
                                Todas
                            </button>
                            {locationTypes.map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setLocationFilter(type)}
                                    className={cn(
                                        "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                                        locationFilter === type ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                                    )}
                                >
                                    {getLocationLabel(type)}
                                </button>
                            ))}
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            <div className="grid grid-cols-2 gap-4 pb-10">
                                {filteredTables.map(table => {
                                    const Icon = TYPE_ICONS[table.type] || MapPin;
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => { setSelectedTable(table); setStep(2); }}
                                            className="group flex flex-col items-center justify-center aspect-square rounded-3xl border-2 border-border bg-card hover:border-primary hover:shadow-xl transition-all active:scale-95"
                                        >
                                            <Icon className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                                            <span className="text-4xl font-black tracking-tighter group-hover:text-primary transition-colors">{table.number}</span>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">
                                                {TYPE_LABELS[table.type] || table.type}
                                            </span>
                                        </button>
                                    );
                                })}
                                {filteredTables.length === 0 && (
                                    <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4 text-muted-foreground/40">
                                        <AlertCircle className="w-12 h-12" />
                                        <p className="text-xs font-black uppercase tracking-widest">No hay puntos disponibles</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Step 2: Menu / Product Selection */}
                {step === 2 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="px-6 mb-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida, bebidas..." 
                                    className="pl-10 h-12 bg-muted/30 border-none rounded-2xl text-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Category Chips (WRAP) */}
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                        selectedCategoryId === null ? "bg-primary text-white border-primary shadow-md" : "bg-background border-border text-muted-foreground"
                                    )}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                            selectedCategoryId === cat.id ? "bg-primary text-white border-primary shadow-md" : "bg-background border-border text-muted-foreground"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 px-6 pb-32">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        disabled={service.source !== 'Internal' && service.stock <= 0}
                                        className="group flex flex-col bg-card border rounded-3xl overflow-hidden hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 right-2">
                                                <Badge className="font-black bg-white/90 text-primary border-none shadow-sm backdrop-blur-sm">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-3 text-left">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight min-h-[2.4rem]">
                                                {service.name}
                                            </h3>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className={cn(
                                                    "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                                    service.source === 'Internal' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                )}>
                                                    {service.source === 'Internal' ? 'Cocina' : 'Comprado'}
                                                </span>
                                                <div className="bg-primary/10 p-1.5 rounded-full">
                                                    <Plus className="w-3 h-3 text-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Step 3: Cart Review */}
                {step === 3 && (
                    <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Su Pedido</h2>
                            <p className="text-sm text-muted-foreground font-medium">Revise los artículos antes de enviar a cocina.</p>
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            <div className="space-y-4 pb-10">
                                {cart.map(item => (
                                    <div key={item.service.id} className="flex items-center gap-4 p-4 rounded-3xl border bg-card shadow-sm">
                                        <Avatar className="h-16 w-16 rounded-2xl border">
                                            <AvatarImage src={item.service.imageUrl || undefined} alt={item.service.name} className="object-cover" />
                                            <AvatarFallback className="bg-muted rounded-2xl"><ImageIcon className="w-6 h-6 text-muted-foreground/30" /></AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-[11px] uppercase truncate tracking-tight">{item.service.name}</h4>
                                            <p className="text-xs font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                            
                                            <div className="mt-3 flex items-center gap-3">
                                                <div className="flex items-center bg-muted/50 rounded-full p-1 border">
                                                    <button onClick={() => handleUpdateQuantity(item.service.id, -1)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white transition-colors">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                                                    <button 
                                                        onClick={() => handleUpdateQuantity(item.service.id, 1)} 
                                                        className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                                                        disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-sm">{formatCurrency(item.service.price * item.quantity)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="pt-6 space-y-4 border-t bg-background">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(cartTotal)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-black tracking-tighter">
                                    <span>Total Estimado</span>
                                    <span className="text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-relaxed text-center italic mt-4">
                                    * Los impuestos y cargos de servicio se aplicarán al momento del cierre de cuenta.
                                </p>
                            </div>
                            <Button 
                                className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                                onClick={handleConfirmOrder}
                                disabled={isPending || cart.length === 0}
                            >
                                {isPending ? "Procesando..." : "Confirmar y Enviar Pedido"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Floating Bar (for Step 2) */}
            {step === 2 && cart.length > 0 && (
                <div className="fixed bottom-6 inset-x-6 z-50 animate-in slide-in-from-bottom-8 duration-500">
                    <button 
                        onClick={() => setStep(3)}
                        className="w-full h-16 bg-primary text-primary-foreground rounded-2xl shadow-2xl flex items-center justify-between px-6 transition-transform active:scale-95 group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 h-10 w-10 flex items-center justify-center rounded-xl font-black text-sm">
                                {cart.reduce((s, i) => s + i.quantity, 0)}
                            </div>
                            <div className="flex flex-col items-start leading-none gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Revisar pedido</span>
                                <span className="text-lg font-black tracking-tighter">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>
                        <div className="bg-white/20 p-2 rounded-lg group-hover:translate-x-1 transition-transform">
                            <ChevronRight className="w-5 h-5" />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}

function getLocationLabel(type: string) {
    if (type === 'Table') return 'Mesas';
    if (type === 'Bar') return 'Barra';
    if (type === 'Terraza') return 'Terraza';
    return type;
}
