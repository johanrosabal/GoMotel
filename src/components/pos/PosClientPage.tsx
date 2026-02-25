
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
                // Refresh local service list to update stock
                getServices().then(setAvailableServices);
            }
        });
    };

    return (
        <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
            {/* Products Selection Area */}
            <div className={cn("lg:col-span-8 flex flex-col space-y-4", step === 2 && "hidden lg:flex")}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por nombre o código de producto..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 text-lg shadow-sm"
                    />
                </div>

                <ScrollArea className="flex-1 border rounded-xl bg-muted/5 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredServices.map(service => (
                            <Card 
                                key={service.id} 
                                className={cn(
                                    "cursor-pointer hover:border-primary/50 transition-all group overflow-hidden flex flex-col",
                                    (service.source !== 'Internal' && (service.stock || 0) <= 0) && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => (service.source === 'Internal' || (service.stock || 0) > 0) && handleAddToCart(service)}
                            >
                                <div className="aspect-video relative bg-muted flex items-center justify-center">
                                    {service.imageUrl ? (
                                        <img src={service.imageUrl} alt={service.name} className="object-cover w-full h-full" />
                                    ) : (
                                        <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm font-bold">
                                            {formatCurrency(service.price)}
                                        </Badge>
                                    </div>
                                    {(service.source !== 'Internal' && (service.stock || 0) <= 0) && (
                                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                            <Badge variant="destructive" className="font-black uppercase tracking-tighter">Agotado</Badge>
                                        </div>
                                    )}
                                </div>
                                <CardHeader className="p-3 pb-0">
                                    <CardTitle className="text-sm font-bold truncate leading-none">{service.name}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-semibold">
                                        {service.source === 'Internal' ? 'Producción' : `Stock: ${service.stock}`}
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="p-3 pt-2 mt-auto">
                                    <Button size="sm" variant="outline" className="w-full h-8 gap-1 font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <Plus className="h-3 w-3" /> Añadir
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Cart & Checkout Area */}
            <div className={cn("lg:col-span-4 flex flex-col h-full", step === 1 && "hidden lg:flex")}>
                <Card className="flex flex-col h-full shadow-lg border-primary/10">
                    <CardHeader className="p-4 bg-muted/30 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" /> 
                                Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})
                            </CardTitle>
                            {step === 1 && cart.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={handleClearCart} className="text-destructive h-8 px-2 font-bold uppercase text-[10px]">
                                    Vaciar
                                </Button>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1 px-4">
                            {step === 1 ? (
                                <div className="py-4 space-y-3">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                            <p className="font-medium">El carrito está vacío</p>
                                            <p className="text-xs">Seleccione productos de la izquierda</p>
                                        </div>
                                    ) : (
                                        cart.map(item => (
                                            <div key={item.service.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border bg-background/50">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate">{item.service.name}</p>
                                                    <p className="text-xs text-muted-foreground">{formatCurrency(item.service.price)} c/u</p>
                                                </div>
                                                <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveFromCart(item.service.id)}><Minus className="h-3 w-3" /></Button>
                                                    <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleAddToCart(item.service)} disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}><Plus className="h-3 w-3" /></Button>
                                                </div>
                                                <div className="text-right w-20">
                                                    <p className="text-sm font-black">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form className="py-4 space-y-6">
                                        <div className="space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="clientName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Facturar a nombre de</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-10 h-11" placeholder="Nombre del cliente" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="paymentMethod"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Método de Pago</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-11 font-bold">
                                                                    <SelectValue placeholder="Seleccione" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Efectivo"><div className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Efectivo</div></SelectItem>
                                                                <SelectItem value="Sinpe Movil"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> SINPE Móvil</div></SelectItem>
                                                                <SelectItem value="Tarjeta"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Tarjeta (Voucher)</div></SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {paymentMethod === 'Efectivo' && (
                                                <div className="p-4 rounded-xl bg-muted/30 border space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase">Monto Recibido</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="₡0.00"
                                                            value={cashTendered}
                                                            onChange={handleCashTenderedChange}
                                                            className="h-12 text-right text-xl font-black"
                                                        />
                                                    </div>
                                                    {numericCashTendered >= grandTotal && (
                                                        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                                                            <span className="font-bold text-xs uppercase">Vuelto</span>
                                                            <span className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - grandTotal)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {paymentMethod === 'Sinpe Movil' && (
                                                <div className="space-y-4">
                                                    {targetSinpeAccount ? (
                                                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4 text-center">
                                                            <p className="text-xs text-muted-foreground uppercase font-bold">Solicitar transferencia a:</p>
                                                            <div className="space-y-1">
                                                                <p className="text-3xl font-black font-mono tracking-tighter">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                <p className="text-[10px] font-black uppercase opacity-60">{targetSinpeAccount.accountHolder}</p>
                                                            </div>
                                                            <FormField
                                                                control={form.control}
                                                                name="paymentConfirmed"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-background p-4 text-left shadow-sm">
                                                                        <FormControl>
                                                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                                        </FormControl>
                                                                        <div className="space-y-1 leading-none">
                                                                            <FormLabel className="font-bold text-xs">He recibido el pago</FormLabel>
                                                                        </div>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-xs text-center font-bold border border-destructive/20 uppercase">
                                                            No hay cuentas SINPE con saldo disponible
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
                                                            <FormLabel className="text-xs font-bold uppercase">Número de Voucher</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Código de transacción" {...field} className="h-11 font-mono text-center" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </div>
                                    </form>
                                </Form>
                            )}
                        </ScrollArea>

                        <div className="p-4 border-t bg-muted/10 space-y-4 mt-auto">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {appliedTaxes.map(tax => (
                                    <div key={tax.taxId} className="flex justify-between text-xs text-muted-foreground">
                                        <span>{tax.name} ({tax.percentage}%)</span>
                                        <span>{formatCurrency(tax.amount)}</span>
                                    </div>
                                ))}
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-base font-black uppercase tracking-tighter">Total</span>
                                    <span className="text-2xl font-black text-primary">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>

                            {step === 1 ? (
                                <Button 
                                    className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                    disabled={cart.length === 0}
                                    onClick={() => setStep(2)}
                                >
                                    Pagar Ahora <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button variant="outline" className="h-14 font-bold" onClick={() => setStep(1)} disabled={isPending}>
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Button 
                                        className="flex-1 h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                        onClick={form.handleSubmit(handleProcessSale)}
                                        disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                                    >
                                        {isPending ? "Procesando..." : <>Vender Ahora <CheckCircle className="ml-2 h-5 w-5" /></>}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <InvoiceSuccessDialog 
                open={successModalOpen}
                onOpenChange={setSuccessModalOpen}
                invoiceId={generatedInvoiceId}
            />
        </div>
    );
}
