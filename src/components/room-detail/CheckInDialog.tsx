'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { checkIn } from '@/lib/actions/room.actions';
import { Check, ChevronsUpDown, PlusCircle, Star, Clock } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Client, Room, RoomType, PricePlan } from '@/types';
import AddClientDialog from '@/components/clients/AddClientDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '../ui/input';

interface CheckInDialogProps {
  children: ReactNode;
  roomId: string;
}

const checkInSchema = z.object({
  guestName: z.string().min(2, 'El nombre del huésped debe tener al menos 2 caracteres.'),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  guestId: z.string().optional(),
});

export default function CheckInDialog({ children, roomId }: CheckInDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const { firestore } = useFirebase();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'clients'));
  }, [firestore]);

  const { data: clients, isLoading: isLoadingClients } = useCollection<Client>(clientsQuery);
  
  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'));
  }, [firestore]);
  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);
  
  const room = useMemo(() => rooms?.find(r => r.id === roomId), [rooms, roomId]);
  const roomType = useMemo(() => roomTypes?.find(rt => rt.id === room?.roomTypeId), [roomTypes, room]);
  const availablePlans = useMemo(() => roomType?.pricePlans?.sort((a, b) => a.price - b.price) || [], [roomType]);

  const form = useForm<z.infer<typeof checkInSchema>>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      guestName: '',
      pricePlanName: undefined,
      guestId: undefined,
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
      if (!searchTerm) {
          return sortedClients;
      }
      const lowercasedQuery = searchTerm.toLowerCase();
      return sortedClients.filter(client =>
          `${client.firstName} ${client.lastName}`.toLowerCase().includes(lowercasedQuery)
      );
  }, [searchTerm, sortedClients]);


  const selectedPlanName = form.watch('pricePlanName');
  
  const calculatedCheckOut = useMemo(() => {
    if (!selectedPlanName || !availablePlans.length) return null;

    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (!plan) return null;

    const checkInTime = new Date();
    let checkOutTime = new Date(checkInTime);
    
    switch(plan.unit) {
      case 'Minutes': checkOutTime = addMinutes(checkInTime, plan.duration); break;
      case 'Hours': checkOutTime = addHours(checkInTime, plan.duration); break;
      case 'Days': checkOutTime = addDays(checkInTime, plan.duration); break;
      case 'Weeks': checkOutTime = addWeeks(checkInTime, plan.duration); break;
      case 'Months': checkOutTime = addMonths(checkInTime, plan.duration); break;
    }
    
    return format(checkOutTime, 'PPpp', { locale: es });
  }, [selectedPlanName, availablePlans]);

  const onSubmit = (values: z.infer<typeof checkInSchema>) => {
    const formData = new FormData();
    formData.append('guestName', values.guestName);
    if (values.guestId) {
      formData.append('guestId', values.guestId);
    }
    
    const plan = availablePlans.find(p => p.name === values.pricePlanName);
    if (!plan) {
        toast({ title: 'Error', description: 'Plan de precios inválido.', variant: 'destructive' });
        return;
    }

    const checkInTime = new Date();
    let expectedCheckOutDate = new Date(checkInTime);
    switch(plan.unit) {
      case 'Minutes': expectedCheckOutDate = addMinutes(checkInTime, plan.duration); break;
      case 'Hours': expectedCheckOutDate = addHours(checkInTime, plan.duration); break;
      case 'Days': expectedCheckOutDate = addDays(checkInTime, plan.duration); break;
      case 'Weeks': expectedCheckOutDate = addWeeks(checkInTime, plan.duration); break;
      case 'Months': expectedCheckOutDate = addMonths(checkInTime, plan.duration); break;
    }

    formData.append('pricePlanName', plan.name);
    formData.append('pricePlanAmount', String(plan.price));
    formData.append('expectedCheckOut', expectedCheckOutDate.toISOString());

    startTransition(async () => {
      const result = await checkIn(roomId, formData);
      if (result?.error) {
        toast({
          title: 'Falló el Check-In',
          description: typeof result.error === 'string' ? result.error : 'Por favor revise los campos del formulario.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: `El huésped "${values.guestName}" ha sido registrado.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };

  useEffect(() => {
    if (open) {
      form.reset();
      setSearchTerm('');
    }
  }, [open, form]);

  useEffect(() => {
    form.setValue('guestName', searchTerm);
    form.setValue('guestId', undefined);
  }, [searchTerm, form]);

  const isLoading = isLoadingRooms || isLoadingRoomTypes;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-In de Huésped (Walk-in)</DialogTitle>
          <DialogDescription>
            Ingrese los detalles del huésped para registrarlo en esta habitación.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Huésped</FormLabel>
                   <div className="relative">
                      <Input
                          placeholder="Buscar o escribir nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          autoComplete="off"
                          className="pr-10"
                      />
                      {showSuggestions && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
                              <ScrollArea className="max-h-56">
                                <div className="p-1">
                                  {filteredClients.length > 0 ? (
                                    filteredClients.map((client) => (
                                      <button
                                        type="button"
                                        key={client.id}
                                        onMouseDown={() => {
                                          setSearchTerm(`${client.firstName} ${client.lastName}`);
                                          form.setValue('guestId', client.id);
                                          setShowSuggestions(false);
                                        }}
                                        className="relative flex w-full cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Check
                                            className={cn('h-4 w-4', guestNameValue === `${client.firstName} ${client.lastName}` ? 'opacity-100' : 'opacity-0')}
                                          />
                                          {client.firstName} {client.lastName}
                                        </div>
                                        {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                      </button>
                                    ))
                                  ) : (
                                    !isLoadingClients && <p className="p-2 text-center text-sm text-muted-foreground">No se encontraron clientes.</p>
                                  )}
                                  {isLoadingClients && <p className="p-2 text-center text-sm text-muted-foreground">Cargando...</p>}
                                </div>
                              </ScrollArea>
                               <div className="border-t p-1">
                                  <button
                                      type="button"
                                      onMouseDown={() => {
                                        setShowSuggestions(false);
                                        setAddClientOpen(true);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                  >
                                      <PlusCircle className="h-4 w-4" />
                                      Añadir Nuevo Cliente
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione un plan"} />
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

            {calculatedCheckOut && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Clock className="h-4 w-4" />
                        <span>Salida Estimada</span>
                    </div>
                    <p className="font-semibold text-center pt-1">{calculatedCheckOut}</p>
                </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isPending || isLoading}>
                {isPending ? 'Registrando...' : 'Confirmar Check-In'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      </DialogContent>
    </Dialog>
  );
}
