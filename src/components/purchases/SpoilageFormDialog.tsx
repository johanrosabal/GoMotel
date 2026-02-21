'use client';
import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseInvoice } from '@/types';
import { registerSpoilage } from '@/lib/actions/purchase.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';

const spoilageItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  spoilageQuantity: z.coerce.number().int().min(0, "La cantidad debe ser un número positivo."),
  originalQuantity: z.number().int(),
}).refine(data => data.spoilageQuantity <= data.originalQuantity, {
  message: "No puede registrar más merma que la cantidad comprada.",
  path: ["spoilageQuantity"],
});

const spoilageFormSchema = z.object({
  purchaseInvoiceId: z.string(),
  notes: z.string().optional(),
  items: z.array(spoilageItemSchema).min(1),
});

type SpoilageFormValues = z.infer<typeof spoilageFormSchema>;

interface SpoilageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseInvoice: PurchaseInvoice;
}

export default function SpoilageFormDialog({ open, onOpenChange, purchaseInvoice }: SpoilageFormDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<SpoilageFormValues>({
        resolver: zodResolver(spoilageFormSchema),
        defaultValues: {
            purchaseInvoiceId: purchaseInvoice.id,
            notes: '',
            items: purchaseInvoice.items.map(item => ({
                serviceId: item.serviceId,
                serviceName: item.serviceName,
                originalQuantity: item.quantity,
                spoilageQuantity: 0,
            })),
        },
    });

    const { fields } = useFieldArray({
        control: form.control,
        name: "items"
    });

    useEffect(() => {
        if (open) {
            form.reset({
                purchaseInvoiceId: purchaseInvoice.id,
                notes: '',
                items: purchaseInvoice.items.map(item => ({
                    serviceId: item.serviceId,
                    serviceName: item.serviceName,
                    originalQuantity: item.quantity,
                    spoilageQuantity: 0,
                })),
            });
        }
    }, [open, purchaseInvoice, form]);

    const onSubmit = (values: SpoilageFormValues) => {
        const itemsWithSpoilage = values.items.filter(item => item.spoilageQuantity > 0);
        if (itemsWithSpoilage.length === 0) {
            toast({ title: "Sin cambios", description: "No se ingresó ninguna cantidad de merma.", variant: 'default' });
            return;
        }

        startTransition(async () => {
            const result = await registerSpoilage({ ...values, items: itemsWithSpoilage });
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Registrar Merma de Inventario</DialogTitle>
                    <DialogDescription>
                        Factura N° {purchaseInvoice.invoiceNumber}. Ingrese las cantidades de productos que se han perdido o dañado. El inventario se ajustará.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <ScrollArea className="h-72 pr-3">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="w-24 text-center">Cant. Comprada</TableHead>
                                        <TableHead className="w-32 text-center">Cant. de Merma</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.serviceName}</TableCell>
                                            <TableCell className="text-center">{item.originalQuantity}</TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.spoilageQuantity`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Input type="number" {...field} className="text-right" min="0" max={item.originalQuantity} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas / Motivo (Opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Ej: Productos dañados durante el transporte." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Guardando...' : 'Confirmar Merma'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
