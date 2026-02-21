'use client';

import { useState, useTransition, useEffect, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy as fbOrderBy } from 'firebase/firestore';
import type { Room, Client, RoomType, PricePlan, SinpeAccount } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Star, Clock, CheckCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '../ui/checkbox';
import { FormDescription } from '../ui/form';
import { Separator } from '../ui/separator';
import InvoiceSuccessDialog from './InvoiceSuccessDialog';

interface CreateReservationDialogProps {
  children: React.ReactNode;
}

const reservationSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  checkInDate: z.date(),
  guestId: z.string().optional(),
  checkInNow: z.boolean().default(false),
  isOpenAccount: z.boolean().default(true),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
  paymentConfirmed: z.boolean().default(false),
  voucherNumber: z.string().optional(),
}).refine(data => data.isOpenAccount || !!data.paymentMethod, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (!data.isOpenAccount && data.paymentMethod === 'Sinpe Movil') {
        return !!data.paymentConfirmed;
    }
    return true;
}, {
    message: 'Debe confirmar que el pago fue recibido.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (!data.isOpenAccount && data.paymentMethod === 'Tarjeta') {
        return data.voucherNumber && data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});


export default function CreateReservationDialog({ children }: CreateReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [calculatedCheckOut, setCalculatedCheckOut] = useState<Date | null>(null);

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState<{ invoiceNumber: string; clientName: string; total: number; } | null>(null);

  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'), fbOrderBy('number'));
  }, [firestore]);
  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"));
  }, [firestore]);
  const { data: clients, isLoading: isLoadingClients } = useCollection<Client>(clientsQuery);
  
  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'));
  }, [firestore]);
  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);
  
  const sinpeAccountsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), fbOrderBy('createdAt', 'asc'));
  }, [firestore]);
  const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      guestName: '',
      guestId: undefined,
      roomId: undefined,
      pricePlanName: undefined,
      checkInNow: false,
      checkInDate: new Date(),
      isOpenAccount: true,
      paymentMethod: undefined,
      paymentConfirmed: false,
      voucherNumber: '',
    },
  });

  const guestNameValue = form.watch('guestName');
  
  const sortedClients = useMemo(() => {
    if (!clients) return [];
    return [...clients].sort((a, b) => {
      if (a.isVip && !b.isVip) return -1;
      if (!a.isVip && b.isVip) return 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!guestNameValue) {
        return sortedClients;
    }
    const lowercasedQuery = guestNameValue.toLowerCase();
    return sortedClients.filter(client =>
        `${client.firstName} ${client.lastName}`.toLowerCase().includes(lowercasedQuery)
    );
  }, [guestNameValue, sortedClients]);


  const selectedRoomId = form.watch('roomId');
  const selectedPlanName = form.watch('pricePlanName');
  const checkInDateValue = form.watch('checkInDate');
  const checkInNow = form.watch('checkInNow');
  const isOpenAccount = form.watch('isOpenAccount');
  const paymentMethod = form.watch('paymentMethod');

  const selectedRoom = useMemo(() => rooms?.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);
  const availablePlans = useMemo(() => {
      if (!selectedRoom || !roomTypes) return [];
      const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
      return roomType?.pricePlans?.sort((a,b) => a.price - b.price) || [];
  }, [selectedRoom, roomTypes]);
  
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
    return null; // No account available
  }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

  const resetForm = useCallback(() => {
    form.reset({
      guestName: '',
      guestId: undefined,
      roomId: undefined,
      pricePlanName: undefined,
      checkInNow: false,
      checkInDate: new Date(),
      isOpenAccount: true,
      paymentMethod: undefined,
      paymentConfirmed: false,
      voucherNumber: '',
    });
    setCalculatedCheckOut(null);
    setShowSuggestions(false);
  }, [form]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    const baseDate = checkInNow ? new Date() : checkInDateValue;

    if (!baseDate || !selectedPlanName || !availablePlans.length) {
      setCalculatedCheckOut(null);
      return;
    }
    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (plan) {
        let newCheckOutDate = new Date(baseDate);
        const { duration, unit } = plan;
        
        if (unit === 'Minutes') newCheckOutDate = addMinutes(newCheckOutDate, duration);
        else if (unit === 'Hours') newCheckOutDate = addHours(newCheckOutDate, duration);
        else if (unit === 'Days') newCheckOutDate = addDays(newCheckOutDate, duration);
        else if (unit === 'Weeks') newCheckOutDate = addWeeks(newCheckOutDate, duration);
        else if (unit === 'Months') newCheckOutDate = addMonths(newCheckOutDate, duration);
        
        setCalculatedCheckOut(newCheckOutDate);
    }
  }, [checkInDateValue, selectedPlanName, availablePlans, checkInNow]);


  const onSubmit = (values: z.infer<typeof reservationSchema>) => {
    if (!calculatedCheckOut) {
        toast({ title: "Error", description: "Fecha de salida no válida.", variant: "destructive" });
        return;
    }

    const finalCheckInDate = values.checkInNow ? new Date() : values.checkInDate;
    if (!finalCheckInDate) {
        toast({ title: "Error", description: "Fecha de check-in no válida.", variant: "destructive" });
        return;
    }

    if (isBefore(calculatedCheckOut, finalCheckInDate)) {
        toast({ title: "Error", description: "La fecha de check-out debe ser posterior a la fecha de check-in.", variant: "destructive" });
        return;
    }

    const submissionData = {
        ...values,
        checkInDate: finalCheckInDate,
        checkOutDate: calculatedCheckOut,
    };

    startTransition(async () => {
      const result = await createReservation(submissionData);
      if (result.error) {
        toast({ title: 'Error al Procesar', description: result.error, variant: 'destructive' });
      } else {
        setOpen(false);
        if (result.invoice) {
            setInvoiceInfo(result.invoice);
            setSuccessModalOpen(true);
        } else {
            toast({ title: '¡Éxito!', description: `La operación se ha completado.` });
        }
      }
    });
  };

  const isLoading = isLoadingRooms || isLoadingRoomTypes || isLoadingSinpe;

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Crear Nueva Reservación</DialogTitle>
          <DialogDescription>Complete los detalles para agendar una nueva reservación.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[65vh] p-1 pr-5">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Left Column: Reservation Details */}
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="guestName"
                            render={({ field }) => (
                            <FormItem className="relative">
                                <FormLabel>Huésped</FormLabel>
                                <FormControl>
                                <Input
                                    placeholder="Buscar o escribir cliente..."
                                    {...field}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                    autoComplete="off"
                                />
                                </FormControl>
                                {showSuggestions && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
                                    <ScrollArea className="max-h-56">
                                    <div className="p-1">
                                        {filteredClients.length > 0 ? (
                                        filteredClients.map((client) => (
                                            <button
                                            type="button"
                                            key={client.id}
                                            onClick={() => {
                                                form.setValue(
                                                'guestName',
                                                `${client.firstName} ${client.lastName}`
                                                );
                                                form.setValue('guestId', client.id);
                                                setShowSuggestions(false);
                                            }}
                                            className="relative flex w-full cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                            >
                                            <div className="flex items-center gap-2">
                                                <Check
                                                className={cn(
                                                    'h-4 w-4',
                                                    form.getValues('guestId') === client.id
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                )}
                                                />
                                                {client.firstName} {client.lastName}
                                            </div>
                                            {client.isVip && (
                                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                            )}
                                            </button>
                                        ))
                                        ) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            No se encontraron clientes.
                                        </div>
                                        )}
                                    </div>
                                    </ScrollArea>
                                </div>
                                )}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        
                        <div className='grid grid-cols-2 gap-4'>
                            <FormField
                                control={form.control}
                                name="roomId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Habitación</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingRooms ? "Cargando..." : "Seleccione"} />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {rooms?.map(room => (
                                            <SelectItem key={room.id} value={room.id}>
                                            {room.number} - {room.roomTypeName}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                            control={form.control}
                            name="pricePlanName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Plan de Estancia</FormLabel>
                                <Select onValueChange={(value) => { field.onChange(value); form.trigger('checkInDate'); }} value={field.value} disabled={isLoading || availablePlans.length === 0 || !selectedRoomId}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={!selectedRoomId ? "Elija habitación" : "Seleccione"} />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {availablePlans.map(plan => (
                                        <SelectItem key={plan.name} value={plan.name}>
                                        {plan.name}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>

                        <div className="rounded-lg border p-3.5 space-y-3">
                        <FormField
                            control={form.control}
                            name="checkInNow"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                <FormLabel>Hacer Check-in Ahora</FormLabel>
                                <p className="text-[13px] text-muted-foreground">
                                    Para huéspedes que ingresan inmediatamente.
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
                        
                        {!checkInNow && (
                            <>
                            <Separator />
                            <Controller
                                control={form.control}
                                name="checkInDate"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>Fecha y Hora de Check-in</FormLabel>
                                        <DateTimePicker date={field.value} setDate={field.onChange} />
                                        <FormMessage>{fieldState.error?.message}</FormMessage>
                                    </FormItem>
                                )}
                            />
                            </>
                        )}
                        </div>
                    </div>
                    {/* Right Column: Payment Details */}
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="isOpenAccount"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                <FormLabel>Cuenta Abierta</FormLabel>
                                <p className="text-[13px] text-muted-foreground">
                                    Si se activa, la factura se liquida al final.
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

                        {!isOpenAccount && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Método de Pago por Adelantado</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccione un método" />
                                                    </SelectTrigger>
                                                </FormControl>
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
                                    <div className='space-y-4 pt-4 border-t'>
                                        {isLoadingSinpe ? (
                                            <p className="text-sm text-muted-foreground text-center">Buscando cuenta SINPE disponible...</p>
                                        ) : targetSinpeAccount ? (
                                            <div className="space-y-3">
                                                <div className='p-4 bg-muted rounded-lg text-center'>
                                                    <p className='text-sm text-muted-foreground'>Transferir el monto de</p>
                                                    <p className='text-2xl font-bold tracking-tight text-primary'>{formatCurrency(selectedPlan?.price || 0)}</p>
                                                    <p className='text-sm text-muted-foreground mt-3'>a la cuenta SINPE Móvil:</p>
                                                    <p className='py-2 text-3xl font-mono font-extrabold tracking-widest'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                    <p className='text-sm font-semibold'>{targetSinpeAccount.accountHolder}</p>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name="paymentConfirmed"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-background p-4 shadow-sm">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1 leading-none">
                                                                <FormLabel>
                                                                    Confirmar Pago Recibido
                                                                </FormLabel>
                                                                <FormDescription>
                                                                    Marque esta casilla para confirmar que ha recibido el pago.
                                                                </FormDescription>
                                                                <FormMessage className="pt-1" />
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ) : (
                                            <div className='p-3 bg-destructive/10 text-destructive rounded-md text-sm font-semibold text-center'>
                                                No hay cuentas SINPE disponibles o todas han alcanzado su límite.
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
                                                <FormLabel>Número de Voucher</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ingrese el número de voucher" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        )}
                        {!isOpenAccount && selectedPlan && paymentMethod && paymentMethod !== 'Sinpe Movil' && (
                            <div className="p-3 bg-green-100/50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50">
                                <div className="flex items-center gap-2 font-semibold">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Confirmación de Pago por Adelantado</span>
                                </div>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200 dark:border-green-800/50">
                                    <span className="font-medium">Monto a Cobrar:</span>
                                    <span className="font-bold text-base">{formatCurrency(selectedPlan.price)}</span>
                                </div>
                            </div>
                        )}

                        {calculatedCheckOut && form.getValues('pricePlanName') && (
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                                    <Clock className="h-4 w-4" />
                                    <span>Salida Estimada</span>
                                </div>
                                <p className="font-semibold text-center pt-1">{format(calculatedCheckOut, "dd MMM yyyy, h:mm a", { locale: es })}</p>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className='pt-4 border-t mt-4'>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending || isLoading}>
                {isPending ? (checkInNow ? 'Procesando...' : 'Creando...') : (checkInNow ? 'Hacer Check-in Ahora' : 'Crear Reservación')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <InvoiceSuccessDialog
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        invoiceInfo={invoiceInfo}
    />
    </>
  );
}
