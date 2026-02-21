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
import type { Service } from '@/types';
import { registerServiceSpoilage } from '@/lib/actions/service.actions';
import { Textarea } from '../ui/textarea';

const spoilageSchema = z.object({
  serviceId: z.string(),
  quantity: z.coerce.number().int().min(1, 'La cantidad de merma debe ser al menos 1.'),
  notes: z.string().optional(),
});

type SpoilageFormValues = z.infer<typeof spoilageSchema>;

interface ServiceSpoilageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}

export default function ServiceSpoilageDialog({ open, onOpenChange, service }: ServiceSpoilageDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<SpoilageFormValues>({
        resolver: zodResolver(spoilageSchema),
        defaultValues: {
            serviceId: service.id,
            quantity: 1,
            notes: '',
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                serviceId: service.id,
                quantity: 1,
                notes: '',
            });
        }
    }, [open, service, form]);

    const onSubmit = (values: SpoilageFormValues) => {
        startTransition(async () => {
            const result = await registerServiceSpoilage(values);
            if (result.error) {
                toast({ title: 'Error al registrar merma', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Éxito!', description: 'La merma de inventario ha sido registrada.' });
                onOpenChange(false);
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar Merma de Producto</DialogTitle>
                    <DialogDescription>
                        Ajuste el stock de "{service.name}". Existencias actuales: {service.stock}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cantidad a Dar de Baja</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} min="1" max={service.stock} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas / Motivo (Opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Ej: Producto vencido, daño..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending} variant="destructive">
                                {isPending ? 'Guardando...' : 'Confirmar Merma'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
