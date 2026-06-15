'use client';

import React, { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { checkOut } from '@/lib/actions/room.actions';
import type { Room, Stay, Order, SinpeAccount } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { format, formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { CheckCircle, Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft, ReceiptText, Zap, Info, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';

interface CheckoutDialogProps {
    children: ReactNode;
    stay?: Stay | null;
    room?: Room | null;
    orders: Order[];
    onCheckoutSuccess?: (invoiceId: string) => void;
}

const checkoutPaymentSchema = z.object({
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

export default function CheckoutDialog({ children, stay, room, orders, onCheckoutSuccess }: CheckoutDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1); // 1: Summary, 2: Payment, 3: Zero Balance Confirm
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [cashTendered, setCashTendered] = useState('');

    const form = useForm<z.infer<typeof checkoutPaymentSchema>>({
        resolver: zodResolver(checkoutPaymentSchema),
        defaultValues: { paymentMethod: 'Efectivo', paymentConfirmed: false, voucherNumber: '' },
    });

    const paymentMethod = form.watch('paymentMethod');

    const sinpeAccountsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null,
        [firestore]
    );
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const billing = useMemo(() => {
        if (!stay || !room) return { duration: 'N/D', roomTotal: 0, servicesTotal: 0, upfrontPaid: 0, totalDue: 0, unpaidOrders: [] };

        const roomTotal = stay.pricePlanAmount || 0;
        const unpaidOrders = orders.filter(o => o.status !== 'Cancelado' && o.paymentStatus !== 'Pagado');
        
        // Use the final total from each order (includes taxes if they were saved correctly)
        const servicesTotal = unpaidOrders.reduce((sum, o) => sum + o.total, 0);
        
        const upfrontPaid = stay.paymentAmount || 0;
        const totalDue = (roomTotal + servicesTotal) - upfrontPaid;

        const duration = formatDistance(new Date(), stay.checkIn.toDate(), { locale: es });

        return { duration, roomTotal, servicesTotal, upfrontPaid, totalDue: totalDue < 0 ? 0 : totalDue, unpaidOrders };
    }, [stay, room, orders]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + billing.totalDue) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, billing.totalDue]);

    useEffect(() => {
        if (!open) {
            setStep(1);
            form.reset();
            setCashTendered('');
        }
    }, [open, form]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = Number(cashTendered.replace(/\D/g, ''));

    const handleProcessCheckout = (values: z.infer<typeof checkoutPaymentSchema>) => {
        if (!stay || !room) return;

        startTransition(async () => {
            const result = await checkOut(stay.id, room.id, {
                paymentMethod: values.paymentMethod,
                voucherNumber: values.voucherNumber,
                amountPaid: billing.totalDue,
            });

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const id = result.invoiceId;
                setOpen(false);
                if (id && onCheckoutSuccess) {
                    setTimeout(() => onCheckoutSuccess(id), 200);
                } else {
                    toast({ title: '¡Éxito!', description: 'Check-out completado correctamente.' });
                }
            }
        });
    };

    const onNextStep = () => {
        if (billing.totalDue > 0) {
            setStep(2);
        } else {
            setStep(3);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto scrollbar-hide p-0 border-none bg-slate-950/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
                <div className="relative overflow-hidden">
                     {/* Decorative background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />

                    <div className="p-5 sm:p-8 relative z-10">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner text-rose-500">
                                    <ReceiptText className="h-6 w-6" />
                                </div>
                                <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                    {step === 1 ? 'Resumen Check-Out' : 'Procesar Liquidación'}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-slate-400 font-medium leading-relaxed">
                                {step === 1
                                    ? `Auditoría de cuenta para ${stay?.guestName}.`
                                    : step === 2 
                                        ? `Seleccione el método de pago para el saldo pendiente.`
                                        : `Confirmación de salida sin saldo pendiente.`}
                            </DialogDescription>
                        </DialogHeader>

                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.div 
                                    key="summary"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 space-y-5 shadow-inner relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                            <Zap className="h-16 w-16 text-white" />
                                        </div>
                                        
                                        <div className="flex justify-between items-center group">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tiempo Transcurrido</span>
                                            <div className="flex items-center gap-2 text-slate-200">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="font-bold text-sm italic">{billing.duration}</span>
                                            </div>
                                        </div>
                                        <Separator className="bg-white/5" />
                                        
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-slate-500 uppercase tracking-widest">Hospedaje ({stay?.pricePlanName})</span>
                                                <span className="text-slate-200 tracking-tight">{formatCurrency(billing.roomTotal)}</span>
                                            </div>
                                            {billing.unpaidOrders.length > 0 && (
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-slate-500 uppercase tracking-widest">Consumos y Servicios</span>
                                                    <span className="text-slate-200 tracking-tight">{formatCurrency(billing.servicesTotal)}</span>
                                                </div>
                                            )}
                                            {billing.upfrontPaid > 0 && (
                                                <div className="flex justify-between text-xs font-black text-emerald-500 pt-1">
                                                    <span className="uppercase tracking-[0.2em]">Pagos Realizados</span>
                                                    <span>-{formatCurrency(billing.upfrontPaid)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-5 border-t border-white/10 flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">Total Neto a Pagar</span>
                                                <span className={cn(
                                                    "text-4xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                                                    billing.totalDue === 0 ? "text-emerald-500" : "text-white"
                                                )}>
                                                    {formatCurrency(billing.totalDue)}
                                                </span>
                                            </div>
                                            {billing.totalDue === 0 && <Badge className="bg-emerald-500 text-black h-6 font-black uppercase tracking-widest text-[8px] mb-2">Saldado</Badge>}
                                        </div>
                                    </div>

                                    {billing.unpaidOrders.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                                                <Info className="h-3 w-3" />
                                                Cronograma de Consumos
                                            </h4>
                                            <ScrollArea className="max-h-[30vh]">
                                                <div className="space-y-2 pr-4">
                                                    {billing.unpaidOrders.map(order => (
                                                        <div key={order.id} className="p-4 border border-white/5 rounded-2xl bg-white/[0.02] space-y-2 group hover:bg-white/[0.04] transition-all">
                                                            <div className="flex justify-between mb-2">
                                                                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">{format(order.createdAt.toDate(), 'HH:mm')} — {order.id.slice(-4).toUpperCase()}</span>
                                                            </div>
                                                            {order.items.map(item => (
                                                                <div key={item.serviceId} className="flex justify-between text-[11px] font-bold">
                                                                    <span className="text-slate-400"><span className="text-slate-600 font-black mr-1">{item.quantity}x</span> {item.name}</span>
                                                                    <span className="text-slate-200">{formatCurrency(item.price * item.quantity)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </motion.div>
                            ) : step === 2 ? (
                                <motion.div 
                                    key="payment"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <Form {...form}>
                                        <form id="checkout-payment-form" className="space-y-6" onSubmit={(e) => e.preventDefault()} data-testid="checkoutdialog-main-form">
                                            <FormField
                                                control={form.control}
                                                name="paymentMethod"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Método de Liquidación</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 focus:ring-primary/20 transition-all font-bold" id="checkoutdialog-selecttrigger-1" data-testid="checkoutdialog-method-select">
                                                                    <SelectValue placeholder="Seleccione método" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                                                <SelectItem value="Efectivo" className="py-3 font-bold">
                                                                    <div className="flex items-center gap-3"><Wallet className="h-4 w-4 text-emerald-400" /> Efectivo (Cash)</div>
                                                                </SelectItem>
                                                                <SelectItem value="Sinpe Movil" className="py-3 font-bold">
                                                                    <div className="flex items-center gap-3"><Smartphone className="h-4 w-4 text-primary" /> SINPE Móvil</div>
                                                                </SelectItem>
                                                                <SelectItem value="Tarjeta" className="py-3 font-bold">
                                                                    <div className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-blue-400" /> Tarjeta (Voucher)</div>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <AnimatePresence mode="wait">
                                                {paymentMethod === 'Efectivo' && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-4 shadow-xl"
                                                    >
                                                        <div className="space-y-3">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Monto Recibido</Label>
                                                            <div className="relative">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-500 opacity-30 italic">₡</div>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder="0.00"
                                                                    value={cashTendered}
                                                                    onChange={handleCashTenderedChange}
                                                                    className="h-16 bg-transparent border-none text-right text-3xl font-black tracking-tighter text-white focus-visible:ring-0" id="checkoutdialog-input-0-00" data-testid="checkoutdialog-cash-received-input"
                                                                />
                                                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                                                            </div>
                                                        </div>
                                                        {numericCashTendered >= billing.totalDue && (
                                                            <motion.div 
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner"
                                                            >
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Vuelto Sugerido</span>
                                                                <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]">{formatCurrency(numericCashTendered - billing.totalDue)}</span>
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                )}

                                                {paymentMethod === 'Sinpe Movil' && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="space-y-4"
                                                    >
                                                        {isLoadingSinpe ? (
                                                            <p className="text-center text-[10px] font-bold uppercase py-4 animate-pulse">Buscando canal disponible...</p>
                                                        ) : targetSinpeAccount ? (
                                                            <div className="p-6 rounded-[2rem] bg-primary/[0.03] border border-primary/20 space-y-6 text-center shadow-xl">
                                                                <p className="text-[10px] font-black tracking-[0.2em] text-primary/70 uppercase">Transferir <span className='text-white'>{formatCurrency(billing.totalDue)}</span> a:</p>
                                                                <div className="space-y-1">
                                                                    <p className="text-4xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{targetSinpeAccount.accountHolder}</p>
                                                                </div>
                                                                <FormField
                                                                    control={form.control}
                                                                    name="paymentConfirmed"
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex flex-row items-center space-x-4 space-y-0 rounded-[1.5rem] border border-white/5 bg-slate-950/50 p-5 text-left shadow-sm group hover:border-primary/40 transition-all">
                                                                            <FormControl>
                                                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg border-primary/40 data-[state=checked]:bg-primary" id="checkoutdialog-checkbox-1" data-testid="checkoutdialog-payment-confirmed-checkbox" />
                                                                            </FormControl>
                                                                            <div className="space-y-1">
                                                                                <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-200">Pago Recibido</FormLabel>
                                                                                <p className="text-[9px] text-slate-500 font-medium">Confirme que el dinero ya está en la cuenta bancaria.</p>
                                                                            </div>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="p-6 bg-rose-500/10 text-rose-500 rounded-[2rem] text-[10px] font-black uppercase text-center border border-rose-500/20 tracking-widest">
                                                                No hay cuentas SINPE con límite suficiente. Use Efectivo o Tarjeta.
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}

                                                {paymentMethod === 'Tarjeta' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                    >
                                                        <FormField
                                                            control={form.control}
                                                            name="voucherNumber"
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-3">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Número de Voucher</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="INGRESE LOS ULTIMOS 6 DIGITOS" {...field} className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-center text-lg uppercase tracking-widest text-primary focus-visible:ring-primary/20" id="checkoutdialog-input-ingrese-el-c-digo" data-testid="checkoutdialog-voucher-input" />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </form>
                                    </Form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="zero-confirm"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="space-y-6 py-4"
                                >
                                    <div className="p-8 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 text-center space-y-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                        
                                        <div className="relative mx-auto w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                                            <CheckCircle className="h-10 w-10 text-emerald-500" />
                                            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
                                        </div>

                                        <div className="space-y-3 relative">
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Sin Saldos Pendientes</h3>
                                            <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                                                El cliente <span className="text-emerald-400 font-bold">{stay?.guestName}</span> no tiene saldos pendientes. 
                                                <br/><br/>
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">No se generará factura</span>
                                            </p>
                                        </div>

                                        <div className="pt-4 flex flex-col gap-2 relative">
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">¿Desea finalizar la estancia ahora?</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                            {step === 1 ? (
                                <div className="flex gap-3 mt-6">
                                    <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-14 rounded-2xl border border-white/5 font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-white transition-all" disabled={isPending} id="checkoutdialog-button-cancelar" data-testid="checkoutdialog-cancel-button">Cancelar</Button>
                                    <Button
                                        type="button"
                                        onClick={onNextStep}
                                        className={cn(
                                            "flex-[2] h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
                                            billing.totalDue === 0 ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20" : "bg-primary hover:bg-primary/90 text-black shadow-primary/20"
                                        )}
                                        disabled={isPending} id="checkoutdialog-button-1" data-testid="checkoutdialog-action-button"
                                    >
                                        {isPending ? "Procesando..." : (
                                            billing.totalDue > 0 ? (
                                                <div className="flex items-center">Proceder a Cobro <ChevronRight className="ml-2 h-5 w-5" /></div>
                                            ) : (
                                                <div className="flex items-center">Cerrar Estancia <CheckCircle className="ml-2 h-5 w-5" /></div>
                                            )
                                        )}
                                    </Button>
                                </div>
                            ) : step === 2 ? (
                                <div className="flex gap-3 mt-6">
                                    <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={isPending} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-white" id="checkoutdialog-button-volver" data-testid="checkoutdialog-back-button">
                                        <ChevronLeft className="mr-2 h-4 w-4 text-primary" /> Volver
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={form.handleSubmit(handleProcessCheckout)}
                                        disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                                        className="flex-[2] h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" id="checkoutdialog-button-2" data-testid="checkoutdialog-action-button"
                                    >
                                        {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                                        {isPending ? 'Procesando...' : 'Finalizar y Cobrar'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-3 mt-6">
                                    <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={isPending} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-white" id="checkoutdialog-button-volver-confirm" data-testid="checkoutdialog-back-button">
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleProcessCheckout({ paymentMethod: 'Efectivo', paymentConfirmed: true })}
                                        disabled={isPending}
                                        className="flex-[2] h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" id="checkoutdialog-button-confirm-zero" data-testid="checkoutdialog-action-button"
                                    >
                                        {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                                        {isPending ? 'Finalizando...' : 'Confirmar Salida'}
                                    </Button>
                                </div>
                            )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
