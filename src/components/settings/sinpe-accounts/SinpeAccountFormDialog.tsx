'use client';

import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { SinpeAccount } from '@/types';
import { saveSinpeAccount } from '@/lib/actions/sinpe.actions';

const sinpeAccountSchema = z.object({
  id: z.string().optional(),
  accountHolder: z.string().min(3, 'El nombre del titular es requerido.'),
  phoneNumber: z.string().length(15, 'Formato de teléfono inválido. Use (506) XXXX-XXXX.'),
  bankName: z.string().min(2, 'El nombre del banco es requerido.'),
  balance: z.coerce.number().optional(),
});

interface SinpeAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: SinpeAccount;
}

export default function SinpeAccountFormDialog({ open, onOpenChange, account }: SinpeAccountFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof sinpeAccountSchema>>({
    resolver: zodResolver(sinpeAccountSchema),
    defaultValues: account || { accountHolder: '', phoneNumber: '', bankName: '', balance: 0 },
  });

  useEffect(() => {
    form.reset(account || { accountHolder: '', phoneNumber: '', bankName: '', balance: 0 });
  }, [account, open, form]);

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

  const onSubmit = (values: z.infer<typeof sinpeAccountSchema>) => {
    startTransition(async () => {
      await saveSinpeAccount(values);
      toast({ title: 'Éxito', description: `Cuenta SINPE para ${values.accountHolder} guardada.` });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Editar Cuenta SINPE' : 'Nueva Cuenta SINPE'}</DialogTitle>
          <DialogDescription>
            {account ? `Editando la cuenta de ${account.accountHolder}.` : 'Añada una nueva cuenta SINPE para recibir pagos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accountHolder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titular de la Cuenta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Teléfono</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(506) 8888-8888"
                      {...field}
                      onChange={(e) => handlePhoneChange(e, field.onChange)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Banco</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Banco Nacional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
    