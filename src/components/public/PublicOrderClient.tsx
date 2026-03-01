'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { RestaurantTable, Service, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { 
    Search, ShoppingCart, Plus, Minus, X, 
    ArrowRight, ChevronLeft, CheckCircle, Package, Utensils, Beer, Sun, MapPin, 
    Smartphone, History, Clock, MessageSquare,
    ImageIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const SESSION_KEY = 'motel_order_session_v1';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI State
    const [step, setStep] = useState(1); // 1: Table Selection, 2: Catalog, 3: Account Review
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Session State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);

    // Note Dialog State
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Tables
    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: tables, isLoading: isLoadingTables } = useCollection<RestaurantTable>(tablesQuery);

    // Fetch Products
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

    // Check session on load
    useEffect(() => {
        const session = localStorage.getItem(SESSION_KEY);
        if (session && tables) {
            const { tableId, orderId } = JSON.parse(session);
            const table = tables.find(t => t.id === tableId);
            if (table && table.status === 'Occupied') {
                setSelectedTable(table);
                setActiveOrderId(orderId);
                setStep(2);
            } else {
                localStorage.removeItem(SESSION_KEY);
            }
        }
    }, [tables]);

    // Real-time listener for current order (Privacy & Sync)
    const [orderData, setOrderData] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setOrderData(null);
            return;
        }
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    // Order finalized, clear session
                    localStorage.removeItem(SESSION_KEY);
                    setActiveOrderId(null);
                    setSelectedTable(null);
                    setStep(1);
                    toast({ title: 'Cuenta Pagada', description: '¡Gracias por su visita! La sesión ha finalizado.' });
                } else {
                    setOrderData({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
                setActiveOrderId(null);
                setStep(1);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId, toast]);

    const filteredTables = useMemo(() => {
        if (!tables) return [];
        return tables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [tables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        setStep(2);
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
            const existing = prev.find(i => i.service.id === serviceId);
            if (existing && existing.quantity > 1) {
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
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, 'Auto-Pedido', 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem(SESSION_KEY, JSON.stringify({ tableId: selectedTable.id, orderId: result.orderId }));
                }
                setCart([]);
                setStep(3);
                toast({ title: '¡Pedido Enviado!', description: 'Su pedido ha sido registrado correctamente.' });
            }
        });
    };

    if (isLoadingTables) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <Skeleton className="h-12 w-48" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-32 w-32 rounded-2xl" />
                    <Skeleton className="h-32 w-32 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-muted/30 overflow-hidden relative">
            
            {/* Header */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between shrink-0 z-20">
                {step > 1 ? (
                    <button onClick={() => setStep(step === 3 ? 2 : 1)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                ) : <div className="w-10 h-10" />}
                
                <h1 className="text-lg font-black uppercase tracking-tighter">
                    {step === 1 ? 'Bienvenido' : `${selectedTable?.number} - ${getLocationLabel(selectedTable?.type || '')}`}
                </h1>

                <button onClick={() => setStep(3)} className="relative h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <History className="h-5 w-5" />
                    {orderData && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-background">
                            !
                        </span>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                
                {/* Step 1: Selection */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col p-6 space-y-6 animate-in fade-in duration-500">
                        <div className="space-y-2 text-center py-4">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">¿Dónde se encuentra?</h2>
                            <p className="text-muted-foreground text-sm">Seleccione su mesa o ubicación para ver el menú.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                        <SelectValue placeholder="Todas las zonas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las zonas</SelectItem>
                                        <SelectItem value="Table">Mesa Salón</SelectItem>
                                        <SelectItem value="Bar">Barra</SelectItem>
                                        <SelectItem value="Terraza">Terraza</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <ScrollArea className="flex-1 h-[50vh]">
                                <div className="grid grid-cols-2 gap-4 pb-10">
                                    {filteredTables.map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => handleSelectTable(table)}
                                            className="group relative flex flex-col items-center justify-center h-32 rounded-3xl border-2 bg-background hover:border-primary hover:shadow-xl transition-all duration-300"
                                        >
                                            <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{TYPE_LABELS[table.type] || table.type}</span>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}

                {/* Step 2: Catalog */}
                {step === 2 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-4 space-y-4 bg-background border-b shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar algo delicioso..." 
                                    className="pl-9 h-12 bg-muted/30 border-none rounded-2xl text-base"
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
                                            selectedCategoryId === null ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground"
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
                                                selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground"
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => {
                                    const qty = cart.find(i => i.service.id === service.id)?.quantity || 0;
                                    return (
                                        <div key={service.id} className="group relative bg-background rounded-3xl border-2 overflow-hidden shadow-sm flex h-32 transition-all active:scale-[0.98]">
                                            <div className="w-32 h-full relative shrink-0">
                                                <Avatar className="h-full w-full rounded-none">
                                                    <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback className="bg-muted">
                                                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white text-primary text-[8px] font-black uppercase tracking-widest border shadow-sm">
                                                    {service.source === 'Internal' ? 'Cocina' : `Stock: ${service.stock}`}
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                                <div className="space-y-0.5">
                                                    <h3 className="font-black text-sm uppercase tracking-tight truncate">{service.name}</h3>
                                                    <p className="text-primary font-black text-lg">{formatCurrency(service.price)}</p>
                                                </div>
                                                
                                                <div className="flex items-center justify-end gap-2">
                                                    {qty > 0 ? (
                                                        <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1.5 border border-primary/20 animate-in zoom-in-95">
                                                            <button onClick={() => handleRemoveFromCart(service.id)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white text-primary shadow-sm active:scale-90">
                                                                <Minus className="h-4 w-4" />
                                                            </button>
                                                            <span className="font-black text-primary text-sm w-4 text-center">{qty}</span>
                                                            <button onClick={() => handleAddToCart(service)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white text-primary shadow-sm active:scale-90">
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleAddToCart(service)}
                                                            className="h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest px-6 shadow-md"
                                                        >
                                                            Añadir <Plus className="ml-1 h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Step 3: History & Account */}
                {step === 3 && (
                    <div className="flex-1 flex flex-col p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                            <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Estado de su consumo actual</p>
                        </div>

                        {!activeOrderId && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                <History className="h-16 w-16" />
                                <p className="font-bold text-lg">Aún no tiene pedidos registrados.</p>
                                <Button variant="outline" onClick={() => setStep(2)}>Ver el Menú</Button>
                            </div>
                        )}

                        {orderData && (
                            <ScrollArea className="flex-1">
                                <div className="space-y-4 pb-32">
                                    <div className="p-6 rounded-3xl bg-primary text-primary-foreground shadow-xl">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Acumulado</p>
                                        <p className="text-5xl font-black tracking-tighter">{formatCurrency(orderData.total)}</p>
                                        <div className="flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-widest bg-white/20 w-fit px-3 py-1.5 rounded-full">
                                            <Clock className="h-3 w-3" /> Pendiente de Pago
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Productos Pedidos</h3>
                                        <div className="space-y-2">
                                            {orderData.items.map((item, idx) => (
                                                <div key={idx} className="bg-background border rounded-2xl p-4 flex justify-between items-center shadow-sm">
                                                    <div>
                                                        <p className="font-black text-sm uppercase">{item.name}</p>
                                                        <p className="text-xs font-bold text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                                    </div>
                                                    <p className="font-black text-primary">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 border-2 border-dashed rounded-3xl text-center space-y-3 bg-muted/20">
                                        <Smartphone className="h-8 w-8 mx-auto opacity-30" />
                                        <p className="text-xs font-bold text-muted-foreground">Para cancelar su cuenta, por favor solicite el cobro en el POS o espere a ser atendido.</p>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Floating Bar */}
            {step === 2 && cart.length > 0 && (
                <div className="absolute bottom-6 inset-x-6 z-30 animate-in slide-in-from-bottom-8">
                    <div className="bg-black text-white rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl ring-4 ring-primary/20">
                        <div className="px-4">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Subtotal</p>
                            <p className="text-2xl font-black tracking-tighter">{formatCurrency(cart.reduce((s, i) => s + i.service.price * i.quantity, 0))}</p>
                        </div>
                        <button 
                            onClick={handleSendOrder}
                            disabled={isPending}
                            className="bg-primary hover:bg-primary/90 h-14 px-8 rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isPending ? 'Enviando...' : 'Confirmar Pedido'}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Kitchen Notes Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Indicaciones Especiales</DialogTitle>
                        <DialogDescription>¿Alguna instrucción para la preparación?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Sin hielo, término medio, etc." 
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 resize-none"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest" onClick={handleSaveNote}>
                            Guardar Indicación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function getLocationLabel(type: string) {
    if (type === 'Table') return 'Mesa';
    if (type === 'Bar') return 'Barra';
    if (type === 'Terraza') return 'Terraza';
    return type;
}

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};
