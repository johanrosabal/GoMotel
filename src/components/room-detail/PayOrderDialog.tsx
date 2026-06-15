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
import { payRestaurantAccountClient } from '@/lib/client-actions/restaurant.client';
import type { Order, SinpeAccount } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { CheckCircle, Smartphone, Wallet, CreditCard, ChevronRight, ReceiptText, Zap, Volume2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { playNotificationSound } from '@/lib/sound';
import { useRouter } from 'next/navigation';

interface PayOrderDialogProps {
    children: ReactNode;
    order: Order;
    onSuccess?: (invoiceId: string) => void;
}

const paymentSchema = z.object({
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

export default function PayOrderDialog({ children, order, onSuccess }: PayOrderDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [cashTendered, setCashTendered] = useState('');
    const router = useRouter();

    const form = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: { paymentMethod: 'Efectivo', paymentConfirmed: false, voucherNumber: '' },
    });

    const paymentMethod = form.watch('paymentMethod');

    const sinpeAccountsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null,
        [firestore]
    );
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + order.total) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, order.total]);

    useEffect(() => {
        if (!open) {
            form.reset();
            setCashTendered('');
        }
    }, [open, form]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = Number(cashTendered.replace(/\D/g, ''));

    const handleProcessPayment = (values: z.infer<typeof paymentSchema>) => {
        startTransition(async () => {
            const result = await payRestaurantAccountClient(order.id, order.locationId, {
                paymentMethod: values.paymentMethod,
                voucherNumber: values.voucherNumber,
                total: order.total,
                subtotal: order.subtotal,
                taxes: order.taxes || [],
                clientName: order.label || 'Cliente de Habitación',
            });

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const id = result.invoiceId;
                setOpen(false);
                playNotificationSound('digital');
                toast({ title: '¡Éxito!', description: 'Pago procesado correctamente.' });
                router.refresh();
                if (id && onSuccess) {
                    onSuccess(id);
                }
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 border-none bg-slate-950/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
                <div className="relative overflow-hidden p-8">
                     {/* Decorative background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />

                    <DialogHeader className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner text-emerald-500">
                                <ReceiptText className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                                Cobrar Pedido
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-400 font-medium">
                            Procesando pago de {formatCurrency(order.total)} para {order.locationLabel}.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form className="space-y-6">
                            <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Método de Pago</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 font-bold">
                                                    <SelectValue placeholder="Seleccione método" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                                <SelectItem value="Efectivo" className="py-3 font-bold">
                                                    <div className="flex items-center gap-3"><Wallet className="h-4 w-4 text-emerald-400" /> Efectivo</div>
                                                </SelectItem>
                                                <SelectItem value="Sinpe Movil" className="py-3 font-bold">
                                                    <div className="flex items-center gap-3"><Smartphone className="h-4 w-4 text-primary" /> SINPE Móvil</div>
                                                </SelectItem>
                                                <SelectItem value="Tarjeta" className="py-3 font-bold">
                                                    <div className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-blue-400" /> Tarjeta</div>
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
                                                    className="h-16 bg-transparent border-none text-right text-3xl font-black tracking-tighter text-white focus-visible:ring-0"
                                                />
                                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                                            </div>
                                        </div>
                                        {numericCashTendered >= order.total && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner"
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Vuelto</span>
                                                <span className="text-2xl font-black text-emerald-400">{formatCurrency(numericCashTendered - order.total)}</span>
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
                                            <p className="text-center text-[10px] font-bold uppercase py-4 animate-pulse text-slate-500">Buscando cuenta...</p>
                                        ) : targetSinpeAccount ? (
                                            <div className="p-6 rounded-[2rem] bg-primary/[0.03] border border-primary/20 space-y-6 text-center shadow-xl">
                                                <p className="text-[10px] font-black tracking-[0.2em] text-primary/70 uppercase">Transferir <span className='text-white'>{formatCurrency(order.total)}</span> a:</p>
                                                <div className="space-y-1">
                                                    <p className="text-4xl font-black font-mono tracking-tighter text-white">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{targetSinpeAccount.accountHolder}</p>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name="paymentConfirmed"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-4 space-y-0 rounded-[1.5rem] border border-primary/40 bg-primary/10 p-6 text-left shadow-lg group hover:bg-primary/20 transition-all">
                                                            <FormControl>
                                                                <Checkbox 
                                                                    checked={field.value} 
                                                                    onCheckedChange={field.onChange} 
                                                                    className="h-8 w-8 rounded-xl border-primary data-[state=checked]:bg-primary data-[state=checked]:text-black" 
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1">
                                                                <FormLabel className="text-sm font-black uppercase tracking-widest text-white">¡He recibido el dinero!</FormLabel>
                                                                <p className="text-[10px] text-primary font-bold italic">Confirme que la transferencia llegó al banco.</p>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-6 bg-rose-500/10 text-rose-500 rounded-[2rem] text-[10px] font-black uppercase text-center border border-rose-500/20 tracking-widest">
                                                No hay cuentas SINPE disponibles.
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
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Últimos 6 dígitos Voucher</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="000000" {...field} className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-center text-lg uppercase tracking-widest text-primary" />
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

                    <div className="flex gap-3 mt-8">
                        <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-14 rounded-2xl border border-white/5 font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-white transition-all">Cancelar</Button>
                        <Button
                            onClick={form.handleSubmit(handleProcessPayment, (errors) => {
                                const errorMessages = Object.values(errors).map(err => err.message).join('. ');
                                toast({
                                    title: 'Faltan datos',
                                    description: errorMessages || 'Por favor verifique los campos del formulario.',
                                    variant: 'destructive'
                                });
                            })}
                            disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                            className="flex-[2] h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                            {isPending ? 'Procesando...' : 'Cobrar Pedido'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
