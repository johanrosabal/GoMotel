'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoomType } from '@/lib/actions/roomType.actions';
import type { RoomType, PricePlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditRoomTypeDialogProps {
  children: ReactNode;
  roomType?: RoomType;
}

const pricePlanSchema = z.object({
  name: z.string().min(1, 'El nombre del plan es requerido.'),
  duration: z.coerce.number().positive('La duración debe ser un número positivo.'),
  unit: z.enum(['Hours', 'Days', 'Weeks', 'Months']),
  price: z.coerce.number().positive('El precio debe ser un número positivo.'),
});

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  features: z.array(z.string()).optional(),
  pricePlans: z.array(pricePlanSchema).min(1, 'Debe agregar al menos un plan de precios.'),
});

const unitMap: Record<PricePlan['unit'], string> = {
    Hours: 'hs',
    Days: 'días',
    Weeks: 'semanas',
    Months: 'meses'
};

const FORM_ID = 'edit-room-type-form';

export default function EditRoomTypeDialog({ children, roomType }: EditRoomTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newFeature, setNewFeature] = useState('');
  
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('');
  const [newPlanUnit, setNewPlanUnit] = useState<PricePlan['unit']>('Hours');
  const [newPlanPrice, setNewPlanPrice] = useState('');

  const form = useForm<z.infer<typeof roomTypeSchema>>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: roomType ? {
        ...roomType,
        features: roomType.features || [],
        pricePlans: roomType.pricePlans || [],
    } : {
      name: '',
      features: [],
      pricePlans: [],
    },
  });

  const { formState: { errors } } = form;
  const features = form.watch('features', roomType?.features || []);
  const pricePlans = form.watch('pricePlans', roomType?.pricePlans || []);

  const handleAddFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      form.setValue('features', [...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    const newFeatures = features.filter((_, index) => index !== indexToRemove);
    form.setValue('features', newFeatures);
  };
  
  const handleAddPlan = () => {
    const durationNum = parseInt(newPlanDuration, 10);
    const priceNum = parseFloat(newPlanPrice);

    if (newPlanName.trim() && !isNaN(durationNum) && durationNum > 0 && !isNaN(priceNum) && priceNum >= 0) {
      const newPlan = { name: newPlanName.trim(), duration: durationNum, unit: newPlanUnit, price: priceNum };
      if (!pricePlans.some(p => p.name === newPlan.name)) {
        form.setValue('pricePlans', [...pricePlans, newPlan], { shouldValidate: true });
        setNewPlanName('');
        setNewPlanDuration('');
        setNewPlanPrice('');
        setNewPlanUnit('Hours');
      } else {
        toast({ title: "Error", description: "El nombre del plan de precios ya existe.", variant: 'destructive'});
      }
    } else {
        toast({ title: "Error", description: "Por favor, complete todos los campos del plan de precios con valores válidos.", variant: 'destructive'});
    }
  };

  const handleRemovePlan = (indexToRemove: number) => {
    const newPlans = pricePlans.filter((_, index) => index !== indexToRemove);
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('name', values.name);
    if(values.features) {
      values.features.forEach(feature => formData.append('features', feature));
    }
    if (values.pricePlans) {
        formData.append('pricePlans', JSON.stringify(values.pricePlans));
    }

    startTransition(async () => {
      const result = await saveRoomType(formData);
      if (result.error) {
        if (typeof result.error === 'object') {
          // Validation error object from Zod
          Object.entries(result.error).forEach(([field, messages]) => {
            if (messages) {
              form.setError(field as keyof z.infer<typeof roomTypeSchema>, {
                type: 'server',
                message: Array.isArray(messages) ? messages.join(', ') : String(messages),
              });
            }
          });
          toast({
            title: 'Error de Validación',
            description: 'Por favor corrija los campos marcados.',
            variant: 'destructive',
          });
        } else {
          // Generic error string from the action
          toast({
            title: 'Error',
            description: result.error,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: '¡Éxito!',
          description: `El tipo de habitación "${values.name}" ha sido guardado.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };
  
  const resetFormState = () => {
    form.reset(roomType ? { ...roomType, features: roomType.features || [], pricePlans: roomType.pricePlans || [] } : { name: '', features: [], pricePlans: [] });
    setNewFeature('');
    setNewPlanName('');
    setNewPlanDuration('');
    setNewPlanUnit('Hours');
    setNewPlanPrice('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetFormState();
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{roomType ? 'Editar Tipo de Habitación' : 'Añadir Nuevo Tipo de Habitación'}</DialogTitle>
          <DialogDescription>
            {roomType
              ? `Actualizar detalles para ${roomType.name}.`
              : 'Añadir un nuevo tipo de habitación a su sistema.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-6">
            <Form {...form}>
              <form
                id={FORM_ID}
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 py-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Tipo de Habitación</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="p.ej., Suite Presidencial"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Características</FormLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="p.ej. Wi-Fi de alta velocidad"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddFeature}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="sr-only">Añadir Característica</span>
                    </Button>
                  </div>
                  <div className="space-y-2 pt-2">
                    {features.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {features.map((feature, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="pl-2 pr-1 py-0.5 text-sm"
                          >
                            {feature}
                            <button
                              type="button"
                              onClick={() => handleRemoveFeature(index)}
                              className="ml-1.5 p-0.5 rounded-full hover:bg-destructive/20 text-destructive"
                              aria-label={`Eliminar ${feature}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-1">
                        Aún no se han añadido características.
                      </p>
                    )}
                  </div>
                </FormItem>

                <Separator className="my-4" />

                <FormItem>
                  <FormLabel>Planes de Precios</FormLabel>
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-10 gap-2 items-end">
                      <div className="space-y-1 sm:col-span-4">
                        <Label htmlFor="plan-name" className="text-xs">
                          Nombre
                        </Label>
                        <Input
                          id="plan-name"
                          placeholder="p.ej. Tarifa Nocturna"
                          value={newPlanName}
                          onChange={(e) => setNewPlanName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="plan-duration" className="text-xs">
                          Duración
                        </Label>
                        <Input
                          id="plan-duration"
                          type="number"
                          placeholder="8"
                          value={newPlanDuration}
                          onChange={(e) => setNewPlanDuration(e.target.value)}
                          className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="plan-unit" className="text-xs">
                          Unidad
                        </Label>
                        <Select
                          value={newPlanUnit}
                          onValueChange={(value) =>
                            setNewPlanUnit(value as any)
                          }
                        >
                          <FormControl>
                            <SelectTrigger id="plan-unit">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Hours">Horas</SelectItem>
                            <SelectItem value="Days">Días</SelectItem>
                            <SelectItem value="Weeks">Semanas</SelectItem>
                            <SelectItem value="Months">Meses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="plan-price" className="text-xs">
                          Precio ($)
                        </Label>
                        <Input
                          id="plan-price"
                          type="number"
                          placeholder="120"
                          value={newPlanPrice}
                          onChange={(e) => setNewPlanPrice(e.target.value)}
                          className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPlan}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir Plan
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2">
                    {pricePlans.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {pricePlans.map((plan, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="pl-2 pr-1 py-0.5 text-sm"
                          >
                            {plan.name} ({plan.duration}{' '}
                            {plan.duration === 1
                              ? unitMap[plan.unit].replace(/s$/, '')
                              : unitMap[plan.unit]}
                            ) - ${plan.price}
                            <button
                              type="button"
                              onClick={() => handleRemovePlan(index)}
                              className="ml-1.5 p-0.5 rounded-full hover:bg-destructive/20 text-destructive"
                              aria-label={`Eliminar ${plan.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-1 pt-2">
                        Aún no se han añadido planes de precios.
                      </p>
                    )}
                    {errors.pricePlans && (
                      <p className="text-sm font-medium text-destructive px-1 pt-1">
                        {errors.pricePlans.message}
                      </p>
                    )}
                  </div>
                </FormItem>
              </form>
            </Form>
          </ScrollArea>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
