'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
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
import type { RoomType, PricePlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';

interface RoomTypeFormProps {
  roomType?: RoomType;
  allRoomTypes?: RoomType[];
}

const pricePlanSchema = z.object({
  name: z.string().min(1, 'El nombre del plan es requerido.'),
  duration: z.coerce.number().positive('La duración debe ser un número positivo.'),
  unit: z.enum(['Hours', 'Days', 'Weeks', 'Months']),
  price: z.coerce.number().min(0, 'El precio debe ser un número no negativo.'),
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

const crcStringToNumber = (crcString: string): number => {
    if (!crcString) return 0;
    // Remove thousand separators (dots) and replace decimal comma with a dot for parseFloat
    return parseFloat(crcString.replace(/\./g, '').replace(',', '.'));
};

const numberToCrcString = (num: number): string => {
    if (isNaN(num)) return '';
    // Format to a string like 1.234,56 (without currency symbol)
    return new Intl.NumberFormat('es-CR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};


export default function RoomTypeForm({ roomType, allRoomTypes = [] }: RoomTypeFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newFeature, setNewFeature] = useState('');
  
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('');
  const [newPlanUnit, setNewPlanUnit] = useState<PricePlan['unit']>('Hours');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [planInputErrors, setPlanInputErrors] = useState<{ name?: string, duration?: string, price?: string }>({});

  const router = useRouter();
  const { firestore } = useFirebase();

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

  const allGlobalFeatures = useMemo(() => {
    const featureSet = new Set<string>();
    allRoomTypes.forEach(rt => {
      rt.features?.forEach(f => featureSet.add(f));
    });
    return Array.from(featureSet).sort();
  }, [allRoomTypes]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const trimmedInput = newFeature.trim();
    if (trimmedInput) {
        const filteredGlobalSuggestions = allGlobalFeatures.filter(f => 
            f.toLowerCase().includes(trimmedInput.toLowerCase()) && 
            !features.includes(f)
        );
        
        const isAlreadyAdded = features.some(f => f.toLowerCase() === trimmedInput.toLowerCase());
        
        const exactMatchExists = filteredGlobalSuggestions.some(f => f.toLowerCase() === trimmedInput.toLowerCase());

        if (!isAlreadyAdded && !exactMatchExists) {
            setSuggestions([trimmedInput, ...filteredGlobalSuggestions]);
        } else {
            setSuggestions(filteredGlobalSuggestions);
        }
    } else {
        setSuggestions([]);
    }
  }, [newFeature, allGlobalFeatures, features]);


  const handleAddFeature = (featureToAdd?: string) => {
    const feature = (featureToAdd || newFeature).trim();
    if (feature && !features.includes(feature)) {
      form.setValue('features', [...features, feature], { shouldValidate: true });
      setNewFeature('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    const newFeatures = features.filter((_, index) => index !== indexToRemove);
    form.setValue('features', newFeatures);
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // only digits
    
    if (value === '') {
        setNewPlanPrice('');
        if (planInputErrors.price) {
            setPlanInputErrors(prev => ({...prev, price: undefined}));
        }
        return;
    }
    
    // remove leading zeros
    value = value.replace(/^0+/, '');

    const numberValue = Number(value);
    
    const formatted = new Intl.NumberFormat('es-CR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numberValue / 100);

    setNewPlanPrice(formatted);
    
    if (planInputErrors.price) {
        setPlanInputErrors(prev => ({...prev, price: undefined}));
    }
  };

  const handleSavePlan = () => {
    const durationNum = parseInt(newPlanDuration, 10);
    const priceNum = crcStringToNumber(newPlanPrice);

    const currentErrors: { name?: string; duration?: string; price?: string } = {};

    if (!newPlanName.trim()) {
      currentErrors.name = 'El nombre es requerido.';
    } else if (
      pricePlans.some((p, i) => p.name.toLowerCase() === newPlanName.trim().toLowerCase() && i !== editingPlanIndex)
    ) {
      currentErrors.name = 'El nombre del plan de precios ya existe.';
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      currentErrors.duration = 'Debe ser un número positivo.';
    }

    if (isNaN(priceNum) || priceNum < 0) {
      currentErrors.price = 'Debe ser un número no negativo.';
    }

    setPlanInputErrors(currentErrors);
    
    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    const newPlan = { name: newPlanName.trim(), duration: durationNum, unit: newPlanUnit, price: priceNum };
    
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
  };

  const handleEditPlan = (index: number) => {
    const plan = pricePlans[index];
    setEditingPlanIndex(index);
    setNewPlanName(plan.name);
    setNewPlanDuration(String(plan.duration));
    setNewPlanUnit(plan.unit);
    setNewPlanPrice(numberToCrcString(plan.price));
    setPlanInputErrors({});
  };

  const handleCancelEdit = () => {
    setEditingPlanIndex(null);
    setNewPlanName('');
    setNewPlanDuration('');
    setNewPlanPrice('');
    setNewPlanUnit('Hours');
    setPlanInputErrors({});
  };

  const handleRemovePlan = (indexToRemove: number) => {
    const newPlans = pricePlans.filter((_, index) => index !== indexToRemove);
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    startTransition(async () => {
      try {
        const dataToSave: Omit<RoomType, 'id' | 'code'> & { code?: string } = {
          name: values.name,
          features: values.features || [],
          pricePlans: values.pricePlans || [],
        };

        if (roomType?.id) {
          // Update
          const roomTypeRef = doc(firestore, 'roomTypes', roomType.id);
          await updateDoc(roomTypeRef, dataToSave as any);
        } else {
          // Create
          const roomTypesCollection = collection(firestore, 'roomTypes');
          const roomTypesSnapshot = await getDocs(roomTypesCollection);
          const existingCodes = roomTypesSnapshot.docs
            .map((doc) => parseInt(doc.data().code, 10))
            .filter((c) => !isNaN(c));

          const nextCodeNumber =
            existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
          
          dataToSave.code = String(nextCodeNumber).padStart(2, '0');

          await addDoc(collection(firestore, 'roomTypes'), dataToSave);
        }
        
        router.push('/settings/room-types');

      } catch (error: any) {
        console.error('Failed to save room type:', error);
        toast({
          title: 'Error al Guardar',
          description: error.message || 'Ocurrió un error inesperado. Es posible que no tenga permisos.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFeature();
    }
  };

  return (
    <Form {...form}>
       <form id="room-type-form" onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
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

                  <Separator />

                  <div className="space-y-4">
                      <FormLabel>Planes de Precios</FormLabel>
                      <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                        <div className="grid grid-cols-1 sm:grid-cols-10 gap-x-4 gap-y-2 items-start">
                          <div className="sm:col-span-4 space-y-2">
                              <Label htmlFor="plan-name" className={cn(planInputErrors.name && "text-destructive")}>Nombre</Label>
                              <Input
                                  id="plan-name"
                                  placeholder="p.ej. Tarifa Nocturna"
                                  value={newPlanName}
                                  onChange={(e) => {
                                    setNewPlanName(e.target.value);
                                    if(planInputErrors.name) setPlanInputErrors(p => ({...p, name: undefined}));
                                  }}
                                  className={cn(planInputErrors.name && "border-destructive focus-visible:ring-destructive")}
                              />
                              {planInputErrors.name && <p className="text-sm font-medium text-destructive">{planInputErrors.name}</p>}
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-duration" className={cn(planInputErrors.duration && "text-destructive")}>Duración</Label>
                            <Input
                                id="plan-duration"
                                type="number"
                                placeholder="8"
                                value={newPlanDuration}
                                onChange={(e) => {
                                  setNewPlanDuration(e.target.value);
                                  if(planInputErrors.duration) setPlanInputErrors(p => ({...p, duration: undefined}));
                                }}
                                className={cn("text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", planInputErrors.duration && "border-destructive focus-visible:ring-destructive")}
                            />
                            {planInputErrors.duration && <p className="text-sm font-medium text-destructive">{planInputErrors.duration}</p>}
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-unit">Unidad</Label>
                            <Select value={newPlanUnit} onValueChange={(value) => setNewPlanUnit(value as any)}>
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
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-price" className={cn(planInputErrors.price && "text-destructive")}>Precio (₡)</Label>
                            <Input
                                id="plan-price"
                                type="text"
                                inputMode='text'
                                placeholder="10.000,00"
                                value={newPlanPrice}
                                onChange={handlePriceChange}
                                className={cn("text-right", planInputErrors.price && "border-destructive focus-visible:ring-destructive")}
                            />
                             {planInputErrors.price && <p className="text-sm font-medium text-destructive">{planInputErrors.price}</p>}
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
                  </div>
              </div>
              <div className="md:col-span-1">
                  <div className="p-4 border rounded-lg bg-muted/30 sticky top-24">
                    <FormItem>
                        <FormLabel>Características</FormLabel>
                        <div className="relative">
                          <div className="flex items-center gap-2">
                              <Input
                                  placeholder="p.ej. Wi-Fi de alta velocidad"
                                  value={newFeature}
                                  onChange={(e) => setNewFeature(e.target.value)}
                                  onKeyDown={handleEnterKey}
                                  onFocus={() => setShowSuggestions(true)}
                                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                              />
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleAddFeature()}
                              >
                                  <Plus className="h-4 w-4" />
                                  <span className="sr-only">Añadir Característica</span>
                              </Button>
                          </div>
                          {showSuggestions && suggestions.length > 0 && (
                              <div className="absolute z-10 w-full bg-card border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                  {suggestions.map((suggestion) => {
                                      const isNew = !allGlobalFeatures.some(f => f.toLowerCase() === suggestion.toLowerCase());
                                      return (
                                          <div
                                              key={suggestion}
                                              className="px-3 py-2 text-sm cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                              onMouseDown={() => handleAddFeature(suggestion)}
                                          >
                                             {isNew ? (
                                                  <span className="flex items-center gap-2">
                                                      <Plus className="h-4 w-4" />
                                                      <span>Añadir: <span className="font-semibold text-foreground">"{suggestion}"</span></span>
                                                  </span>
                                             ) : (
                                                 <span className="text-foreground">{suggestion}</span>
                                             )}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
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
                  </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t p-6">
              <Button asChild variant="outline" type="button">
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
