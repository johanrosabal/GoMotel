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
import type { Room, Client, RoomType, PricePlan } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { addHours, isBefore, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, ChevronsUpDown, PlusCircle, Star, Clock } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AddClientDialog from '@/components/clients/AddClientDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface CreateReservationDialogProps {
  children: React.ReactNode;
}

const reservationSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  checkInDate: z.date({ required_error: 'La fecha de check-in es requerida.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  guestId: z.string().optional(),
});


export default function CreateReservationDialog({ children }: CreateReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

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


  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      guestName: '',
      guestId: undefined,
      roomId: undefined,
      pricePlanName: undefined,
      checkInDate: new Date(),
    },
  });
  
  const selectedRoomId = form.watch('roomId');
  const selectedPlanName = form.watch('pricePlanName');
  const checkInDate = form.watch('checkInDate');

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
      form.setValue('pricePlanName', undefined, { shouldValidate: false });
  }, [selectedRoomId, form]);

  useEffect(() => {
      if (!checkInDate || !selectedPlanName || !availablePlans.length) {
        setCalculatedCheckOut(null);
        return;
      }
      const plan = availablePlans.find(p => p.name === selectedPlanName);
      if (plan) {
          let newCheckOutDate = new Date(checkInDate);
          const { duration, unit } = plan;
          
          if (unit === 'Hours') newCheckOutDate = addHours(newCheckOutDate, duration);
          else if (unit === 'Days') newCheckOutDate = addDays(newCheckOutDate, duration);
          else if (unit === 'Weeks') newCheckOutDate = addWeeks(newCheckOutDate, duration);
          else if (unit === 'Months') newCheckOutDate = addMonths(newCheckOutDate, duration);
          
          setCalculatedCheckOut(newCheckOutDate);
      }
  }, [checkInDate, selectedPlanName, availablePlans]);


  const onSubmit = (values: z.infer<typeof reservationSchema>) => {
    const room = rooms?.find(r => r.id === values.roomId);
    if (!room || !calculatedCheckOut) {
        toast({ title: "Error", description: "Habitación o fecha de salida no válida.", variant: "destructive" });
        return;
    }
    
    if (isBefore(calculatedCheckOut, values.checkInDate)) {
        toast({ title: "Error", description: "La fecha de check-out debe ser posterior a la fecha de check-in.", variant: "destructive" });
        return;
    }

    const formData = new FormData();
    formData.append('guestName', values.guestName);
    formData.append('roomId', values.roomId);
    formData.append('roomNumber', room.number);
    formData.append('roomType', room.roomTypeName);
    formData.append('checkInDate', values.checkInDate.toISOString());
    formData.append('checkOutDate', calculatedCheckOut.toISOString());
    if (values.guestId) {
        formData.append('guestId', values.guestId);
    }

    startTransition(async () => {
      const result = await createReservation(formData);
      if (result.error) {
        toast({ title: 'Error al Crear Reservación', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La reservación ha sido creada.' });
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
                            {field.value || 'Seleccionar o crear cliente...'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar cliente..."
                          onValueChange={setSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>
                             <CommandItem
                                onSelect={() => {
                                  form.setValue('guestName', searchTerm);
                                  form.setValue('guestId', undefined);
                                  setPopoverOpen(false);
                                }}
                              >
                                Usar nombre: "{searchTerm}"
                              </CommandItem>
                          </CommandEmpty>
                          <ScrollArea className="max-h-56">
                            <CommandGroup>
                              {isLoadingClients ? (
                                <p className="p-2 text-center text-sm">Cargando...</p>
                              ) : (
                                clients?.map((client) => (
                                  <CommandItem
                                    value={`${client.firstName} ${client.lastName}`}
                                    key={client.id}
                                    onSelect={() => {
                                      form.setValue('guestName', `${client.firstName} ${client.lastName}`);
                                      form.setValue('guestId', client.id);
                                      setPopoverOpen(false);
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
                          <CommandGroup className="border-t">
                            <CommandItem
                              onSelect={() => {
                                setPopoverOpen(false);
                                setAddClientOpen(true);
                              }}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Añadir Nuevo Cliente
                            </CommandItem>
                          </CommandGroup>
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
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Habitación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRooms ? "Cargando..." : "Seleccione una habitación"} />
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || availablePlans.length === 0 || !selectedRoomId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={!selectedRoomId ? "Seleccione una habitación primero" : "Seleccione un plan"} />
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

            <Controller
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fecha y Hora de Check-in</FormLabel>
                        <DateTimePicker date={field.value} setDate={field.onChange} />
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            {calculatedCheckOut && form.getValues('pricePlanName') && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Clock className="h-4 w-4" />
                        <span>Salida Estimada</span>
                    </div>
                    <p className="font-semibold text-center pt-1">{format(calculatedCheckOut, 'PPpp', { locale: es })}</p>
                </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending || isLoading}>
                {isPending ? 'Creando...' : 'Crear Reservación'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      </DialogContent>
    </Dialog>
  );
}
