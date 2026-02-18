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
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { Room, Client, RoomType } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { addHours, isBefore, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, ChevronsUpDown, Star, Clock } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import AddClientDialog from '../clients/AddClientDialog';
import { useRouter } from 'next/navigation';

interface CreateReservationDialogProps {
  children: React.ReactNode;
}

const reservationSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  checkInDate: z.date({ required_error: 'La fecha de check-in es requerida.'}),
  guestId: z.string().optional(),
  checkInNow: z.boolean().default(false),
});


export default function CreateReservationDialog({ children }: CreateReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const router = useRouter();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [calculatedCheckOut, setCalculatedCheckOut] = useState<Date | null>(null);

  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'), fbOrderBy('number'));
  }, [firestore]);
  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), fbOrderBy("firstName"));
  }, [firestore]);
  const { data: clients, isLoading: isLoadingClients } = useCollection<Client>(clientsQuery);
  
  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'));
  }, [firestore]);
  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchTerm) {
      // Sort by isVip first, then by name
      return [...clients].sort((a, b) => {
        if (a.isVip && !b.isVip) return -1;
        if (!a.isVip && b.isVip) return 1;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return clients.filter(client => 
      `${client.firstName} ${client.lastName}`.toLowerCase().includes(lowercasedSearchTerm)
    );
  }, [clients, searchTerm]);


  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      guestName: '',
      guestId: undefined,
      roomId: undefined,
      pricePlanName: undefined,
      checkInNow: false,
      checkInDate: new Date(),
    },
  });
  
  const selectedRoomId = form.watch('roomId');
  const selectedPlanName = form.watch('pricePlanName');
  const checkInDateValue = form.watch('checkInDate');
  const checkInNow = form.watch('checkInNow');

  const selectedRoom = useMemo(() => rooms?.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);
  const availablePlans = useMemo(() => {
      if (!selectedRoom || !roomTypes) return [];
      const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
      return roomType?.pricePlans?.sort((a,b) => a.price - b.price) || [];
  }, [selectedRoom, roomTypes]);

  const resetForm = useCallback(() => {
    form.reset({
      guestName: '',
      guestId: undefined,
      roomId: undefined,
      pricePlanName: undefined,
      checkInNow: false,
      checkInDate: new Date(),
    });
    setCalculatedCheckOut(null);
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
        
        if (unit === 'Hours') newCheckOutDate = addHours(newCheckOutDate, duration);
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
        toast({ title: '¡Éxito!', description: `La operación se ha completado.` });
        setOpen(false);
      }
    });
  };

  const isLoading = isLoadingRooms || isLoadingRoomTypes;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nueva Reservación</DialogTitle>
          <DialogDescription>Complete los detalles para agendar una nueva reservación.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Huésped</FormLabel>
                   <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <span className="truncate">
                            {field.value || 'Seleccionar o escribir cliente...'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar cliente..."
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>
                             <CommandItem
                                onSelect={() => {
                                  form.setValue('guestName', searchTerm);
                                  form.setValue('guestId', undefined);
                                  setPopoverOpen(false);
                                  setSearchTerm('');
                                }}
                                className="cursor-pointer"
                              >
                                Usar nombre: "{searchTerm}"
                              </CommandItem>
                          </CommandEmpty>
                          <ScrollArea className="max-h-56">
                            <CommandGroup>
                              {isLoadingClients ? (
                                <p className="p-2 text-center text-sm">Cargando...</p>
                              ) : (
                                filteredClients.map((client) => (
                                  <CommandItem
                                    value={`${client.firstName} ${client.lastName}`}
                                    key={client.id}
                                    onSelect={() => {
                                      form.setValue('guestName', `${client.firstName} ${client.lastName}`);
                                      form.setValue('guestId', client.id);
                                      setPopoverOpen(false);
                                      setSearchTerm('');
                                    }}
                                    className="flex justify-between items-center"
                                  >
                                    <div className="flex items-center">
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          field.value === `${client.firstName} ${client.lastName}`
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {client.firstName} {client.lastName}
                                    </div>
                                     {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                  </CommandItem>
                                ))
                              )}
                            </CommandGroup>
                          </ScrollArea>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="checkInNow"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
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
            
            {!checkInNow && (
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
            )}
            
            {calculatedCheckOut && form.getValues('pricePlanName') && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Clock className="h-4 w-4" />
                        <span>Salida Estimada</span>
                    </div>
                    <p className="font-semibold text-center pt-1">{calculatedCheckOut}</p>
                </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending || isLoading}>
                {isPending ? (checkInNow ? 'Procesando...' : 'Creando...') : (checkInNow ? 'Hacer Check-in Ahora' : 'Crear Reservación')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      </DialogContent>
    </Dialog>
  );
}
