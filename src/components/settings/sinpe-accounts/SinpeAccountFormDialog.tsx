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
  phoneNumber: z.string().min(8, 'El número de teléfono es requerido.'),
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
    defaultValues: account || { phoneNumber: '', bankName: '', balance: 0 },
  });

  useEffect(() => {
    form.reset(account || { phoneNumber: '', bankName: '', balance: 0 });
  }, [account, open, form]);

  const onSubmit = (values: z.infer<typeof sinpeAccountSchema>) => {
    startTransition(async () => {
      await saveSinpeAccount(values);
      toast({ title: 'Éxito', description: `Cuenta SINPE para el número ${values.phoneNumber} guardada.` });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Editar Cuenta SINPE' : 'Nueva Cuenta SINPE'}</DialogTitle>
          <DialogDescription>
            {account ? `Editando la cuenta del número ${account.phoneNumber}.` : 'Añada una nueva cuenta SINPE para recibir pagos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="88888888" {...field} />
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