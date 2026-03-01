
'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, X, User, 
    Utensils, Beer, Sparkles, Clock, MessageSquare,
    PackageCheck, History, Info, Store, MapPin
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const SESSION_KEY = 'go_motel_order_session';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // Session State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    
    // UI State
    const [currentTab, setCurrentTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // Note Management
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [currentNote, setCurrentNote] = useState('');

    // Persistence Logic
    useEffect(() => {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
            const { orderId, tableId } = JSON.parse(saved);
            setActiveOrderId(orderId);
            // Fetch table info if we have a session
            if (firestore) {
                getDoc(doc(firestore, 'restaurantTables', tableId)).then(snap => {
                    if (snap.exists()) setSelectedTable({ id: snap.id, ...snap.data() } as RestaurantTable);
                });
            }
        }
    }, [firestore]);

    // Firestore Real-time Sync
    useEffect(() => {
        if (!firestore || !activeOrderId) return;
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    // Session ended by admin
                    localStorage.removeItem(SESSION_KEY);
                    setActiveOrderId(null);
                    setSelectedTable(null);
                    setCurrentTab('menu');
                    toast({ title: 'Cuenta Finalizada', description: 'Su cuenta ha sido pagada. ¡Gracias por visitarnos!' });
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
                setActiveOrderId(null);
                setSelectedTable(null);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId, toast]);

    // Data Queries
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const myOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId));
    }, [firestore, activeOrderId]);
    const { data: myOrdersData } = useCollection<Order>(myOrdersQuery);
    const activeOrder = myOrdersData?.[0];

    // Filter Logic
    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCat;
        });
    }, [services, searchTerm, selectedCategoryId]);

    // Cart Actions
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
    };

    const handleUpdateQuantity = (idx: number, delta: number) => {
        setCart(prev => {
            const updated = [...prev];
            const newQty = updated[idx].quantity + delta;
            if (newQty <= 0) {
                updated.splice(idx, 1);
            } else {
                updated[idx].quantity = newQty;
            }
            return updated;
        });
    };

    const handleSaveNote = () => {
        if (editingIdx === null) return;
        setCart(prev => prev.map((item, i) => i === editingIdx ? { ...item, notes: currentNote } : item));
        setNoteDialogOpen(false);
    };

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    // Submit Order
    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cliente Móvil`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    const session = { orderId: result.orderId, tableId: selectedTable.id };
                    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    setActiveOrderId(result.orderId);
                }
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando sus productos.' });
                setCart([]);
                setIsCartOpen(false);
                setCurrentTab('account');
            }
        });
    };

    const clearSession = () => {
        localStorage.removeItem(SESSION_KEY);
        setActiveOrderId(null);
        setSelectedTable(null);
        setCart([]);
        setCurrentTab('menu');
    };

    // Render Table Selection
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-zinc-50 p-6">
                <div className="max-w-md mx-auto space-y-8 pt-10">
                    <div className="text-center space-y-2">
                        <div className="inline-flex p-4 bg-primary/10 rounded-3xl mb-4">
                            <Store className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Por favor, seleccione su ubicación para ordenar</p>
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
                                    <SelectItem value="Table">Mesas</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTable(table)}
                                    className={cn(
                                        "h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-95",
                                        table.status === 'Occupied' 
                                            ? "bg-primary/5 border-primary/20 text-primary" 
                                            : "bg-card border-border hover:border-primary/40"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                        {table.type === 'Table' ? 'Mesa' : table.type === 'Bar' ? 'Barra' : table.type}
                                    </span>
                                    <span className="text-3xl font-black">{table.number}</span>
                                    {table.status === 'Occupied' && (
                                        <Badge variant="outline" className="mt-1 text-[8px] h-4 font-black bg-primary/10 border-primary/20">OCUPADA</Badge>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] flex flex-col bg-zinc-50 overflow-hidden font-sans">
            {/* Sticky Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Ubicación</p>
                        <p className="font-black text-lg leading-tight uppercase">{selectedTable.type} {selectedTable.number}</p>
                    </div>
                </div>
                {activeOrderId ? (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentTab('account')}
                            className={cn(
                                "flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-xs transition-all",
                                currentTab === 'account' ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                        >
                            <History className="h-4 w-4" /> Cuenta
                        </button>
                        <button onClick={clearSession} className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setSelectedTable(null)} className="h-10 px-4 rounded-xl font-bold text-xs bg-muted text-muted-foreground">Cambiar</button>
                )}
            </header>

            {/* Menu Nav */}
            {currentTab === 'menu' && (
                <div className="bg-white border-b px-4 py-3 shrink-0 z-10">
                    <ScrollArea className="w-full">
                        <div className="flex gap-2 pb-2">
                            <button 
                                onClick={() => setSelectedCategoryId(null)}
                                className={cn(
                                    "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                    !selectedCategoryId ? "bg-zinc-900 text-white shadow-md" : "bg-zinc-100 text-zinc-500"
                                )}
                            >Todos</button>
                            {categories?.map(cat => (
                                <button 
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all",
                                        selectedCategoryId === cat.id ? "bg-zinc-900 text-white shadow-md" : "bg-zinc-100 text-zinc-500"
                                    )}
                                >{cat.name}</button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {currentTab === 'menu' ? (
                    <ScrollArea className="h-full">
                        <div className="p-4 grid grid-cols-2 gap-4 pb-32">
                            {filteredServices.map(service => (
                                <div key={service.id} className="relative group aspect-square rounded-3xl overflow-hidden shadow-md bg-zinc-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <img 
                                        src={service.imageUrl || `https://picsum.photos/seed/${service.id}/600/600`} 
                                        alt={service.name}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    
                                    {/* Info Badge Top */}
                                    <div className="absolute top-3 left-3 z-10">
                                        <div className="px-2 py-1 rounded-lg bg-white/90 backdrop-blur-md border border-white/20 text-[8px] font-black uppercase tracking-widest text-zinc-900 shadow-sm">
                                            {service.category === 'Food' ? 'Cocina' : service.category === 'Beverage' ? 'Bar' : 'Tienda'}
                                        </div>
                                    </div>

                                    {/* Content Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                        <div className="space-y-3">
                                            <div className="space-y-0.5">
                                                <h3 className="text-white font-black text-xs uppercase leading-tight line-clamp-2 drop-shadow-md">{service.name}</h3>
                                                <p className="text-white/90 font-black text-lg tracking-tighter drop-shadow-md">{formatCurrency(service.price)}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="w-full h-9 bg-white text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="h-3 w-3" /> Agregar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-6 space-y-6 pb-32">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Mi Consumo</h2>
                                <p className="text-muted-foreground text-sm font-medium">Historial de pedidos confirmados en esta mesa.</p>
                            </div>

                            {!activeOrder ? (
                                <div className="text-center py-20 space-y-4">
                                    <div className="inline-flex p-6 bg-muted rounded-full">
                                        <PackageCheck className="h-10 w-10 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-muted-foreground font-bold">No hay pedidos registrados en su sesión actual.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-primary/5 rounded-3xl border-2 border-primary/10 p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Acumulado</p>
                                            <p className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</p>
                                        </div>
                                        <div className="h-14 w-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                            <Smartphone className="h-7 w-7" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Detalle de Pedidos</h3>
                                        <div className="bg-white rounded-3xl border p-5 shadow-sm space-y-4">
                                            {activeOrder.items.map((item, i) => (
                                                <div key={i} className="flex justify-between items-start gap-4">
                                                    <div className="flex-1 space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-5 w-5 rounded-md bg-zinc-100 flex items-center justify-center text-[10px] font-black">{item.quantity}x</div>
                                                            <p className="font-bold text-sm uppercase tracking-tight">{item.name}</p>
                                                        </div>
                                                        {item.notes && <p className="text-[10px] text-primary italic font-medium ml-7 border-l-2 pl-2 border-primary/20">"{item.notes}"</p>}
                                                    </div>
                                                    <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-muted/30 rounded-2xl border border-dashed flex items-start gap-3">
                                        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed tracking-wider">
                                            El pago debe realizarse directamente en recepción o contactando a un salonero al finalizar su estancia.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Cart Bar Floating */}
            {cart.length > 0 && currentTab === 'menu' && (
                <div className="fixed bottom-6 inset-x-6 z-30 animate-in slide-in-from-bottom-4 duration-500">
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="w-full h-16 bg-zinc-900 text-white rounded-2xl shadow-2xl flex items-center justify-between px-6 border border-white/10 active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                                <ShoppingCart className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{cart.length} Productos</p>
                                <p className="text-lg font-black tracking-tighter">Ver Carrito</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</p>
                        </div>
                    </button>
                </div>
            )}

            {/* Cart Dialog */}
            <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden border-0 bg-transparent shadow-none">
                    <div className="bg-white rounded-t-3xl p-6 flex-1 overflow-hidden flex flex-col">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Mi Pedido</DialogTitle>
                            <DialogDescription className="font-medium">Confirme los productos que desea solicitar.</DialogDescription>
                        </DialogHeader>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            <div className="space-y-4 pr-2 pb-4">
                                {cart.map((item, idx) => (
                                    <div key={idx} className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 space-y-1">
                                                <p className="font-black text-sm uppercase tracking-tight leading-tight">{item.service.name}</p>
                                                <p className="text-[10px] font-bold text-zinc-400">{formatCurrency(item.service.price)} c/u</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1.5 shadow-sm border border-primary/20">
                                                <button onClick={() => handleUpdateQuantity(idx, -1)} className="h-8 w-8 bg-white text-zinc-900 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Minus className="h-3 w-3" /></button>
                                                <span className="text-sm font-black w-6 text-center text-primary">{item.quantity}</span>
                                                <button onClick={() => handleUpdateQuantity(idx, 1)} className="h-8 w-8 bg-white text-zinc-900 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Plus className="h-3 w-3" /></button>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => { setEditingIdx(idx); setCurrentNote(item.notes || ''); setNoteDialogOpen(true); }}
                                            className={cn(
                                                "w-full h-9 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                                item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-white text-zinc-500 border-zinc-200"
                                            )}
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            {item.notes ? 'Editar Instrucciones' : '+ Añadir Notas Cocina'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="mt-6 pt-6 border-t space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">Monto del Pedido</span>
                                <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                            </div>
                            <Button 
                                onClick={handleConfirmOrder} 
                                disabled={isPending || cart.length === 0}
                                className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                            >
                                {isPending ? 'Enviando...' : 'Confirmar y Ordenar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="uppercase font-black text-lg">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription className="font-medium">Escriba indicaciones para la preparación de su pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            value={currentNote} 
                            onChange={(e) => setCurrentNote(e.target.value)}
                            placeholder="Ej: Término medio, sin cebolla, etc..."
                            className="min-h-[120px] rounded-2xl border-2 text-base font-bold p-4"
                            autoFocus
                        />
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
