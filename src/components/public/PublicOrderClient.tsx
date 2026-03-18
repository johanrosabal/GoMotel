
'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Utensils, Beer, ShoppingCart, Plus, Minus, CheckCircle, 
    Search, Trash2, Clock, MapPin, ChevronRight, X, User,
    LayoutGrid, History, Smartphone, ChevronDown
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

type CartItem = {
  service: Service;
  quantity: number;
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

    // UI States
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('menu');

    // Account Persistence
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // Queries
    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // 1. Recover Session from localStorage
    useEffect(() => {
        if (selectedTable) {
            const savedOrderId = localStorage.getItem(`active_order_${selectedTable.id}`);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            } else {
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        }
    }, [selectedTable]);

    // 2. Sync Active Order in Real-time
    useEffect(() => {
        if (!firestore || !activeOrderId) return;

        const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Order;
                if (data.paymentStatus === 'Pagado') {
                    // Account was paid by admin, clear local session
                    if (selectedTable) localStorage.removeItem(`active_order_${selectedTable.id}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                } else {
                    setActiveOrder({ id: snapshot.id, ...data });
                }
            } else {
                // Order deleted or not found
                if (selectedTable) localStorage.removeItem(`active_order_${selectedTable.id}`);
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        });

        return () => unsubscribe();
    }, [firestore, activeOrderId, selectedTable]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

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
            if (activeOrderId) {
                // Add to existing account
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                // Open new account
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando su solicitud.' });
                if (result.orderId) {
                    localStorage.setItem(`active_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

    const getPrepStatusBadge = (item: any) => {
        if (!activeOrder) return null;
        const status = item.category === 'Food' ? activeOrder.kitchenStatus : activeOrder.barStatus;
        
        return (
            <Badge variant="outline" className={cn(
                "text-[9px] font-black uppercase px-2 py-0 h-5",
                status === 'Pendiente' ? "text-amber-600 border-amber-200" :
                status === 'En preparación' ? "text-blue-600 border-blue-200 animate-pulse" :
                "text-green-600 border-green-200"
            )}>
                {status || 'En cola'}
            </Badge>
        );
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-4xl space-y-12"
                >
                    <div className="text-center space-y-4">
                        <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter leading-none drop-shadow-2xl italic">
                            BIEN<span className="text-primary">VENIDO</span>
                        </h1>
                        <p className="text-sm font-black uppercase tracking-[0.5em] text-primary/60">Seleccione su ubicación para ordenar</p>
                    </div>

                    <Tabs defaultValue={locationTypes[0]} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 bg-white/5 border border-white/10 h-14 rounded-2xl p-1 mb-8">
                            {locationTypes.map(type => (
                                <TabsTrigger key={type} value={type} className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary">
                                    {TYPE_LABELS[type] || type}s
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        
                        {locationTypes.map(type => (
                            <TabsContent key={type} value={type} className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {allTables?.filter(t => t.type === type).map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className="aspect-square rounded-2xl border-2 border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/10 transition-all group active:scale-95" id="publicorderclient-button-1"
                                        >
                                            <span className="text-xs font-black opacity-40 uppercase tracking-tighter group-hover:text-primary transition-colors">N°</span>
                                            <span className="text-4xl font-black leading-none">{table.number}</span>
                                        </button>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-muted/20 overflow-hidden font-sans">
            {/* Header Fijo */}
            <div className="bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
                <button onClick={() => setSelectedTable(null)} className="flex items-center gap-3" id="publicorderclient-button-2">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-muted-foreground leading-none tracking-widest">Mi Ubicación</p>
                        <p className="text-lg font-black uppercase tracking-tight text-primary">{TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}</p>
                    </div>
                </button>
                
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold uppercase text-[10px] tracking-widest gap-2" id="publicorderclient-button-categor-as">
                                <ChevronDown className="h-3 w-3" /> Categorías
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            <DropdownMenuItem onClick={() => setSelectedCategoryId(null)} className="font-bold">Todos los Productos</DropdownMenuItem>
                            <Separator className="my-1" />
                            {categories?.map(cat => (
                                <DropdownMenuItem key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className="font-medium">
                                    {cat.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Contenido con Pestañas */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="bg-background border-b px-4 shrink-0">
                    <TabsList className="w-full flex bg-transparent h-14 p-0 gap-8">
                        <TabsTrigger value="menu" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none font-black uppercase text-[11px] tracking-[0.2em] h-full">
                            <LayoutGrid className="mr-2 h-4 w-4" /> Carta
                        </TabsTrigger>
                        <TabsTrigger value="account" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none font-black uppercase text-[11px] tracking-[0.2em] h-full relative">
                            <History className="mr-2 h-4 w-4" /> Mi Cuenta
                            {activeOrder && (
                                <span className="absolute top-3 right-4 h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab: Menú / Carta */}
                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 m-0">
                    <div className="p-4 border-b bg-background shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar en el menú..." 
                                className="pl-10 h-11 bg-muted/50 border-none rounded-xl text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)} id="publicorderclient-input-buscar-en-el"
                            />
                        </div>
                    </div>

                    <ScrollArea className="flex-1 px-4 py-6">
                        <div className="grid grid-cols-2 gap-4 pb-24">
                            {filteredServices.map(service => (
                                <Card key={service.id} className="overflow-hidden border-none shadow-md rounded-3xl group active:scale-95 transition-transform">
                                    <div className="aspect-[4/3] relative bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="rounded-none"><Utensils className="h-8 w-8 text-muted-foreground/20" /></AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-black/60 backdrop-blur-md text-white border-none font-black text-[10px]">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-3 space-y-2">
                                        <h3 className="font-black uppercase text-[11px] leading-tight line-clamp-2 min-h-[2.4em]">{service.name}</h3>
                                        <Button 
                                            onClick={() => handleAddToCart(service)}
                                            className="w-full h-9 rounded-2xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-lg shadow-primary/10" id="publicorderclient-button-ordenar"
                                        >
                                            <Plus className="h-3 w-3" /> Ordenar
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* Tab: Mi Cuenta */}
                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 m-0">
                    <ScrollArea className="flex-1 p-4">
                        {!activeOrder ? (
                            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                                <Smartphone className="h-20 w-20" />
                                <p className="text-xl font-black uppercase tracking-widest">Aún no tiene pedidos</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">
                                <div className="bg-primary/5 rounded-[2rem] p-6 border-2 border-primary/10 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-black uppercase tracking-widest text-primary text-xs">Historial de Consumo</h3>
                                        <Badge variant="outline" className="font-black text-primary border-primary/20 bg-primary/5">ACTIVA</Badge>
                                    </div>
                                    <div className="space-y-3">
                                        {activeOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-sm">{item.quantity}x</span>
                                                        <span className="font-bold text-sm uppercase truncate">{item.name}</span>
                                                    </div>
                                                    <div className="mt-1">{getPrepStatusBadge(item)}</div>
                                                </div>
                                                <span className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <Separator className="bg-primary/10" />
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-black uppercase text-xs tracking-tighter opacity-60">Total Acumulado</span>
                                        <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(activeOrder.total)}</span>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-muted/30 rounded-2xl text-[10px] font-bold text-center uppercase tracking-widest text-muted-foreground leading-relaxed">
                                    Para pagar su cuenta, por favor solicite la factura al personal de recepción o bar.
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Barra Inferior del Carrito */}
            {cart.length > 0 && (
                <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="fixed bottom-0 inset-x-0 bg-background border-t p-4 pb-8 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-[2.5rem]"
                >
                    <div className="container max-w-lg space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center relative">
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background">
                                        {cart.reduce((s, i) => s + i.quantity, 0)}
                                    </span>
                                </div>
                                <div className="text-left leading-none">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Pedido</p>
                                    <p className="text-xl font-black tracking-tighter">{formatCurrency(cartTotal)}</p>
                                </div>
                            </div>
                            
                            <Button 
                                onClick={handleSendOrder} 
                                disabled={isPending}
                                className="h-12 px-8 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20 gap-2" id="publicorderclient-button-1-1"
                            >
                                {isPending ? 'Enviando...' : activeOrderId ? 'Añadir a mi Cuenta' : 'Confirmar Pedido'}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <ScrollArea className="max-h-40">
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.service.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/50">
                                        <span className="font-bold text-xs uppercase truncate max-w-[150px]">{item.service.name}</span>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-background rounded-lg p-1 border shadow-sm">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-6 w-6 flex items-center justify-center hover:text-primary" id="publicorderclient-button-3"><Minus className="h-3 w-3" /></button>
                                                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="h-6 w-6 flex items-center justify-center hover:text-primary" id="publicorderclient-button-4"><Plus className="h-3 w-3" /></button>
                                            </div>
                                            <button 
                                                onClick={() => setCart(prev => prev.filter(i => i.service.id !== item.service.id))}
                                                className="h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" id="publicorderclient-button-5"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
