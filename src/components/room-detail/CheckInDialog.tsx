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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Client, Room, RoomType, PricePlan } from '@/types';
import AddClientDialog from '@/components/clients/AddClientDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { firestore } = useFirebase();

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

  const selectedPlanName = form.watch('pricePlanName');
  
  const calculatedCheckOut = useMemo(() => {
    if (!selectedPlanName || !availablePlans.length) return null;

    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (!plan) return null;

    const checkInTime = new Date();
    let checkOutTime = new Date(checkInTime);
    
    switch(plan.unit) {
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
    
    let durationHours = 0;
    switch(plan.unit) {
        case 'Hours': durationHours = plan.duration; break;
        case 'Days': durationHours = plan.duration * 24; break;
        case 'Weeks': durationHours = plan.duration * 7 * 24; break;
        case 'Months': durationHours = plan.duration * 30 * 24; break; // Approximation
    }
    formData.append('durationHours', String(durationHours));

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
    }
  }, [open, form]);

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
