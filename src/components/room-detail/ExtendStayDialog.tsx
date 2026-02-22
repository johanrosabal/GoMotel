'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { extendStay } from '@/lib/actions/room.actions';
import { Clock, CheckCircle, Smartphone } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Room, Stay, RoomType, Order, SinpeAccount } from '@/types';
import CheckoutDialog from './CheckoutDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

interface ExtendStayDialogProps {
  children: ReactNode;
  stay?: Stay | null;
  room: Room;
  isOverdue?: boolean;
}

const extendStaySchema = z.object({
  newPlanName: z.string({ required_error: 'Debe seleccionar un nuevo plan de estancia.' }),
  payNow: z.boolean().default(false),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
  paymentConfirmed: z.boolean().optional(),
  voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.payNow) return !!data.paymentMethod;
    return true;
}, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Sinpe Movil') {
        return data.paymentConfirmed === true;
    }
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Tarjeta' && data.voucherNumber) {
        return data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export default function ExtendStayDialog({ children, stay, room, isOverdue }: ExtendStayDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [cashTendered, setCashTendered] = useState('');

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore || !room) return null;
    return query(collection(firestore, 'roomTypes'), where('__name__', '==', room.roomTypeId));
  }, [firestore, room]);
  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);
  const roomType = useMemo(() => roomTypes?.[0], [roomTypes]);
  const availablePlans = useMemo(() => roomType?.pricePlans?.sort((a, b) => a.price - b.price) || [], [roomType]);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !stay) return null;
    return query(collection(firestore, 'orders'), where('stayId', '==', stay.id));
  }, [firestore, stay]);
  const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);
  
  const sinpeAccountsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc'));
  }, [firestore]);
  const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

  const form = useForm<z.infer<typeof extendStaySchema>>({
    resolver: zodResolver(extendStaySchema),
    defaultValues: { newPlanName: undefined, payNow: false, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined },
  });

  const selectedPlanName = form.watch('newPlanName');
  const payNow = form.watch('payNow');
  const paymentMethod = form.watch('paymentMethod');

  const selectedPlan = useMemo(() => {
    if (!selectedPlanName || !availablePlans.length) return null;
    return availablePlans.find(p => p.name === selectedPlanName);
  }, [selectedPlanName, availablePlans]);

  const targetSinpeAccount = useMemo(() => {
    if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) {
      return null;
    }
    const paymentAmount = selectedPlan.price;
    for (const account of activeSinpeAccounts) {
        const limit = account.limitAmount || Infinity;
        if ((account.balance + paymentAmount) <= limit) {
            return account;
        }
    }
    return null;
  }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

  const calculatedCheckOut = useMemo(() => {
    if (!selectedPlanName || !availablePlans.length || !stay) return null;

    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (!plan) return null;

    const now = new Date();
    const currentCheckOut = stay.expectedCheckOut.toDate();
    const baseDate = isOverdue && now > currentCheckOut ? now : currentCheckOut;
    
    let checkOutTime = new Date(baseDate);
    
    switch(plan.unit) {
      case 'Minutes': checkOutTime = addMinutes(baseDate, plan.duration); break;
      case 'Hours': checkOutTime = addHours(baseDate, plan.duration); break;
      case 'Days': checkOutTime = addDays(baseDate, plan.duration); break;
      case 'Weeks': checkOutTime = addWeeks(baseDate, plan.duration); break;
      case 'Months': checkOutTime = addMonths(baseDate, plan.duration); break;
    }
    
    return format(checkOutTime, 'PPpp', { locale: es });
  }, [selectedPlanName, availablePlans, stay, isOverdue]);

  const onSubmit = (values: z.infer<typeof extendStaySchema>) => {
    if (!stay) return;
    startTransition(async () => {
      const result = await extendStay({
        stayId: stay.id,
        ...values,
      });
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La estancia ha sido extendida.' });
        setOpen(false);
      }
    });
  };

  useEffect(() => {
    if (open) {
      form.reset({ newPlanName: undefined, payNow: false, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined });
      setCashTendered('');
    }
  }, [open, form]);

  useEffect(() => {
    if (!payNow) {
        setCashTendered('');
    }
  }, [payNow]);

  useEffect(() => {
    setCashTendered('');
  }, [paymentMethod]);

  const isLoading = isLoadingRoomTypes || isLoadingOrders || isLoadingSinpe;
  const submitButtonText = payNow ? 'Pagar y Extender' : 'Extender (Pendiente)';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {stay && (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>{isOverdue ? 'Gestionar Estancia Vencida' : 'Extender Estancia'}</DialogTitle>
            <DialogDescription>
                {isOverdue 
                ? `La estancia de ${stay.guestName} ha vencido. Puede extender la estancia o realizar el check-out.`
                : `Añada más tiempo a la estancia de ${stay.guestName}.`
                }
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="newPlanName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Extender con Nuevo Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione un plan de extensión"} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {availablePlans.map(plan => (
                            <SelectItem key={plan.name} value={plan.name}>
                              {plan.name} ({formatCurrency(plan.price)})
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {calculatedCheckOut && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                            <Clock className="h-4 w-4" />
                            <span>Nueva Salida Estimada</span>
                        </div>
                        <p className="font-semibold text-center pt-1">{calculatedCheckOut}</p>
                    </div>
                )}
                
                {selectedPlan && (
                    <div className="space-y-4 pt-4 border-t">
                        <FormField
                            control={form.control}
                            name="payNow"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                <FormLabel>Pagar Extensión Ahora</FormLabel>
                                <p className="text-[13px] text-muted-foreground">
                                    Genera una factura para este pago.
                                </p>
                                </div>
                                <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                        {payNow && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Método de Pago</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                <SelectItem value="Sinpe Movil">Sinpe Móvil</SelectItem>
                                                <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                {paymentMethod === 'Sinpe Movil' && (
                                    <div className='space-y-3 pt-3 border-t'>
                                        {isLoadingSinpe ? <p>Buscando cuenta...</p> : targetSinpeAccount ? (
                                             <div className="space-y-3">
                                                <div className='p-4 bg-muted rounded-lg text-center'>
                                                    <p className='text-sm text-muted-foreground'>Transferir <span className='font-bold'>{formatCurrency(selectedPlan.price)}</span> a:</p>
                                                    <p className='py-1 text-2xl font-mono font-extrabold tracking-widest'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                    <p className='text-sm font-semibold'>{targetSinpeAccount.accountHolder}</p>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name="paymentConfirmed"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-background p-4 shadow-sm">
                                                            <FormControl>
                                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                            </FormControl>
                                                            <div className="space-y-1 leading-none">
                                                                <FormLabel>Confirmar Pago Recibido</FormLabel>
                                                                <FormMessage className="pt-1" />
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ) : <p className='p-3 bg-destructive/10 text-destructive rounded-md text-sm font-semibold text-center'>No hay cuentas SINPE disponibles.</p>}
                                    </div>
                                )}
                                {paymentMethod === 'Tarjeta' && (
                                    <FormField
                                        control={form.control}
                                        name="voucherNumber"
                                        render={({ field }) => (
                                            <FormItem><FormLabel>Número de Voucher</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )}
                                    />
                                )}
                                {paymentMethod === 'Efectivo' && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <FormItem>
                                            <FormLabel>Paga con</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="Monto recibido"
                                                    value={cashTendered}
                                                    onChange={(e) => setCashTendered(e.target.value.replace(/[^0-9]/g, ''))}
                                                    className="text-right"
                                                />
                                            </FormControl>
                                        </FormItem>
                                        {cashTendered && selectedPlan && Number(cashTendered) >= selectedPlan.price && (
                                            <div className="flex justify-between items-center text-sm font-semibold">
                                                <FormLabel>Vuelto</FormLabel>
                                                <span className="text-lg text-primary">
                                                    {formatCurrency(Number(cashTendered) - selectedPlan.price)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {paymentMethod && paymentMethod !== 'Sinpe Movil' && (
                                     <div className="p-3 bg-green-100/50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50">
                                        <div className="flex justify-between items-center font-semibold">
                                            <span className='flex items-center gap-2'><CheckCircle className="h-4 w-4" />Monto a Cobrar:</span>
                                            <span className="font-bold text-base">{formatCurrency(selectedPlan.price)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}


                <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
                    <Button type="submit" disabled={isPending || isLoading || !selectedPlanName} className="flex-1">
                        {isPending ? 'Guardando...' : submitButtonText}
                    </Button>
                    {isOverdue && (
                      <CheckoutDialog stay={stay} room={room} orders={orders || []}>
                          <Button type="button" variant="destructive" className="flex-1">
                              Realizar Check-Out
                          </Button>
                      </CheckoutDialog>
                    )}
                </div>
            </form>
            </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
