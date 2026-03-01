
'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ImageIcon, Utensils, Beer, Clock, CheckCircle, X, Sun, MapPin, 
    MessageSquare, History, LogOut, Loader2, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger 
} from '@/components/ui/dialog';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const SESSION_TABLE_KEY = 'gomotel_public_table_id';
const SESSION_ORDER_KEY = 'gomotel_public_order_id';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
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
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Session State
    const [currentTableId, setCurrentTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Kitchen Notes dialog state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    
    useEffect(() => {
        getServices().then(setAvailableServices);
        
        // Recover session from localStorage
        const storedTableId = localStorage.getItem(SESSION_TABLE_KEY);
        const storedOrderId = localStorage.getItem(SESSION_ORDER_KEY);
        if (storedTableId) setCurrentTableId(storedTableId);
        if (storedOrderId) setActiveOrderId(storedOrderId);
        
        setIsInitialLoading(false);
    }, []);

    // Sync localStorage
    useEffect(() => {
        if (currentTableId) localStorage.setItem(SESSION_TABLE_KEY, currentTableId);
        else localStorage.removeItem(SESSION_TABLE_KEY);
    }, [currentTableId]);

    useEffect(() => {
        if (activeOrderId) localStorage.setItem(SESSION_ORDER_KEY, activeOrderId);
        else localStorage.removeItem(SESSION_ORDER_KEY);
    }, [activeOrderId]);

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

    // Subscribe to the ACTIVE ORDER to check for status changes (if it gets closed/paid)
    const activeOrderRef = useMemoFirebase(() => 
        (firestore && activeOrderId) ? doc(firestore, 'orders', activeOrderId) : null,
        [firestore, activeOrderId]
    );
    const { data: serverOrder } = useDoc<Order>(activeOrderRef);

    // If order is closed or canceled, clear session
    useEffect(() => {
        if (activeOrderId && serverOrder && (serverOrder.status === 'Cancelado' || serverOrder.paymentStatus === 'Pagado')) {
            handleExit();
            toast({ title: "Cuenta Cerrada", description: "Tu cuenta ha sido finalizada. Gracias por visitarnos." });
        }
    }, [serverOrder, activeOrderId, toast]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            // Only show available tables OR the one the current device has claimed
            const isAvailable = t.status === 'Available' || t.id === currentTableId;
            return matchesType && isAvailable;
        }).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, typeFilter, currentTableId]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    // HANDLERS
    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied' && table.id !== currentTableId) {
            toast({ title: "Mesa Ocupada", description: "Esta ubicación ya está siendo atendida.", variant: "destructive" });
            return;
        }
        setCurrentTableId(table.id);
    };

    const handleExit = () => {
        setCurrentTableId(null);
        setActiveOrderId(null);
        setCart([]);
        localStorage.removeItem(SESSION_TABLE_KEY);
        localStorage.removeItem(SESSION_ORDER_KEY);
    };

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

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!currentTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(currentTableId, cart, "Auto-Pedido Móvil");
            }

            if (result.error) {
                toast({ title: "Error al pedir", description: result.error, variant: "destructive" });
            } else {
                if (result.orderId) setActiveOrderId(result.orderId);
                toast({ title: "¡Pedido Enviado!", description: "Tu orden está siendo preparada." });
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

    if (isInitialLoading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Iniciando Menú Digital...</p>
            </div>
        );
    }

    // STEP 1: Select Location
    if (!currentTableId) {
        return (
            <div className="min-h-screen bg-muted/30 p-6 flex flex-col">
                <div className="max-w-md mx-auto w-full space-y-8 py-10">
                    <div className="text-center space-y-2">
                        <Utensils className="h-12 w-12 text-primary mx-auto" />
                        <h1 className="text-3xl font-black tracking-tighter uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Selecciona tu mesa para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => {
                                const Icon = getTypeIcon(table.type);
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleSelectTable(table)}
                                        className="bg-card border-2 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:border-primary hover:shadow-xl active:scale-95 group"
                                    >
                                        <div className="bg-primary/10 p-3 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <span className="font-black text-4xl tracking-tighter">{table.number}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {TYPE_LABELS[table.type] || table.type}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 2: Catalog & Account
    const table = allTables?.find(t => t.id === currentTableId);

    return (
        <div className="flex flex-col h-screen bg-muted/20 overflow-hidden">
            {/* Cabecera Fija */}
            <header className="bg-background border-b px-6 py-4 flex items-center justify-between shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary text-white h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-tight leading-none">Mesa {table?.number || '--'}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Cuenta Activa</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={handleExit}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>

            {/* Navegación de Pestañas */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="bg-background px-6 pb-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-muted/50 p-1">
                        <TabsTrigger value="menu" className="rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
                            <Utensils className="h-3 w-3" /> Menú
                        </TabsTrigger>
                        <TabsTrigger value="account" className="rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
                            <History className="h-3 w-3" /> Mi Cuenta
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 p-0 m-0">
                    {/* Filtros de Categoría */}
                    <div className="bg-background px-6 py-3 space-y-4 shrink-0 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar en el menú..." 
                                className="pl-9 h-12 bg-muted/30 border-0 rounded-2xl focus-visible:ring-2" 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                    selectedCategoryId === null ? "bg-primary text-white border-primary shadow-md" : "bg-card text-muted-foreground"
                                )}
                                onClick={() => setSelectedCategoryId(null)}
                            >
                                Todos
                            </button>
                            {categories?.map(cat => (
                                <button
                                    key={cat.id}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                        selectedCategoryId === cat.id ? "bg-primary text-white border-primary shadow-md" : "bg-card text-muted-foreground"
                                    )}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-4 p-6 pb-32">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-card border-2 rounded-3xl overflow-hidden shadow-sm flex flex-col relative group">
                                    <div className="aspect-square relative overflow-hidden bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-background/90 text-primary border-primary/20 backdrop-blur-md font-black shadow-sm">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <h3 className="font-black text-[11px] uppercase tracking-tight leading-tight mb-3 line-clamp-2">{service.name}</h3>
                                        <Button 
                                            size="sm" 
                                            className="w-full rounded-xl font-black text-[9px] uppercase h-9 shadow-lg"
                                            onClick={() => handleAddToCart(service)}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Agregar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 p-0 m-0">
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-6 pb-20">
                            {/* Resumen de Cuenta */}
                            <div className="bg-primary text-white rounded-[2.5rem] p-8 shadow-2xl shadow-primary/30 relative overflow-hidden">
                                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 bg-white/10 rounded-full blur-3xl"></div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Total Acumulado</p>
                                <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(serverOrder?.total || 0)}</h3>
                                <div className="mt-6 flex items-center gap-2 bg-white/20 w-fit px-4 py-1.5 rounded-full backdrop-blur-sm">
                                    <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta Abierta</span>
                                </div>
                            </div>

                            {/* Historial de Pedidos */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Historial de Consumo</h4>
                                {(!serverOrder || serverOrder.items.length === 0) ? (
                                    <div className="bg-background rounded-3xl border-2 border-dashed p-10 text-center space-y-3">
                                        <div className="bg-muted h-12 w-12 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground/30">
                                            <Utensils className="h-6 w-6" />
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground">Aún no has pedido nada.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {serverOrder.items.map((item, idx) => (
                                            <div key={idx} className="bg-card border-2 rounded-3xl p-4 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-muted h-12 w-12 rounded-2xl flex items-center justify-center text-primary font-black">
                                                        {item.quantity}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm uppercase tracking-tight">{item.name}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatCurrency(item.price)} c/u</p>
                                                        {item.notes && (
                                                            <p className="text-[10px] text-primary italic mt-1 font-medium">"{item.notes}"</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-sm text-primary">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Carrito Flotante (Solo visible en Menú) */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 p-6 z-30 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
                                                {cart.length}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Revisar Pedido</p>
                                            <p className="font-black text-lg leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-t-[2.5rem] border-0 sm:rounded-3xl">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black tracking-tighter uppercase text-center">Tu Pedido</DialogTitle>
                                    <DialogDescription className="text-center font-medium">
                                        Confirma los productos antes de enviar a cocina.
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[50vh] pr-4 mt-4">
                                    <div className="space-y-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/30 p-4 rounded-3xl space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className="font-black text-sm uppercase tracking-tight leading-tight">{item.service.name}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground mt-1">{formatCurrency(item.service.price)} x {item.quantity}</p>
                                                    </div>
                                                    <p className="font-black text-primary">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                                <div className="flex items-center justify-between pt-2">
                                                    <button 
                                                        onClick={() => handleOpenNoteDialog(idx)}
                                                        className={cn(
                                                            "text-[9px] font-black uppercase flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 transition-all",
                                                            item.notes ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground border-dashed"
                                                        )}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Ver Instrucciones" : "+ Instrucciones"}
                                                    </button>
                                                    <div className="flex items-center gap-3 bg-background rounded-2xl p-1 border shadow-inner">
                                                        <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground"><Minus className="h-4 w-4" /></button>
                                                        <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                                        <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted text-primary"><Plus className="h-4 w-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="mt-6 p-6 bg-primary/5 rounded-3xl border-2 border-primary/10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Subtotal de la orden</span>
                                        <span className="text-2xl font-black text-primary">{formatCurrency(cartTotal)}</span>
                                    </div>
                                </div>
                                <DialogFooter className="mt-4">
                                    <Button 
                                        className="w-full h-16 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                                        ) : (
                                            <><CheckCircle className="h-5 w-5 mr-2" /> Confirmar y Enviar</>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-center">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription className="text-center">
                            Indica si deseas algún cambio o preparación especial.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                            <Utensils className="h-5 w-5 text-primary" />
                            <span className="font-black text-xs uppercase">
                                {editingNoteIndex !== null && cart[editingNoteIndex]?.service.name}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tus Notas</Label>
                            <Textarea 
                                placeholder="Ej: Con poco hielo, sin cebolla, término medio..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 font-bold text-sm"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl font-bold" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
