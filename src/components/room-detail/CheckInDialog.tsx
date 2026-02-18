'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { checkIn } from '@/lib/actions/room.actions';
import { Check, ChevronsUpDown, PlusCircle, Star } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { Client } from '@/types';
import AddClientDialog from '@/components/clients/AddClientDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface CheckInDialogProps {
  children: ReactNode;
  roomId: string;
}

const checkInSchema = z.object({
  guestName: z.string().min(2, 'El nombre del huésped debe tener al menos 2 caracteres.'),
  durationHours: z.coerce.number().int().min(1, 'La duración debe ser de al menos 1 hora.'),
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
    return query(collection(firestore, 'clients'), fbOrderBy('isVip', 'desc'), fbOrderBy('firstName'));
  }, [firestore]);

  const { data: clients, isLoading: isLoadingClients } = useCollection<Client>(clientsQuery);

  const form = useForm<z.infer<typeof checkInSchema>>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      guestName: '',
      durationHours: 3,
      guestId: undefined,
    },
  });

  const onSubmit = (values: z.infer<typeof checkInSchema>) => {
    const formData = new FormData();
    formData.append('guestName', values.guestName);
    formData.append('durationHours', String(values.durationHours));
    if (values.guestId) {
      formData.append('guestId', values.guestId);
    }

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
              name="durationHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración de la Estancia (horas)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isPending}>
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
