'use client';

import React, { useState, useTransition, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Wallet, Smartphone, CreditCard, X, Zap, Clock } from 'lucide-react';
import { createFineOrder } from '@/lib/actions/order.actions';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { SinpeAccount, Stay } from '@/types';

interface GenerateFineDialogProps {
    children: ReactNode;
    stay?: Stay;
    onSuccess?: () => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2 }).format(amount);
};

const fineSchema = z.object({
    amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta'], {
        required_error: "Debe seleccionar un método de pago."
    }),
    paymentConfirmed: z.boolean().default(false),
    voucherNumber: z.string().optional(),
    blacklistClient: z.boolean().default(false),
}).refine(data => {
    if (data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar que el pago fue recibido.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export default function GenerateFineDialog({ children, stay, onSuccess }: GenerateFineDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [cashTendered, setCashTendered] = useState('');

    const form = useForm<z.infer<typeof fineSchema>>({
        resolver: zodResolver(fineSchema),
        defaultValues: {
            amount: 0,
            description: '',
            paymentConfirmed: false,
            voucherNumber: '',
            paymentMethod: undefined,
            blacklistClient: false,
        },
    });

    const amount = form.watch('amount') || 0;
    const paymentMethod = form.watch('paymentMethod');

    const sinpeAccountsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, [firestore]);
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const targetSinpeAccount = activeSinpeAccounts?.find(acc => (acc.balance + amount) <= (acc.limitAmount || Infinity)) || activeSinpeAccounts?.[0];
    const numericCashTendered = parseFloat(cashTendered.replace(/[^0-9.-]+/g, "")) || 0;

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value) {
            setCashTendered(new Intl.NumberFormat('en-US').format(parseInt(value, 10)));
        } else {
            setCashTendered('');
        }
    };

    const handleSubmit = (values: z.infer<typeof fineSchema>) => {
        if (!stay?.id) return;

        startTransition(async () => {
            const result = await createFineOrder(
                stay.id,
                values.amount,
                values.description,
                values.paymentMethod,
                values.voucherNumber,
                values.blacklistClient
            );

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Multa Generada', description: 'La multa se ha registrado exitosamente.' });
                setOpen(false);
                form.reset();
                setCashTendered('');
                if (onSuccess) onSuccess();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-950/80 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[2rem] p-0 overflow-hidden flex flex-col border-t-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-8 pb-4 flex items-center justify-between sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl">
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6 text-rose-500" />
                            Crear multa al cliente
                        </DialogTitle>
                        <DialogDescription asChild className="text-slate-500 mt-1 font-medium tracking-wide">
                            <div>
                                {stay?.guestName ? (
                                    <div className="flex items-center gap-2 mt-2 text-sm">
                                        <span>Cliente:</span>
                                        <span className="px-2.5 py-1 bg-white/10 text-white font-bold rounded-lg border border-white/10 tracking-tight">
                                            {stay.guestName}
                                        </span>
                                    </div>
                                ) : (
                                    'Ingrese los detalles de la multa a cobrar.'
                                )}
                            </div>
                        </DialogDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full hover:bg-white/5 text-slate-500">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-8 pt-4 space-y-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                            
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/80">Monto (₡)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="text" 
                                                inputMode="numeric"
                                                placeholder="Ej. 15,000" 
                                                className="h-12 bg-white/5 border-white/10 rounded-xl text-lg font-bold text-right pr-4" 
                                                value={field.value ? new Intl.NumberFormat('en-US').format(field.value) : ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    field.onChange(val ? Number(val) : 0);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/80">Descripción</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Ej. Daño en toallas..." className="resize-none bg-white/5 border-white/10 rounded-xl" rows={2} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="blacklistClient"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-left">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-lg border-rose-500/50 data-[state=checked]:bg-rose-500 data-[state=checked]:text-white" />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-xs font-black uppercase tracking-widest text-rose-500">Añadir a Lista Negra</FormLabel>
                                            <p className="text-[10px] font-medium text-slate-400">
                                                Bloquear este cliente. La descripción se usará como motivo.
                                            </p>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Método de Pago</FormLabel>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'Efectivo', icon: Wallet, label: 'Efectivo' },
                                                { id: 'Sinpe Movil', icon: Smartphone, label: 'Sinpe' },
                                                { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' }
                                            ].map((method) => (
                                                <button
                                                    key={method.id}
                                                    type="button"
                                                    onClick={() => field.onChange(method.id)}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-2",
                                                        field.value === method.id 
                                                            ? "bg-primary border-primary text-black shadow-lg shadow-primary/20" 
                                                            : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                                                    )}
                                                >
                                                    <method.icon className="h-5 w-5" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight">{method.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                                        {paymentMethod === 'Sinpe Movil' && (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                                                {isLoadingSinpe ? (
                                                    <p className="text-[10px] font-bold uppercase text-center py-4 animate-pulse">Buscando cuenta...</p>
                                                ) : targetSinpeAccount ? (
                                                    <div className="p-5 rounded-[2rem] bg-primary/[0.03] border border-primary/20 space-y-4 text-center">
                                                        <p className='text-[10px] font-black text-primary/70 uppercase tracking-widest'>Transferir <span className='text-white'>{formatCurrency(amount)}</span> a:</p>
                                                        <p className='text-3xl font-black font-mono tracking-tighter text-white'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                        <FormField
                                                            control={form.control}
                                                            name="paymentConfirmed"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border border-white/5 bg-slate-950/50 p-4 text-left">
                                                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-lg border-primary/40" /></FormControl>
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-300">Pago Recibido</FormLabel>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className='p-4 bg-rose-500/10 text-rose-500 rounded-2xl text-[10px] font-black uppercase text-center border border-rose-500/20 tracking-widest'>No hay cuentas disponibles</div>
                                                )}
                                            </motion.div>
                                        )}

                                        {paymentMethod === 'Tarjeta' && (
                                            <FormField
                                                control={form.control}
                                                name="voucherNumber"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Voucher</FormLabel>
                                                        <FormControl><Input placeholder="ULTIMOS 6 DIGITOS" {...field} className="h-12 bg-white/5 border-white/10 rounded-xl text-center font-mono tracking-widest uppercase text-primary" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {paymentMethod === 'Efectivo' && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Monto Recibido</Label>
                                                    <Input type="text" inputMode="numeric" placeholder="₡ 0.00" value={cashTendered} onChange={handleCashTenderedChange} className="h-12 bg-white/5 border-white/10 rounded-xl text-right text-lg font-black tracking-tight" />
                                                </div>
                                                {cashTendered && amount > 0 && numericCashTendered >= amount && (
                                                    <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Vuelto</span>
                                                        <span className="text-xl font-black text-emerald-400 tracking-tighter">{formatCurrency(numericCashTendered - amount)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                            <div className="flex gap-3 pt-2">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    disabled={isPending}
                                    className="w-full h-14 rounded-2xl border-white/10 text-white font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isPending}
                                    className="w-full h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isPending ? 'Procesando...' : 'Confirmar Multa'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
