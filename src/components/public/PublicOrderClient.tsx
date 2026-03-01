'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, CheckCircle, Smartphone, 
    Utensils, Beer, Sun, MapPin, X, 
    ImageIcon, History, LayoutGrid
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const TYPE_ICONS: Record<string, any> = {
    'Table': Utensils,
    'Bar': Beer,
    'Terraza': Sun,
    'Pooles': LayoutGrid
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View state
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [zoneFilter, setRoleFilter] = useState<string>('all');
    
    // Catalog state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number }[]>([]);
    
    // Session state
    const [sessionOrderId, setSessionOrderId] = useState<string | null>(null);

    // Persistence of session order in localStorage
    useEffect(() => {
        if (selectedTableId) {
            const savedId = localStorage.getItem(`session_order_${selectedTableId}`);
            setSessionOrderId(savedId);
        }
    }, [selectedTableId]);

    // Firestore Data
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    // Watch current session order in real-time
    const [orderHistory, setOrderHistory] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore || !sessionOrderId) {
            setOrderHistory(null);
            return;
        }
        const unsub = onSnapshot(doc(firestore, 'orders', sessionOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' || data.status === 'Cancelado') {
                    // Session ended
                    localStorage.removeItem(`session_order_${selectedTableId}`);
                    setSessionOrderId(null);
                    setOrderHistory(null);
                } else {
                    setOrderHistory({ id: snap.id, ...data });
                }
            } else {
                setSessionOrderId(null);
                setOrderHistory(null);
            }
        });
        return () => unsub();
    }, [firestore, sessionOrderId, selectedTableId]);

    const selectedTable = useMemo(() => allTables?.find(t => t.id === selectedTableId), [allTables, selectedTableId]);
    
    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return (services || []).filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: Math.min(i.quantity + 1, service.stock || 99) } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
    };

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === serviceId);
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (sessionOrderId) {
                result = await addToTableAccount(sessionOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, `Cliente Móvil - ${selectedTable?.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    setSessionOrderId(result.orderId);
                    localStorage.setItem(`session_order_${selectedTableId}`, result.orderId);
                }
                setCart([]);
                setActiveTab('account');
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
            }
        });
    };

    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-10 animate-in fade-in duration-500">
                <div className="w-full max-w-md space-y-10 text-center">
                    <div className="space-y-4">
                        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center border-2 border-primary/20 shadow-xl shadow-primary/5">
                            <Smartphone className="h-12 w-12 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para ver el menú digital y realizar su pedido.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="text-left space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Filtrar por Zona</Label>
                            <Select value={zoneFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(type => (
                                        <SelectItem key={type} value={type}>{TYPE_LABELS[type] || type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[45vh] rounded-3xl border-2 bg-muted/20 p-2">
                            <div className="grid grid-cols-3 gap-3 p-2">
                                {filteredTables.map(table => {
                                    const Icon = TYPE_ICONS[table.type] || MapPin;
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTableId(table.id)}
                                            className="group aspect-square flex flex-col items-center justify-center bg-background border-2 rounded-[2rem] hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95"
                                        >
                                            <Icon className="h-5 w-5 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="text-2xl font-black tracking-tighter">{table.number}</span>
                                            <span className="text-[8px] font-black uppercase text-muted-foreground mt-1 opacity-60">
                                                {TYPE_LABELS[table.type] || table.type}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            {/* Top Navigation */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <span className="font-black text-xl">{selectedTable?.number}</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-tight">Mesa Seleccionada</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTableId(null)} className="h-10 w-10 rounded-xl">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'menu' && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 space-y-4 bg-muted/10 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar producto..." 
                                    className="pl-10 h-12 bg-background rounded-2xl border-2 shadow-sm"
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
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        disabled={service.source !== 'Internal' && (service.stock || 0) <= 0}
                                        className="group relative flex flex-col bg-card border-2 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <div className="flex flex-wrap gap-1">
                                                    <Badge className="bg-white/90 text-black text-[8px] font-black uppercase">
                                                        {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                                    </Badge>
                                                    {service.source !== 'Internal' && (
                                                        <Badge variant="secondary" className="text-[8px] font-black">
                                                            STOCK: {service.stock}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="font-black text-[11px] uppercase text-white leading-tight line-clamp-2 drop-shadow-md">
                                                        {service.name}
                                                    </h3>
                                                    <p className="text-primary font-black text-sm drop-shadow-lg">
                                                        {formatCurrency(service.price)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Su Carrito</h3>
                            <Badge variant="outline" className="h-8 px-4 font-black">{cart.length} items</Badge>
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-6">
                                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                                        <ShoppingCart className="h-10 w-10 opacity-20" />
                                    </div>
                                    <p className="font-black uppercase text-xs tracking-widest">Carrito vacío</p>
                                    <Button onClick={() => setActiveTab('menu')} variant="outline" className="rounded-xl font-bold">Volver al Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="flex items-center gap-4 p-4 bg-muted/20 border-2 rounded-[2rem]">
                                            <Avatar className="h-16 w-16 rounded-2xl border shadow-sm">
                                                <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback><ImageIcon /></AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-[11px] uppercase truncate">{item.service.name}</p>
                                                <p className="text-primary font-black">{formatCurrency(item.service.price * item.quantity)}</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-background rounded-2xl p-1 border shadow-sm">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                                <button 
                                                    className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50"
                                                    onClick={() => handleAddToCart(item.service)}
                                                    disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        <div className="pt-6 space-y-4 bg-background">
                            <div className="flex justify-between items-end p-2">
                                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total Estimado</span>
                                <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                            </div>
                            <Button 
                                className="w-full h-16 rounded-[2rem] text-lg font-black uppercase tracking-[0.1em] shadow-xl shadow-primary/20"
                                disabled={cart.length === 0 || isPending}
                                onClick={handleSendOrder}
                            >
                                {isPending ? 'Enviando...' : 'Confirmar Pedido'}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Mi Consumo</h3>
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <History className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            {!orderHistory ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-6 text-center">
                                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                                        <History className="h-10 w-10 opacity-20" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-black uppercase text-xs tracking-widest">Sin historial actual</p>
                                        <p className="text-[10px] max-w-[200px] font-medium">Sus pedidos de la estancia actual aparecerán aquí una vez enviados.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Saldo Pendiente</p>
                                                    <p className="text-5xl font-black tracking-tighter mt-1">{formatCurrency(orderHistory.total)}</p>
                                                </div>
                                                <Badge className="bg-white/20 backdrop-blur-md text-white border-0 font-black uppercase text-[9px] px-3 h-6">
                                                    {orderHistory.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-8 space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos pedidos</h4>
                                                {orderHistory.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center group">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-1 rounded-full bg-primary" />
                                                                <p className="font-black text-xs uppercase truncate tracking-tight">{item.name}</p>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground font-bold ml-3">{item.quantity} x {formatCurrency(item.price)}</p>
                                                        </div>
                                                        <p className="font-black text-sm tracking-tighter">{formatCurrency(item.price * item.quantity)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="pt-6 border-t border-dashed">
                                                <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-3xl border-2 border-amber-200/50 flex gap-4 items-start">
                                                    <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl">
                                                        <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-black uppercase tracking-tight text-amber-800 dark:text-amber-300">Solicitar Cobro</p>
                                                        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400/80 leading-relaxed">
                                                            Para cancelar su cuenta, por favor comuníquese con la recepción o un salonero.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Bottom Tab Bar */}
            <div className="bg-background border-t px-6 py-2 pb-8 flex items-center justify-around shrink-0 shadow-2xl relative z-50">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 transition-all active:scale-90",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'menu' && "bg-primary/10")}>
                        <LayoutGrid className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 transition-all active:scale-90 relative",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'cart' && "bg-primary/10")}>
                        <ShoppingCart className="h-6 w-6" />
                    </div>
                    {cart.length > 0 && (
                        <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in">
                            {cart.length}
                        </span>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-2 transition-all active:scale-90",
                        activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2 rounded-2xl transition-colors", activeTab === 'account' && "bg-primary/10")}>
                        <History className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>
        </div>
    );
}