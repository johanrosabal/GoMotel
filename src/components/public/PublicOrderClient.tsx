'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, OrderItem } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, PackageCheck, Clock, X, Utensils, Beer, Sun, MapPin, 
    MessageSquare, ChevronRight, CheckCircle, Receipt
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

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const SESSION_KEY = 'go_motel_active_order_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View Management
    const [step, setStep] = useState(1); // 1: Selection, 2: Menu, 3: Account
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // Search and Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Cart and Notes
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Persistence: Check for active session on mount
    useEffect(() => {
        const savedId = localStorage.getItem(SESSION_KEY);
        if (savedId) {
            setActiveOrderId(savedId);
            setStep(2);
        }
    }, []);

    // Sincronización en tiempo real de la orden activa
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setActiveOrder(null);
            return;
        }
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // Si la orden ya fue pagada o entregada definitivamente, cerrar sesión local
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(SESSION_KEY);
                    setActiveOrderId(null);
                    setStep(1);
                    toast({ title: 'Cuenta Finalizada', description: 'Su estancia ha concluido. ¡Gracias!' });
                } else {
                    setActiveOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
                setActiveOrderId(null);
                setStep(1);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId, toast]);

    // Data Fetching
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
        [firestore]
    );
    const { data: allServices } = useCollection<Service>(servicesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<any>(categoriesQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        if (!allServices) return [];
        return allServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [allServices, searchTerm, selectedCategoryId]);

    // Cart Logic
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

    const handleOpenAccount = () => {
        if (!selectedTable || cart.length === 0) return;
        startTransition(async () => {
            const result = await openTableAccount(selectedTable.id, cart, `Cliente Móvil - ${selectedTable.number}`);
            if (result.success) {
                const orderId = result.orderId!;
                localStorage.setItem(SESSION_KEY, orderId);
                setActiveOrderId(orderId);
                setCart([]);
                setStep(3); // Ir a historial
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando su orden.' });
            }
        });
    };

    const handleAddToExisting = () => {
        if (!activeOrderId || cart.length === 0) return;
        startTransition(async () => {
            const result = await addToTableAccount(activeOrderId, cart);
            if (result.success) {
                setCart([]);
                setStep(3);
                toast({ title: 'Pedido Actualizado' });
            }
        });
    };

    const cartTotal = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden font-sans">
            
            {/* Cabecera Fija */}
            <div className="bg-primary p-6 pt-8 pb-10 rounded-b-[3rem] shadow-2xl z-20 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-white font-black text-2xl tracking-tighter uppercase leading-none">Auto-Pedido</h1>
                        <p className="text-white/60 text-[10px] font-bold tracking-[0.2em] mt-1 uppercase">Servicio Digital</p>
                    </div>
                    {selectedTable && (
                        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 flex items-center gap-3">
                            <div className="h-8 w-8 bg-white rounded-xl flex items-center justify-center text-primary font-black shadow-sm">
                                {selectedTable.number}
                            </div>
                            <span className="text-white font-black text-xs uppercase tracking-widest">{TYPE_LABELS[selectedTable.type] || 'Mesa'}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 overflow-hidden flex flex-col -mt-6">
                
                {/* Paso 1: Selección de Ubicación */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col p-6 space-y-6 bg-background rounded-t-[3rem]">
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

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 pb-10">
                                {filteredTables.map(table => {
                                    const Icon = getTypeIcon(table.type);
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => { setSelectedTable(table); setStep(2); }}
                                            className="flex flex-col items-center justify-center p-6 bg-card border-2 rounded-3xl hover:border-primary transition-all active:scale-95 shadow-sm"
                                        >
                                            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-3">
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{TYPE_LABELS[table.type]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Paso 2: El Menú */}
                {step === 2 && (
                    <div className="flex-1 flex flex-col bg-background rounded-t-[3rem] overflow-hidden">
                        {/* Selector de Categorías */}
                        <div className="p-6 pb-2 shrink-0">
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar algo rico..." 
                                    className="h-12 pl-11 rounded-2xl bg-muted/50 border-none shadow-inner text-sm font-medium"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todo
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            )}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Lista de Productos */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-6 pb-32">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        className="group relative aspect-[4/5] bg-muted rounded-[2.5rem] overflow-hidden shadow-md active:scale-95 transition-transform"
                                    >
                                        <img 
                                            src={service.imageUrl || `https://picsum.photos/seed/${service.id}/400/500`} 
                                            className="w-full h-full object-cover" 
                                            alt={service.name}
                                        />
                                        {/* Etiquetas de Stock Superior */}
                                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
                                            <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase text-primary border border-primary/10 shadow-sm">
                                                {service.category}
                                            </div>
                                            {service.source !== 'Internal' && (
                                                <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase text-white">
                                                    Stock: {service.stock}
                                                </div>
                                            )}
                                        </div>

                                        {/* Información Inferior */}
                                        <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-start gap-1">
                                            <h3 className="text-white font-black text-xs uppercase tracking-tight leading-tight line-clamp-2">{service.name}</h3>
                                            <div className="flex items-center justify-between w-full mt-1">
                                                <span className="text-primary font-black text-sm">{formatCurrency(service.price)}</span>
                                                <div className="h-7 w-7 bg-white rounded-xl flex items-center justify-center text-primary shadow-lg">
                                                    <Plus className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Paso 3: Mi Cuenta / Historial */}
                {step === 3 && activeOrder && (
                    <div className="flex-1 flex flex-col p-6 space-y-6 bg-background rounded-t-[3rem]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black tracking-tight uppercase">Mi Cuenta</h2>
                            <Badge variant="outline" className="font-black border-primary/20 text-primary">#{activeOrder.id.slice(-4).toUpperCase()}</Badge>
                        </div>

                        <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-3xl p-6 text-center space-y-2">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Total Acumulado</p>
                            <p className="text-5xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground italic">Se liquida al momento del Check-out</p>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="space-y-4 pb-10">
                                {activeOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-white rounded-2xl flex items-center justify-center text-primary font-black shadow-sm">
                                                {item.quantity}
                                            </div>
                                            <div>
                                                <p className="font-black text-[11px] uppercase tracking-tight">{item.name}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.price)} c/u</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-xs text-primary">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Barra Flotante de Acciones */}
            <div className="fixed bottom-0 left-0 w-full p-6 pb-8 bg-gradient-to-t from-background via-background to-transparent z-40">
                <div className="flex gap-3">
                    {/* Botón de Carrito (Solo en paso 2) */}
                    {step === 2 && cart.length > 0 && (
                        <div className="flex-1 flex items-center bg-black rounded-[2rem] p-1.5 pl-6 shadow-2xl animate-in slide-in-from-bottom-5">
                            <div className="flex-1">
                                <p className="text-white/50 text-[8px] font-black uppercase tracking-widest">Subtotal</p>
                                <p className="text-white font-black text-xl tracking-tighter leading-none">{formatCurrency(cartTotal)}</p>
                            </div>
                            <Button 
                                className="h-14 px-8 rounded-full font-black uppercase text-xs tracking-widest gap-2 bg-primary hover:bg-primary/90"
                                onClick={activeOrderId ? handleAddToExisting : handleOpenAccount}
                                disabled={isPending}
                            >
                                {isPending ? "..." : "Pedir"} <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Navegación Inferior */}
                    {step >= 2 && cart.length === 0 && (
                        <div className="w-full flex gap-3">
                            <button 
                                onClick={() => setStep(2)}
                                className={cn(
                                    "flex-1 h-14 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all",
                                    step === 2 ? "bg-primary text-white shadow-xl shadow-primary/20" : "bg-card border-2 text-muted-foreground"
                                )}
                            >
                                <Utensils className="h-4 w-4" /> Carta
                            </button>
                            {activeOrderId && (
                                <button 
                                    onClick={() => setStep(3)}
                                    className={cn(
                                        "flex-1 h-14 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all",
                                        step === 3 ? "bg-primary text-white shadow-xl shadow-primary/20" : "bg-card border-2 text-muted-foreground"
                                    )}
                                >
                                    <Receipt className="h-4 w-4" /> Mi Cuenta
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Diálogos */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">Para la cocina</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 flex items-center gap-4">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            <span className="font-black text-xs uppercase">{editingNoteIndex !== null ? cart[editingNoteIndex].service.name : ''}</span>
                        </div>
                        <Textarea 
                            placeholder="Ej: Sin cebolla, término medio, etc."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-3xl bg-muted/50 border-none shadow-inner"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg" onClick={handleSaveNote}>
                            Guardar Nota
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
