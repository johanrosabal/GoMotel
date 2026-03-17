
'use client';

import { useState, useEffect, useTransition, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import type { RestaurantTable, Service, Order, ProductCategory, ProductSubCategory, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ShoppingCart, Plus, Minus, Search, Utensils, 
    CheckCircle, Clock, Info, ChevronRight, MessageSquare,
    ReceiptText, PackageOpen
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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

function OrderPageContent() {
    const searchParams = useSearchParams();
    const tableId = searchParams.get('tableId');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // UI States
    const [activeTab, setActiveTab] = useState('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Kitchen Notes dialog
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // 1. Fetch Table Data
    const tableRef = useMemoFirebase(() => tableId ? doc(firestore!, 'restaurantTables', tableId) : null, [firestore, tableId]);
    const { data: table, isLoading: isLoadingTable } = useDoc<RestaurantTable>(tableRef);

    // 2. Fetch Active Order for this table
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!tableId || !firestore) return;
        const q = query(collection(firestore, 'orders'), where('locationId', '==', tableId), where('paymentStatus', '==', 'Pendiente'));
        return onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
                setCurrentOrder(orders[0]); // Take the first active order
            } else {
                setCurrentOrder(null);
            }
        });
    }, [tableId, firestore]);

    // 3. Fetch Menu Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => { getServices().then(setAvailableServices); }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    // Financial Calculations
    const billing = useMemo(() => {
        const orderItems = currentOrder?.items || [];
        const sub = orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        
        let taxTotal = 0;
        const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();

        if (allTaxes && currentOrder) {
            orderItems.forEach(item => {
                const itemTotal = item.price * item.quantity;
                const service = availableServices.find(s => s.id === item.serviceId);
                const taxIds = service?.taxIds || [];
                
                // Add restaurant service tax if applicable
                const serviceTax = allTaxes.find(t => t.name.toLowerCase().includes('servicio'));
                const effectiveTaxIds = new Set(taxIds);
                if (serviceTax) effectiveTaxIds.add(serviceTax.id);

                effectiveTaxIds.forEach(tId => {
                    const tInfo = allTaxes.find(t => t.id === tId);
                    if (tInfo) {
                        const amt = itemTotal * (tInfo.percentage / 100);
                        taxTotal += amt;
                        const existing = taxMap.get(tId);
                        if (existing) existing.amount += amt;
                        else taxMap.set(tId, { name: tInfo.name, percentage: tInfo.percentage, amount: amt });
                    }
                });
            });
        }

        return {
            subtotal: sub,
            taxes: Array.from(taxMap.values()),
            total: sub + taxTotal
        };
    }, [currentOrder, allTaxes, availableServices]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado al carrito", description: service.name, duration: 1500 });
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

    const handleSendOrder = () => {
        if (!tableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (currentOrder) {
                result = await addToTableAccount(currentOrder.id, cart);
            } else {
                result = await openTableAccount(tableId, cart, `Cliente ${TYPE_LABELS[table!.type]} ${table!.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: "Error al pedir", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está en preparación." });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (isLoadingTable) {
        return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-bold animate-pulse">CARGANDO MENÚ...</div>;
    }

    if (!table) {
        return (
            <div className="min-h-screen bg-neutral-950 p-6 flex flex-col items-center justify-center text-center">
                <PackageOpen className="h-16 w-16 text-primary mb-4" />
                <h1 className="text-white text-2xl font-black uppercase tracking-tighter">Ubicación No Válida</h1>
                <p className="text-neutral-400 mt-2">Por favor escanee el código QR de su mesa nuevamente.</p>
            </div>
        );
    }

    const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const cartTotal = cart.reduce((sum, i) => sum + (i.service.price * i.quantity), 0);

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto border-x border-neutral-900 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-neutral-900/50 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                            <Utensils className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-lg tracking-tighter uppercase leading-none">AUTO-SERVICIO</h1>
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                                {TYPE_LABELS[table.type] || table.type} {table.number}
                            </p>
                        </div>
                    </div>
                    {cartCount > 0 && (
                        <Badge className="bg-primary text-white h-8 px-3 font-black animate-bounce">
                            {cartCount} ITEMS
                        </Badge>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <Input 
                        placeholder="Buscar comida o bebida..." 
                        className="bg-neutral-800 border-none rounded-xl pl-9 text-white placeholder:text-neutral-600 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="bg-neutral-900/30 p-2">
                    <TabsList className="grid w-full grid-cols-2 bg-neutral-800/50 rounded-xl h-12 p-1">
                        <TabsTrigger value="menu" className="rounded-lg font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary">EL MENÚ</TabsTrigger>
                        <TabsTrigger value="account" className="rounded-lg font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary relative">
                            MI CUENTA
                            {currentOrder && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 overflow-hidden mt-0">
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-neutral-900 bg-neutral-900/20">
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                            !selectedCategoryId ? "bg-primary text-white" : "bg-neutral-800 text-neutral-400"
                                        )}
                                    >TODOS</button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-neutral-800 text-neutral-400"
                                            )}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="flex gap-4 p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 hover:border-primary/30 transition-all">
                                        <Avatar className="h-24 w-24 rounded-xl border border-neutral-800 shrink-0">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-neutral-800 text-neutral-600"><Utensils className="h-8 w-8" /></AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 flex flex-col justify-between py-1">
                                            <div>
                                                <h3 className="font-black text-sm uppercase tracking-tight line-clamp-1">{service.name}</h3>
                                                <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1 leading-tight">{service.description || 'Sin descripción disponible.'}</p>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="font-black text-primary text-base">{formatCurrency(service.price)}</span>
                                                <Button 
                                                    size="sm" 
                                                    className="rounded-lg h-8 px-3 font-black text-[10px] uppercase bg-neutral-800 hover:bg-primary"
                                                    onClick={() => handleAddToCart(service)}
                                                >
                                                    AÑADIR <Plus className="ml-1 h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </TabsContent>

                <TabsContent value="account" className="flex-1 overflow-hidden mt-0 p-4">
                    <ScrollArea className="h-full">
                        <div className="space-y-6 pb-24">
                            {currentOrder ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h2 className="font-black text-xs uppercase tracking-widest text-neutral-500">Consumo Acumulado</h2>
                                        <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px] font-black uppercase">EN PREPARACIÓN</Badge>
                                    </div>
                                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
                                        {currentOrder.items.map((item, idx) => (
                                            <div key={idx} className="p-4 border-b border-neutral-800/50 flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm uppercase tracking-tight">{item.name}</span>
                                                    <span className="text-[10px] font-bold text-neutral-500">{item.quantity} x {formatCurrency(item.price)}</span>
                                                </div>
                                                <span className="font-black text-neutral-200">{formatCurrency(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                        
                                        {/* Financial Summary */}
                                        <div className="p-4 bg-neutral-900/50 space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                                <span>Subtotal Neto</span>
                                                <span>{formatCurrency(billing.subtotal)}</span>
                                            </div>
                                            {billing.taxes.map((tax, i) => (
                                                <div key={i} className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                                    <span>{tax.name} {tax.percentage}%</span>
                                                    <span>{formatCurrency(tax.amount)}</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
                                                <span className="text-sm font-black uppercase tracking-tighter text-primary">Total a Pagar</span>
                                                <span className="text-xl font-black text-white">{formatCurrency(billing.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex gap-3 items-start">
                                        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-primary/80 font-bold leading-tight">
                                            Para pagar su cuenta o solicitar factura electrónica, por favor llame a un salonero o diríjase a la caja.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 opacity-20 flex flex-col items-center">
                                    <ReceiptText className="h-16 w-16 mb-4" />
                                    <p className="font-black uppercase text-sm tracking-widest">Sin consumos aún</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Sticky Action Bar */}
            {cart.length > 0 && (
                <div className="p-4 bg-neutral-900 border-t border-neutral-800 fixed bottom-0 left-0 right-0 max-w-md mx-auto animate-in slide-in-from-bottom-full duration-300 shadow-2xl z-30">
                    <div className="flex gap-3">
                        <Button 
                            variant="outline" 
                            className="bg-neutral-800 border-none h-14 w-14 rounded-2xl shrink-0"
                            onClick={() => setCart([])}
                        >
                            <ShoppingCart className="h-6 w-6 text-neutral-400" />
                        </Button>
                        <Button 
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
                            onClick={handleSendOrder}
                            disabled={isPending}
                        >
                            {isPending ? "ENVIANDO..." : `PEDIR ${formatCurrency(cartTotal)}`}
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Kitchen Notes Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-white">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-neutral-500">Ej: Término de carne, sin cebolla, etc.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span className="font-black text-xs uppercase text-primary">
                                {editingNoteIndex !== null ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <Textarea 
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            placeholder="Escriba aquí sus indicaciones..."
                            className="bg-neutral-800 border-neutral-700 min-h-[120px] rounded-xl text-white font-bold"
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setNoteDialogOpen(false)} className="text-neutral-400 hover:text-white">CANCELAR</Button>
                        <Button onClick={handleSaveNote} className="font-black uppercase text-xs tracking-widest h-11 rounded-xl">GUARDAR NOTA</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function OrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-bold">CARGANDO...</div>}>
            <OrderPageContent />
        </Suspense>
    );
}
