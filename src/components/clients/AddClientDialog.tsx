'use client';

import { useState, useTransition, type ReactNode, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/types';
import { saveClient } from '@/lib/actions/client.actions';
import { Textarea } from '../ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddClientDialogProps {
  children: ReactNode;
  client?: Client;
}

const clientSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(50),
  lastName: z.string().min(1, 'El apellido es requerido.').max(50),
  secondLastName: z.string().max(50).optional(),
  idCard: z.string().min(1, 'La cédula es requerida.'),
  email: z.string().email('Correo electrónico inválido.'),
  phoneNumber: z.string().min(1, 'El teléfono es requerido.'),
  whatsappNumber: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().default(false),
});

export default function AddClientDialog({ children, client }: AddClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
        ...client,
        birthDate: client.birthDate?.toDate(),
        isVip: client.isVip || false,
    } : {
      firstName: '',
      lastName: '',
      secondLastName: '',
      idCard: '',
      email: '',
      phoneNumber: '',
      whatsappNumber: '',
      address: '',
      notes: '',
      isVip: false,
    },
  });
  
  useEffect(() => {
    if (open) {
      const defaultValues = client ? {
        ...client,
        birthDate: client.birthDate?.toDate(),
      } : {
        firstName: '', lastName: '', secondLastName: '', idCard: '', email: '', phoneNumber: '',
        whatsappNumber: '', address: '', notes: '', isVip: false, birthDate: undefined
      };
      form.reset(defaultValues);

      if (client && client.birthDate) {
        const date = client.birthDate.toDate();
        setBirthDay(String(date.getDate()));
        setBirthMonth(String(date.getMonth() + 1));
        setBirthYear(String(date.getFullYear()));
      } else {
        setBirthDay('');
        setBirthMonth('');
        setBirthYear('');
      }
    }
  }, [open, client, form]);

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const day = parseInt(birthDay, 10);
      const month = parseInt(birthMonth, 10) - 1; // JS months are 0-indexed
      const year = parseInt(birthYear, 10);
      const date = new Date(year, month, day);

      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        form.setValue('birthDate', date, { shouldValidate: true });
        form.clearErrors('birthDate');
      } else {
        form.setError('birthDate', { type: 'manual', message: 'Fecha no válida.' });
      }
    } else if (!birthDay && !birthMonth && !birthYear) {
        form.setValue('birthDate', undefined, { shouldValidate: true });
        form.clearErrors('birthDate');
    }
  }, [birthDay, birthMonth, birthYear, form]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  const onSubmit = (values: z.infer<typeof clientSchema>) => {
    startTransition(async () => {
      const result = await saveClient(values);
      if (result.error) {
        toast({ title: 'Error al Guardar', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: `El cliente ${values.firstName} ha sido guardado.` });
        setOpen(false);
      }
    });
  };

  const handleIdCardChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const maxLength = 9;
    const value = rawValue.slice(0, maxLength);

    let maskedValue = '';
    if (value.length > 5) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1, 5)}-${value.slice(5)}`;
    } else if (value.length > 1) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1)}`;
    } else {
      maskedValue = value;
    }

    fieldOnChange(maskedValue);
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    let numbers = e.target.value.replace(/\D/g, '');
    
    if (numbers.startsWith('506')) {
      numbers = numbers.substring(3);
    }
    const value = numbers.slice(0, 8);
    let maskedValue = '';
    if (value.length > 0) {
      maskedValue = `(506) ${value.slice(0, 4)}`;
      if (value.length > 4) {
        maskedValue += `-${value.slice(4)}`;
      }
    }
    fieldOnChange(maskedValue);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {client ? `Actualizando la ficha de ${client.firstName}.` : 'Complete el formulario para registrar un nuevo cliente.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Primer Apellido</FormLabel><FormControl><Input placeholder="Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="secondLastName" render={({ field }) => (
                <FormItem><FormLabel>Segundo Apellido (Opcional)</FormLabel><FormControl><Input placeholder="García" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Nacimiento (Opcional)</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                     <Select onValueChange={setBirthDay} value={birthDay}>
                       <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Día" />
                        </SelectTrigger>
                       </FormControl>
                       <SelectContent>
                        {days.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                       </SelectContent>
                     </Select>
                      <Select onValueChange={setBirthMonth} value={birthMonth}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {months.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={setBirthYear} value={birthYear}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="idCard" render={({ field }) => (
                <FormItem><FormLabel>Cédula</FormLabel><FormControl><Input placeholder="0-0000-0000" {...field} onChange={(e) => handleIdCardChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="juan@perez.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="(506) 8888-8888" {...field} onChange={(e) => handlePhoneChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="Cliente frecuente, prefiere habitaciones tranquilas..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField
              control={form.control}
              name="isVip"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Cliente VIP / Favorito</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Los clientes VIP se destacarán en la lista para un reconocimiento rápido.
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

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : (client ? 'Guardar Cambios' : 'Crear Cliente')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
