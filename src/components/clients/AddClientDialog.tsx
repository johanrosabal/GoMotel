'use client';

import { useState, useTransition, type ReactNode, useEffect } from 'react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/types';
import { saveClient } from '@/lib/actions/client.actions';
import { Textarea } from '../ui/textarea';

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
});

export default function AddClientDialog({ children, client }: AddClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
        ...client,
        birthDate: client.birthDate?.toDate()
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
    },
  });

  const onSubmit = (values: z.infer<typeof clientSchema>) => {
    startTransition(async () => {
      const result = await saveClient(values);
      if (result.error) {
        toast({ title: 'Error al Guardar', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: `El cliente ${values.firstName} ha sido guardado.` });
        setOpen(false);
        if(!client) form.reset();
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
