'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Plus, X, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RoomTypeFormProps {
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

export default function RoomTypeForm({ roomType }: RoomTypeFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newFeature, setNewFeature] = useState('');
  
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('');
  const [newPlanUnit, setNewPlanUnit] = useState<PricePlan['unit']>('Hours');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);

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
  
  const handleSavePlan = () => {
    const durationNum = parseInt(newPlanDuration, 10);
    const priceNum = parseFloat(newPlanPrice);

    if (newPlanName.trim() && !isNaN(durationNum) && durationNum > 0 && !isNaN(priceNum) && priceNum >= 0) {
      const newPlan = { name: newPlanName.trim(), duration: durationNum, unit: newPlanUnit, price: priceNum };
      
      if (pricePlans.some((p, i) => p.name.toLowerCase() === newPlan.name.toLowerCase() && i !== editingPlanIndex)) {
        toast({ title: "Error", description: "El nombre del plan de precios ya existe.", variant: 'destructive'});
        return;
      }
      
      if (editingPlanIndex !== null) {
        const updatedPlans = [...pricePlans];
        updatedPlans[editingPlanIndex] = newPlan;
        form.setValue('pricePlans', updatedPlans, { shouldValidate: true });
      } else {
        form.setValue('pricePlans', [...pricePlans, newPlan], { shouldValidate: true });
      }

      setEditingPlanIndex(null);
      setNewPlanName('');
      setNewPlanDuration('');
      setNewPlanPrice('');
      setNewPlanUnit('Hours');

    } else {
        toast({ title: "Error", description: "Por favor, complete todos los campos del plan de precios con valores válidos.", variant: 'destructive'});
    }
  };

  const handleEditPlan = (index: number) => {
    const plan = pricePlans[index];
    setEditingPlanIndex(index);
    setNewPlanName(plan.name);
    setNewPlanDuration(String(plan.duration));
    setNewPlanUnit(plan.unit);
    setNewPlanPrice(String(plan.price));
  };

  const handleCancelEdit = () => {
    setEditingPlanIndex(null);
    setNewPlanName('');
    setNewPlanDuration('');
    setNewPlanPrice('');
    setNewPlanUnit('Hours');
  };

  const handleRemovePlan = (indexToRemove: number) => {
    const newPlans = pricePlans.filter((_, index) => index !== indexToRemove);
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    const formData = new FormData();
    if(roomType?.id) formData.append('id', roomType.id);
    formData.append('name', values.name);
    if(values.features) {
      values.features.forEach(feature => formData.append('features', feature));
    }
    if (values.pricePlans) {
        formData.append('pricePlans', JSON.stringify(values.pricePlans));
    }

    startTransition(async () => {
      const result = await saveRoomType(formData);
      if (result?.error) {
        toast({
          title: 'Error al Guardar',
          description: typeof result.error === 'string' ? result.error : 'Por favor, revise los errores en el formulario.',
          variant: 'destructive',
        });
      }
      // On success, the server action will redirect the user.
      // No need to show a toast here.
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="space-y-6 pt-6">
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

              <Separator />

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
                   <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        onClick={handleSavePlan}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {editingPlanIndex !== null ? 'Actualizar Plan' : 'Añadir Plan'}
                    </Button>
                    {editingPlanIndex !== null && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCancelEdit}
                        >
                            Cancelar
                        </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                {pricePlans.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Duración</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricePlans.map((plan, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{plan.name}</TableCell>
                            <TableCell>{`${plan.duration} ${
                              plan.duration === 1
                                ? unitMap[plan.unit].replace(/s$/, '')
                                : unitMap[plan.unit]
                            }`}</TableCell>
                            <TableCell className="text-right">{formatCurrency(plan.price)}</TableCell>
                            <TableCell className="text-right">
                               <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditPlan(index)}
                                aria-label={`Editar ${plan.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemovePlan(index)}
                                aria-label={`Eliminar ${plan.name}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
              <Button asChild variant="outline">
                <Link href="/settings/room-types">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
