'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, RestaurantTable, Order } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, User, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin, UserPlus,
    MessageSquare, Star
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const LOCAL_STORAGE_KEY = 'go_motel_active_order_id';

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
    
    // View and State Management
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [newAccountLabel, setNewAccountLabel] = useState('');

    // Kitchen Notes state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const storedOrderId = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedOrderId) setActiveOrderId(storedOrderId);
        return () => clearInterval(timer);
    }, []);

    // Sync active order state
    useEffect(() => {
        if (!firestore || !activeOrderId) return;
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    setActiveOrderId(null);
                    setSelectedTable(null);
                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                    toast({ title: 'Cuenta Cerrada', description: 'Su cuenta ha sido pagada. ¡Gracias por su visita!' });
                }
            } else {
                setActiveOrderId(null);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId, toast]);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        activeOrderId ? query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId)) : null, 
        [activeOrderId, firestore]
    );
    const { data: activeOrderData } = useCollection<Order>(activeOrdersQuery);
    const activeOrder = activeOrderData?.[0] || null;

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [availableServices, searchTerm]);

    const totalInCart = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
    const totalOrder = activeOrder?.total || 0;

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

    const handleConfirmOrder = () => {
        if (cart.length === 0) return;
        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else if (selectedTable) {
                const label = newAccountLabel.trim() || `Cliente en ${TYPE_LABELS[selectedTable.type] || selectedTable.type} ${selectedTable.number}`;
                result = await openTableAccount(selectedTable.id, cart, label);
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem(LOCAL_STORAGE_KEY, result.orderId);
                }
            }

            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Su solicitud está siendo procesada.' });
                setCart([]);
                setNewAccountLabel('');
            }
        });
    };

    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied') {
            toast({ title: 'Ubicación ocupada', description: 'Esta mesa ya tiene una cuenta abierta por otro cliente.', variant: 'destructive' });
            return;
        }
        setSelectedTable(table);
    };

    // Render Selection Screen
    if (!activeOrderId && !selectedTable) {
        return (
            <div className="min-h-screen bg-muted/30 p-4 sm:p-6 flex flex-col">
                <div className="max-w-2xl mx-auto w-full space-y-8 animate-in fade-in duration-700">
                    <div className="text-center space-y-2">
                        <div className="h-20 w-20 bg-primary rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
                            <Utensils className="h-10 w-10 text-primary-foreground" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight uppercase mt-6">Auto-Pedido Móvil</h1>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Seleccione su ubicación para comenzar</p>
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
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className={cn(
                                        "h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95",
                                        table.status === 'Occupied' 
                                            ? "bg-muted text-muted-foreground/50 border-muted grayscale cursor-not-allowed" 
                                            : "bg-card border-border hover:border-primary hover:shadow-lg"
                                    )}
                                >
                                    <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                        {TYPE_LABELS[table.type] || table.type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-muted/20 overflow-hidden relative">
            {/* 1. Dynamic Header */}
            <div className="bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm z-40">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Sun className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-tight">
                            {selectedTable ? `${TYPE_LABELS[selectedTable.type] || selectedTable.type} ${selectedTable.number}` : 'Mi Mesa'}
                        </h2>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pedido en línea activo</span>
                        </div>
                    </div>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-xl border">
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={cn("h-8 px-4 rounded-lg text-[10px] font-black uppercase transition-all", activeTab === 'menu' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                    >Menú</button>
                    <button 
                        onClick={() => setActiveTab('account')}
                        className={cn("h-8 px-4 rounded-lg text-[10px] font-black uppercase transition-all", activeTab === 'account' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                    >Mi Cuenta</button>
                </div>
            </div>

            {/* 2. Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {activeTab === 'menu' ? (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="p-4 bg-background border-b shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida, bebidas..." 
                                    className="pl-10 h-12 bg-muted/30 border-none rounded-2xl font-medium"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-3 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        className="group flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm active:scale-95 transition-all relative aspect-[4/5]"
                                    >
                                        <div className="h-full w-full relative">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-muted"><ImageIcon className="h-10 w-10 opacity-10" /></AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Labels Top */}
                                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                                                <Badge className="bg-white/90 text-black font-black text-[8px] uppercase tracking-widest px-2 py-0.5 border-none backdrop-blur-md">
                                                    {service.category === 'Food' ? 'Cocina' : 'Bar'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="secondary" className="text-[8px] font-black bg-black/40 text-white backdrop-blur-md border-none">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Gradient & Content Bottom */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
                                                <h3 className="font-black text-[11px] uppercase tracking-tight text-white leading-tight mb-1">{service.name}</h3>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-black text-primary drop-shadow-md">{formatCurrency(service.price)}</span>
                                                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-lg ring-4 ring-primary/20">
                                                        <Plus className="h-4 w-4 text-primary-foreground" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6 pb-24">
                            <div className="bg-background rounded-3xl border p-6 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black uppercase tracking-tighter text-xl">Resumen de Consumo</h3>
                                    <Badge variant="outline" className="font-black text-[10px] tracking-widest uppercase border-primary text-primary">Cuenta Abierta</Badge>
                                </div>
                                <Separator />
                                {activeOrder ? (
                                    <div className="space-y-4">
                                        {activeOrder.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <p className="font-black text-xs uppercase tracking-tight leading-none">{item.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">{item.quantity} un. x {formatCurrency(item.price)}</p>
                                                </div>
                                                <span className="font-black text-xs">{formatCurrency(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                        <Separator />
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Acumulado</span>
                                            <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(activeOrder.total)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-muted-foreground flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center"><Clock className="h-8 w-8 opacity-20" /></div>
                                        <p className="text-xs font-black uppercase tracking-widest">Aún no se han registrado pedidos</p>
                                    </div>
                                )}
                            </div>
                            
                            {activeOrder && (
                                <div className="p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Star className="h-5 w-5" /></div>
                                    <p className="text-[10px] font-bold text-primary/80 uppercase tracking-tight">Su pedido está siendo preparado. Puede seguir pidiendo productos y se añadirán a su cuenta.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* 3. Floating Bottom Bar (Cart) */}
            {cart.length > 0 && (
                <div className="absolute bottom-6 inset-x-4 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="bg-primary p-1.5 rounded-[2rem] shadow-[0_20px_50px_rgba(var(--primary),0.3)] flex items-center justify-between border-2 border-white/20">
                        <div className="flex items-center gap-3 pl-4">
                            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center relative">
                                <ShoppingCart className="h-5 w-5 text-white" />
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-white text-primary rounded-full text-[10px] font-black flex items-center justify-center shadow-lg">{cart.length}</span>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">Nuevo Pedido</span>
                                <span className="text-xl font-black text-white tracking-tighter">{formatCurrency(totalInCart)}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                                        <Plus className="h-6 w-6 text-white" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden border-none rounded-3xl">
                                    <DialogHeader className="p-6 bg-muted/30">
                                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Mi Carrito</DialogTitle>
                                        <DialogDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Revise sus artículos antes de pedir</DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 px-6 py-2">
                                        <div className="space-y-4">
                                            {cart.map((item, i) => (
                                                <div key={i} className="flex flex-col gap-2 p-4 bg-muted/20 rounded-2xl border border-border/50 group">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                                            <p className="text-[10px] font-bold text-primary mt-0.5">{formatCurrency(item.service.price)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1 border border-primary/20 shadow-inner">
                                                            <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 bg-background rounded-xl flex items-center justify-center shadow-sm text-primary hover:bg-primary hover:text-white transition-all"><Minus className="h-4 w-4" /></button>
                                                            <span className="text-sm font-black text-primary w-4 text-center">{item.quantity}</span>
                                                            <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 bg-background rounded-xl flex items-center justify-center shadow-sm text-primary hover:bg-primary hover:text-white transition-all"><Plus className="h-4 w-4" /></button>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleOpenNoteDialog(i)}
                                                        className={cn("text-[9px] font-black uppercase flex items-center gap-2 py-2 px-3 rounded-xl border transition-all", item.notes ? "bg-primary text-white border-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Instrucción: " + item.notes : "Añadir nota de cocina"}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-6 border-t bg-background">
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Subtotal Pedido</span>
                                            <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(totalInCart)}</span>
                                        </div>
                                        <Button 
                                            onClick={handleConfirmOrder} 
                                            disabled={isPending}
                                            className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30"
                                        >
                                            {isPending ? 'Enviando...' : 'Confirmar y Pedir Ahora'}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <button 
                                onClick={handleConfirmOrder}
                                disabled={isPending}
                                className="h-12 px-8 bg-white text-primary rounded-[1.75rem] font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                {isPending ? '...' : 'Pedir Ahora'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Notas de Preparación</DialogTitle>
                        <DialogDescription className="text-xs font-bold opacity-60">Indique cómo desea que se prepare su producto.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Con poco hielo, término medio, sin cebolla..." 
                            className="min-h-[120px] rounded-2xl border-2 focus:border-primary text-base font-medium resize-none"
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px]" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
