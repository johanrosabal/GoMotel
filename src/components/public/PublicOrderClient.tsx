'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft, MapPin, 
    Utensils, Beer, Sun, CheckCircle2, ShoppingBag,
    ImageIcon, ArrowRight, X, Clock
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

type CartItem = {
  service: Service;
  quantity: number;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // App State
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Ubicación, 2: Menú, 3: Confirmación
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Data
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
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Pendiente')) : null, 
        [firestore]
    );
    const { data: activeOrders } = useCollection<any>(activeOrdersQuery);

    // Filter Logic
    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const totalCart = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    // Actions
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

    const handleSubmitOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            // Buscamos si ya hay una cuenta abierta para esta mesa
            const existingOrder = activeOrders?.find((o: any) => o.locationId === selectedTable.id);
            
            let result;
            if (existingOrder) {
                result = await addToTableAccount(existingOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil - ${selectedTable.number}`);
            }

            if (result.error) {
                toast({ title: 'Error al enviar pedido', description: result.error, variant: 'destructive' });
            } else {
                setStep(3);
                setCart([]);
            }
        });
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    const getTypeName = (type: string) => {
        if (type === 'Table') return 'Mesa';
        if (type === 'Bar') return 'Barra';
        return type;
    };

    // --- STEP 1: SELECT LOCATION ---
    if (step === 1) {
        return (
            <div className="flex flex-col min-h-screen p-6 animate-in fade-in duration-500">
                <div className="mb-8 text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Bienvenido</h1>
                    <p className="text-muted-foreground font-medium">Por favor, seleccione su ubicación para comenzar el pedido.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto w-full">
                    {allTables?.map(table => {
                        const Icon = getTypeIcon(table.type);
                        const isOccupied = activeOrders?.some((o: any) => o.locationId === table.id);
                        
                        return (
                            <button
                                key={table.id}
                                onClick={() => { setSelectedTable(table); setStep(2); }}
                                className={cn(
                                    "flex flex-col items-center justify-center aspect-square rounded-3xl border-2 transition-all p-4 relative group active:scale-95",
                                    isOccupied 
                                        ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/5" 
                                        : "bg-background border-border hover:border-primary/40"
                                )}
                            >
                                <div className="p-3 bg-muted rounded-2xl mb-3 group-hover:bg-primary/10 transition-colors">
                                    <Icon className="h-6 w-6 text-primary" />
                                </div>
                                <span className="font-black text-2xl tracking-tighter">{table.number}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                                    {getTypeName(table.type)}
                                </span>
                                {isOccupied && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <span className="text-[8px] font-black uppercase text-blue-600">En uso</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- STEP 2: BROWSE MENU ---
    if (step === 2) {
        return (
            <div className="flex flex-col h-screen bg-background overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                {/* Header Móvil */}
                <div className="shrink-0 p-4 border-b bg-background flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="rounded-full">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div className="leading-tight">
                            <h2 className="font-black text-sm uppercase tracking-tighter">{getTypeName(selectedTable!.type)} {selectedTable?.number}</h2>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Menú Digital</p>
                        </div>
                    </div>
                    {cart.length > 0 && (
                        <Badge className="h-8 px-3 rounded-full font-black animate-in zoom-in">
                            {cart.length} ITEMS
                        </Badge>
                    )}
                </div>

                {/* Search & Categories */}
                <div className="shrink-0 p-4 space-y-4 bg-muted/20">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar en el menú..." 
                            className="pl-9 h-11 bg-background border-none shadow-sm rounded-xl font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-2">
                            <button 
                                onClick={() => setSelectedCategoryId(null)}
                                className={cn(
                                    "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                    selectedCategoryId === null ? "bg-primary text-white shadow-md" : "bg-background text-muted-foreground border"
                                )}
                            >
                                Todo
                            </button>
                            {categories?.map(cat => (
                                <button 
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        selectedCategoryId === cat.id ? "bg-primary text-white shadow-md" : "bg-background text-muted-foreground border"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                {/* Product List */}
                <ScrollArea className="flex-1 px-4">
                    <div className="grid grid-cols-1 gap-3 py-4 pb-32">
                        {filteredServices.map(service => {
                            const qty = getCartQuantity(service.id, cart);
                            return (
                                <div key={service.id} className="bg-card border rounded-2xl p-3 flex gap-4 items-center shadow-sm relative overflow-hidden active:bg-muted/50 transition-colors">
                                    <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted shrink-0 relative">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="bg-transparent"><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <h3 className="font-black text-xs uppercase tracking-tight line-clamp-1">{service.name}</h3>
                                        <p className="text-primary font-black text-sm">{formatCurrency(service.price)}</p>
                                        <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{service.description || 'Delicioso producto del menú.'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1 border">
                                        {qty > 0 ? (
                                            <>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => handleRemoveFromCart(service.id)}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-4 text-center font-black text-xs">{qty}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => handleAddToCart(service)}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Button 
                                                variant="primary" 
                                                size="sm" 
                                                className="h-8 px-4 rounded-full font-black text-[9px] uppercase"
                                                onClick={() => handleAddToCart(service)}
                                            >
                                                Agregar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Floating Cart Button */}
                {cart.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
                        <Button 
                            className="w-full h-14 rounded-2xl shadow-2xl shadow-primary/20 font-black text-sm uppercase tracking-widest gap-3 pointer-events-auto animate-in slide-in-from-bottom-8 duration-500"
                            onClick={() => {
                                // Aquí podríamos abrir un modal de revisión antes de enviar
                                handleSubmitOrder();
                            }}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Clock className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <ShoppingCart className="h-5 w-5" />
                                    Confirmar Pedido ({formatCurrency(totalCart)})
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // --- STEP 3: SUCCESS ---
    if (step === 3) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">¡Pedido Recibido!</h1>
                <p className="text-muted-foreground font-medium mb-8">
                    Su pedido para la <span className="text-foreground font-bold">{getTypeName(selectedTable!.type)} {selectedTable?.number}</span> está siendo procesado por nuestro personal.
                </p>
                <div className="w-full max-w-sm p-6 bg-background border rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        <span>Estado</span>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">En preparación</Badge>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground italic">"En unos momentos recibirá sus productos. ¡Gracias por preferirnos!"</p>
                </div>
                <Button variant="outline" className="mt-10 h-12 rounded-xl font-bold px-8" onClick={() => setStep(2)}>
                    Realizar otro pedido
                </Button>
            </div>
        );
    }

    return null;
}

function getCartQuantity(serviceId: string, cart: CartItem[]) {
    return cart.find(i => i.service.id === serviceId)?.quantity || 0;
}
