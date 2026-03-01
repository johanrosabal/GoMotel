'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Sun, MapPin, 
    Clock, CheckCircle, X, ShoppingBasket, ReceiptText, LogOut, MessageSquare, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const SESSION_ORDER_KEY = 'go_motel_active_order_id';
const SESSION_TABLE_KEY = 'go_motel_active_table_id';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());
    
    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Session State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [myOrderId, setMyOrderId] = useState<string | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const storedOrderId = localStorage.getItem(SESSION_ORDER_KEY);
        const storedTableId = localStorage.getItem(SESSION_TABLE_KEY);
        if (storedOrderId) setMyOrderId(storedOrderId);
        if (storedTableId) setSelectedTableId(storedTableId);
        setIsCheckingSession(false);

        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Firestore Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const tableRef = useMemoFirebase(() => 
        (firestore && selectedTableId) ? doc(firestore, 'restaurantTables', selectedTableId) : null,
        [firestore, selectedTableId]
    );
    const { data: selectedTable } = useDoc<RestaurantTable>(tableRef);

    // IMPORTANT: Only fetch the order that belongs to this specific session
    const orderRef = useMemoFirebase(() => 
        (firestore && myOrderId) ? doc(firestore, 'orders', myOrderId) : null,
        [firestore, myOrderId]
    );
    const { data: activeOrder } = useDoc<Order>(orderRef);

    // Auto-management of session: if order is closed, clear session
    useEffect(() => {
        if (activeOrder && activeOrder.paymentStatus === 'Pagado') {
            handleLogout();
        }
    }, [activeOrder]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            // A table is available if it is Available OR it's MY occupied table
            const isAvailableOrMine = t.status === 'Available' || (t.id === selectedTableId && myOrderId === t.currentOrderId);
            return matchesType && isAvailableOrMine;
        }).sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, typeFilter, selectedTableId, myOrderId]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

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
    };

    const handleSelectTable = (table: RestaurantTable) => {
        // If table is occupied and I don't have the key, I can't enter
        if (table.status === 'Occupied' && myOrderId !== table.currentOrderId) {
            toast({ title: "Mesa Ocupada", description: "Esta mesa ya está siendo atendida.", variant: "destructive" });
            return;
        }
        
        setSelectedTableId(table.id);
        localStorage.setItem(SESSION_TABLE_KEY, table.id);
        
        if (table.currentOrderId) {
            setMyOrderId(table.currentOrderId);
            localStorage.setItem(SESSION_ORDER_KEY, table.currentOrderId);
        }
    };

    const handleLogout = () => {
        setSelectedTableId(null);
        setMyOrderId(null);
        setCart([]);
        localStorage.removeItem(SESSION_ORDER_KEY);
        localStorage.removeItem(SESSION_TABLE_KEY);
        setActiveTab('menu');
    };

    const handleConfirmOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (myOrderId) {
                result = await addToTableAccount(myOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, `Cliente Móvil`);
                if (result.orderId) {
                    setMyOrderId(result.orderId);
                    localStorage.setItem(SESSION_ORDER_KEY, result.orderId);
                }
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'Su orden está siendo procesada.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (isCheckingSession) return null;

    if (!selectedTableId) {
        return (
            <div className="flex-1 flex flex-col p-6 bg-background">
                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                    <div className="bg-primary/10 p-4 rounded-full">
                        <MapPin className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Bienvenido</h1>
                    <p className="text-muted-foreground max-w-xs">Seleccione su ubicación actual para empezar a ordenar.</p>
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-20">
                        {filteredTables.map(table => {
                            const isMine = table.id === selectedTableId;
                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className={cn(
                                        "aspect-square rounded-3xl border-2 flex flex-col items-center justify-center transition-all active:scale-95",
                                        isMine ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20" : "bg-card hover:border-primary/40 shadow-sm"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{TYPE_LABELS[table.type] || table.type}</span>
                                    <span className="text-5xl font-black tracking-tighter">{table.number}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-muted/20 overflow-hidden relative">
            {/* Header */}
            <header className="bg-background border-b px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary text-primary-foreground h-10 w-10 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">
                        {selectedTable?.number}
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type}</span>
                        <span className="text-sm font-bold">Cuenta Activa</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl text-muted-foreground hover:text-destructive">
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col min-h-0">
                <div className="bg-background px-6 pt-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 rounded-2xl p-1.5">
                        <TabsTrigger value="menu" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md">
                            <Utensils className="h-3.5 w-3.5 mr-2" /> Menú
                        </TabsTrigger>
                        <TabsTrigger value="account" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md relative">
                            <ReceiptText className="h-3.5 w-3.5 mr-2" /> Mi Cuenta
                            {activeOrder && activeOrder.items.length > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[8px] flex items-center justify-center rounded-full border-2 border-background">
                                    {activeOrder.items.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 m-0">
                    <div className="p-4 space-y-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="¿Qué se le antoja?" 
                                className="pl-10 h-12 bg-background border-none rounded-2xl shadow-sm focus-visible:ring-primary"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-primary-foreground shadow-md" : "bg-background border")}
                                onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                            >Todos</button>
                            {categories?.map(cat => (
                                <button
                                    key={cat.id}
                                    className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-background border")}
                                    onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                >{cat.name}</button>
                            ))}
                        </div>
                    </div>

                    <ScrollArea className="flex-1 px-4 pb-32">
                        <div className="grid grid-cols-2 gap-4 pb-10">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-background rounded-3xl border border-border/50 overflow-hidden shadow-sm flex flex-col">
                                    <div className="aspect-square relative overflow-hidden bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-transparent"><ImageIcon className="h-8 w-8 opacity-10" /></AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-background/90 text-primary backdrop-blur-sm border-primary/10 font-black">{formatCurrency(service.price)}</Badge>
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-[11px] uppercase tracking-tight line-clamp-2 leading-tight">{service.name}</h3>
                                            <p className="text-[9px] text-muted-foreground font-medium uppercase mt-1">
                                                {service.source === 'Internal' ? 'Cocina' : 'Comprado'}
                                            </p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                            onClick={() => handleAddToCart(service)}
                                        >
                                            Pedir
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="account" className="flex-1 flex flex-col m-0 overflow-hidden">
                    <ScrollArea className="flex-1 px-6 pt-6 pb-20">
                        {(!activeOrder || activeOrder.items.length === 0) ? (
                            <div className="text-center py-20 space-y-4">
                                <ReceiptText className="h-16 w-16 mx-auto opacity-10" />
                                <p className="text-muted-foreground font-medium">Aún no hay consumos registrados.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Acumulado</p>
                                    <p className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</p>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Historial de Pedidos</h3>
                                    <div className="bg-background rounded-3xl border p-5 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase text-amber-600">Estado: {activeOrder.status}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground">{formatDistance(activeOrder.createdAt.toDate(), now, { locale: es, addSuffix: true })}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {activeOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start group">
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-bold uppercase tracking-tight">{item.quantity}x {item.name}</p>
                                                        {item.notes && <p className="text-[10px] text-primary italic font-medium ml-4">"{item.notes}"</p>}
                                                    </div>
                                                    <span className="text-xs font-bold text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed text-center space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">¿Desea la cuenta final?</p>
                                    <p className="text-xs text-muted-foreground px-4">Por favor, solicite el cierre de cuenta a través del servicio de mensajería o espere a su salonero.</p>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <div className="absolute bottom-6 inset-x-6 z-50 animate-in slide-in-from-bottom-8 duration-500">
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 ring-4 ring-background">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                        <ShoppingCart className="h-5 w-5" />
                                        <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-white text-primary text-[10px] font-black flex items-center justify-center rounded-full shadow-md">
                                            {cart.reduce((s, i) => s + i.quantity, 0)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Confirmar Pedido</span>
                                        <span className="text-lg font-black tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                </div>
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="rounded-t-3xl sm:rounded-3xl border-none">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Revisar Pedido</DialogTitle>
                                <DialogDescription className="text-xs">Confirme los artículos antes de enviar a cocina.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[50vh] pr-4">
                                <div className="space-y-4 py-4">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                                            <div className="flex justify-between items-center">
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-black uppercase tracking-tight">{item.service.name}</p>
                                                    <p className="text-xs text-muted-foreground font-bold">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-background p-1 rounded-xl shadow-sm border">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}><Minus className="h-3 w-3"/></Button>
                                                    <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)}><Plus className="h-3 w-3"/></Button>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleOpenNoteDialog(idx)}
                                                className={cn(
                                                    "text-[10px] font-black uppercase flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors",
                                                    item.notes ? "bg-primary/10 text-primary border-primary/20" : "bg-background text-muted-foreground border-dashed"
                                                )}
                                            >
                                                <MessageSquare className="h-3 w-3" />
                                                {item.notes ? `Nota: ${item.notes}` : "+ Instrucciones de cocina"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pedido</span>
                                    <span className="text-2xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20" 
                                    onClick={handleConfirmOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? "Procesando..." : "Enviar a Cocina"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Instrucciones</DialogTitle>
                        <DialogDescription>Añada cualquier detalle para la preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Sin hielo, término medio, etc." 
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 text-sm font-bold"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
