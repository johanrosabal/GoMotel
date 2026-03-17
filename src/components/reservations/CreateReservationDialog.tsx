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
import type { Room, Client, RoomType, SinpeAccount } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Star, Clock, CheckCircle, User, BedDouble, CalendarDays, Wallet, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '../ui/separator';
import InvoiceSuccessDialog from './InvoiceSuccessDialog';

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = [
        { label: 'Huésped', icon: User },
        { label: 'Estancia', icon: Clock },
        { label: 'Pago', icon: Wallet }
    ];

    return (
        <div className="flex items-center justify-between w-full mb-8 px-4 relative">
            <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10" />
            {steps.map((step, index) => {
                const isCompleted = currentStep > index + 1;
                const isActive = currentStep === index + 1;
                const Icon = step.icon;

                return (
                    <div key={index} className="flex flex-col items-center gap-2 bg-background px-2">
                        <div className={cn(
                            "w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                            isCompleted ? "bg-primary border-primary text-primary-foreground" :
                            isActive ? "border-primary text-primary ring-4 ring-primary/10" :
                            "bg-muted border-muted text-muted-foreground"
                        )}>
                            {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}>{step.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

interface CreateReservationDialogProps {
  children: React.ReactNode;
  initialRoomId?: string;
  isWalkIn?: boolean;
}

const reservationSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  checkInDate: z.date(),
  guestId: z.string().nullable().optional(),
  checkInNow: z.boolean().default(false),
  isOpenAccount: z.boolean().default(true),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).nullable().optional(),
  paymentConfirmed: z.boolean().default(false),
  voucherNumber: z.string().nullable().optional(),
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


export default function CreateReservationDialog({ children, initialRoomId, isWalkIn = false }: CreateReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [calculatedCheckOut, setCalculatedCheckOut] = useState<Date | null>(null);
  const [cashTendered, setCashTendered] = useState('');
  
  const [canFinalize, setCanFinalize] = useState(false);

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

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
      guestId: null,
      roomId: isWalkIn ? initialRoomId : undefined,
      pricePlanName: undefined,
      checkInNow: isWalkIn,
      checkInDate: new Date(),
      isOpenAccount: true,
      paymentMethod: null,
      paymentConfirmed: false,
      voucherNumber: null,
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
    if (!guestNameValue) return sortedClients;
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
    if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) return null;
    const paymentAmount = selectedPlan.price;
    for (const account of activeSinpeAccounts) {
        const limit = account.limitAmount || Infinity;
        if ((account.balance + paymentAmount) <= limit) return account;
    }
    return null;
  }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

  const resetForm = useCallback(() => {
    form.reset({
      guestName: '',
      guestId: null,
      roomId: isWalkIn ? initialRoomId : undefined,
      pricePlanName: undefined,
      checkInNow: isWalkIn,
      checkInDate: new Date(),
      isOpenAccount: true,
      paymentMethod: null,
      paymentConfirmed: false,
      voucherNumber: null,
    });
    setCurrentStep(1);
    setCalculatedCheckOut(null);
    setShowSuggestions(false);
    setCashTendered('');
    setCanFinalize(false);
  }, [form, isWalkIn, initialRoomId]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (currentStep === 3) {
        const timer = setTimeout(() => setCanFinalize(true), 500);
        return () => clearTimeout(timer);
    } else {
        setCanFinalize(false);
    }
  }, [currentStep]);

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

  const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
  };

  const numericCashTendered = useMemo(() => Number(cashTendered.replace(/\D/g, '')), [cashTendered]);

  const validateStep = async () => {
      if (currentStep === 1) return await form.trigger(['guestName', 'roomId']);
      if (currentStep === 2) return await form.trigger(['pricePlanName', 'checkInDate']);
      return true;
  }

  const handleNext = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const isValid = await validateStep();
      if (isValid) {
          setCurrentStep(prev => prev + 1);
      }
  }

  const handleBack = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCurrentStep(prev => prev - 1);
  }

  const onSubmit = (values: z.infer<typeof reservationSchema>) => {
    if (currentStep < 3) return;

    if (!calculatedCheckOut) {
        toast({ title: "Error", description: "Fecha de salida no válida.", variant: "destructive" });
        return;
    }

    const finalCheckInDate = values.checkInNow ? new Date() : values.checkInDate;
    if (isBefore(calculatedCheckOut, finalCheckInDate)) {
        toast({ title: "Error", description: "La fecha de check-out debe ser posterior al ingreso.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      const result = await createReservation({
          ...values,
          checkInDate: finalCheckInDate,
          checkOutDate: calculatedCheckOut,
      });
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        setOpen(false);
        if (result.invoiceId) {
            setInvoiceId(result.invoiceId);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isWalkIn ? 'Registro Rápido' : 'Nueva Reservación'}</DialogTitle>
          <DialogDescription>Complete los 3 pasos para confirmar la estancia.</DialogDescription>
        </DialogHeader>

        <Stepper currentStep={currentStep} />

        <Form {...form}>
          <form onSubmit={e => e.preventDefault()} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault() }}>
            <div className="min-h-[320px] flex flex-col justify-center">
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <FormField
                            control={form.control}
                            name="guestName"
                            render={({ field }) => (
                            <FormItem className="relative">
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Cliente / Huésped</FormLabel>
                                <FormControl>
                                <Input
                                    placeholder="Nombre del cliente..."
                                    {...field}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                    autoComplete="off"
                                    className="h-12 text-lg font-medium"
                                />
                                </FormControl>
                                {showSuggestions && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl overflow-hidden">
                                    <ScrollArea className="max-h-56">
                                    <div className="p-1">
                                        {filteredClients.length > 0 ? (
                                        filteredClients.map((client) => (
                                            <button
                                            type="button"
                                            key={client.id}
                                            onClick={() => {
                                                form.setValue('guestName', `${client.firstName} ${client.lastName}`);
                                                form.setValue('guestId', client.id);
                                                setShowSuggestions(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                                            >
                                            <div className="flex items-center gap-3">
                                                {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                                <span className="font-semibold">{client.firstName} {client.lastName}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono">{client.idCard}</span>
                                            </button>
                                        ))
                                        ) : (
                                        <div className="p-4 text-center text-xs text-muted-foreground font-medium">
                                            Se registrará como nuevo cliente.
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
                        
                        <FormField
                            control={form.control}
                            name="roomId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Habitación Asignada</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms || isWalkIn}>
                                    <FormControl>
                                    <SelectTrigger className="h-12 text-lg">
                                        <SelectValue placeholder="Seleccione habitación" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {rooms?.map(room => (
                                        <SelectItem key={room.id} value={room.id}>
                                            <div className='flex items-center gap-2'>
                                                <span className='font-black'>Hab. {room.number}</span>
                                                <span className='text-xs opacity-60'>— {room.roomTypeName}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <FormField
                            control={form.control}
                            name="pricePlanName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Plan de Estancia</FormLabel>
                                <Select onValueChange={(value) => field.onChange(value)} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                                    <FormControl>
                                    <SelectTrigger className="h-12 text-lg">
                                        <SelectValue placeholder="Seleccione plan de tiempo" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {availablePlans.map(plan => (
                                        <SelectItem key={plan.name} value={plan.name}>
                                            <div className="flex justify-between w-full gap-8">
                                                <span className="font-bold">{plan.name}</span>
                                                <span className="text-primary font-black">{formatCurrency(plan.price)}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                            <FormField
                                control={form.control}
                                name="checkInNow"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel className="font-bold text-sm">Ingreso Inmediato</FormLabel>
                                        <p className="text-xs text-muted-foreground">El tiempo empieza a correr ahora.</p>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isWalkIn} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            {!checkInNow && (
                                <div className="pt-2">
                                    <Controller
                                        control={form.control}
                                        name="checkInDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Fecha y Hora de Entrada</FormLabel>
                                                <DateTimePicker date={field.value} setDate={field.onChange} />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        {calculatedCheckOut && (
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                                <Clock className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Salida Estimada</p>
                                    <p className="font-bold text-sm">{format(calculatedCheckOut, "eeee dd 'de' MMMM, h:mm a", { locale: es })}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <FormField
                            control={form.control}
                            name="isOpenAccount"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 bg-muted/10">
                                <div className="space-y-0.5">
                                <FormLabel className="font-bold text-sm">Manejar como Cuenta Abierta</FormLabel>
                                <p className="text-xs text-muted-foreground">Se liquida el saldo total al salir.</p>
                                </div>
                                <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                            )}
                        />

                        {!isOpenAccount && (
                            <div className="space-y-4 rounded-xl border p-4 bg-background shadow-sm border-primary/20">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Método de Pago Adelantado</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Seleccione método" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                    <SelectItem value="Sinpe Movil">Sinpe Móvil</SelectItem>
                                                    <SelectItem value="Tarjeta">Tarjeta (Voucher)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {paymentMethod === 'Sinpe Movil' && (
                                    <div className='pt-4 border-t space-y-3'>
                                        {targetSinpeAccount ? (
                                            <div className='p-4 bg-primary/5 rounded-xl text-center border-2 border-dashed border-primary/20'>
                                                <p className='text-xs font-bold text-muted-foreground uppercase mb-2'>Enviar {formatCurrency(selectedPlan?.price || 0)} a:</p>
                                                <p className='text-2xl font-black font-mono text-primary'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                <p className='text-[10px] font-black uppercase text-muted-foreground'>{targetSinpeAccount.accountHolder}</p>
                                                <FormField
                                                    control={form.control}
                                                    name="paymentConfirmed"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border bg-background p-3 mt-4 text-left">
                                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className="text-xs font-bold">Pago verificado</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ) : <div className='p-3 bg-destructive/5 text-destructive rounded-lg text-xs font-bold text-center border uppercase'>Límite excedido</div>}
                                    </div>
                                )}
                                {paymentMethod === 'Tarjeta' && (
                                    <FormField
                                        control={form.control}
                                        name="voucherNumber"
                                        render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs font-bold">N° Voucher</FormLabel><FormControl><Input {...field} value={field.value || ''} className="h-11 font-mono" /></FormControl><FormMessage /></FormItem>
                                        )}
                                    />
                                )}
                                {paymentMethod === 'Efectivo' && (
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                        <FormItem><FormLabel className="text-xs font-bold">Paga con</FormLabel><FormControl><Input type="text" inputMode="numeric" value={cashTendered} onChange={handleCashTenderedChange} className="text-right h-11" /></FormControl></FormItem>
                                        {numericCashTendered >= (selectedPlan?.price || 0) && (
                                            <div className="text-right"><span className="text-[10px] font-black uppercase text-muted-foreground">Vuelto</span><p className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - (selectedPlan?.price || 0))}</p></div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="p-4 rounded-xl border border-dashed bg-muted/5">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Resumen Final</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>Habitación:</span><span className="font-bold">{selectedRoom?.number} ({selectedRoom?.roomTypeName})</span></div>
                                <div className="flex justify-between"><span>Huésped:</span><span className="font-bold">{guestNameValue}</span></div>
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center text-lg font-black"><span>Total Estancia</span><span className="text-primary">{formatCurrency(selectedPlan?.price || 0)}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <DialogFooter className='pt-6 border-t mt-6 flex-row sm:justify-between items-center gap-4'>
              <div className='flex items-center gap-2'>
                  {currentStep > 1 && (
                      <Button type="button" variant="ghost" onClick={handleBack} disabled={isPending} className="font-bold">
                          <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
                      </Button>
                  )}
              </div>
              <div className='flex items-center gap-2 flex-1 sm:flex-none'>
                  {currentStep < 3 ? (
                      <Button type="button" onClick={handleNext} disabled={isPending} className="w-full sm:w-auto h-12 px-8 font-black uppercase tracking-widest shadow-lg">
                          Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                  ) : (
                      <Button 
                        type="button" 
                        disabled={isPending || isLoading || !canFinalize} 
                        onClick={() => form.handleSubmit(onSubmit)()}
                        className="w-full sm:w-auto h-12 px-8 font-black uppercase tracking-widest shadow-primary/20 shadow-xl"
                      >
                          {isPending ? 'Procesando...' : (
                              <>
                                <CheckCircle className="mr-2 h-5 w-5" /> 
                                {checkInNow ? 'Finalizar e Ingresar' : 'Confirmar Reserva'}
                              </>
                          )}
                      </Button>
                  )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <InvoiceSuccessDialog open={successModalOpen} onOpenChange={setSuccessModalOpen} invoiceId={invoiceId} />
    </>
  );
}
