'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax } from '@/types';
import { createDirectSale } from '@/lib/actions/pos.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, X, CheckCircle, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    Tag, ImageIcon, User
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InvoiceSuccessDialog from '../reservations/InvoiceSuccessDialog';
import { Label } from '../ui/label';

const posPaymentSchema = z.object({
  clientName: z.string().default('Cliente de Contado'),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']),
  paymentConfirmed: z.boolean().default(false),
  voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

type CartItem = {
  service: Service;
  quantity: number;
};

export default function PosClientPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [step, setStep] = useState(1); // 1: Select, 2: Payment
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);
    const [cashTendered, setCashTendered] = useState('');

    const form = useForm<z.infer<typeof posPaymentSchema>>({
        resolver: zodResolver(posPaymentSchema),
        defaultValues: { clientName: 'Cliente de Contado', paymentMethod: 'Efectivo', paymentConfirmed: false, voucherNumber: '' },
    });

    const paymentMethod = form.watch('paymentMethod');

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, 
        [firestore]
    );
    const { data: activeSinpeAccounts } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    // Calculations
    const filteredServices = useMemo(() => {
        return availableServices.filter(s => 
            s.isActive && 
            (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [availableServices, searchTerm]);

    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let tax = 0;
        const taxes: AppliedTax[] = [];

        if (allTaxes) {
            const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemTotal * (taxInfo.percentage / 100);
                        tax += taxAmount;
                        const existingTax = taxMap.get(taxId);
                        if (existingTax) existingTax.amount += taxAmount;
                        else taxMap.set(taxId, { name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                });
            });
            taxMap.forEach((value, key) => taxes.push({ taxId: key, ...value }));
        }
        return { subtotal: sub, totalTax: tax, grandTotal: sub + tax, appliedTaxes: taxes };
    }, [cart, allTaxes]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + grandTotal) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, grandTotal]);

    // Handlers
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

    const handleClearCart = () => setCart([]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = Number(cashTendered.replace(/\D/g, ''));

    const handleProcessSale = (values: z.infer<typeof posPaymentSchema>) => {
        if (cart.length === 0) return;

        startTransition(async () => {
            const result = await createDirectSale({
                items: cart.map(i => ({
                    serviceId: i.service.id,
                    name: i.service.name,
                    quantity: i.quantity,
                    price: i.service.price,
                })),
                clientName: values.clientName,
                paymentMethod: values.paymentMethod,
                voucherNumber: values.voucherNumber,
                subtotal,
                taxes: appliedTaxes,
                total: grandTotal,
            });

            if (result.error) {
                toast({ title: 'Error en venta', description: result.error, variant: 'destructive' });
            } else {
                setGeneratedInvoiceId(result.invoiceId);
                setSuccessModalOpen(true);
                handleClearCart();
                setStep(1);
                form.reset();
                setCashTendered('');
                getServices().then(setAvailableServices);
            }
        });
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
            {/* Products Selection Area */}
            <div className={cn("flex-1 flex flex-col min-w-0 bg-muted/5 border-r", step === 2 && "hidden lg:flex")}>
                <div className="p-3 border-b bg-background flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Búsqueda rápida de productos..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 border-muted-foreground/20"
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 bg-background/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 p-1 gap-1">
                        {filteredServices.map(service => (
                            <div 
                                key={service.id} 
                                className={cn(
                                    "cursor-pointer hover:ring-2 hover:ring-primary transition-all group overflow-hidden flex flex-col bg-card border",
                                    (service.source !== 'Internal' && (service.stock || 0) <= 0) && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => (service.source === 'Internal' || (service.stock || 0) > 0) && handleAddToCart(service)}
                            >
                                <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                                    {service.imageUrl ? (
                                        <img 
                                            src={service.imageUrl} 
                                            alt={service.name} 
                                            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110" 
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest text-center px-2">Sin imagen</span>
                                        </div>
                                    )}
                                    
                                    {/* Text Overlay */}
                                    <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
                                        <div className="flex flex-col gap-0.5">
                                            <span 
                                                className="text-white font-black text-[13px] uppercase leading-tight drop-shadow-lg line-clamp-2"
                                                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                            >
                                                {service.name}
                                            </span>
                                            <span 
                                                className="text-white/80 font-mono text-[9px] drop-shadow-sm"
                                                style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.8)' }}
                                            >
                                                {service.code}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-1.5 right-1.5">
                                        <Badge variant="default" className="bg-primary/90 backdrop-blur-sm font-black text-[12px] px-2 h-6 shadow-lg border-0">
                                            {formatCurrency(service.price)}
                                        </Badge>
                                    </div>
                                    
                                    {(service.source !== 'Internal' && (service.stock || 0) <= 0) && (
                                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[1px]">
                                            <Badge variant="destructive" className="font-black uppercase tracking-tighter text-[9px]">Agotado</Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="p-0.5 bg-muted/20 border-t">
                                    <Badge variant="outline" className={cn(
                                        "w-full justify-center text-[9px] h-5 font-black border-0 rounded-none uppercase",
                                        service.source === 'Internal' ? "bg-indigo-50 text-indigo-700" : "bg-white/50 text-muted-foreground"
                                    )}>
                                        {service.source === 'Internal' ? 'Producto de Cocina' : `Stock: ${service.stock}`}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Cart & Checkout Area */}
            <div className={cn("w-full lg:w-[380px] xl:w-[420px] flex flex-col h-full bg-card shadow-2xl z-10", step === 1 && "hidden lg:flex")}>
                <div className="p-4 border-b bg-muted/30 flex justify-between items-center h-14 shrink-0">
                    <CardTitle className="text-sm flex items-center gap-2 font-black uppercase tracking-tighter">
                        <ShoppingCart className="h-4 w-4 text-primary" /> 
                        Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                    </CardTitle>
                    {step === 1 && cart.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleClearCart} className="text-destructive h-8 px-2 font-bold uppercase text-[9px] hover:bg-destructive/10">
                            Limpiar Todo
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1">
                        {step === 1 ? (
                            <div className="p-3 space-y-2">
                                {cart.length === 0 ? (
                                    <div className="text-center py-32 text-muted-foreground animate-in fade-in duration-500">
                                        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-5" />
                                        <p className="font-bold text-[10px] uppercase tracking-widest opacity-30">Seleccione productos</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.service.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-background shadow-sm animate-in slide-in-from-right-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-[11px] truncate uppercase tracking-tight">{item.service.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.service.price)}</p>
                                            </div>
                                            <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5 border">
                                                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                    <Minus className="h-2.5 w-2.5" />
                                                </Button>
                                                <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-5 w-5 rounded-full" 
                                                    onClick={() => handleAddToCart(item.service)} 
                                                    disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                >
                                                    <Plus className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                            <div className="text-right w-16">
                                                <p className="text-[11px] font-black text-primary">{formatCurrency(item.service.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <Form {...form}>
                                <form className="p-4 space-y-5">
                                    <FormField
                                        control={form.control}
                                        name="clientName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Facturar a</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input {...field} className="pl-9 h-10 font-bold text-xs" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="paymentMethod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Método de Pago</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-10 font-black uppercase text-[10px] tracking-widest">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Efectivo"><div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Efectivo</div></SelectItem>
                                                        <SelectItem value="Sinpe Movil"><div className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> SINPE Móvil</div></SelectItem>
                                                        <SelectItem value="Tarjeta"><div className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Tarjeta</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    {paymentMethod === 'Efectivo' && (
                                        <div className="p-3 rounded-xl bg-primary/5 border-2 border-primary/10 space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-primary/70">Monto Recibido</Label>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="₡0.00"
                                                    value={cashTendered}
                                                    onChange={handleCashTenderedChange}
                                                    className="h-12 text-right text-xl font-black bg-background border-primary/20"
                                                />
                                            </div>
                                            {numericCashTendered >= grandTotal && (
                                                <div className="flex justify-between items-center p-2 bg-primary/10 rounded-lg">
                                                    <span className="font-black text-[9px] uppercase text-primary">Vuelto</span>
                                                    <span className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - grandTotal)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {paymentMethod === 'Sinpe Movil' && (
                                        <div className="space-y-3">
                                            {targetSinpeAccount ? (
                                                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 space-y-3 text-center">
                                                    <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-widest">Enviar SINPE a:</p>
                                                    <p className="text-3xl font-black font-mono tracking-tighter text-indigo-900 dark:text-indigo-100">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                    <FormField
                                                        control={form.control}
                                                        name="paymentConfirmed"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-lg border bg-background p-3 text-left">
                                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                <FormLabel className="font-black text-[10px] uppercase">Pago recibido</FormLabel>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-[9px] text-center font-black border uppercase">
                                                    Límite SINPE excedido
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {paymentMethod === 'Tarjeta' && (
                                        <FormField
                                            control={form.control}
                                            name="voucherNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Voucher</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Código de voucher" {...field} className="h-10 font-bold font-mono text-center text-sm border-2" />
                                                    </FormControl>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </form>
                            </Form>
                        )}
                    </ScrollArea>

                    <div className="p-4 border-t bg-background space-y-3 mt-auto shrink-0">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {appliedTaxes.map(tax => (
                                <div key={tax.taxId} className="flex justify-between text-[9px] font-bold text-muted-foreground/60 uppercase">
                                    <span>{tax.name} {tax.percentage}%</span>
                                    <span>{formatCurrency(tax.amount)}</span>
                                </div>
                            ))}
                            <Separator className="my-1.5" />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total</span>
                                <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        {step === 1 ? (
                            <Button 
                                className="w-full h-12 text-xs font-black uppercase tracking-widest rounded-xl"
                                disabled={cart.length === 0}
                                onClick={() => setStep(2)}
                            >
                                CONTINUAR AL PAGO <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" className="h-12 w-12 rounded-xl" onClick={() => setStep(1)} disabled={isPending}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button 
                                    className="flex-1 h-12 text-xs font-black uppercase tracking-widest rounded-xl"
                                    onClick={form.handleSubmit(handleProcessSale)}
                                    disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                                >
                                    {isPending ? "PROCESANDO..." : "COMPLETAR VENTA"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <InvoiceSuccessDialog 
                open={successModalOpen}
                onOpenChange={setSuccessModalOpen}
                invoiceId={generatedInvoiceId}
            />
        </div>
    );
}